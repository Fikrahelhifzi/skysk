/*
 * main.js — game loop (pengganti run_game), tata letak layar HP, kontrol sentuh &
 * keyboard, penyimpanan progres, dan PWA.
 */
import * as P from "./params.js";
import * as L from "./logic.js";
import { draw_frame } from "./render.js";
import { UI } from "./ui.js";

export const APP_VERSION = "1.0.0";
const SAVE_KEY = "skystriker.save.v1";
const SETTINGS_KEY = "skystriker.settings.v1";
const ARENA = new Set(["level_intro", "playing", "paused", "level_complete", "game_over"]);
const params = new URLSearchParams(location.search);

/* ------------------------------------------------------------------ */
/* Simpan & muat                                                       */
/* ------------------------------------------------------------------ */
function read_json(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function write_json(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* mode privat: abaikan */ }
}

const coarse = window.matchMedia ? window.matchMedia("(pointer: coarse)").matches : false;
const settings = {
  auto_fire: coarse,
  sensitivity: P.touch_sensitivity_default,
  vibrate: true,
  ...read_json(SETTINGS_KEY, {}),
};
let save = { coins: P.coins, owned: ["Falcon"], plane: "Falcon", checkpoint: P.start_level, completed: false, ...read_json(SAVE_KEY, {}) };

/* ------------------------------------------------------------------ */
/* Ukuran dunia & tata letak                                           */
/* ------------------------------------------------------------------ */
const app = document.getElementById("app");
const canvas = document.getElementById("screen");
const ctx2d = canvas.getContext("2d", { alpha: false });
const stage_el = document.getElementById("stage");
const abilities_el = document.getElementById("abilities");
const hint_el = document.getElementById("touch-hint");
let touch_mode = coarse || params.has("touch");
let view = null;

function desired_world() {
  return window.innerHeight > window.innerWidth ? P.world_portrait : P.world_landscape;
}

function safe_insets() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:env(safe-area-inset-top);right:env(safe-area-inset-right);bottom:env(safe-area-inset-bottom);left:env(safe-area-inset-left);pointer-events:none;visibility:hidden";
  document.body.append(probe);
  const cs = getComputedStyle(probe);
  const out = { t: parseFloat(cs.top) || 0, r: parseFloat(cs.right) || 0, b: parseFloat(cs.bottom) || 0, l: parseFloat(cs.left) || 0 };
  probe.remove();
  return out;
}

/** Ukuran dunia hanya boleh berganti saat tidak sedang bertanding (menu, hangar dari menu, menang). */
function world_change_allowed() {
  const s = game.state;
  return s === "menu" || s === "victory" || (s === "shop" && game.shop_return === "menu");
}

function apply_world(force_new_scenery) {
  const want = desired_world();
  if (want.width === L.dims.W && want.height === L.dims.H && !force_new_scenery) return false;
  L.set_world_size(want.width, want.height);
  game.stars = L.make_stars(150);
  game.background = L.make_background(game.level);
  return true;
}

function layout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const safe = safe_insets();
  const W = L.dims.W;
  const H = L.dims.H;
  const portrait_world = H > W;
  const GAP = 10;
  const reserve = touch_mode && portrait_world ? 92 : 0; // area kontrol di bawah arena (HP berdiri)
  const avail_w = vw - safe.l - safe.r;
  const avail_h = vh - safe.t - safe.b - reserve;
  const scale = Math.max(0.1, Math.min(avail_w / W, avail_h / H));
  const stage = { w: W * scale, h: H * scale, scale };
  const spare_w = avail_w - stage.w;
  // HP mendatar: arena ke kiri, sisa lebar di kanan untuk tombol ability (jempol kanan).
  const side_panel = touch_mode && !portrait_world && spare_w >= 2 * 48 + GAP + 24;
  stage.x = side_panel ? safe.l : safe.l + spare_w / 2;
  // HP berdiri: arena dinaikkan supaya area jempol di bawah lebih lega.
  stage.y = safe.t + (reserve ? Math.min(8, (avail_h - stage.h) / 2) : (avail_h - stage.h) / 2);

  canvas.width = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);
  Object.assign(stage_el.style, { left: `${stage.x}px`, top: `${stage.y}px`, width: `${stage.w}px`, height: `${stage.h}px` });
  const ui_scale = Math.min(1, Math.max(0.62, scale * 1.15));
  stage_el.style.setProperty("--ui", ui_scale.toFixed(3));
  stage_el.classList.toggle("narrow", stage.w < 640);
  // Bar musuh/boss dipindah ke luar arena bila ada ruang (bawah saat berdiri, kanan saat mendatar).
  const deck = touch_mode && portrait_world;
  stage_el.classList.toggle("deck", deck);
  stage_el.classList.toggle("side", side_panel);
  stage_el.style.setProperty("--side-w", `${Math.max(0, vw - safe.r - (stage.x + stage.w))}px`);
  app.classList.toggle("touch", touch_mode);

  // Tombol ability
  abilities_el.className = "abilities";
  const a = abilities_el.style;
  a.left = a.top = a.right = a.bottom = a.transform = "";
  hint_el.hidden = true;
  a.gap = `${GAP}px`;
  if (touch_mode && portrait_world) {
    // HP berdiri: ability rapat di kiri bawah, sisi kanan bebas untuk menggeser jari.
    const bar_h = 52; // bar musuh/boss di bagian atas area kontrol
    const region_top = stage.y + stage.h + bar_h;
    const region_h = Math.max(48, vh - safe.b - region_top);
    const size = Math.max(44, Math.min(60, region_h - 16, (avail_w * 0.66 - 3 * GAP) / 4));
    abilities_el.classList.add("row");
    a.setProperty("--size", `${size}px`);
    a.left = `${safe.l + 12}px`;
    a.top = `${region_top + (region_h - size) / 2}px`;
    const hint_left = safe.l + 12 + 4 * size + 3 * GAP + 10;
    Object.assign(hint_el.style, { left: `${hint_left}px`, width: `${Math.max(60, vw - safe.r - 8 - hint_left)}px`, top: `${region_top + region_h / 2 - 18}px` });
  } else if (side_panel) {
    // HP mendatar: 2x2 tombol di panel kanan.
    const side_left = stage.x + stage.w;
    const side_w = vw - safe.r - side_left;
    const size = Math.max(48, Math.min(64, (side_w - GAP - 24) / 2));
    abilities_el.classList.add("grid2");
    a.setProperty("--size", `${size}px`);
    a.left = `${side_left + (side_w - (2 * size + GAP)) / 2}px`;
    a.top = `${stage.y + stage.h - (2 * size + GAP) - 14}px`;
    Object.assign(hint_el.style, { left: `${side_left + 8}px`, width: `${side_w - 16}px`, top: `${stage.y + stage.h * 0.4}px` });
  } else {
    // Laptop (dan tablet tanpa sisa ruang): di dalam arena kiri bawah, seperti HUD notebook.
    const size = Math.max(touch_mode ? 52 : 40, Math.min(64, 64 * scale));
    abilities_el.classList.add("row");
    a.setProperty("--size", `${size}px`);
    a.left = `${stage.x + 16 * Math.max(scale, 0.75)}px`;
    a.top = `${stage.y + stage.h - size - 14 * Math.max(scale, 0.75)}px`;
    Object.assign(hint_el.style, { left: `${stage.x}px`, width: `${stage.w}px`, top: `${stage.y + stage.h * 0.62}px` });
  }
  view = { vw, vh, dpr, stage, W, H, ui_scale };
}

/* ------------------------------------------------------------------ */
/* Game                                                                */
/* ------------------------------------------------------------------ */
L.set_world_size(desired_world().width, desired_world().height);
const game = L.new_game();
apply_save_to_game();

function apply_save_to_game() {
  game.coins = Number.isFinite(save.coins) ? save.coins : P.coins;
  const owned = Array.isArray(save.owned) ? save.owned.filter((n) => n in P.planes) : [];
  game.owned = owned.includes("Falcon") ? owned : ["Falcon", ...owned];
  const plane = game.owned.includes(save.plane) ? save.plane : "Falcon";
  game.player = L.create_player(plane);
}

function snapshot_save() {
  return { coins: game.coins, owned: [...game.owned], plane: game.player.plane, checkpoint: save.checkpoint, completed: save.completed };
}
let last_saved = "";
function persist(force = false) {
  save = snapshot_save();
  const s = JSON.stringify(save);
  if (force || s !== last_saved) {
    write_json(SAVE_KEY, save);
    last_saved = s;
  }
}

L.hooks.before_level = (_game, level) => {
  apply_world(false);
  layout();
  save.checkpoint = level;
  persist(true);
};

const input = { keys: { left: false, right: false, up: false, down: false, fire: false }, drag: null, auto_fire: settings.auto_fire };

/* ------------------------------------------------------------------ */
/* Aksi dari tombol                                                    */
/* ------------------------------------------------------------------ */
const ui = new UI({
  ability(name) {
    if (game.state === "playing") L.use_ability(game, name);
  },
  pause() {
    if (game.state === "playing" || game.state === "level_intro") game.state = "paused";
  },
  key(code) { handle_code(code); },
  menu(what) {
    if (what === "start") L.start_campaign(game);
    else if (what === "continue") L.continue_campaign(game, save.checkpoint);
    else if (what === "shop") L.open_shop(game, "menu");
    else if (what === "settings") open_settings();
  },
  shop_hover(index) { game.shop_index = index; ui.keyboard_nav = false; },
  shop_select(index) {
    game.shop_index = index;
    L.shop_select(game, index);
    persist();
  },
  open_settings() { open_settings(); },
  close_settings() { ui.settings_open = false; },
});

function open_settings() {
  ui.settings_open = true;
  document.getElementById("set-auto-fire").checked = settings.auto_fire;
  document.getElementById("set-sensitivity").value = String(settings.sensitivity);
  document.getElementById("sens-value").textContent = `${settings.sensitivity.toFixed(1)}×`;
  document.getElementById("set-vibrate").checked = settings.vibrate;
  document.getElementById("row-vibrate").hidden = !("vibrate" in navigator);
  document.getElementById("btn-fullscreen").hidden = !document.fullscreenEnabled;
  document.getElementById("app-version").textContent = `Versi ${APP_VERSION}`;
}

function save_settings() {
  write_json(SETTINGS_KEY, settings);
  input.auto_fire = settings.auto_fire;
}
document.getElementById("set-auto-fire").addEventListener("change", (e) => { settings.auto_fire = e.target.checked; save_settings(); });
document.getElementById("set-vibrate").addEventListener("change", (e) => { settings.vibrate = e.target.checked; save_settings(); });
document.getElementById("set-sensitivity").addEventListener("input", (e) => {
  settings.sensitivity = Number(e.target.value);
  document.getElementById("sens-value").textContent = `${settings.sensitivity.toFixed(1)}×`;
  save_settings();
});
document.getElementById("btn-fullscreen").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
});
document.getElementById("btn-reset").addEventListener("click", () => {
  if (!window.confirm("Hapus semua koin, pesawat, dan level tersimpan?")) return;
  save = { coins: P.coins, owned: ["Falcon"], plane: "Falcon", checkpoint: P.start_level, completed: false };
  write_json(SAVE_KEY, save);
  apply_save_to_game();
  game.state = "menu";
  ui.settings_open = false;
  ui.state = null;
});

/* ------------------------------------------------------------------ */
/* Keyboard                                                            */
/* ------------------------------------------------------------------ */
const HOLD = {
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", Space: "fire",
};

function handle_code(code) {
  if (ui.settings_open) {
    if (code === "Escape") ui.settings_open = false;
    return;
  }
  if (game.state === "menu") ui.menu_key(code);
  else if (game.state === "shop") { ui.keyboard_nav = true; L.handle_shop_key(game, code); persist(); }
  else L.handle_key(game, code);
}

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (HOLD[e.code]) input.keys[HOLD[e.code]] = true;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
  if (!e.repeat) handle_code(e.code);
});
window.addEventListener("keyup", (e) => { if (HOLD[e.code]) input.keys[HOLD[e.code]] = false; });
window.addEventListener("blur", () => { for (const k of Object.keys(input.keys)) input.keys[k] = false; });

/* ------------------------------------------------------------------ */
/* Sentuhan: geser jari di mana saja                                   */
/* ------------------------------------------------------------------ */
let drag_pointer = null;
let hint_seen = false;
app.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch" && !touch_mode) { touch_mode = true; if (!read_json(SETTINGS_KEY, null)) { settings.auto_fire = true; input.auto_fire = true; } layout(); ui.state = null; }
  if (drag_pointer !== null || !ARENA.has(game.state) || e.target.closest("button, .screen, .overlay, input")) return;
  drag_pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
  input.drag = { dx: 0, dy: 0 };
  try { app.setPointerCapture(e.pointerId); } catch { /* abaikan */ }
});
app.addEventListener("pointermove", (e) => {
  if (!drag_pointer || e.pointerId !== drag_pointer.id) return;
  const k = settings.sensitivity / view.stage.scale;
  if (input.drag) {
    input.drag.dx += (e.clientX - drag_pointer.x) * k;
    input.drag.dy += (e.clientY - drag_pointer.y) * k;
  }
  drag_pointer.x = e.clientX;
  drag_pointer.y = e.clientY;
  if (game.state === "playing") hint_seen = true;
});
function end_drag(e) {
  if (!drag_pointer || e.pointerId !== drag_pointer.id) return;
  drag_pointer = null;
  input.drag = null;
}
app.addEventListener("pointerup", end_drag);
app.addEventListener("pointercancel", end_drag);
document.addEventListener("gesturestart", (e) => e.preventDefault());

/* ------------------------------------------------------------------ */
/* Efek HP: getar, layar tetap menyala, jeda otomatis                  */
/* ------------------------------------------------------------------ */
function handle_fx() {
  if (!game.fx.length) return;
  if (settings.vibrate && navigator.vibrate) {
    if (game.fx.includes("life_lost")) navigator.vibrate([60, 40, 60]);
    else if (game.fx.includes("boss_defeated")) navigator.vibrate(150);
    else if (game.fx.includes("player_hit")) navigator.vibrate(25);
  }
  game.fx.length = 0;
}

let wake_lock = null;
async function update_wake_lock(active) {
  try {
    if (active && !wake_lock && "wakeLock" in navigator && document.visibilityState === "visible") {
      wake_lock = await navigator.wakeLock.request("screen");
      wake_lock.addEventListener("release", () => { wake_lock = null; });
    } else if (!active && wake_lock) {
      await wake_lock.release();
      wake_lock = null;
    }
  } catch { wake_lock = null; }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    if (game.state === "playing") game.state = "paused";
    for (const k of Object.keys(input.keys)) input.keys[k] = false;
    input.drag = null;
    drag_pointer = null;
    persist(true);
  }
});
window.addEventListener("pagehide", () => persist(true));

/* ------------------------------------------------------------------ */
/* Loop utama (pengganti run_game)                                     */
/* ------------------------------------------------------------------ */
let last_time = null;
let last_state = null;
let fps_frames = 0;
let fps_since = performance.now();
let measured_fps = 0;
const min_frame_ms = 1000 / P.fps - 2; // layar 120 Hz tetap diproses ~60x/detik seperti notebook

function frame(now) {
  requestAnimationFrame(frame);
  if (last_time !== null && now - last_time < min_frame_ms) return;
  const dt = last_time === null ? 1 / P.fps : Math.min((now - last_time) / 1000, 0.05);
  last_time = now;

  if (world_change_allowed() && apply_world(false)) layout();
  if (input.drag && game.state !== "playing") { input.drag.dx = 0; input.drag.dy = 0; }

  L.update_game(game, input, dt);
  handle_fx();
  const shake = L.shake_offsets(game);
  draw_frame(ctx2d, game, view, shake);
  ui.sync(game, { touch: touch_mode, save, ui_scale: view.ui_scale });
  hint_el.hidden = !(touch_mode && game.state === "playing" && !hint_seen);

  if (game.state !== last_state) {
    if (["level_complete", "game_over", "menu", "shop"].includes(game.state)) persist();
    if (game.state === "victory") { save.checkpoint = P.start_level; save.completed = true; persist(true); }
    update_wake_lock(game.state === "playing" || game.state === "level_intro");
    last_state = game.state;
  }
  fps_frames += 1;
  if (now - fps_since > 1000) { measured_fps = (fps_frames * 1000) / (now - fps_since); fps_frames = 0; fps_since = now; }
}

window.addEventListener("resize", () => { layout(); ui.state = null; });
if (window.visualViewport) window.visualViewport.addEventListener("resize", () => layout());
layout();
persist(true);
requestAnimationFrame(frame);

if ("serviceWorker" in navigator && window.isSecureContext && !params.has("nosw")) {
  navigator.serviceWorker.register("./sw.js").catch((err) => console.warn("Service worker:", err));
}

// Untuk debugging di konsol browser (dan uji otomatis).
window.skyStriker = { game, L, settings, input, get view() { return view; }, get fps() { return measured_fps; }, persist };
