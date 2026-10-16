/*
 * Menjalankan skenario uji memakai logic.js dan menulis keadaan game per frame
 * (satu baris JSON per frame) ke stdout. Dipanggil oleh run_parity.py.
 */
import { readFileSync } from "node:fs";
import * as L from "../../js/logic.js";
import { R } from "../../js/rng.js";

const scenarios = JSON.parse(readFileSync(process.argv[2], "utf-8"));

/** Meniru handle_menu_event (keyboard) dari notebook: 3 tombol START / SHOP / QUIT. */
function py_menu_key(game, code) {
  if (code === "ArrowUp" || code === "KeyW") game.menu_index = L.py_mod(game.menu_index - 1, 3);
  else if (code === "ArrowDown" || code === "KeyS") game.menu_index = L.py_mod(game.menu_index + 1, 3);
  else if (code === "Enter" || code === "NumpadEnter") {
    if (game.menu_index === 0) L.start_campaign(game);
    else if (game.menu_index === 1) L.open_shop(game, "menu");
    else return "quit";
  } else if (code === "Escape") return "quit";
  return undefined;
}

function summary(game) {
  const sum = (list, key) => list.reduce((s, p) => s + p[key], 0);
  const g = {};
  for (const [k, v] of Object.entries(game)) {
    if (k === "background" || k === "fx") continue;
    if (k === "particles") g[k] = { n: v.length, x: sum(v, "x"), y: sum(v, "y"), life: sum(v, "life"), size: sum(v, "size") };
    else if (k === "stars") g[k] = { n: v.length, x: sum(v, "x"), y: sum(v, "y") };
    else g[k] = v;
  }
  return g;
}

const write = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");

for (const sc of scenarios) {
  R.seed(sc.seed);
  L.set_world_size(sc.world[0], sc.world[1]);
  const game = L.new_game();
  let frame = 0;
  let quit = false;
  write({ scenario: sc.name, frame: -1, game: summary(game) });
  for (const step of sc.steps) {
    if (quit) break;
    if (step.op === "call") {
      L[step.fn](game, ...(step.args || []));
    } else if (step.op === "set") {
      let obj = game;
      for (const key of step.path.slice(0, -1)) obj = obj[key];
      obj[step.path[step.path.length - 1]] = step.value;
    } else if (step.op === "push") {
      game[step.path[0]].push(step.value);
    } else if (step.op === "frames") {
      for (const f of step.frames) {
        for (const code of f.events) {
          const result = game.state === "menu" ? py_menu_key(game, code) : L.handle_key(game, code);
          if (result === "quit") quit = true;
        }
        if (quit) break;
        const keys = { left: f.keys.includes("left"), right: f.keys.includes("right"), up: f.keys.includes("up"), down: f.keys.includes("down"), fire: f.keys.includes("fire") };
        L.update_game(game, { keys, drag: null, auto_fire: false }, f.dt);
        L.shake_offsets(game);
        write({ scenario: sc.name, frame, game: summary(game) });
        frame += 1;
      }
    }
  }
  write({ scenario: sc.name, end: true });
}
