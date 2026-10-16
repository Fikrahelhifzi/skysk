"""Uji paritas: kode ASLI notebook (Python) vs versi web (JavaScript).

Cara kerja:
1. Sel-sel logika notebook dijalankan dengan pygame tiruan (tanpa jendela) dan modul
   random tiruan yang memakai benih tetap (mulberry32, sama persis dengan js/rng.js).
2. Skenario yang sama (urutan tombol, dt, panggilan fungsi) dijalankan di Python dan
   di Node (js_runner.mjs).
3. Keadaan game dibandingkan di setiap frame: posisi, HP, peluru, musuh, boss, koin, dll.

Pemakaian:
    python tests/parity/run_parity.py --notebook sky_striker.ipynb
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import tempfile
import types
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOGIC_CELLS = (3, 5, 7, 9, 11, 13, 15, 17, 19)
MASK = 0xFFFFFFFF


# --------------------------------------------------------------------------- random tiruan
class SharedRandom:
    """Pengganti modul random. Rumusnya identik dengan objek R di js/rng.js."""

    def __init__(self, seed: int):
        self.a = seed & MASK

    def _next(self) -> float:
        self.a = (self.a + 0x6D2B79F5) & MASK
        a = self.a
        t = ((a ^ (a >> 15)) * (a | 1)) & MASK
        t = ((t + (((t ^ (t >> 7)) * (t | 61)) & MASK)) & MASK) ^ t
        return ((t ^ (t >> 14)) & MASK) / 4294967296

    def random(self):
        return self._next()

    def uniform(self, a, b):
        return a + (b - a) * self._next()

    def randint(self, a, b):
        return a + math.floor(self._next() * (b - a + 1))

    def choice(self, seq):
        return seq[math.floor(self._next() * len(seq))]

    def choices(self, population, weights):
        cum, acc = [], 0
        for w in weights:
            acc += w
            cum.append(acc)
        total = cum[-1] + 0.0
        x = self._next() * total
        lo, hi = 0, len(population) - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if x < cum[mid]:
                hi = mid
            else:
                lo = mid + 1
        return [population[lo]]


# --------------------------------------------------------------------------- pygame tiruan
class Rect:
    def __init__(self, x, y, w, h):
        self.x, self.y, self.w, self.h = int(x), int(y), int(w), int(h)

    width = property(lambda s: s.w)
    height = property(lambda s: s.h)

    def collidepoint(self, *args):
        px, py = args[0] if len(args) == 1 else args
        px, py = int(px), int(py)
        return self.x <= px < self.x + self.w and self.y <= py < self.y + self.h

    def colliderect(self, o):
        if self.w == 0 or self.h == 0 or o.w == 0 or o.h == 0:
            return False
        return (min(self.x, self.x + self.w) < max(o.x, o.x + o.w)
                and min(self.y, self.y + self.h) < max(o.y, o.y + o.h)
                and max(self.x, self.x + self.w) > min(o.x, o.x + o.w)
                and max(self.y, self.y + self.h) > min(o.y, o.y + o.h))


class Surface:
    def __init__(self, *a, **k):
        pass

    def __getattr__(self, name):
        return lambda *a, **k: None


KEY_NAMES = ["LEFT", "RIGHT", "UP", "DOWN", "SPACE", "RETURN", "KP_ENTER", "ESCAPE",
             "a", "d", "w", "s", "q", "e", "r", "f", "p", "m"]
CODE_TO_KEY = {"ArrowLeft": "LEFT", "ArrowRight": "RIGHT", "ArrowUp": "UP", "ArrowDown": "DOWN",
               "Space": "SPACE", "Enter": "RETURN", "NumpadEnter": "KP_ENTER", "Escape": "ESCAPE",
               "KeyA": "a", "KeyD": "d", "KeyW": "w", "KeyS": "s", "KeyQ": "q", "KeyE": "e",
               "KeyR": "r", "KeyF": "f", "KeyP": "p", "KeyM": "m"}


class Held:
    def __init__(self):
        self.keys = set()

    def __getitem__(self, k):
        return k in self.keys


def make_pygame(held: Held):
    pg = types.ModuleType("pygame")
    for i, name in enumerate(KEY_NAMES):
        setattr(pg, "K_" + name, 1000 + i)
    pg.Rect, pg.Surface = Rect, Surface
    pg.KEYDOWN, pg.MOUSEMOTION, pg.MOUSEBUTTONDOWN, pg.QUIT = 768, 1024, 1025, 256
    pg.SRCALPHA, pg.BLEND_ADD = 65536, 1
    noop = lambda *a, **k: None  # noqa: E731
    pg.draw = types.SimpleNamespace(line=noop, circle=noop, polygon=noop, rect=noop, ellipse=noop)
    pg.key = types.SimpleNamespace(get_pressed=lambda: held)
    return pg


def load_game(notebook: Path, seed: int, world):
    nb = json.loads(notebook.read_text(encoding="utf-8"))
    cells = nb["cells"]
    for i in LOGIC_CELLS:
        if cells[i]["cell_type"] != "code":
            raise SystemExit(f"Sel {i} bukan sel kode. Apakah ini notebook sky_striker yang sama?")
    held = Held()
    rnd = SharedRandom(seed)
    pg = make_pygame(held)
    g = {"__name__": "sky_striker_reference"}
    sys.modules["pygame"] = pg
    sys.modules["random"] = rnd  # import random di sel 0 tidak dieksekusi; isi namespace langsung
    g.update({"pygame": pg, "random": rnd, "math": math})
    for i in LOGIC_CELLS:
        exec(compile("".join(cells[i]["source"]), f"<cell {i}>", "exec"), g)
    g["screen_width"], g["screen_height"] = world
    return g, held


# --------------------------------------------------------------------------- skenario
DT_CYCLE = [1 / 60, 1 / 60, 0.016, 0.0175, 1 / 60, 0.02, 1 / 60, 0.0333, 1 / 60, 0.05]


def frames(count, start, movement="weave", fire=True, periodic=()):
    out = []
    for k in range(count):
        n = start + k
        keys = []
        if movement == "weave":
            phase = (n // 40) % 4
            keys += [["left"], ["right", "up"], ["right"], ["left", "down"]][phase]
        elif movement == "dodge":
            phase = (n // 25) % 6
            keys += [["left"], ["left", "up"], ["right"], ["right", "down"], ["up"], ["down"]][phase]
        if fire:
            keys.append("fire")
        events = [code for every, offset, code in periodic if n % every == offset]
        out.append({"dt": DT_CYCLE[n % len(DT_CYCLE)], "keys": keys, "events": events})
    return out


ABILITIES = [(700, 100, "KeyQ"), (480, 200, "KeyE"), (900, 350, "KeyR"), (1300, 600, "KeyF")]


def scenarios():
    s = []
    flow = ABILITIES + [(150, 75, "Enter"), (2000, 1000, "KeyS"), (230, 1110, "Escape"), (3000, 2900, "KeyM"), (610, 400, "KeyR")]
    s.append({"name": "kampanye level 1+", "seed": 11, "world": [1100, 720], "steps": [
        {"op": "call", "fn": "start_campaign"},
        {"op": "frames", "frames": frames(9000, 0, "weave", True, flow)},
    ]})
    boss = []
    for level in (5, 10, 15, 20):
        boss.append({"op": "set", "path": ["player", "lives"], "value": 5})
        boss.append({"op": "call", "fn": "begin_level", "args": [level]})
        boss.append({"op": "frames", "frames": frames(3600 if level == 20 else 2400, level * 1000, "dodge", True,
                                                         ABILITIES + [(200, 150, "Enter")])})
    s.append({"name": "4 boss dengan Titan X", "seed": 22, "world": [1100, 720], "steps": [
        {"op": "set", "path": ["coins"], "value": 3000},
        {"op": "push", "path": ["owned"], "value": "Titan X"},
        {"op": "call", "fn": "equip_plane", "args": ["Titan X"]},
    ] + boss})
    s.append({"name": "potret 720x1100 level 12-13", "seed": 33, "world": [720, 1100], "steps": [
        {"op": "push", "path": ["owned"], "value": "Phoenix"},
        {"op": "call", "fn": "equip_plane", "args": ["Phoenix"]},
        {"op": "call", "fn": "begin_level", "args": [12]},
        {"op": "frames", "frames": frames(3000, 0, "weave", True, ABILITIES + [(160, 90, "Enter"), (500, 250, "KeyR")])},
        {"op": "call", "fn": "begin_level", "args": [13]},
        {"op": "frames", "frames": frames(2000, 3000, "dodge", True, ABILITIES)},
    ]})
    shop_keys = ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowDown", "Enter", "ArrowUp", "Enter", "ArrowLeft",
                 "Enter", "ArrowDown", "ArrowRight", "Enter", "Space", "Escape"]
    shop = [{"op": "set", "path": ["coins"], "value": 1700}, {"op": "call", "fn": "open_shop", "args": ["menu"]}]
    for i in range(8):
        shop.append({"op": "call", "fn": "shop_select", "args": [i]})
        shop.append({"op": "call", "fn": "open_shop", "args": ["menu"]})
    shop.append({"op": "frames", "frames": [{"dt": 1 / 60, "keys": [], "events": [k]} for k in shop_keys]})
    shop.append({"op": "call", "fn": "start_campaign"})
    shop.append({"op": "frames", "frames": frames(900, 0, "weave", True, ABILITIES)})
    s.append({"name": "hangar/shop", "seed": 44, "world": [1100, 720], "steps": shop})
    s.append({"name": "game over & menu", "seed": 55, "world": [1100, 720], "steps": [
        {"op": "set", "path": ["player", "lives"], "value": 1},
        {"op": "call", "fn": "begin_level", "args": [15]},
        {"op": "frames", "frames": frames(2600, 0, "none", False,
                                          [(700, 650, "KeyS"), (700, 690, "Escape"), (900, 880, "KeyR"), (1300, 1250, "KeyM"),
                                           (1300, 1270, "Enter"), (400, 330, "KeyP"), (400, 360, "KeyP")])},
    ]})
    return s


# --------------------------------------------------------------------------- snapshot & perbandingan
def plain(v):
    if isinstance(v, dict):
        return {k: plain(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [plain(x) for x in v]
    return v


def summary(game):
    out = {}
    for k, v in game.items():
        if k == "background":
            continue
        if k == "particles":
            out[k] = {"n": len(v), "x": sum(p["x"] for p in v), "y": sum(p["y"] for p in v),
                      "life": sum(p["life"] for p in v), "size": sum(p["size"] for p in v)}
        elif k == "stars":
            out[k] = {"n": len(v), "x": sum(p["x"] for p in v), "y": sum(p["y"] for p in v)}
        else:
            out[k] = plain(v)
    return out


class Stats:
    numbers = 0
    max_rel = 0.0


def compare(py, js, path, problems, stats):
    if len(problems) >= 8:
        return
    if isinstance(py, bool) or isinstance(js, bool) or py is None or js is None or isinstance(py, str):
        if py != js:
            problems.append(f"{path}: Python={py!r} JS={js!r}")
        return
    if isinstance(py, (int, float)) and isinstance(js, (int, float)):
        stats.numbers += 1
        rel = abs(py - js) / max(1.0, abs(py), abs(js))
        stats.max_rel = max(stats.max_rel, rel)
        if rel > 1e-9:
            problems.append(f"{path}: Python={py!r} JS={js!r}")
        return
    if isinstance(py, dict) and isinstance(js, dict):
        for k in py:
            if k not in js:
                problems.append(f"{path}.{k}: tidak ada di JS")
            else:
                compare(py[k], js[k], f"{path}.{k}", problems, stats)
        return
    if isinstance(py, list) and isinstance(js, list):
        if len(py) != len(js):
            problems.append(f"{path}: panjang list Python={len(py)} JS={len(js)}")
            return
        for i, (a, b) in enumerate(zip(py, js)):
            compare(a, b, f"{path}[{i}]", problems, stats)
        return
    problems.append(f"{path}: tipe berbeda Python={type(py).__name__} JS={type(js).__name__}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--notebook", required=True, type=Path)
    ap.add_argument("--node", default="node")
    args = ap.parse_args()

    scs = scenarios()
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(scs, f)
        scenario_file = f.name
    js = subprocess.Popen([args.node, str(HERE / "js_runner.mjs"), scenario_file], stdout=subprocess.PIPE, text=True,
                          bufsize=1 << 20)
    failed = False
    coverage = {"states": set(), "max_level": 0, "bosses_beaten": 0, "victory": False, "planes": set(), "events": set()}
    for sc in scs:
        stats = Stats()
        g, held = load_game(args.notebook, sc["seed"], sc["world"])
        game = g["new_game"]()

        def check(frame_no):
            line = json.loads(js.stdout.readline())
            problems = []
            compare(summary(game), line["game"], "game", problems, stats)
            if problems:
                print(f"  BEDA di frame {frame_no}:\n    " + "\n    ".join(problems))
            coverage["states"].add(game["state"])
            coverage["max_level"] = max(coverage["max_level"], game["level"])
            coverage["victory"] |= game["state"] == "victory"
            coverage["planes"].add(game["player"]["plane"])
            return not problems

        ok = check(-1)
        frame_no, quit_ = 0, False
        for step in sc["steps"]:
            if not ok or quit_:
                break
            if step["op"] == "call":
                g[step["fn"]](game, *step.get("args", []))
            elif step["op"] == "set":
                obj = game
                for key in step["path"][:-1]:
                    obj = obj[key]
                obj[step["path"][-1]] = step["value"]
            elif step["op"] == "push":
                game[step["path"][0]].append(step["value"])
            elif step["op"] == "frames":
                for fr in step["frames"]:
                    for code in fr["events"]:
                        ev = types.SimpleNamespace(type=768, key=getattr(g["pygame"], "K_" + CODE_TO_KEY[code]))
                        coverage["events"].add(code)
                        if g["handle_event"](game, ev) == "quit":
                            quit_ = True
                    if quit_:
                        break
                    names = {"left": "K_LEFT", "right": "K_RIGHT", "up": "K_UP", "down": "K_DOWN", "fire": "K_SPACE"}
                    held.keys = {getattr(g["pygame"], names[k]) for k in fr["keys"]}
                    before = game["boss"]
                    g["update_game"](game, fr["dt"])
                    if before is not None and game["boss"] is None and game["state"] == "playing":
                        coverage["bosses_beaten"] += 1
                    shake = int(game["shake"])
                    if shake > 0:
                        g["random"].randint(-shake, shake)
                        g["random"].randint(-shake, shake)
                    if not check(frame_no):
                        ok = False
                        break
                    frame_no += 1
        # sinkronkan aliran JS sampai akhir skenario
        while True:
            line = js.stdout.readline()
            if not line or json.loads(line).get("end"):
                break
        status = "IDENTIK" if ok else "BERBEDA"
        print(f"[{sc['name']}] {frame_no} frame, {stats.numbers:,} angka dibandingkan, "
              f"selisih relatif maks {stats.max_rel:.1e}: {status}")
        failed |= not ok
    js.wait()
    print("\nCakupan:", {k: (sorted(v) if isinstance(v, set) else v) for k, v in coverage.items()})
    print("\nHASIL:", "ADA PERBEDAAN" if failed else "PARITAS OK")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
