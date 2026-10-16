/*
 * params.js — SEMUA parameter game, disalin dari notebook (cell "Parameter milikmu"
 * dan "Parameter tambahan"). Nama variabel sengaja sama dengan notebook.
 *
 * Mau mengubah game? Ubah angka di file ini saja, simpan, lalu unggah ulang ke GitHub.
 * Warna ditulis [R, G, B] (0–255), sama seperti tuple (R, G, B) di Python.
 */

// ---------- Ukuran dunia game (khusus versi web) ----------
// Laptop / HP mendatar memakai ukuran asli notebook. HP berdiri memakai versi tegak.
export const world_landscape = { width: 1100, height: 720 }; // = screen_width, screen_height di notebook
export const world_portrait = { width: 720, height: 1100 }; // HP posisi berdiri (potret)

// ---------- Parameter milikmu (TIDAK diubah) ----------
export const player_speed = 100; // kecepatan dasar pesawat pemain (dikali player_speed_scale)
export const bullet_speed = 100; // kecepatan dasar peluru pemain (dikali bullet_speed_scale)
export const enemy_bullet_speed = 100; // kecepatan dasar peluru musuh (dikali enemy_bullet_speed_scale)
export const bullet_player_power = 1; // damage dasar 1 peluru pemain
export const enemy_speed = 100; // kecepatan dasar musuh
export const enemy_speed_increase = 5; // tambahan kecepatan musuh setiap naik 1 level
export const enemy_base = 5; // jumlah musuh di level 1
export const enemy_increase = 2; // pengali tambahan jumlah musuh per level
export const start_level = 1; // level pertama saat game dimulai
export const last_level = 20; // level terakhir (Final Boss)
export const boss_every = 5; // boss muncul di setiap kelipatan 5 level
export const coins = 0; // jumlah koin awal pemain
export const coins_per_enemy = 5; // koin setiap menghancurkan 1 musuh
export const coins_per_lv5_boss = { "First Boss": 50, "Second Boss": 100, "Third Boss": 150, "Final Boss": 500 }; // hadiah koin boss
export const player_bar_health = 100; // health bar maksimal pemain
export const player_lives = 3; // jumlah nyawa pemain
export const enemy_types = {
  Attacker: { Speed: enemy_speed, "Enemy health": 5, "Bullet Speed": enemy_bullet_speed, "Bullet Damage": 10 }, // musuh biasa
  Tank: { Speed: enemy_speed * 0.6, "Enemy health": 15, "Bullet Speed": enemy_bullet_speed, "Bullet Damage": 20 }, // lambat tapi tebal
};
export const enemy_per_level = {}; // nomor level -> jumlah musuh (atau "BOSS")
for (let i = 1; i < 21; i++) {
  if (i === 1) enemy_per_level[i] = enemy_base; // level 1 berisi 5 musuh
  else if (i % 5 === 0) enemy_per_level[i] = "BOSS"; // level 5, 10, 15, 20
  else enemy_per_level[i] = enemy_base + i * enemy_increase; // bertambah setiap level
}

// ---------- Parameter tambahan ----------
export const game_title = "SKY STRIKER";
export const fps = 60; // info saja: browser menggambar sesuai layar, semua gerakan memakai dt

// Skala kecepatan (angka 100 milikmu dikali skala ini)
export const player_speed_scale = 10;
export const bullet_speed_scale = 8.0;
export const enemy_bullet_speed_scale = 3.0;
export const enemy_speed_scale = 1.0;
export const boss_bullet_speed_scale = 2.6;

// Aturan gameplay
export const invincible_time = 2.0; // kebal (detik) setelah kehilangan 1 nyawa
export const hit_flash_time = 0.08; // musuh berkedip putih saat terkena tembakan
export const max_enemies_on_screen = 6; // batas musuh di layar (bertambah 1 setiap 3 level)
export const spawn_delay = 0.9; // jeda rata-rata munculnya musuh baru
export const enemy_health_bonus_per_level = 0.2; // HP musuh +0.2 per level
export const enemy_fire_increase = 0.03; // musuh menembak 3% lebih sering per level
export const level_clear_bonus = 20; // bonus koin setiap level selesai
export const heal_after_level = 25; // health dipulihkan setelah level selesai
export const powerup_drop_chance = 0.1; // 10% peluang musuh menjatuhkan item
export const powerup_heal = 25; // item hijau (+)
export const powerup_coins = 15; // item emas ($)
export const max_lives = 5; // nyawa maksimal

// 2 tipe musuh tambahan
enemy_types.Scout = { Speed: enemy_speed * 1.8, "Enemy health": 2, "Bullet Speed": 0, "Bullet Damage": 25 }; // kamikaze
enemy_types.Sniper = { Speed: enemy_speed * 0.8, "Enemy health": 4, "Bullet Speed": enemy_bullet_speed * 1.6, "Bullet Damage": 15 }; // membidik pemain

// Data tambahan setiap tipe musuh (tampilan & perilaku)
export const enemy_extra = {
  Attacker: { Behavior: "strafe", Shots: 1, "Fire Delay": 1.8, Size: 46, Color: [235, 70, 80], "Coin Multiplier": 1, "Unlock Level": 1, Chance: 5 },
  Tank: { Behavior: "strafe", Shots: 3, "Fire Delay": 2.4, Size: 64, Color: [130, 185, 90], "Coin Multiplier": 2, "Unlock Level": 6, Chance: 2 },
  Scout: { Behavior: "kamikaze", Shots: 0, "Fire Delay": 0, Size: 34, Color: [255, 200, 60], "Coin Multiplier": 1, "Unlock Level": 3, Chance: 3 },
  Sniper: { Behavior: "sniper", Shots: 1, "Fire Delay": 2.6, Size: 44, Color: [200, 100, 255], "Coin Multiplier": 2, "Unlock Level": 11, Chance: 2 },
};

// Data boss
export const boss_names = Object.keys(coins_per_lv5_boss); // First, Second, Third, Final Boss
export const boss_attack_time = 4.0; // setiap 4 detik boss berganti pola serangan
export const boss_stats = {
  "First Boss": { Title: "IRON HAWK", Health: 200, Speed: 140, "Bullet Damage": 10, Width: 220, Height: 110, Color: [235, 90, 70], Attacks: ["spread", "aimed"] },
  "Second Boss": { Title: "STORM WIDOW", Health: 380, Speed: 160, "Bullet Damage": 12, Width: 250, Height: 120, Color: [70, 160, 255], Attacks: ["spiral", "spread", "aimed"] },
  "Third Boss": { Title: "INFERNO CORE", Health: 650, Speed: 180, "Bullet Damage": 15, Width: 280, Height: 130, Color: [255, 150, 40], Attacks: ["ring", "aimed", "spiral"] },
  "Final Boss": { Title: "OMEGA DREAD", Health: 1400, Speed: 200, "Bullet Damage": 18, Width: 320, Height: 150, Color: [200, 70, 255], Attacks: ["spread", "spiral", "ring", "rain", "aimed"] },
};

// Pesawat di Hangar/Shop
export const planes = {
  Falcon: { Price: 0, Speed: 1.00, "Fire Delay": 0.22, Guns: 1, Damage: 1.0, Armor: 1.0, Missiles: 4, Cooldown: 1.00, Wing: 1.00, Color: [70, 140, 255], Accent: [170, 220, 255], Info: "Pesawat awal seimbang" },
  Viper: { Price: 150, Speed: 1.10, "Fire Delay": 0.18, Guns: 2, Damage: 1.0, Armor: 1.15, Missiles: 6, Cooldown: 0.95, Wing: 1.05, Color: [50, 200, 120], Accent: [170, 255, 200], Info: "Gesit, 2 senapan" },
  Phoenix: { Price: 450, Speed: 1.20, "Fire Delay": 0.16, Guns: 3, Damage: 1.5, Armor: 1.3, Missiles: 8, Cooldown: 0.85, Wing: 1.15, Color: [255, 120, 50], Accent: [255, 210, 140], Info: "Tembakan 3 arah" },
  Spectre: { Price: 1000, Speed: 1.35, "Fire Delay": 0.13, Guns: 3, Damage: 2.0, Armor: 1.5, Missiles: 10, Cooldown: 0.75, Wing: 1.25, Color: [160, 90, 255], Accent: [225, 190, 255], Info: "Super cepat & lincah" },
  "Titan X": { Price: 1500, Speed: 1.30, "Fire Delay": 0.11, Guns: 5, Damage: 2.5, Armor: 2.0, Missiles: 12, Cooldown: 0.65, Wing: 1.35, Color: [255, 200, 60], Accent: [255, 245, 190], Info: "Raja langit, 5 senapan" },
};
export const plane_order = Object.keys(planes);

export const shop_items = {
  Repair: { Price: 30, Info: "Isi penuh health" },
  "Extra Life": { Price: 200, Info: "+1 nyawa (maks 5)" },
};

// 4 ability unik
export const abilities = {
  Shield: { Key: "Q", Cooldown: 12, Duration: 3.0, Color: [80, 220, 255] },
  Missiles: { Key: "E", Cooldown: 8, Duration: 0, Color: [255, 170, 60] },
  Laser: { Key: "R", Cooldown: 15, Duration: 2.5, Color: [255, 80, 200] },
  EMP: { Key: "F", Cooldown: 20, Duration: 0, Color: [140, 255, 140] },
};
export const ability_keys = { KeyQ: "Shield", KeyE: "Missiles", KeyR: "Laser", KeyF: "EMP" }; // tombol keyboard -> ability
export const missile_damage = 3;
export const missile_speed = 520;
export const laser_damage_per_second = 20;
export const laser_width = 36;
export const emp_damage = 8;

// Warna
export const color_white = [255, 255, 255];
export const color_gold = [255, 205, 70];
export const color_red = [255, 70, 80];
export const color_green = [90, 230, 120];
export const color_cyan = [80, 220, 255];
export const color_gray = [150, 155, 180];

// ---------- Khusus versi HP ----------
export const touch_sensitivity_default = 1.3; // 1 cm geser jari = 1.3 cm gerak pesawat
