/*
 * ui.js — layar & tombol HTML (pengganti draw_hud, draw_menu, draw_shop, draw_pause,
 * draw_level_complete, draw_game_over, draw_victory di notebook). Teks sama dengan
 * notebook; hanya cara menekannya yang disesuaikan untuk layar sentuh.
 */
import * as P from "./params.js";
import * as L from "./logic.js";
import { draw_plane_preview, draw_lives } from "./render.js";

const $ = (sel) => document.querySelector(sel);
const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const ARENA = new Set(["level_intro", "playing", "paused", "level_complete", "game_over"]);

const ICONS = {
  Shield: '<circle r="15" fill="none" stroke="currentColor" stroke-width="3"/><circle r="8" fill="currentColor" opacity="0.6"/>',
  Missiles: [-9, 0, 9].map((dx) => `<polygon points="${dx},-14 ${dx + 4},8 ${dx - 4},8" fill="currentColor"/>`).join(""),
  Laser: '<rect x="-6" y="-16" width="12" height="32" rx="5" fill="currentColor"/><rect x="-2" y="-16" width="4" height="32" fill="#fff"/>',
  EMP: '<circle r="16" fill="none" stroke="currentColor" stroke-width="2"/><circle r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle r="3" fill="#fff"/>',
};

export class UI {
  constructor(actions) {
    this.actions = actions;
    this.cache = new Map();
    this.state = null;
    this.menu_index = 0;
    this.settings_open = false;
    this.shop_signature = "";
    this.lives_signature = "";
    this.ability_els = {};
    this.build_abilities();
    this.build_shop();
    this.wire();
  }

  /* -------------------------------------------------- pembangun */
  build_abilities() {
    const wrap = $("#abilities");
    for (const [name, ab] of Object.entries(P.abilities)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ability";
      b.style.setProperty("--c", css(ab.Color));
      b.setAttribute("aria-label", `${name} (${ab.Key})`);
      b.innerHTML = `<svg viewBox="-20 -20 40 40" aria-hidden="true">${ICONS[name]}</svg><i class="cover"></i><b class="cd"></b><span class="key">${ab.Key}</span>`;
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.actions.ability(name);
      });
      wrap.append(b);
      this.ability_els[name] = { button: b, cover: b.querySelector(".cover"), cd: b.querySelector(".cd") };
    }
  }

  build_shop() {
    const grid = $("#plane-grid");
    const items = $("#item-row");
    const best = {};
    for (const name of P.plane_order) {
      const stats = L.plane_stats(name);
      for (const key of Object.keys(stats)) best[key] = Math.max(best[key] || 0, stats[key]);
    }
    this.shop_cards = [];
    L.shop_entries().forEach((entry, index) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.index = String(index);
      if (entry in P.planes) {
        const plane = P.planes[entry];
        b.className = "card plane-card";
        b.style.setProperty("--c", css(plane.Color));
        b.style.setProperty("--glow", plane.Color.join(","));
        const stats = L.plane_stats(entry);
        b.innerHTML = `<canvas aria-hidden="true"></canvas><span class="name">${entry.toUpperCase()}</span>`
          + `<span class="info">${plane.Info}</span><span class="stats">${Object.keys(stats).map((k) => `<span>${k}</span><span class="bar"><i style="width:${(100 * stats[k]) / best[k]}%;background:${css(plane.Color)}"></i></span>`).join("")}</span>`
          + `<span class="guns">Guns ${plane.Guns}   Missiles ${plane.Missiles}</span><span class="status"></span>`;
        grid.append(b);
      } else if (entry === "BACK") {
        b.className = "btn";
        b.innerHTML = "BACK <kbd>ESC</kbd>";
        items.append(b);
      } else {
        b.className = "card item-card";
        b.innerHTML = `<span class="name">${entry.toUpperCase()}</span><span class="price"></span><span class="info">${P.shop_items[entry].Info}</span><span class="now"></span>`;
        items.append(b);
      }
      b.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") this.actions.shop_hover(index); });
      b.addEventListener("click", () => this.actions.shop_select(index));
      this.shop_cards.push({ entry, el: b, canvas: b.querySelector("canvas") });
    });
  }

  wire() {
    document.querySelectorAll("#menu-buttons .btn").forEach((b) => {
      b.addEventListener("click", () => this.actions.menu(b.dataset.menu));
      b.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "mouse") return;
        const visible = this.menu_buttons();
        this.menu_index = Math.max(0, visible.indexOf(b));
        this.paint_menu_selection();
      });
    });
    $("#btn-pause").addEventListener("click", () => this.actions.pause());
    $("#btn-victory-menu").addEventListener("click", () => this.actions.key("Enter"));
    $("#btn-settings-back").addEventListener("click", () => this.actions.close_settings());
  }

  menu_buttons() { return [...document.querySelectorAll("#menu-buttons .btn")].filter((b) => !b.hidden); }

  paint_menu_selection() {
    this.menu_buttons().forEach((b, i) => b.classList.toggle("selected", i === this.menu_index));
  }

  menu_key(code) {
    const buttons = this.menu_buttons();
    if (code === "ArrowUp" || code === "KeyW") this.menu_index = (this.menu_index - 1 + buttons.length) % buttons.length;
    else if (code === "ArrowDown" || code === "KeyS") this.menu_index = (this.menu_index + 1) % buttons.length;
    else if (code === "Enter" || code === "NumpadEnter" || code === "Space") buttons[this.menu_index]?.click();
    this.paint_menu_selection();
  }

  /* -------------------------------------------------- utilitas */
  set(el, key, value, prop = "textContent") {
    const k = `${key}|${prop}`;
    if (this.cache.get(k) === value) return;
    this.cache.set(k, value);
    if (prop === "textContent") el.textContent = value;
    else if (prop === "width") el.style.width = value;
    else if (prop === "height") el.style.height = value;
    else if (prop === "background") el.style.background = value;
    else if (prop === "color") el.style.color = value;
  }

  /* -------------------------------------------------- sinkron per frame */
  sync(game, ctx) {
    const state = game.state;
    if (state !== this.state || ctx.force) this.enter_state(game, state, ctx);
    if (ARENA.has(state)) this.sync_hud(game, ctx);
    if (state === "level_intro") this.sync_intro(game, ctx);
    if (state === "menu") {
      const k = Math.min(1, ($("#menu-plane").clientHeight || 160) / 190);
      draw_plane_preview($("#menu-plane"), game.player.plane, 2.2 * k, Math.sin(game.time) * 0.4, Math.sin(game.time * 2) * 8 * k);
    }
    if (state === "victory") {
      const k = Math.min(1, ($("#victory-plane").clientHeight || 160) / 190);
      draw_plane_preview($("#victory-plane"), game.player.plane, 2.0 * k, 0, Math.sin(game.time * 2) * 8 * k);
    }
    if (state === "shop") this.sync_shop(game);
    $("#settings").hidden = !this.settings_open;
  }

  enter_state(game, state, ctx) {
    this.state = state;
    const arena = ARENA.has(state);
    $("#menu").hidden = state !== "menu";
    $("#shop").hidden = state !== "shop";
    $("#victory").hidden = state !== "victory";
    $("#hud").hidden = !arena;
    $("#intro").hidden = state !== "level_intro";
    $("#abilities").hidden = !arena;
    $("#btn-pause").hidden = !(state === "playing" || state === "level_intro");
    const overlay = ["paused", "level_complete", "game_over"].includes(state);
    $("#overlay").hidden = !overlay;
    if (overlay) this.build_overlay(game, state);
    if (state === "menu") this.build_menu(game, ctx);
    if (state === "victory") $("#victory-coins").textContent = `Total coins:  ${game.coins}`;
    if (state === "shop") this.shop_signature = "";
    this.lives_signature = "";
  }

  build_menu(game, ctx) {
    const cont = document.querySelector('[data-menu="continue"]');
    const checkpoint = ctx.save.checkpoint || 1;
    cont.hidden = !(checkpoint > P.start_level);
    cont.textContent = `LANJUTKAN LEVEL ${checkpoint}`;
    $("#menu-info").textContent = `Coins: ${game.coins}    |    Pesawat: ${game.player.plane}`;
    $("#menu-help").textContent = ctx.touch
      ? "Geser jari = terbang   Tombol bulat = ability   Pesawat menembak otomatis"
      : "WASD/Panah = gerak   SPACE = tembak   Q E R F = ability   P = pause";
    this.menu_index = Math.min(this.menu_index, this.menu_buttons().length - 1);
    this.paint_menu_selection();
  }

  build_overlay(game, state) {
    const panel = $("#overlay-panel");
    const buttons = $("#ov-buttons");
    const lines = ["#ov-line1", "#ov-line2", "#ov-line3"].map((s) => $(s));
    lines.forEach((l) => { l.textContent = ""; });
    buttons.replaceChildren();
    const add = (label, key, action, selected = false) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `btn${selected ? " selected" : ""}`;
      b.innerHTML = key ? `${label} <kbd>${key}</kbd>` : label;
      b.addEventListener("click", action);
      buttons.append(b);
    };
    panel.className = "panel center-panel";
    if (state === "paused") {
      panel.classList.add("cyan");
      $("#ov-title").textContent = "PAUSED";
      add("LANJUT", "P / ESC", () => this.actions.key("KeyP"), true);
      add("PENGATURAN", "", () => this.actions.open_settings());
      add("MENU UTAMA", "M", () => this.actions.key("KeyM"));
    } else if (state === "level_complete") {
      panel.classList.add("green");
      $("#ov-title").textContent = L.is_boss_level(game.level) ? "BOSS DEFEATED!" : `LEVEL ${game.level} CLEAR!`;
      lines[0].textContent = `Coins level ini:  +${game.level_coins}`;
      lines[1].textContent = `Total coins:  ${game.coins}`;
      lines[2].textContent = `Health dipulihkan +${P.heal_after_level}`;
      add(`LEVEL ${game.level + 1}`, "ENTER", () => this.actions.key("Enter"), true);
      add("HANGAR / SHOP", "S", () => this.actions.key("KeyS"));
    } else if (state === "game_over") {
      panel.classList.add("red");
      $("#ov-title").textContent = "GAME OVER";
      lines[0].textContent = `Kamu gugur di level ${game.level}`;
      lines[1].textContent = "Koin & pesawat tetap tersimpan. Upgrade di Hangar!";
      add("COBA LAGI", "R", () => this.actions.key("KeyR"), true);
      add("HANGAR", "S", () => this.actions.key("KeyS"));
      add("MENU", "M", () => this.actions.key("KeyM"));
    }
  }

  sync_hud(game, ctx) {
    const player = game.player;
    const plane = P.planes[player.plane];
    this.set($("#hud-level"), "lvl", `LEVEL ${game.level} / ${P.last_level}`);
    this.set($("#hud-plane"), "pn", player.plane.toUpperCase());
    this.set($("#hud-plane"), "pc", css(plane.Color), "color");
    const ratio = L.clamp(player.health / player.max_health, 0, 1);
    this.set($("#hud-hp"), "hpw", `${(ratio * 100).toFixed(1)}%`, "width");
    this.set($("#hud-hp"), "hpc", css(L.mix_color(P.color_red, P.color_green, ratio)), "background");
    this.set($("#hud-hp-text"), "hpt", `${Math.max(0, Math.trunc(player.health))}/${player.max_health}`);
    this.set($("#hud-coins"), "coins", String(game.coins));
    const lives_sig = `${player.plane}|${player.lives}|${ctx.ui_scale}`;
    if (lives_sig !== this.lives_signature) {
      this.lives_signature = lives_sig;
      draw_lives($("#hud-lives"), player.plane, player.lives);
    }
    const center = $(".hud-center");
    const bar = $("#hud-center-bar");
    if (game.boss !== null) {
      const boss = game.boss;
      center.hidden = false;
      center.classList.add("boss");
      this.set($("#hud-center-text"), "ct", `${boss.name.toUpperCase()}  -  ${boss.title}`);
      this.set($("#hud-center-text"), "cc", css(boss.color), "color");
      this.set(bar, "cw", `${(L.clamp(boss.health / boss.max_health, 0, 1) * 100).toFixed(1)}%`, "width");
      this.set(bar, "cb", css(L.mix_color(boss.color, P.color_red, 0.3)), "background");
    } else if (!L.is_boss_level(game.level)) {
      const total = P.enemy_per_level[game.level];
      const remaining = game.to_spawn + game.enemies.length;
      center.hidden = false;
      center.classList.remove("boss");
      this.set($("#hud-center-text"), "ct", `ENEMIES  ${total - remaining} / ${total}`);
      this.set($("#hud-center-text"), "cc", "#fff", "color");
      this.set(bar, "cw", `${(((total - remaining) / total) * 100).toFixed(1)}%`, "width");
      this.set(bar, "cb", css(P.color_cyan), "background");
    } else {
      center.hidden = true;
    }
    for (const [name, ab] of Object.entries(P.abilities)) {
      const els = this.ability_els[name];
      const cooldown = player.cooldowns[name];
      const max_cooldown = ab.Cooldown * plane.Cooldown;
      const active = (name === "Shield" && player.shield_time > 0) || (name === "Laser" && player.laser_time > 0);
      const ready = cooldown <= 0;
      const cls = active ? "ability active" : ready ? "ability ready" : "ability cooling";
      if (els.button.className !== cls) els.button.className = cls;
      this.set(els.cover, `cv${name}`, ready ? "0%" : `${((100 * cooldown) / max_cooldown).toFixed(1)}%`, "height");
      this.set(els.cd, `cd${name}`, ready ? "" : String(Math.ceil(cooldown)));
    }
  }

  sync_intro(game, ctx) {
    const level = game.level;
    const intro = $("#intro");
    const key = `${level}|${ctx.touch}`;
    if (this.cache.get("intro") === key) return;
    this.cache.set("intro", key);
    if (L.is_boss_level(level)) {
      const name = L.boss_name_for_level(level);
      intro.classList.add("boss");
      $("#intro-warning").hidden = false;
      $("#intro-title").textContent = `${name.toUpperCase()}  :  ${P.boss_stats[name].Title}`;
      $("#intro-sub").textContent = "Hindari pola tembakannya & pakai ability!";
      $("#intro-tip").textContent = "";
    } else {
      intro.classList.remove("boss");
      $("#intro-warning").hidden = true;
      $("#intro-title").textContent = `LEVEL ${level}`;
      $("#intro-sub").textContent = `${P.enemy_per_level[level]} musuh menunggu  -  GET READY!`;
      $("#intro-tip").textContent = level === P.start_level
        ? (ctx.touch ? "Geser jari untuk terbang. Pesawat menembak otomatis. Tombol bulat = ability."
          : "Tahan SPACE untuk menembak.  Q E R F untuk ability.")
        : "";
    }
  }

  sync_shop(game) {
    const player = game.player;
    const sig = `${game.coins}|${game.owned.join(",")}|${player.plane}|${game.shop_index}|${player.health}|${player.lives}`;
    if (sig !== this.shop_signature) {
      this.shop_signature = sig;
      $("#shop-coins").textContent = String(game.coins);
      this.shop_cards.forEach(({ entry, el }, index) => {
        el.classList.toggle("selected", index === game.shop_index);
        if (entry in P.planes) {
          const plane = P.planes[entry];
          let status_text;
          let status_color;
          if (player.plane === entry) { status_text = "EQUIPPED"; status_color = P.color_green; }
          else if (game.owned.includes(entry)) { status_text = "OWNED - PAKAI"; status_color = P.color_cyan; }
          else { status_text = `BUY  ${plane.Price}`; status_color = game.coins >= plane.Price ? P.color_gold : [200, 90, 90]; }
          const status = el.querySelector(".status");
          status.textContent = status_text;
          status.style.color = css(status_color);
          status.style.background = css(L.shade(status_color, 0.25));
        } else if (entry !== "BACK") {
          const item = P.shop_items[entry];
          const price = el.querySelector(".price");
          price.textContent = `${item.Price} coins`;
          price.style.color = game.coins >= item.Price ? css(P.color_gold) : "rgb(200,90,90)";
          el.querySelector(".now").textContent = entry === "Repair"
            ? `Health ${Math.trunc(player.health)}/${player.max_health}` : `Lives ${player.lives}/${P.max_lives}`;
        } else {
          el.classList.toggle("selected", index === game.shop_index);
        }
      });
      const selected = this.shop_cards[game.shop_index];
      if (selected && document.activeElement !== selected.el && selected.el.scrollIntoView && this.keyboard_nav) {
        selected.el.scrollIntoView({ block: "nearest" });
      }
    }
    this.set($("#shop-msg"), "msg", game.shop_message_timer > 0 ? game.shop_message : "");
    this.shop_cards.forEach(({ entry, canvas }, index) => {
      if (!canvas) return;
      const selected = index === game.shop_index;
      const wing = P.planes[entry].Wing;
      const scale = Math.min(1.35, (canvas.clientWidth - 8) / (68 * wing), canvas.clientHeight / 80);
      draw_plane_preview(canvas, entry, scale, selected ? Math.sin(game.time * 3) * 0.5 : 0, selected ? Math.sin(game.time * 3) * 4 : 0);
    });
  }
}
