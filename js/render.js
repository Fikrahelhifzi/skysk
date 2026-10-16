/*
 * render.js — menggambar dunia game di <canvas>, port dari fungsi gambar notebook
 * (cell 7 bagian gambar, cell 15). pygame.draw.* diganti Canvas 2D; BLEND_ADD diganti
 * globalCompositeOperation "lighter". Angka acak di sini hanya untuk efek visual.
 */
import * as P from "./params.js";
import { shade, mix_color, clamp } from "./logic.js";

export const FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const css = (c, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
const vrand = (a, b) => a + (b - a) * Math.random();

/* ------------------------------------------------------------------ */
/* Bentuk dasar (pengganti pygame.draw)                                */
/* ------------------------------------------------------------------ */
function path(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
export function polygon(ctx, color, pts, width = 0) {
  path(ctx, pts);
  if (width) { ctx.strokeStyle = css(color); ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.stroke(); }
  else { ctx.fillStyle = css(color); ctx.fill(); }
}
export function circle(ctx, color, x, y, r, width = 0, alpha = 1) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  if (width) { ctx.strokeStyle = css(color, alpha); ctx.lineWidth = width; ctx.stroke(); }
  else { ctx.fillStyle = css(color, alpha); ctx.fill(); }
}
export function line(ctx, color, x1, y1, x2, y2, width) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = css(color);
  ctx.lineWidth = width;
  ctx.lineCap = "butt";
  ctx.stroke();
}
export function rect(ctx, color, x, y, w, h, width = 0, radius = 0) {
  ctx.beginPath();
  if (radius && ctx.roundRect) ctx.roundRect(x, y, w, h, radius);
  else ctx.rect(x, y, w, h);
  if (width) { ctx.strokeStyle = css(color); ctx.lineWidth = width; ctx.stroke(); }
  else { ctx.fillStyle = css(color); ctx.fill(); }
}
function ellipse(ctx, color, x, y, w, h) {
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, Math.max(0.5, w / 2), Math.max(0.5, h / 2), 0, 0, Math.PI * 2);
  ctx.fillStyle = css(color);
  ctx.fill();
}
export function text(ctx, str, size, color, x, y, align = "center", shadow = true, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (shadow) { ctx.fillStyle = "rgb(0,0,0)"; ctx.fillText(str, x + 2, y + 2); }
  ctx.fillStyle = css(color);
  ctx.fillText(str, x, y);
}

/* ------------------------------------------------------------------ */
/* Cahaya (get_glow / draw_glow)                                       */
/* ------------------------------------------------------------------ */
const glow_cache = new Map();
function get_glow(color, radius) {
  const key = `${color[0]},${color[1]},${color[2]}|${radius}`;
  let glow = glow_cache.get(key);
  if (!glow) {
    glow = document.createElement("canvas");
    glow.width = glow.height = radius * 2;
    const g = glow.getContext("2d");
    const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
    // Notebook: warna x (1 - r/R)^2 ditambahkan (BLEND_ADD). Di canvas: warna dengan
    // alpha = kekuatan, digambar dengan "lighter" -> hasil sama, tanpa kotak hitam.
    for (let i = 0; i <= 8; i++) {
      const f = i / 8;
      grad.addColorStop(f, css(color, (1 - f) ** 2));
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, radius * 2, radius * 2);
    if (glow_cache.size > 400) glow_cache.delete(glow_cache.keys().next().value);
    glow_cache.set(key, glow);
  }
  return glow;
}
export function draw_glow(ctx, color, x, y, radius) {
  radius = Math.max(2, Math.trunc(radius));
  const glow = get_glow(color, radius);
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(glow, Math.trunc(x) - radius, Math.trunc(y) - radius);
  ctx.globalCompositeOperation = op;
}

/* ------------------------------------------------------------------ */
/* Latar & bintang                                                     */
/* ------------------------------------------------------------------ */
let bg_canvas = null;
let bg_id = -1;
function background_image(spec) {
  if (bg_id === spec.id && bg_canvas) return bg_canvas;
  bg_canvas = document.createElement("canvas");
  bg_canvas.width = spec.width;
  bg_canvas.height = spec.height;
  const g = bg_canvas.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, spec.height);
  grad.addColorStop(0, css(spec.top));
  grad.addColorStop(1, css(spec.bottom));
  g.fillStyle = grad;
  g.fillRect(0, 0, spec.width, spec.height);
  for (const n of spec.nebulae) draw_glow(g, shade(spec.bottom, 0.5), n.x, n.y, 260);
  bg_id = spec.id;
  return bg_canvas;
}

function draw_stars(ctx, stars) {
  for (const star of stars) {
    const light = star.light;
    circle(ctx, [light, light, Math.min(255, light + 30)], star.x, star.y, star.size);
  }
}

function draw_particles(ctx, particles) {
  for (const p of particles) {
    const t = p.life / p.max_life;
    circle(ctx, shade(p.color, 0.3 + 0.7 * t), p.x, p.y, Math.max(1, Math.trunc(p.size * t + 0.5)));
  }
}

function draw_popups(ctx, popups) {
  for (const p of popups) {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    text(ctx, p.text, 20, p.color, p.x, p.y, "center", false);
  }
  ctx.globalAlpha = 1;
}

function draw_rings(ctx, rings) {
  for (const ring of rings) {
    const t = 1 - ring.radius / ring.max_radius;
    const width = Math.max(1, Math.trunc(8 * t));
    circle(ctx, shade(ring.color, 0.4 + 0.6 * t), ring.x, ring.y, Math.trunc(ring.radius), width);
  }
}

/* ------------------------------------------------------------------ */
/* Pesawat, musuh, boss, peluru (cell 15)                              */
/* ------------------------------------------------------------------ */
export function draw_player_plane(ctx, x, y, plane_name, scale = 1.0, tilt = 0.0, flash = false) {
  const plane = P.planes[plane_name];
  const s = scale;
  let body = plane.Color;
  const accent = plane.Accent;
  if (flash) body = P.color_white;
  const wing_color = shade(body, 0.75);
  const outline = shade(body, 0.4);
  const span = 34 * plane.Wing * s;
  const left_span = span * (1 + tilt * 0.25);
  const right_span = span * (1 - tilt * 0.25);
  const flame = vrand(10, 20) * s;
  draw_glow(ctx, [255, 130, 40], x, y + 28 * s, 16 * s);
  polygon(ctx, [255, 160, 60], [[x - 5 * s, y + 22 * s], [x + 5 * s, y + 22 * s], [x, y + 22 * s + flame]]);
  polygon(ctx, [255, 245, 190], [[x - 2.5 * s, y + 22 * s], [x + 2.5 * s, y + 22 * s], [x, y + 22 * s + flame * 0.6]]);
  const left_wing = [[x - 6 * s, y - 6 * s], [x - left_span, y + 10 * s], [x - left_span, y + 17 * s], [x - 6 * s, y + 12 * s]];
  const right_wing = [[x + 6 * s, y - 6 * s], [x + right_span, y + 10 * s], [x + right_span, y + 17 * s], [x + 6 * s, y + 12 * s]];
  for (const wing of [left_wing, right_wing]) {
    polygon(ctx, wing_color, wing);
    polygon(ctx, outline, wing, 2 * Math.min(1, s));
  }
  const guns = plane.Guns;
  if (guns >= 2) {
    for (const side of [-1, 1]) rect(ctx, accent, x + side * span * 0.55 - 2 * s, y - 4 * s, Math.max(2, 4 * s), Math.max(3, 14 * s));
  }
  if (guns >= 4) {
    for (const side of [-1, 1]) rect(ctx, accent, x + side * span * 0.85 - 2 * s, y + 2 * s, Math.max(2, 4 * s), Math.max(3, 12 * s));
  }
  const left_tail = [[x - 4 * s, y + 12 * s], [x - 15 * s, y + 26 * s], [x - 4 * s, y + 22 * s]];
  const right_tail = [[x + 4 * s, y + 12 * s], [x + 15 * s, y + 26 * s], [x + 4 * s, y + 22 * s]];
  for (const tail of [left_tail, right_tail]) {
    polygon(ctx, wing_color, tail);
    polygon(ctx, outline, tail, 2 * Math.min(1, s));
  }
  const fuselage = [[x, y - 34 * s], [x + 7 * s, y - 14 * s], [x + 7 * s, y + 18 * s], [x, y + 25 * s], [x - 7 * s, y + 18 * s], [x - 7 * s, y - 14 * s]];
  polygon(ctx, body, fuselage);
  polygon(ctx, outline, fuselage, 2 * Math.min(1, s));
  line(ctx, accent, x, y - 2 * s, x, y + 20 * s, Math.max(1, 2 * s));
  const cw = Math.max(2, 8 * s);
  const ch = Math.max(3, 15 * s);
  const cx = x - 4 * s;
  const cy = y - 24 * s;
  ellipse(ctx, accent, cx, cy, cw, ch);
  ellipse(ctx, P.color_white, cx + cw / 3, cy + 2 * Math.min(1, s), Math.max(1, cw / 3), Math.max(1, ch / 3));
}

function draw_player(ctx, game) {
  const player = game.player;
  if (!player.alive) return;
  if (player.invincible > 0 && Math.trunc(player.invincible * 12) % 2 === 0) return;
  draw_player_plane(ctx, player.x, player.y, player.plane, 1.0, player.tilt, player.flash > 0);
  if (player.shield_time > 0) {
    const radius = Math.trunc(48 + 4 * Math.sin(game.time * 10));
    circle(ctx, [80, 220, 255], player.x, player.y, radius, 0, 55 / 255);
    circle(ctx, [160, 240, 255], player.x, player.y, radius, 3, 210 / 255);
  }
}

function draw_laser(ctx, game) {
  const player = game.player;
  if (player.laser_time <= 0 || !player.alive) return;
  const color = P.abilities.Laser.Color;
  const bottom = Math.trunc(player.y - 30);
  const width = P.laser_width + Math.sin(game.time * 40) * 6;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = css(shade(color, 0.35));
  ctx.fillRect(player.x - width / 2 - 12, 0, width + 24, bottom);
  ctx.fillStyle = css(shade(color, 0.8));
  ctx.fillRect(player.x - width / 2, 0, width, bottom);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#fff";
  ctx.fillRect(player.x - width * 0.2, 0, width * 0.4, bottom);
  draw_glow(ctx, color, player.x, bottom, 34);
}

function draw_enemy(ctx, enemy) {
  const extra = P.enemy_extra[enemy.type];
  const x = enemy.x;
  const y = enemy.y;
  const s = enemy.size;
  let color = extra.Color;
  if (enemy.flash > 0) color = P.color_white;
  const dark = shade(color, 0.45);
  const light = shade(color, 1.4);
  draw_glow(ctx, shade(extra.Color, 0.7), x, y - s * 0.4, s * 0.35);
  let points;
  if (enemy.type === "Tank") {
    points = [[x - s * 0.5, y - s * 0.2], [x - s * 0.3, y - s * 0.45], [x + s * 0.3, y - s * 0.45], [x + s * 0.5, y - s * 0.2], [x + s * 0.35, y + s * 0.35], [x - s * 0.35, y + s * 0.35]];
  } else if (enemy.type === "Scout") {
    points = [[x, y + s * 0.55], [x + s * 0.4, y - s * 0.45], [x, y - s * 0.2], [x - s * 0.4, y - s * 0.45]];
  } else if (enemy.type === "Sniper") {
    points = [[x, y + s * 0.5], [x + s * 0.5, y - s * 0.05], [x + s * 0.2, y - s * 0.45], [x - s * 0.2, y - s * 0.45], [x - s * 0.5, y - s * 0.05]];
  } else {
    points = [[x, y + s * 0.5], [x + s * 0.25, y + s * 0.05], [x + s * 0.55, y - s * 0.25], [x + s * 0.2, y - s * 0.2], [x, y - s * 0.45], [x - s * 0.2, y - s * 0.2], [x - s * 0.55, y - s * 0.25], [x - s * 0.25, y + s * 0.05]];
  }
  polygon(ctx, color, points);
  polygon(ctx, dark, points, 2);
  if (enemy.type === "Tank") {
    for (const dx of [-0.25, 0, 0.25]) line(ctx, dark, x + dx * s, y + s * 0.2, x + dx * s, y + s * 0.55, 4);
  }
  if (enemy.type === "Sniper") line(ctx, light, x, y, x, y + s * 0.75, 3);
  circle(ctx, light, x, y, Math.max(2, Math.trunc(s * 0.12)));
  if (enemy.health < enemy.max_health) {
    const bar_width = s * 0.8;
    const ratio = clamp(enemy.health / enemy.max_health, 0, 1);
    rect(ctx, [40, 40, 55], x - bar_width / 2, y - s * 0.68, bar_width, 4);
    rect(ctx, mix_color(P.color_red, P.color_green, ratio), x - bar_width / 2, y - s * 0.68, bar_width * ratio, 4);
  }
}

function draw_boss(ctx, game) {
  const boss = game.boss;
  if (boss === null) return;
  const x = boss.x;
  const y = boss.y;
  const w = boss.width;
  const h = boss.height;
  let color = boss.color;
  if (boss.health < boss.max_health * 0.5) color = mix_color(color, [255, 40, 40], (Math.sin(game.time * 8) + 1) / 4);
  if (boss.flash > 0) color = mix_color(color, P.color_white, 0.35);
  const dark = shade(color, 0.4);
  const mid = shade(color, 0.7);
  draw_glow(ctx, shade(boss.color, 0.7), x - w * 0.2, y - h * 0.45, h * 0.35);
  draw_glow(ctx, shade(boss.color, 0.7), x + w * 0.2, y - h * 0.45, h * 0.35);
  const left_wing = [[x - w * 0.18, y - h * 0.3], [x - w * 0.5, y - h * 0.05], [x - w * 0.46, y + h * 0.22], [x - w * 0.2, y + h * 0.18]];
  const right_wing = [[x + w * 0.18, y - h * 0.3], [x + w * 0.5, y - h * 0.05], [x + w * 0.46, y + h * 0.22], [x + w * 0.2, y + h * 0.18]];
  for (const wing of [left_wing, right_wing]) {
    polygon(ctx, mid, wing);
    polygon(ctx, dark, wing, 3);
  }
  const hull = [[x - w * 0.22, y - h * 0.5], [x + w * 0.22, y - h * 0.5], [x + w * 0.3, y - h * 0.1], [x + w * 0.18, y + h * 0.38], [x, y + h * 0.5], [x - w * 0.18, y + h * 0.38], [x - w * 0.3, y - h * 0.1]];
  polygon(ctx, color, hull);
  polygon(ctx, dark, hull, 3);
  for (const side of [-1, 1]) {
    const tx = x + side * w * 0.38;
    const ty = y + h * 0.1;
    line(ctx, dark, tx, ty, tx, ty + h * 0.25, 6);
    circle(ctx, dark, tx, ty, Math.trunc(h * 0.11));
    circle(ctx, shade(color, 1.3), tx, ty, Math.trunc(h * 0.07));
  }
  draw_glow(ctx, shade(boss.color, 0.9), x, y, h * 0.4);
  circle(ctx, dark, x, y, Math.trunc(h * 0.2));
  for (let n = 0; n < 6; n++) {
    const angle = boss.spin + (n * Math.PI) / 3;
    circle(ctx, shade(color, 1.5), x + Math.cos(angle) * h * 0.14, y + Math.sin(angle) * h * 0.14, Math.max(2, Math.trunc(h * 0.035)));
  }
  circle(ctx, P.color_white, x, y, Math.trunc(h * 0.06));
}

function draw_bullets(ctx, game) {
  const accent = P.planes[game.player.plane].Accent;
  const glow = shade(accent, 0.6);
  for (const b of game.player_bullets) {
    draw_glow(ctx, glow, b.x, b.y, 10);
    const tail_x = b.x - b.vx * 0.025;
    const tail_y = b.y - b.vy * 0.025;
    line(ctx, accent, b.x, b.y, tail_x, tail_y, 4);
    line(ctx, P.color_white, b.x, b.y, tail_x, tail_y, 2);
  }
  for (const b of game.enemy_bullets) {
    const r = b.radius;
    draw_glow(ctx, shade(b.color, 0.7), b.x, b.y, r * 2.2);
    circle(ctx, b.color, b.x, b.y, r);
    circle(ctx, P.color_white, b.x, b.y, Math.max(1, Math.floor(r / 2)));
  }
}

function draw_missiles(ctx, game) {
  for (const m of game.missiles) {
    const ca = Math.cos(m.angle);
    const sa = Math.sin(m.angle);
    draw_glow(ctx, [255, 140, 40], m.x - ca * 9, m.y - sa * 9, 11);
    polygon(ctx, [255, 225, 160], [[m.x + ca * 10, m.y + sa * 10], [m.x - ca * 8 - sa * 4, m.y - sa * 8 + ca * 4], [m.x - ca * 8 + sa * 4, m.y - sa * 8 - ca * 4]]);
  }
}

function draw_powerups(ctx, game) {
  for (const item of game.powerups) {
    const pulse = 2 * Math.sin(item.time * 6);
    const color = item.kind === "health" ? P.color_green : P.color_gold;
    const symbol = item.kind === "health" ? "+" : "$";
    draw_glow(ctx, shade(color, 0.7), item.x, item.y, 24);
    circle(ctx, shade(color, 0.35), item.x, item.y, Math.trunc(13 + pulse));
    circle(ctx, color, item.x, item.y, Math.trunc(13 + pulse), 2);
    text(ctx, symbol, 20, P.color_white, item.x, item.y - 1, "center", false);
  }
}

function draw_world(ctx, game) {
  draw_powerups(ctx, game);
  for (const enemy of game.enemies) draw_enemy(ctx, enemy);
  draw_boss(ctx, game);
  draw_laser(ctx, game);
  draw_bullets(ctx, game);
  draw_missiles(ctx, game);
  draw_player(ctx, game);
  draw_particles(ctx, game.particles);
  draw_rings(ctx, game.rings);
  draw_popups(ctx, game.popups);
}

const ARENA = new Set(["level_intro", "playing", "paused", "level_complete", "game_over"]);

/**
 * Gambar 1 frame ke kanvas layar penuh.
 * view = { vw, vh, dpr, stage: {x, y, w, h, scale}, W, H }, shake = [dx, dy] (satuan dunia)
 */
export function draw_frame(ctx, game, view, shake) {
  const { dpr, stage } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  const arena = ARENA.has(game.state);
  ctx.fillStyle = arena ? "#03040b" : css(game.background.top);
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  let s;
  let ox;
  let oy;
  if (arena) {
    s = stage.scale;
    ox = stage.x;
    oy = stage.y;
  } else {
    // Menu/hangar/menang: latar menutupi seluruh layar.
    s = Math.max(view.vw / view.W, view.vh / view.H);
    ox = (view.vw - view.W * s) / 2;
    oy = (view.vh - view.H * s) / 2;
  }
  if (arena) {
    // Area di luar arena (tempat jempol & tombol): panel gelap dengan garis tepi tipis.
    ctx.fillStyle = "rgb(8,11,28)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.strokeStyle = "rgba(80,90,130,0.55)";
    ctx.lineWidth = Math.max(1, dpr);
    ctx.strokeRect((stage.x - 0.5) * dpr, (stage.y - 0.5) * dpr, (stage.w + 1) * dpr, (stage.h + 1) * dpr);
  }
  ctx.save();
  if (arena) {
    ctx.beginPath();
    ctx.rect(stage.x * dpr, stage.y * dpr, stage.w * dpr, stage.h * dpr);
    ctx.clip();
    ctx.fillStyle = "#000";
    ctx.fillRect(stage.x * dpr, stage.y * dpr, stage.w * dpr, stage.h * dpr);
  }
  ctx.setTransform(s * dpr, 0, 0, s * dpr, (ox + shake[0] * s) * dpr, (oy + shake[1] * s) * dpr);
  ctx.drawImage(background_image(game.background), 0, 0, view.W, view.H);
  draw_stars(ctx, game.stars);
  if (arena) {
    draw_world(ctx, game);
  } else {
    draw_particles(ctx, game.particles);
    draw_rings(ctx, game.rings);
  }
  ctx.restore();
}

/** Gambar pesawat di kanvas kecil (menu, hangar, nyawa, layar menang). */
export function draw_plane_preview(canvas, plane_name, scale, tilt = 0, lift = 0) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw_player_plane(ctx, w / 2, h / 2 - 4 * scale + lift, plane_name, scale, tilt);
}

/** Ikon nyawa: deretan pesawat kecil (seperti HUD notebook). */
export function draw_lives(canvas, plane_name, lives) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = h / 66; // tinggi pesawat ~ 66 x skala
  const half = 34 * P.planes[plane_name].Wing * s;
  const spacing = Math.max(75 * s, half * 2 + 3);
  for (let n = 0; n < lives; n++) draw_player_plane(ctx, half + 1 + n * spacing, h * 0.55, plane_name, s);
}
