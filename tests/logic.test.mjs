/* Uji unit logika (tanpa browser). Jalankan: node tests/logic.test.mjs */
import assert from "node:assert/strict";
import * as P from "../js/params.js";
import * as L from "../js/logic.js";
import { R } from "../js/rng.js";

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok  - ${name}`); } catch (e) { console.error(`GAGAL - ${name}\n${e.stack}`); process.exitCode = 1; }
};
R.seed(1);

test("enemy_per_level sama dengan notebook", () => {
  assert.equal(P.enemy_per_level[1], 5);
  assert.equal(P.enemy_per_level[2], 9);
  assert.equal(P.enemy_per_level[19], 43);
  for (const lv of [5, 10, 15, 20]) assert.equal(P.enemy_per_level[lv], "BOSS");
});
test("health pesawat = int(100 x Armor)", () => {
  assert.equal(L.create_player("Viper").max_health, 114);
  assert.equal(L.create_player("Titan X").max_health, 200);
});
test("Rect meniru pygame (tepi kanan/bawah tidak termasuk)", () => {
  const r = new L.Rect(0, 0, 10, 10);
  assert.ok(r.collidepoint(0, 0) && r.collidepoint(9.9, 9.9) && !r.collidepoint(10, 5));
  assert.ok(r.colliderect(new L.Rect(9, 9, 5, 5)) && !r.colliderect(new L.Rect(10, 0, 5, 5)));
  assert.ok(!r.colliderect(new L.Rect(2, 2, 0, 5)));
});
test("py_mod sama dengan % Python", () => {
  assert.equal(L.py_mod(-1, 8), 7);
  assert.ok(Math.abs(L.py_mod(-0.5, Math.PI * 2) - (Math.PI * 2 - 0.5)) < 1e-12);
});
test("boss per level", () => {
  assert.equal(L.boss_name_for_level(5), "First Boss");
  assert.equal(L.boss_name_for_level(20), "Final Boss");
});
test("shop: beli, pakai, koin kurang, repair, extra life", () => {
  const g = L.new_game();
  g.coins = 200;
  L.shop_select(g, 1); // Viper 150
  assert.deepEqual([g.coins, g.player.plane], [50, "Viper"]);
  L.shop_select(g, 2); // Phoenix 450
  assert.match(g.shop_message, /Butuh 400 lagi/);
  L.shop_select(g, 0); // Falcon sudah dimiliki
  assert.equal(g.player.plane, "Falcon");
  g.player.health = 10; g.coins = 30;
  L.shop_select(g, 5); // Repair
  assert.equal(g.player.health, g.player.max_health);
  g.coins = 400; g.player.lives = 5;
  L.shop_select(g, 6);
  assert.equal(g.shop_message, "Nyawa sudah maksimal");
});
test("alur level: selesai -> level_complete -> level berikutnya", () => {
  const g = L.new_game();
  L.start_campaign(g);
  assert.equal(g.state, "level_intro");
  g.state = "playing"; g.to_spawn = 0;
  const input = { keys: {}, drag: null, auto_fire: false };
  for (let i = 0; i < 120; i++) L.update_game(g, input, 1 / 60);
  assert.equal(g.state, "level_complete");
  assert.equal(g.coins, P.level_clear_bonus);
  L.handle_key(g, "Enter");
  assert.equal(g.level, 2);
});
test("geser jari: pesawat mengikuti, dibatasi Speed pesawat", () => {
  const g = L.new_game();
  L.begin_level(g, 1);
  g.state = "playing";
  const input = { keys: {}, drag: { dx: -300, dy: 0 }, auto_fire: true };
  const x0 = g.player.x;
  L.update_player(g, input, 1 / 60);
  assert.ok(Math.abs(x0 - g.player.x - 1000 / 60) < 1e-9, "langkah maks = 1000 px/s x dt");
  for (let i = 0; i < 30; i++) L.update_player(g, input, 1 / 60);
  assert.ok(Math.abs(g.player.x - (x0 - 300)) < 1e-6);
  assert.ok(g.player_bullets.length > 0, "tembak otomatis");
});
test("continue_campaign membatasi level 1..20", () => {
  const g = L.new_game();
  L.continue_campaign(g, 99);
  assert.equal(g.level, 20);
});

console.log(`\n${passed} uji lolos${process.exitCode ? ", ADA YANG GAGAL" : ""}.`);
