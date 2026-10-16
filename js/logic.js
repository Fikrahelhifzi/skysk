/*
 * logic.js — semua LOGIKA game, port 1:1 dari notebook (cell 7 bagian non-gambar,
 * cell 9, 11, 13, dan 19). Nama fungsi sama dengan notebook supaya mudah dicocokkan.
 *
 * File ini tidak menggambar apa pun dan tidak menyentuh layar/HTML, sehingga bisa
 * diuji langsung dan dibandingkan dengan kode Python asli (tests/parity).
 *
 * Perbedaan khusus versi HP ditandai "WEB:" di komentar.
 */
import * as P from "./params.js";
import { R } from "./rng.js";

// WEB: ukuran dunia bisa lanskap (1100x720) atau potret (720x1100).
export const dims = { W: P.world_landscape.width, H: P.world_landscape.height };
export function set_world_size(width, height) { dims.W = width; dims.H = height; }

// WEB: kait opsional yang diisi main.js (mis. menyesuaikan ukuran dunia sebelum level dimulai).
export const hooks = { before_level: null };

/* ------------------------------------------------------------------ */
/* Helper (cell 7)                                                     */
/* ------------------------------------------------------------------ */
export function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }

export function shade(color, factor) {
  return [
    clamp(Math.trunc(color[0] * factor), 0, 255),
    clamp(Math.trunc(color[1] * factor), 0, 255),
    clamp(Math.trunc(color[2] * factor), 0, 255),
  ];
}

export function mix_color(color_a, color_b, t) {
  t = clamp(t, 0, 1);
  return [
    Math.trunc(color_a[0] + (color_b[0] - color_a[0]) * t),
    Math.trunc(color_a[1] + (color_b[1] - color_a[1]) * t),
    Math.trunc(color_a[2] + (color_b[2] - color_a[2]) * t),
  ];
}

/** Operator % ala Python (hasil bertanda sama dengan pembagi). */
export function py_mod(a, n) {
  const m = a % n;
  if (m === 0) return 0;
  return (m < 0) !== (n < 0) ? m + n : m;
}

/** Pengganti pygame.Rect (hanya bagian yang dipakai game: tabrakan). */
export class Rect {
  constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; }
  collidepoint(px, py) {
    px = Math.trunc(px); py = Math.trunc(py);
    return px >= this.x && px < this.x + this.w && py >= this.y && py < this.y + this.h;
  }
  colliderect(o) {
    if (this.w === 0 || this.h === 0 || o.w === 0 || o.h === 0) return false;
    return Math.min(this.x, this.x + this.w) < Math.max(o.x, o.x + o.w)
      && Math.min(this.y, this.y + this.h) < Math.max(o.y, o.y + o.h)
      && Math.max(this.x, this.x + this.w) > Math.min(o.x, o.x + o.w)
      && Math.max(this.y, this.y + this.h) > Math.min(o.y, o.y + o.h);
  }
}

function remove_item(list, item) {
  const i = list.indexOf(item);
  if (i >= 0) list.splice(i, 1);
}

const TOP_COLORS = [[6, 8, 26], [18, 6, 34], [4, 22, 32], [28, 6, 14]];
const BOTTOM_COLORS = [[24, 36, 86], [64, 24, 86], [14, 70, 84], [86, 30, 36]];
let background_counter = 0;

/** make_background: WEB: menyimpan "resep" latar; gambarnya dibuat oleh render.js. */
export function make_background(level) {
  const zone = Math.floor((level - 1) / P.boss_every) % TOP_COLORS.length;
  const nebulae = [];
  for (let n = 0; n < 4; n++) {
    const x = R.randint(0, dims.W);
    const y = R.randint(0, dims.H);
    nebulae.push({ x, y });
  }
  background_counter += 1;
  return { id: background_counter, zone, top: TOP_COLORS[zone], bottom: BOTTOM_COLORS[zone], nebulae, width: dims.W, height: dims.H };
}

export function make_stars(amount) {
  const stars = [];
  for (let n = 0; n < amount; n++) {
    const layer = R.randint(1, 3);
    const star = {
      x: R.uniform(0, dims.W), y: R.uniform(0, dims.H),
      speed: 30 * layer + R.uniform(0, 20), size: 1 + Math.floor(layer / 3), light: 70 + layer * 50,
    };
    stars.push(star);
  }
  return stars;
}

export function update_stars(stars, dt) {
  for (const star of stars) {
    star.y = star.y + star.speed * dt;
    if (star.y > dims.H) {
      star.y = 0;
      star.x = R.uniform(0, dims.W);
    }
  }
}

export function add_particle(particles, x, y, vx, vy, life, color, size) {
  particles.push({ x, y, vx, vy, life, max_life: life, color, size });
}

export function add_explosion(particles, x, y, color, amount, power, size) {
  for (let n = 0; n < amount; n++) {
    const angle = R.uniform(0, Math.PI * 2);
    const speed = R.uniform(power * 0.2, power);
    const life = R.uniform(0.35, 0.9);
    add_particle(particles, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, life, color, R.uniform(size * 0.5, size));
  }
}

function filter_in_place(list, keep) {
  let j = 0;
  for (let i = 0; i < list.length; i++) if (keep(list[i])) list[j++] = list[i];
  list.length = j;
}

export function update_particles(particles, dt) {
  for (const p of particles) {
    p.x = p.x + p.vx * dt;
    p.y = p.y + p.vy * dt;
    p.vx = p.vx * (1 - 2.5 * dt);
    p.vy = p.vy * (1 - 2.5 * dt);
    p.life = p.life - dt;
  }
  filter_in_place(particles, (p) => p.life > 0);
}

export function add_popup(popups, text, x, y, color) {
  popups.push({ text, x, y, life: 1.0, color });
}

export function update_popups(popups, dt) {
  for (const p of popups) {
    p.y = p.y - 45 * dt;
    p.life = p.life - dt;
  }
  filter_in_place(popups, (p) => p.life > 0);
}

export function add_ring(rings, x, y, color, max_radius, speed) {
  rings.push({ x, y, radius: 5, max_radius, speed, color });
}

export function update_rings(rings, dt) {
  for (const ring of rings) ring.radius = ring.radius + ring.speed * dt;
  filter_in_place(rings, (ring) => !(ring.radius >= ring.max_radius));
}

/* ------------------------------------------------------------------ */
/* Pemain & 4 ability (cell 9)                                         */
/* ------------------------------------------------------------------ */
export function create_player(plane_name) {
  const plane = P.planes[plane_name];
  const max_health = Math.trunc(P.player_bar_health * plane.Armor);
  const cooldowns = {};
  for (const name of Object.keys(P.abilities)) cooldowns[name] = 0;
  return {
    x: dims.W / 2, y: dims.H - 100, plane: plane_name, health: max_health, max_health,
    lives: P.player_lives, alive: true, fire_timer: 0, invincible: 0, flash: 0, tilt: 0,
    shield_time: 0, laser_time: 0, cooldowns,
  };
}

export function player_hitbox(player) {
  return new Rect(Math.trunc(player.x) - 12, Math.trunc(player.y) - 18, 24, 36);
}

export function equip_plane(game, plane_name) {
  const player = game.player;
  const ratio = player.health / player.max_health;
  player.plane = plane_name;
  player.max_health = Math.trunc(P.player_bar_health * P.planes[plane_name].Armor);
  player.health = Math.max(1, Math.trunc(player.max_health * ratio));
}

/**
 * input = { keys: {left, right, up, down, fire}, drag: null | {dx, dy}, auto_fire }
 * WEB: "drag" = geseran jari yang belum dijalani pesawat (satuan dunia game).
 * Pesawat mengikuti jari secepat-cepatnya sesuai Speed pesawat.
 */
export function update_player(game, input, dt) {
  const player = game.player;
  const plane = P.planes[player.plane];
  const keys = input.keys;
  let move_x = 0;
  let move_y = 0;
  const speed = P.player_speed * P.player_speed_scale * plane.Speed;
  if (input.drag) {
    const step = speed * dt;
    const want = Math.hypot(input.drag.dx, input.drag.dy);
    let mx = 0;
    let my = 0;
    if (want > 1e-6) {
      const f = Math.min(1, step / want);
      mx = input.drag.dx * f;
      my = input.drag.dy * f;
    }
    input.drag.dx -= mx;
    input.drag.dy -= my;
    const nx = clamp(player.x + mx, 30, dims.W - 30);
    const ny = clamp(player.y + my, 80, dims.H - 40);
    if (nx !== player.x + mx) input.drag.dx = 0; // mentok tepi: jangan menumpuk geseran
    if (ny !== player.y + my) input.drag.dy = 0;
    player.x = nx;
    player.y = ny;
    move_x = step > 0 ? clamp(mx / step, -1, 1) : 0;
  } else {
    if (keys.left) move_x = move_x - 1;
    if (keys.right) move_x = move_x + 1;
    if (keys.up) move_y = move_y - 1;
    if (keys.down) move_y = move_y + 1;
    if (move_x !== 0 && move_y !== 0) {
      move_x = move_x * 0.707;
      move_y = move_y * 0.707;
    }
    player.x = player.x + move_x * speed * dt;
    player.y = player.y + move_y * speed * dt;
    player.x = clamp(player.x, 30, dims.W - 30);
    player.y = clamp(player.y, 80, dims.H - 40);
  }
  player.tilt = player.tilt + (move_x - player.tilt) * Math.min(1, dt * 10);
  player.fire_timer = player.fire_timer - dt;
  player.invincible = Math.max(0, player.invincible - dt);
  player.flash = Math.max(0, player.flash - dt);
  player.shield_time = Math.max(0, player.shield_time - dt);
  player.laser_time = Math.max(0, player.laser_time - dt);
  for (const name of Object.keys(player.cooldowns)) {
    player.cooldowns[name] = Math.max(0, player.cooldowns[name] - dt);
  }
  if ((keys.fire || input.auto_fire) && player.fire_timer <= 0) {
    shoot_player(game);
    player.fire_timer = plane["Fire Delay"];
  }
  const flame_color = R.choice([[255, 150, 40], [255, 210, 90], [255, 90, 40]]);
  add_particle(game.particles, player.x + R.uniform(-3, 3), player.y + 28, R.uniform(-20, 20), R.uniform(180, 260), 0.25, flame_color, 3);
}

export function shoot_player(game) {
  const player = game.player;
  const plane = P.planes[player.plane];
  const guns = plane.Guns;
  const damage = P.bullet_player_power * plane.Damage;
  const speed = P.bullet_speed * P.bullet_speed_scale;
  for (let g = 0; g < guns; g++) {
    const offset = g - (guns - 1) / 2;
    const angle = offset * 0.07;
    game.player_bullets.push({
      x: player.x + offset * 12, y: player.y - 30,
      vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed, damage,
    });
  }
}

export function use_ability(game, name) {
  const player = game.player;
  if (player.cooldowns[name] > 0 || !player.alive) return;
  const plane = P.planes[player.plane];
  const ability = P.abilities[name];
  player.cooldowns[name] = ability.Cooldown * plane.Cooldown;
  if (name === "Shield") player.shield_time = ability.Duration;
  else if (name === "Missiles") fire_missiles(game);
  else if (name === "Laser") player.laser_time = ability.Duration;
  else if (name === "EMP") emp_blast(game);
  const order = Object.keys(P.abilities).indexOf(name);
  add_popup(game.popups, name.toUpperCase() + "!", player.x, player.y - 55 - order * 22, ability.Color);
}

export function fire_missiles(game) {
  const player = game.player;
  const plane = P.planes[player.plane];
  const count = plane.Missiles;
  for (let m = 0; m < count; m++) {
    const angle = -Math.PI / 2 + (m - (count - 1) / 2) * 0.28;
    game.missiles.push({
      x: player.x, y: player.y - 10, angle, speed: P.missile_speed * 0.4,
      life: 4.0, damage: P.missile_damage * plane.Damage,
    });
  }
}

export function find_target(game, x, y) {
  let best = null;
  let best_distance = 999999999;
  for (const enemy of game.enemies) {
    const distance = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
    if (distance < best_distance) {
      best_distance = distance;
      best = [enemy.x, enemy.y];
    }
  }
  if (game.boss !== null) {
    const boss = game.boss;
    const distance = (boss.x - x) ** 2 + (boss.y - y) ** 2;
    if (distance < best_distance) best = [boss.x, boss.y];
  }
  return best;
}

export function update_missiles(game, dt) {
  for (const missile of game.missiles.slice()) {
    const target = find_target(game, missile.x, missile.y);
    if (target !== null) {
      const wanted = Math.atan2(target[1] - missile.y, target[0] - missile.x);
      const difference = py_mod(wanted - missile.angle + Math.PI, Math.PI * 2) - Math.PI;
      const turn = 5 * dt;
      missile.angle = missile.angle + clamp(difference, -turn, turn);
    }
    missile.speed = Math.min(P.missile_speed, missile.speed + 700 * dt);
    missile.x = missile.x + Math.cos(missile.angle) * missile.speed * dt;
    missile.y = missile.y + Math.sin(missile.angle) * missile.speed * dt;
    missile.life = missile.life - dt;
    add_particle(game.particles, missile.x, missile.y, 0, 0, 0.3, [200, 200, 210], 2);
    const outside = missile.x < -50 || missile.x > dims.W + 50 || missile.y < -50 || missile.y > dims.H + 50;
    if (missile.life <= 0 || outside) remove_item(game.missiles, missile);
  }
}

export function emp_blast(game) {
  const player = game.player;
  const plane = P.planes[player.plane];
  const color = P.abilities.EMP.Color;
  for (const bullet of game.enemy_bullets) add_particle(game.particles, bullet.x, bullet.y, 0, 0, 0.4, color, 4);
  game.enemy_bullets.length = 0;
  add_ring(game.rings, player.x, player.y, color, 900, 1100);
  add_ring(game.rings, player.x, player.y, P.color_white, 500, 800);
  for (const enemy of game.enemies.slice()) damage_enemy(game, enemy, P.emp_damage * plane.Damage);
  if (game.boss !== null) damage_boss(game, P.emp_damage * 2 * plane.Damage);
  game.shake = Math.max(game.shake, 12);
}

export function damage_player(game, amount) {
  const player = game.player;
  if (player.shield_time > 0 || player.invincible > 0 || !player.alive) return;
  player.health = player.health - amount;
  player.flash = 0.15;
  game.shake = Math.max(game.shake, 6);
  emit(game, "player_hit");
  if (player.health <= 0) {
    player.lives = player.lives - 1;
    add_explosion(game.particles, player.x, player.y, [255, 160, 60], 50, 380, 6);
    add_explosion(game.particles, player.x, player.y, P.color_white, 20, 200, 4);
    add_ring(game.rings, player.x, player.y, [255, 160, 60], 220, 400);
    game.shake = 18;
    emit(game, "life_lost");
    if (player.lives > 0) {
      player.health = player.max_health;
      player.invincible = P.invincible_time;
      add_popup(game.popups, "-1 LIFE", player.x, player.y - 50, P.color_red);
    } else {
      player.health = 0;
      player.alive = false;
      game.end_timer = 2.0;
    }
  }
}

/** WEB: catatan kejadian untuk tampilan (getar HP, dll). Tidak memengaruhi logika. */
function emit(game, type) {
  if (game.fx) game.fx.push(type);
}

/* ------------------------------------------------------------------ */
/* Musuh, item & boss (cell 11)                                        */
/* ------------------------------------------------------------------ */
export function is_boss_level(level) { return P.enemy_per_level[level] === "BOSS"; }

export function pick_enemy_type(level) {
  const names = [];
  const weights = [];
  for (const name of Object.keys(P.enemy_types)) {
    if (level >= P.enemy_extra[name]["Unlock Level"]) {
      names.push(name);
      weights.push(P.enemy_extra[name].Chance);
    }
  }
  return R.choices(names, weights)[0];
}

export function create_enemy(level, type_name) {
  const stats = P.enemy_types[type_name];
  const extra = P.enemy_extra[type_name];
  const size = extra.Size;
  const speed = (stats.Speed + (level - 1) * P.enemy_speed_increase) * P.enemy_speed_scale;
  const health = stats["Enemy health"] + Math.trunc((level - 1) * P.enemy_health_bonus_per_level);
  return {
    type: type_name,
    x: R.uniform(size, dims.W - size),
    y: -size,
    target_y: R.uniform(80, dims.H * 0.42),
    entered: false,
    speed,
    direction: R.choice([-1, 1]),
    health,
    max_health: health,
    size,
    fire_timer: R.uniform(0.5, 1.5),
    flash: 0,
    wave: R.uniform(0, 6.28),
  };
}

export function enemy_rect(enemy) {
  const s = enemy.size * 0.9;
  return new Rect(Math.trunc(enemy.x - s / 2), Math.trunc(enemy.y - s / 2), Math.trunc(s), Math.trunc(s));
}

export function update_spawning(game, dt) {
  if (game.to_spawn <= 0) return;
  game.spawn_timer = game.spawn_timer - dt;
  const limit = P.max_enemies_on_screen + Math.floor(game.level / 3);
  if (game.spawn_timer <= 0 && game.enemies.length < limit) {
    const type_name = pick_enemy_type(game.level);
    game.enemies.push(create_enemy(game.level, type_name));
    game.to_spawn = game.to_spawn - 1;
    game.spawn_timer = P.spawn_delay * R.uniform(0.6, 1.4);
  }
}

export function update_enemies(game, dt) {
  const player = game.player;
  for (const enemy of game.enemies) {
    const extra = P.enemy_extra[enemy.type];
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.wave = enemy.wave + dt;
    if (extra.Behavior === "kamikaze") {
      enemy.y = enemy.y + enemy.speed * dt;
      const dx = player.x - enemy.x;
      enemy.x = enemy.x + clamp(dx / 100, -1, 1) * enemy.speed * 0.7 * dt;
      if (enemy.y > dims.H + enemy.size) {
        enemy.y = -enemy.size;
        enemy.x = R.uniform(enemy.size, dims.W - enemy.size);
      }
    } else if (!enemy.entered) {
      enemy.y = enemy.y + enemy.speed * 1.5 * dt;
      if (enemy.y >= enemy.target_y) enemy.entered = true;
    } else {
      enemy.x = enemy.x + enemy.direction * enemy.speed * dt;
      enemy.y = enemy.target_y + Math.sin(enemy.wave * 2) * 10;
      if (enemy.x < enemy.size) {
        enemy.x = enemy.size;
        enemy.direction = 1;
      }
      if (enemy.x > dims.W - enemy.size) {
        enemy.x = dims.W - enemy.size;
        enemy.direction = -1;
      }
      enemy.fire_timer = enemy.fire_timer - dt;
      if (enemy.fire_timer <= 0) {
        enemy_shoot(game, enemy);
        const delay = extra["Fire Delay"] / (1 + game.level * P.enemy_fire_increase);
        enemy.fire_timer = delay * R.uniform(0.7, 1.3);
      }
    }
  }
}

export function add_enemy_bullet(game, x, y, angle, speed, damage, color, radius) {
  game.enemy_bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, color, radius });
}

export function enemy_shoot(game, enemy) {
  const stats = P.enemy_types[enemy.type];
  const extra = P.enemy_extra[enemy.type];
  const player = game.player;
  const speed = stats["Bullet Speed"] * P.enemy_bullet_speed_scale;
  const gun_y = enemy.y + enemy.size * 0.4;
  if (extra.Behavior === "sniper") {
    const angle = Math.atan2(player.y - gun_y, player.x - enemy.x);
    add_enemy_bullet(game, enemy.x, gun_y, angle, speed, stats["Bullet Damage"], [230, 140, 255], 5);
  } else {
    const shots = extra.Shots;
    for (let n = 0; n < shots; n++) {
      const angle = Math.PI / 2 + (n - (shots - 1) / 2) * 0.25;
      add_enemy_bullet(game, enemy.x, gun_y, angle, speed, stats["Bullet Damage"], [255, 110, 90], 6);
    }
  }
}

export function damage_enemy(game, enemy, amount) {
  if (!game.enemies.includes(enemy)) return;
  enemy.health = enemy.health - amount;
  enemy.flash = P.hit_flash_time;
  if (enemy.health <= 0) kill_enemy(game, enemy);
}

export function kill_enemy(game, enemy) {
  remove_item(game.enemies, enemy);
  const extra = P.enemy_extra[enemy.type];
  const reward = Math.trunc(P.coins_per_enemy * extra["Coin Multiplier"]);
  game.coins = game.coins + reward;
  game.level_coins = game.level_coins + reward;
  add_explosion(game.particles, enemy.x, enemy.y, extra.Color, 28, 260, 4);
  add_explosion(game.particles, enemy.x, enemy.y, [255, 240, 200], 10, 140, 3);
  add_ring(game.rings, enemy.x, enemy.y, extra.Color, enemy.size * 1.4, 220);
  add_popup(game.popups, "+" + String(reward), enemy.x, enemy.y - 10, P.color_gold);
  game.shake = Math.max(game.shake, 4);
  if (R.random() < P.powerup_drop_chance) game.powerups.push(create_powerup(enemy.x, enemy.y));
}

export function create_powerup(x, y) {
  const kind = R.choice(["health", "coins"]);
  return { x, y, kind, time: 0 };
}

export function update_powerups(game, dt) {
  for (const item of game.powerups.slice()) {
    item.y = item.y + 90 * dt;
    item.time = item.time + dt;
    if (item.y > dims.H + 30) remove_item(game.powerups, item);
  }
}

export function collect_powerup(game, item) {
  const player = game.player;
  if (item.kind === "health") {
    player.health = Math.min(player.max_health, player.health + P.powerup_heal);
    add_popup(game.popups, "+" + String(P.powerup_heal) + " HP", item.x, item.y, P.color_green);
  } else {
    game.coins = game.coins + P.powerup_coins;
    game.level_coins = game.level_coins + P.powerup_coins;
    add_popup(game.popups, "+" + String(P.powerup_coins), item.x, item.y, P.color_gold);
  }
  add_ring(game.rings, item.x, item.y, P.color_white, 50, 200);
  remove_item(game.powerups, item);
}

export function boss_name_for_level(level) {
  let index = Math.floor(level / P.boss_every) - 1;
  index = clamp(index, 0, P.boss_names.length - 1);
  return P.boss_names[index];
}

export function create_boss(level) {
  const name = boss_name_for_level(level);
  const stats = P.boss_stats[name];
  return {
    name, title: stats.Title, x: dims.W / 2, y: -stats.Height, target_y: 110 + stats.Height * 0.55,
    entered: false, health: stats.Health, max_health: stats.Health, speed: stats.Speed, direction: 1,
    width: stats.Width, height: stats.Height, color: stats.Color, attack_index: 0,
    attack_timer: P.boss_attack_time, fire_timer: 1.0, spin: 0, time: 0, flash: 0,
  };
}

export function boss_rect(boss) {
  const w = boss.width * 0.85;
  const h = boss.height * 0.8;
  return new Rect(Math.trunc(boss.x - w / 2), Math.trunc(boss.y - h / 2), Math.trunc(w), Math.trunc(h));
}

export function update_boss(game, dt) {
  const boss = game.boss;
  if (boss === null) return;
  boss.time = boss.time + dt;
  boss.flash = Math.max(0, boss.flash - dt);
  boss.spin = boss.spin + dt * 2;
  if (!boss.entered) {
    boss.y = boss.y + 110 * dt;
    if (boss.y >= boss.target_y) boss.entered = true;
    return;
  }
  const enraged = boss.health < boss.max_health * 0.5;
  let speed = boss.speed;
  if (enraged) speed = speed * 1.4;
  boss.x = boss.x + boss.direction * speed * dt;
  const half = boss.width / 2 + 10;
  if (boss.x < half) {
    boss.x = half;
    boss.direction = 1;
  }
  if (boss.x > dims.W - half) {
    boss.x = dims.W - half;
    boss.direction = -1;
  }
  boss.y = boss.target_y + Math.sin(boss.time * 1.5) * 20;
  const attacks = P.boss_stats[boss.name].Attacks;
  boss.attack_timer = boss.attack_timer - dt;
  if (boss.attack_timer <= 0) {
    boss.attack_index = (boss.attack_index + 1) % attacks.length;
    boss.attack_timer = P.boss_attack_time;
  }
  boss.fire_timer = boss.fire_timer - dt;
  if (boss.fire_timer <= 0) {
    let delay = boss_attack(game, boss, attacks[boss.attack_index]);
    if (enraged) delay = delay * 0.7;
    boss.fire_timer = delay;
  }
}

export function boss_attack(game, boss, attack) {
  const player = game.player;
  const stats = P.boss_stats[boss.name];
  const speed = P.enemy_bullet_speed * P.boss_bullet_speed_scale;
  const damage = stats["Bullet Damage"];
  const color = shade(boss.color, 1.3);
  const x = boss.x;
  const y = boss.y + boss.height * 0.35;
  if (attack === "spread") {
    for (let n = 0; n < 7; n++) add_enemy_bullet(game, x, y, Math.PI / 2 + (n - 3) * 0.16, speed, damage, color, 7);
    return 0.9;
  }
  if (attack === "aimed") {
    const aim = Math.atan2(player.y - y, player.x - x);
    for (let n = 0; n < 3; n++) add_enemy_bullet(game, x, y, aim + (n - 1) * 0.12, speed * 1.4, damage, P.color_white, 6);
    return 0.55;
  }
  if (attack === "spiral") {
    for (let n = 0; n < 3; n++) {
      const angle = boss.time * 2.2 + n * (Math.PI * 2 / 3);
      add_enemy_bullet(game, boss.x, boss.y, angle, speed * 0.8, damage, color, 6);
    }
    return 0.11;
  }
  if (attack === "ring") {
    const count = 20;
    const offset = R.uniform(0, 0.3);
    for (let n = 0; n < count; n++) {
      add_enemy_bullet(game, boss.x, boss.y, offset + n * (Math.PI * 2 / count), speed * 0.75, damage, color, 7);
    }
    return 1.2;
  }
  if (attack === "rain") {
    for (let n = 0; n < 2; n++) {
      const rain_x = boss.x + R.uniform(-boss.width / 2, boss.width / 2);
      add_enemy_bullet(game, rain_x, y, Math.PI / 2 + R.uniform(-0.1, 0.1), speed * R.uniform(0.8, 1.2), damage, color, 5);
    }
    return 0.1;
  }
  return 1.0;
}

export function damage_boss(game, amount) {
  const boss = game.boss;
  if (boss === null || !boss.entered) return;
  boss.health = boss.health - amount;
  boss.flash = 0.06;
  if (boss.health <= 0) kill_boss(game);
}

export function kill_boss(game) {
  const boss = game.boss;
  const reward = P.coins_per_lv5_boss[boss.name];
  game.coins = game.coins + reward;
  game.level_coins = game.level_coins + reward;
  for (let n = 0; n < 8; n++) {
    const ex = boss.x + R.uniform(-boss.width / 2, boss.width / 2);
    const ey = boss.y + R.uniform(-boss.height / 2, boss.height / 2);
    add_explosion(game.particles, ex, ey, R.choice([boss.color, [255, 220, 120], P.color_white]), 30, 380, 5);
  }
  add_ring(game.rings, boss.x, boss.y, boss.color, 500, 600);
  add_ring(game.rings, boss.x, boss.y, P.color_white, 300, 450);
  add_popup(game.popups, "BOSS DEFEATED  +" + String(reward), boss.x, boss.y, P.color_gold);
  game.enemy_bullets.length = 0;
  game.shake = 26;
  game.boss = null;
  game.clear_timer = 2.5;
  emit(game, "boss_defeated");
}

/* ------------------------------------------------------------------ */
/* Tabrakan & alur level (cell 13)                                     */
/* ------------------------------------------------------------------ */
export function update_bullets(bullets, dt) {
  for (const bullet of bullets) {
    bullet.x = bullet.x + bullet.vx * dt;
    bullet.y = bullet.y + bullet.vy * dt;
  }
  filter_in_place(bullets, (b) => !(b.x < -30 || b.x > dims.W + 30 || b.y < -30 || b.y > dims.H + 30));
}

export function check_collisions(game, dt) {
  const player = game.player;
  const plane = P.planes[player.plane];

  // 1) Peluru pemain mengenai musuh atau boss
  for (const bullet of game.player_bullets.slice()) {
    let hit = false;
    for (const enemy of game.enemies) {
      if (enemy_rect(enemy).collidepoint(bullet.x, bullet.y)) {
        add_explosion(game.particles, bullet.x, bullet.y, P.color_white, 4, 120, 2);
        damage_enemy(game, enemy, bullet.damage);
        hit = true;
        break;
      }
    }
    if (!hit && game.boss !== null) {
      if (boss_rect(game.boss).collidepoint(bullet.x, bullet.y)) {
        add_explosion(game.particles, bullet.x, bullet.y, P.color_white, 4, 120, 2);
        damage_boss(game, bullet.damage);
        hit = true;
      }
    }
    if (hit) remove_item(game.player_bullets, bullet);
  }

  // 2) Rudal mengenai musuh atau boss
  for (const missile of game.missiles.slice()) {
    let hit = false;
    for (const enemy of game.enemies) {
      if (enemy_rect(enemy).collidepoint(missile.x, missile.y)) {
        damage_enemy(game, enemy, missile.damage);
        hit = true;
        break;
      }
    }
    if (!hit && game.boss !== null) {
      if (boss_rect(game.boss).collidepoint(missile.x, missile.y)) {
        damage_boss(game, missile.damage);
        hit = true;
      }
    }
    if (hit) {
      add_explosion(game.particles, missile.x, missile.y, [255, 170, 60], 14, 200, 4);
      remove_item(game.missiles, missile);
    }
  }

  // 3) Laser
  if (player.laser_time > 0 && player.alive) {
    const beam = new Rect(Math.trunc(player.x - P.laser_width / 2), 0, P.laser_width, Math.trunc(player.y - 25));
    const laser_damage = P.laser_damage_per_second * plane.Damage * dt;
    for (const enemy of game.enemies.slice()) {
      if (beam.colliderect(enemy_rect(enemy))) damage_enemy(game, enemy, laser_damage);
    }
    const boss = game.boss;
    if (boss !== null && beam.colliderect(boss_rect(boss))) {
      if (R.random() < 0.5) {
        add_particle(game.particles, player.x + R.uniform(-15, 15), boss.y + boss.height * 0.4, R.uniform(-150, 150), R.uniform(-150, 50), 0.3, P.abilities.Laser.Color, 3);
      }
      damage_boss(game, laser_damage);
    }
    for (const bullet of game.enemy_bullets.slice()) {
      if (beam.collidepoint(bullet.x, bullet.y)) remove_item(game.enemy_bullets, bullet);
    }
  }

  if (!player.alive) return;
  const hitbox = player_hitbox(player);

  // 4) Peluru musuh mengenai pemain
  for (const bullet of game.enemy_bullets.slice()) {
    if (player.shield_time > 0) {
      const distance = Math.hypot(bullet.x - player.x, bullet.y - player.y);
      if (distance < 52) {
        add_explosion(game.particles, bullet.x, bullet.y, P.abilities.Shield.Color, 5, 120, 3);
        remove_item(game.enemy_bullets, bullet);
      }
      continue;
    }
    const r = bullet.radius;
    const bullet_box = new Rect(Math.trunc(bullet.x - r), Math.trunc(bullet.y - r), r * 2, r * 2);
    if (bullet_box.colliderect(hitbox)) {
      remove_item(game.enemy_bullets, bullet);
      add_explosion(game.particles, bullet.x, bullet.y, bullet.color, 8, 160, 3);
      damage_player(game, bullet.damage);
      if (!player.alive) return;
    }
  }

  // 5) Badan musuh menabrak pemain
  for (const enemy of game.enemies.slice()) {
    if (enemy_rect(enemy).colliderect(hitbox)) {
      damage_player(game, P.enemy_types[enemy.type]["Bullet Damage"]);
      player.invincible = Math.max(player.invincible, 0.4);
      damage_enemy(game, enemy, 9999);
      if (!player.alive) return;
    }
  }

  // 6) Badan boss menabrak pemain
  if (game.boss !== null && boss_rect(game.boss).colliderect(hitbox)) {
    damage_player(game, 30);
    player.invincible = Math.max(player.invincible, 0.8);
    player.y = Math.min(dims.H - 40, player.y + 60);
  }

  // 7) Pemain mengambil item
  for (const item of game.powerups.slice()) {
    if (Math.hypot(item.x - player.x, item.y - player.y) < 38) collect_powerup(game, item);
  }
}

export function new_game() {
  return {
    state: "menu", level: P.start_level, coins: P.coins, owned: ["Falcon"], player: create_player("Falcon"),
    enemies: [], player_bullets: [], enemy_bullets: [], missiles: [], powerups: [], particles: [], popups: [], rings: [],
    boss: null, to_spawn: 0, spawn_timer: 0, clear_timer: -1, end_timer: -1, intro_timer: 0, level_coins: 0,
    shake: 0, time: 0, menu_index: 0, shop_index: 0, shop_return: "menu", shop_message: "", shop_message_timer: 0,
    background: make_background(P.start_level),
    stars: make_stars(150),
    fx: [], // WEB: kejadian untuk tampilan
  };
}

export function begin_level(game, level) {
  if (hooks.before_level) hooks.before_level(game, level);
  game.level = level;
  game.enemies.length = 0;
  game.player_bullets.length = 0;
  game.enemy_bullets.length = 0;
  game.missiles.length = 0;
  game.powerups.length = 0;
  game.popups.length = 0;
  game.boss = null;
  if (is_boss_level(level)) {
    game.boss = create_boss(level);
    game.to_spawn = 0;
  } else {
    game.to_spawn = P.enemy_per_level[level];
  }
  game.spawn_timer = 0.8;
  game.clear_timer = -1;
  game.end_timer = -1;
  game.level_coins = 0;
  game.intro_timer = 2.5;
  game.background = make_background(level);
  const player = game.player;
  player.x = dims.W / 2;
  player.y = dims.H - 100;
  player.alive = true;
  player.shield_time = 0;
  player.laser_time = 0;
  player.invincible = 0;
  game.state = "level_intro";
}

export function start_campaign(game) {
  const player = game.player;
  player.lives = P.player_lives;
  player.health = player.max_health;
  begin_level(game, P.start_level);
}

export function retry_level(game) {
  const player = game.player;
  player.lives = P.player_lives;
  player.health = player.max_health;
  begin_level(game, game.level);
}

/** WEB: lanjutkan dari level yang tersimpan (seperti retry_level, tapi level dipilih). */
export function continue_campaign(game, level) {
  const player = game.player;
  player.lives = P.player_lives;
  player.health = player.max_health;
  begin_level(game, clamp(level, P.start_level, P.last_level));
}

export function finish_level(game) {
  const player = game.player;
  game.coins = game.coins + P.level_clear_bonus;
  game.level_coins = game.level_coins + P.level_clear_bonus;
  player.health = Math.min(player.max_health, player.health + P.heal_after_level);
  game.player_bullets.length = 0;
  game.enemy_bullets.length = 0;
  if (game.level >= P.last_level) game.state = "victory";
  else game.state = "level_complete";
}

export function update_play(game, input, dt) {
  const player = game.player;
  if (player.alive) update_player(game, input, dt);
  update_spawning(game, dt);
  update_enemies(game, dt);
  update_boss(game, dt);
  update_bullets(game.player_bullets, dt);
  update_bullets(game.enemy_bullets, dt);
  update_missiles(game, dt);
  update_powerups(game, dt);
  check_collisions(game, dt);
  const level_empty = game.to_spawn === 0 && game.enemies.length === 0 && !is_boss_level(game.level);
  if (level_empty && game.clear_timer < 0 && player.alive) game.clear_timer = 1.2;
  if (game.clear_timer > 0 && player.alive) {
    game.clear_timer = game.clear_timer - dt;
    if (game.clear_timer <= 0) finish_level(game);
  }
  if (game.end_timer > 0) {
    game.end_timer = game.end_timer - dt;
    if (game.end_timer <= 0) game.state = "game_over";
  }
}

export function update_game(game, input, dt) {
  const state = game.state;
  if (state === "paused") return;
  game.time = game.time + dt;
  update_stars(game.stars, dt);
  update_particles(game.particles, dt);
  update_popups(game.popups, dt);
  update_rings(game.rings, dt);
  game.shake = Math.max(0, game.shake - 30 * dt);
  game.shop_message_timer = Math.max(0, game.shop_message_timer - dt);
  if (state === "level_intro") {
    game.intro_timer = game.intro_timer - dt;
    if (game.intro_timer <= 0) game.state = "playing";
  } else if (state === "playing") {
    update_play(game, input, dt);
  } else if (state === "victory") {
    if (R.random() < 0.08) {
      const firework_color = R.choice([P.color_gold, P.color_cyan, P.color_red, P.color_green, [220, 120, 255]]);
      add_explosion(game.particles, R.uniform(100, dims.W - 100), R.uniform(80, 420), firework_color, 45, 320, 4);
    }
  }
}

/** Getaran layar: sama dengan bagian akhir run_game (dipakai saat menggambar). */
export function shake_offsets(game) {
  const shake = Math.trunc(game.shake);
  if (shake > 0) return [R.randint(-shake, shake), R.randint(-shake, shake)];
  return [0, 0];
}

/* ------------------------------------------------------------------ */
/* Shop & input (cell 19)                                              */
/* ------------------------------------------------------------------ */
export function shop_message(game, text) {
  game.shop_message = text;
  game.shop_message_timer = 2.0;
}

export function open_shop(game, return_state) {
  game.shop_return = return_state;
  game.shop_index = 0;
  game.state = "shop";
}

export function shop_entries() {
  return [...P.plane_order, ...Object.keys(P.shop_items), "BACK"];
}

export function shop_select(game, index) {
  const entry = shop_entries()[index];
  const player = game.player;
  if (entry in P.planes) {
    const price = P.planes[entry].Price;
    if (player.plane === entry) {
      shop_message(game, entry + " sudah dipakai");
    } else if (game.owned.includes(entry)) {
      equip_plane(game, entry);
      shop_message(game, entry + " siap terbang!");
    } else if (game.coins >= price) {
      game.coins = game.coins - price;
      game.owned.push(entry);
      equip_plane(game, entry);
      shop_message(game, "Berhasil membeli " + entry + "!");
    } else {
      shop_message(game, "Koin tidak cukup! Butuh " + String(price - game.coins) + " lagi");
    }
  } else if (entry === "Repair") {
    if (player.health >= player.max_health) shop_message(game, "Health sudah penuh");
    else if (game.coins >= P.shop_items.Repair.Price) {
      game.coins = game.coins - P.shop_items.Repair.Price;
      player.health = player.max_health;
      shop_message(game, "Pesawat diperbaiki!");
    } else shop_message(game, "Koin tidak cukup!");
  } else if (entry === "Extra Life") {
    if (player.lives >= P.max_lives) shop_message(game, "Nyawa sudah maksimal");
    else if (game.coins >= P.shop_items["Extra Life"].Price) {
      game.coins = game.coins - P.shop_items["Extra Life"].Price;
      player.lives = player.lives + 1;
      shop_message(game, "+1 nyawa!");
    } else shop_message(game, "Koin tidak cukup!");
  } else if (entry === "BACK") {
    game.state = game.shop_return;
  }
}

const ENTER = ["Enter", "NumpadEnter"];

/** Port bagian keyboard handle_shop_event. code = KeyboardEvent.code */
export function handle_shop_key(game, code) {
  const count = shop_entries().length;
  const plane_count = P.plane_order.length;
  const index = game.shop_index;
  if (code === "ArrowLeft" || code === "KeyA") game.shop_index = py_mod(index - 1, count);
  else if (code === "ArrowRight" || code === "KeyD") game.shop_index = py_mod(index + 1, count);
  else if ((code === "ArrowDown" || code === "KeyS") && index < plane_count) {
    game.shop_index = plane_count + Math.min(count - plane_count - 1, Math.floor(index / 2));
  } else if ((code === "ArrowUp" || code === "KeyW") && index >= plane_count) {
    game.shop_index = Math.min(plane_count - 1, (index - plane_count) * 2);
  } else if (ENTER.includes(code) || code === "Space") shop_select(game, index);
  else if (code === "Escape") game.state = game.shop_return;
}

/** Port bagian keyboard handle_event untuk layar permainan. */
export function handle_key(game, code) {
  const state = game.state;
  if (state === "shop") return handle_shop_key(game, code);
  if (state === "playing") {
    if (code === "Escape" || code === "KeyP") game.state = "paused";
    else if (code in P.ability_keys) use_ability(game, P.ability_keys[code]);
  } else if (state === "paused") {
    if (code === "Escape" || code === "KeyP") game.state = "playing";
    else if (code === "KeyM") game.state = "menu";
  } else if (state === "level_complete") {
    if (ENTER.includes(code)) begin_level(game, game.level + 1);
    else if (code === "KeyS") open_shop(game, "level_complete");
  } else if (state === "game_over") {
    if (code === "KeyR") retry_level(game);
    else if (code === "KeyS") open_shop(game, "game_over");
    else if (code === "KeyM") game.state = "menu";
  } else if (state === "victory") {
    if (ENTER.includes(code)) game.state = "menu";
  }
  return undefined;
}

export function plane_stats(name) {
  const plane = P.planes[name];
  return { SPEED: plane.Speed, "FIRE RATE": 1 / plane["Fire Delay"], POWER: plane.Damage * plane.Guns, ARMOR: plane.Armor };
}
