'use strict';
// ============================================================
//  The Hub — the living, editable Lattice above the Fault
// ============================================================

const HUB_W = 64, HUB_H = 44;
const PLOT = { x0: 46, y0: 16, x1: 58, y1: 28 };
const SPIRE_POS = { tx: 54, ty: 19 };
const RIVAL_SPIRES = [{ tx: 15, ty: 10 }, { tx: 15, ty: 33 }, { tx: 27, ty: 35 }, { tx: 38, ty: 35 }];

const Hub = {
  init() {
    const rng = mulberry32(20261001);
    const g = genCave(HUB_W, HUB_H, rng, 0.5, 0.1);
    for (let y = 7; y <= 36; y++) for (let x = 11; x <= 59; x++) g.set(x, y, T.FLOOR);
    for (let y = 1; y < HUB_H - 1; y++)
      for (let x = 1; x < HUB_W - 1; x++)
        if (g.get(x, y) === T.ROCK && DIRS4.some(([dx, dy]) => g.get(x + dx, y + dy) === T.FLOOR) && rng() < 0.16) g.set(x, y, T.VEIN);
    for (const k in Save.data.hubEdits) {
      const [x, y] = k.split(',').map(Number);
      g.set(x, y, Save.data.hubEdits[k]);
    }
    this.grid = g;
    this.objects = [
      { id: 'fault', tx: 32, ty: 21, label: 'THE FAULT', sub: '[E] YUV DOWN', color: YUV_CYAN },
      { id: 'wall', tx: 32, ty: 9, label: 'THE YUV WALL', sub: '[E] read the names', color: '#ffd166' },
      { id: 'smith', tx: 22, ty: 14, label: 'Kesh · Tool Smith', npc: true, color: '#ffb347' },
      { id: 'quarter', tx: 42, ty: 14, label: 'Ama · Quartermaster', npc: true, color: '#7dff9a' },
      { id: 'spire', tx: 49, ty: 21, label: 'Ilo · Spire Keeper', npc: true, color: '#9b8cff' },
      { id: 'shrine', tx: 22, ty: 29, label: 'Skill Shrine', color: '#ff5ca8' },
      { id: 'board', tx: 32, ty: 31, label: 'Verse Board', color: '#ffd166' },
      { id: 'wardrobe', tx: 42, ty: 29, label: 'Wardrobe & Store', npc: true, color: '#ff7a3d' }
    ];
    for (const o of this.objects) { o.x = (o.tx + 0.5) * TILE; o.y = (o.ty + 0.5) * TILE; }
    this.fx = new FX();
    this.chat = [];
    this.chatT = 2;
    this.ghosts = shuffle(Save.data.rivals.slice()).slice(0, 7).map((r, i) => {
      const p = this.randomPlaza();
      return { name: r.name, house: r.house, x: p.x, y: p.y, r: 11, tx: p.x, ty: p.y, carry: Math.random() < 0.4 ? randi(40, 400) : 0,
        color: TEAM_COLORS[1 + (i % 2)], aim: 0, hit: 0, wait: rand(0, 3) };
    });
    this.enter();
  },

  enter() {
    const st = playerStats();
    this.player = { x: 32.5 * TILE, y: 24.5 * TILE, r: 11, aim: -Math.PI / 2, cd: 0, hp: st.maxHp, maxHp: st.maxHp, hit: 0, bindCharges: 2, bindT: 0 };
    this.cam = { x: this.player.x, y: this.player.y };
    this.hollows = []; this.bolts = [];
    this.dig = null; this.hollowT = 4; this.prompt = null;
  },

  randomPlaza() {
    for (let i = 0; i < 200; i++) {
      const tx = randi(12, 44), ty = randi(8, 35);
      if (this.grid.get(tx, ty) === T.FLOOR) return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
    }
    return { x: 32 * TILE, y: 24 * TILE };
  },

  edit(tx, ty, tile) {
    this.grid.set(tx, ty, tile);
    Save.data.hubEdits[tx + ',' + ty] = tile;
  },

  // the Yuv Tide: veins regrow after each dive
  regrow(n) {
    let made = 0;
    for (let i = 0; i < 400 && made < n; i++) {
      const x = randi(1, HUB_W - 2), y = randi(1, HUB_H - 2);
      if (this.grid.get(x, y) !== T.ROCK) continue;
      if (!DIRS4.some(([dx, dy]) => this.grid.get(x + dx, y + dy) === T.FLOOR)) continue;
      this.edit(x, y, T.VEIN); made++;
    }
    return made;
  },

  mouseWorld() { return { x: Input.mouse.x - Game.W / 2 + this.cam.x, y: Input.mouse.y - Game.H / 2 + this.cam.y }; },
  inPlot(tx, ty) { return tx >= PLOT.x0 && tx <= PLOT.x1 && ty >= PLOT.y0 && ty <= PLOT.y1; },
  say(text, color = '#dfe8ff') { this.chat.push({ text, color }); if (this.chat.length > 6) this.chat.shift(); },

  update(dt) {
    const s = Save.data, p = this.player, g = this.grid;
    this.fx.update(dt);
    this.updateGhosts(dt);
    this.chatT -= dt;
    if (this.chatT <= 0) {
      this.chatT = rand(5, 10);
      const r = pick(s.rivals);
      this.say(pick(CHAT_LINES).replace('{n}', r.name).replace('{k}', randi(80, 520)), '#b9b2d6');
    }
    s.corruption = Math.max(0, s.corruption - dt * 0.4);

    if (UI.open) return;

    const st = playerStats();
    const ax = Input.axis();
    moveCircle(g, p, ax.x * 190 * dt, ax.y * 190 * dt);
    this.cam.x = lerp(this.cam.x, p.x, 0.15); this.cam.y = lerp(this.cam.y, p.y, 0.15);
    const m = this.mouseWorld();
    p.aim = Math.atan2(m.y - p.y, m.x - p.x);
    p.cd -= dt; p.hit = Math.max(0, p.hit - dt);
    if (p.bindCharges < 2) { p.bindT += dt; if (p.bindT >= 7) { p.bindCharges++; p.bindT = 0; } }
    if (!this.hollows.length) p.hp = Math.min(p.maxHp, p.hp + 6 * dt);

    // hover / dig / place
    const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE);
    const t = g.get(tx, ty);
    const reach = Math.hypot((tx + 0.5) * TILE - p.x, (ty + 0.5) * TILE - p.y) < 2.8 * TILE;
    const diggable = (t === T.ROCK || t === T.VEIN || t === T.BLOCK) && tx > 0 && ty > 0 && tx < HUB_W - 1 && ty < HUB_H - 1;
    this.hover = { tx, ty, t, reach, diggable };
    if (Input.mouse.down && diggable && reach) {
      if (!this.dig || this.dig.tx !== tx || this.dig.ty !== ty) this.dig = { tx, ty, t: 0 };
      this.dig.t += dt * st.dig;
      const need = t === T.VEIN ? 0.9 : t === T.BLOCK ? 0.3 : 0.6;
      this.dig.need = need;
      if (Math.random() < dt * 8) { Sound.dig(); this.fx.burst((tx + 0.5) * TILE, (ty + 0.5) * TILE, t === T.VEIN ? YUV_CYAN : '#6a5a90', 2, 80, 0.4); }
      if (this.dig.t >= need) { this.finishDig(tx, ty, t); this.dig = null; }
    } else {
      this.dig = null;
      if (Input.mouse.down && p.cd <= 0 && !diggable) this.fire();
    }
    if (Input.mouse.rclicked) this.place(tx, ty, reach);
    if (Input.pressed[' ']) this.bind();

    // interactions
    this.prompt = null;
    let best = 60;
    for (const o of this.objects) { const k = dist(o, p); if (k < best) { best = k; this.prompt = o; } }
    if (Input.pressed['e'] && this.prompt) Game.openPanel(this.prompt.id);

    this.updateHollows(dt);
    this.updateBolts(dt);
  },

  finishDig(tx, ty, t) {
    const s = Save.data, cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
    this.edit(tx, ty, T.FLOOR);
    if (t === T.ROCK || t === T.BLOCK) {
      s.stone++;
      this.fx.text(cx, cy - 10, '+1 stone', '#c9bdf0', 12, 0.8);
      this.fx.burst(cx, cy, '#6a5a90', 8, 120, 0.5);
    } else if (t === T.VEIN) {
      const amt = Math.round(randi(4, 9) * mod('hubYield', 1));
      s.yuv += amt; s.corruption += 7; s.veinsMined++;
      this.fx.text(cx, cy - 10, '+' + amt + ' YUV', YUV_CYAN, 14, 1);
      this.fx.burst(cx, cy, YUV_CYAN, 14, 160, 0.7);
      Sound.pickup();
      const depth = Math.min(10, Math.floor(s.veinsMined / 5));
      if (depth > s.faultDepth) {
        s.faultDepth = depth;
        this.say(`[Lattice] The Fault below deepens to depth ${depth}. Richer nodes, tougher Hollows.`, '#9b8cff');
        this.fx.text(this.player.x, this.player.y - 40, 'THE FAULT DEEPENS', '#9b8cff', 16, 1.6);
      }
      if (s.corruption > 50 && s.corruption - 7 <= 50) this.say('[Lattice] Corruption is spreading from overmined veins. Hollows are coming.', '#ff5ca8');
    }
    Save.write();
  },

  place(tx, ty, reach) {
    const s = Save.data, g = this.grid;
    if (!reach || g.get(tx, ty) !== T.FLOOR) return;
    if (!this.inPlot(tx, ty)) { this.fx.text(this.player.x, this.player.y - 30, 'Build inside your plot', '#ff5c7a', 12, 1); return; }
    const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
    if (Math.hypot(cx - this.player.x, cy - this.player.y) < TILE * 0.9) return;
    if (this.objects.some(o => Math.abs(o.tx - tx) <= 1 && Math.abs(o.ty - ty) <= 1) || (Math.abs(SPIRE_POS.tx - tx) <= 1 && Math.abs(SPIRE_POS.ty - ty) <= 1)) return;
    if (s.stone < 1) { this.fx.text(this.player.x, this.player.y - 30, 'Need stone: dig rock', '#ff5c7a', 12, 1); return; }
    s.stone--;
    this.edit(tx, ty, T.BLOCK);
    this.fx.burst(cx, cy, YUV_CYAN, 8, 90, 0.4);
    this.fx.text(cx, cy - 12, 'YUV!', YUV_CYAN, 12, 0.6);
    Sound.dig();
    Save.write();
  },

  fire() {
    const p = this.player;
    p.cd = playerStats().fireCd;
    this.bolts.push({ x: p.x + Math.cos(p.aim) * 14, y: p.y + Math.sin(p.aim) * 14, vx: Math.cos(p.aim) * 580, vy: Math.sin(p.aim) * 580, life: 0.7, color: Save.data.aura });
    Sound.shoot(0.6);
  },

  bind() {
    const p = this.player, st = playerStats(), s = Save.data;
    if (p.bindCharges <= 0) return;
    p.bindCharges--;
    this.fx.text(p.x, p.y - 34, 'YUV!', s.aura, 22, 1.2);
    this.fx.ring(p.x, p.y, st.bindR, s.aura);
    this.fx.burst(p.x, p.y, s.aura, 30, st.bindR * 2.5, 0.6);
    Sound.bind(1); Sound.say('Yuv!');
    s.corruption = Math.max(0, s.corruption - 4);
    for (const h of this.hollows) if (dist(h, p) < st.bindR + h.r) { h.stun = 1.8; this.hurtHollow(h, st.bindDmg); }
    // ghosts nearby echo it back
    for (const gh of this.ghosts) if (dist(gh, p) < 260 && Math.random() < 0.7)
      setTimeout(() => this.fx.text(gh.x, gh.y - 30, 'YUV!', gh.color, 14, 1), 150 + Math.random() * 300);
  },

  updateGhosts(dt) {
    for (const gh of this.ghosts) {
      gh.wait -= dt;
      const d = Math.hypot(gh.tx - gh.x, gh.ty - gh.y);
      if (d < 6) {
        if (gh.wait <= 0) { const p = this.randomPlaza(); gh.tx = p.x; gh.ty = p.y; gh.wait = rand(1, 5); }
      } else {
        const a = Math.atan2(gh.ty - gh.y, gh.tx - gh.x);
        gh.x += Math.cos(a) * 80 * dt; gh.y += Math.sin(a) * 80 * dt; gh.aim = a;
      }
    }
  },

  updateHollows(dt) {
    const s = Save.data, p = this.player, g = this.grid;
    const max = s.corruption > 50 ? 1 + Math.floor((s.corruption - 50) / 15) : 0;
    this.hollowT -= dt;
    if (this.hollowT <= 0 && this.hollows.length < max) {
      this.hollowT = 6;
      for (let i = 0; i < 50; i++) {
        const q = this.randomPlaza();
        if (dist(q, p) > 350) {
          this.hollows.push({ x: q.x, y: q.y, r: 13, hp: 40, maxHp: 40, speed: 85, cd: 0, stun: 0, hit: 0, path: null, pathT: 0, seed: Math.random() * 10 });
          break;
        }
      }
    }
    for (const h of this.hollows) {
      h.hit = Math.max(0, h.hit - dt); h.cd -= dt; h.pathT -= dt;
      if (h.stun > 0) { h.stun -= dt; continue; }
      let mx = 0, my = 0;
      if (g.los(h.x, h.y, p.x, p.y)) { const a = Math.atan2(p.y - h.y, p.x - h.x); mx = Math.cos(a); my = Math.sin(a); }
      else {
        if (h.pathT <= 0) { const [sx, sy] = cellOf(h), [tx, ty] = cellOf(p); h.path = g.path(sx, sy, tx, ty, 3000); h.pathT = 1; }
        if (h.path && h.path.length) {
          const [cx, cy] = h.path[0], px = (cx + 0.5) * TILE, py = (cy + 0.5) * TILE;
          if (Math.hypot(px - h.x, py - h.y) < 8) h.path.shift();
          const a = Math.atan2(py - h.y, px - h.x); mx = Math.cos(a); my = Math.sin(a);
        }
      }
      moveCircle(g, h, mx * h.speed * dt, my * h.speed * dt);
      if (dist(h, p) < h.r + p.r + 3 && h.cd <= 0) {
        h.cd = 0.8; p.hp -= 8; p.hit = 0.12; Sound.hit();
        this.fx.text(p.x, p.y - 20, '8', '#ff5c7a', 12, 0.6);
        if (p.hp <= 0) this.hubDeath();
      }
    }
    this.hollows = this.hollows.filter(h => h.hp > 0);
  },

  hurtHollow(h, dmg) {
    h.hp -= dmg; h.hit = 0.1;
    if (h.hp <= 0) {
      const s = Save.data, bounty = Math.round(6 * mod('bounty', 1));
      s.yuv += bounty; s.corruption = Math.max(0, s.corruption - 8);
      this.fx.burst(h.x, h.y, '#a0306a', 18, 180, 0.7);
      this.fx.text(h.x, h.y - 20, `+${bounty} bounty`, '#ffd166', 13, 1);
      Save.write();
    }
  },

  hubDeath() {
    const s = Save.data, loss = Math.floor(s.yuv * 0.1);
    s.yuv -= loss;
    this.say(`[Lattice] ${s.name} got yuv'd in their own hub by Hollows (-${loss} YUV). Clean up that corruption.`, '#ff5c7a');
    Sound.death();
    this.enter();
    Save.write();
  },

  updateBolts(dt) {
    for (const b of this.bolts) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (this.grid.solidAt(b.x, b.y)) { b.life = 0; this.fx.burst(b.x, b.y, b.color, 3, 70, 0.25); continue; }
      for (const h of this.hollows) if (h.hp > 0 && Math.hypot(h.x - b.x, h.y - b.y) < h.r + 3) { this.hurtHollow(h, playerStats().dmg); b.life = 0; break; }
    }
    this.bolts = this.bolts.filter(b => b.life > 0);
  },

  // ---------------- drawing ----------------
  draw(ctx, W, H) {
    const s = Save.data, p = this.player, now = performance.now() / 1000;
    ctx.fillStyle = '#0d0a17'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(Math.round(W / 2 - this.cam.x), Math.round(H / 2 - this.cam.y));
    drawTiles(ctx, this.grid, this.cam, W, H, PAL_HUB);

    // plot
    ctx.save();
    ctx.setLineDash([8, 6]); ctx.strokeStyle = hexA(s.aura, 0.6); ctx.lineWidth = 2;
    ctx.strokeRect(PLOT.x0 * TILE, PLOT.y0 * TILE, (PLOT.x1 - PLOT.x0 + 1) * TILE, (PLOT.y1 - PLOT.y0 + 1) * TILE);
    ctx.restore();
    ctx.font = '700 11px Orbitron, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = hexA(s.aura, 0.8);
    ctx.fillText(`YUV MARK · ${s.name.toUpperCase()}'S PLOT`, PLOT.x0 * TILE + 6, PLOT.y0 * TILE - 8);

    // the Fault
    const f = this.objects[0];
    const fg = ctx.createRadialGradient(f.x, f.y, 4, f.x, f.y, 70);
    fg.addColorStop(0, '#000'); fg.addColorStop(0.6, '#0a1a24'); fg.addColorStop(1, 'rgba(124,247,255,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(f.x, f.y, 70, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(f.x, f.y);
    for (let i = 0; i < 3; i++) {
      ctx.rotate(now * (0.4 + i * 0.2));
      ctx.strokeStyle = hexA(YUV_CYAN, 0.5 - i * 0.12); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 30 + i * 12, 0, Math.PI * 1.3); ctx.stroke();
    }
    ctx.restore();
    ctx.font = '800 16px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = hexA(YUV_CYAN, 0.6 + 0.3 * Math.sin(now * 2));
    ctx.fillText('YUV', f.x, f.y + 6);
    ctx.font = '600 10px Inter, sans-serif'; ctx.fillStyle = '#9b8cff';
    ctx.fillText(`depth ${s.faultDepth}`, f.x, f.y + 22);

    this.drawWall(ctx);
    this.drawSpire(ctx, (SPIRE_POS.tx + 0.5) * TILE, (SPIRE_POS.ty + 0.5) * TILE, s.spire, s.aura, 'House ' + s.name, 1);
    const top = wallBoard().filter(r => !r.me).slice(0, RIVAL_SPIRES.length);
    RIVAL_SPIRES.forEach((pos, i) => {
      const r = top[i]; if (!r) return;
      this.drawSpire(ctx, (pos.tx + 0.5) * TILE, (pos.ty + 0.5) * TILE, clamp(Math.round(r.total / 900) + 1, 1, 10), TEAM_COLORS[1 + (i % 2)], r.house, 0.75);
    });

    // stations
    for (const o of this.objects) {
      if (o.id === 'fault' || o.id === 'wall') continue;
      if (o.npc) {
        drawAura(ctx, o.x, o.y, 40, o.color, 0.25);
        drawBody(ctx, { x: o.x, y: o.y + Math.sin(now * 2 + o.tx) * 2, r: 12, aim: Math.PI / 2, hit: 0 }, o.color);
      } else {
        drawAura(ctx, o.x, o.y, 46, o.color, 0.3);
        ctx.fillStyle = '#120e1e'; ctx.strokeStyle = o.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(o.x, o.y - 18); ctx.lineTo(o.x + 16, o.y); ctx.lineTo(o.x, o.y + 18); ctx.lineTo(o.x - 16, o.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.font = '800 11px Orbitron, sans-serif'; ctx.fillStyle = o.color; ctx.textAlign = 'center'; ctx.fillText('Y', o.x, o.y + 4);
      }
      ctx.font = '700 11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = o.color;
      ctx.fillText(o.label, o.x, o.y + 32);
    }

    // ghost Choruses (AI)
    for (const gh of this.ghosts) {
      ctx.globalAlpha = 0.8;
      if (gh.carry > 0) drawAura(ctx, gh.x, gh.y, 26 + Math.sqrt(gh.carry) * 5, gh.color, 0.3);
      drawBody(ctx, gh, gh.color, { name: gh.name + ' (ghost)', nameColor: gh.color });
      ctx.globalAlpha = 1;
      drawGlyph(ctx, gh.x, gh.y, gh.carry, gh.color);
    }
    for (const h of this.hollows) drawHollow(ctx, h);

    // hover tile
    const hv = this.hover;
    if (hv && hv.reach && (hv.diggable || (hv.t === T.FLOOR && this.inPlot(hv.tx, hv.ty)))) {
      ctx.strokeStyle = hv.diggable ? YUV_CYAN : 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
      ctx.strokeRect(hv.tx * TILE + 1, hv.ty * TILE + 1, TILE - 2, TILE - 2);
      if (this.dig) {
        ctx.fillStyle = YUV_CYAN;
        ctx.fillRect(hv.tx * TILE + 2, hv.ty * TILE + TILE - 6, (TILE - 4) * clamp(this.dig.t / this.dig.need, 0, 1), 4);
      }
    }

    // player
    if (s.yuv > 0) drawAura(ctx, p.x, p.y, 30, s.aura, 0.35);
    drawBody(ctx, p, '#e9fdff', { name: s.name, nameColor: s.aura, hpFrac: p.hp / p.maxHp });
    for (const b of this.bolts) {
      ctx.strokeStyle = b.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.025, b.y - b.vy * 0.025); ctx.stroke();
    }
    this.fx.draw(ctx);
    ctx.restore();

    // corruption vignette
    if (s.corruption > 20) {
      const a = clamp((s.corruption - 20) / 120, 0, 0.55);
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      vg.addColorStop(0, 'rgba(120,20,90,0)'); vg.addColorStop(1, `rgba(120,20,90,${a})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
    this.drawHud(ctx, W, H);
  },

  drawWall(ctx) {
    const o = this.objects[1], w = 7 * TILE, h = 46;
    const x = o.x - w / 2, y = o.y - h / 2;
    ctx.fillStyle = '#2a2140'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    ctx.font = '800 12px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd166';
    ctx.fillText('THE YUV WALL', o.x, y + 15);
    ctx.font = '600 10px Inter, sans-serif'; ctx.fillStyle = '#e9e4ff';
    const top = wallBoard().slice(0, 3).map((r, i) => `${i + 1}. ${r.name}`).join('   ');
    ctx.fillText(top, o.x, y + 33);
    ctx.fillStyle = '#ffd166'; ctx.fillText('[E] read the names', o.x, y + h + 14);
  },

  drawSpire(ctx, x, y, level, color, label, alpha) {
    const h = 30 + level * 14, w = 22;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawAura(ctx, x, y - h, 50 + level * 4, color, 0.35);
    const g = ctx.createLinearGradient(0, y - h, 0, y);
    g.addColorStop(0, color); g.addColorStop(1, '#1a1430');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 4, y - h); ctx.lineTo(x + w / 4, y - h); ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill();
    ctx.font = '800 12px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.fillText('YUV', x, y - h - 8);
    ctx.shadowBlur = 0;
    ctx.font = '600 10px Inter, sans-serif'; ctx.fillStyle = color;
    ctx.fillText(`${label} · Spire ${level}`, x, y + 14);
    ctx.restore();
  },

  drawHud(ctx, W, H) {
    const s = Save.data, p = this.player;
    ctx.save();
    ctx.fillStyle = 'rgba(10,7,20,0.75)'; ctx.fillRect(12, 12, 280, 118);
    ctx.strokeStyle = 'rgba(124,247,255,0.25)'; ctx.strokeRect(12.5, 12.5, 280, 118);
    ctx.textAlign = 'left';
    ctx.font = '800 13px Orbitron, sans-serif'; ctx.fillStyle = '#e9fdff'; ctx.fillText(s.name, 24, 32);
    ctx.font = '600 11px Inter, sans-serif'; ctx.fillStyle = '#9b8cff';
    const nr = nextRank(s.lifetime);
    ctx.fillText(`${rankName(s.lifetime)} · Lv ${s.level} · "${s.title}"${nr ? ` · next: ${nr.name} @ ${fmt(nr.min)}` : ''}`, 24, 47);
    ctx.fillStyle = '#2a213f'; ctx.fillRect(24, 54, 256, 6);
    ctx.fillStyle = '#9b8cff'; ctx.fillRect(24, 54, 256 * clamp(s.xp / levelXp(s.level), 0, 1), 6);
    ctx.font = '800 18px Orbitron, sans-serif'; ctx.fillStyle = YUV_CYAN; ctx.fillText(`${fmt(s.yuv)} YUV`, 24, 82);
    ctx.font = '600 11px Inter, sans-serif'; ctx.fillStyle = '#c9bdf0';
    ctx.fillText(`${s.stone} stone · ${s.anchors} Echo Anchors · ${s.sp} skill pts`, 24, 99);
    ctx.fillStyle = s.corruption > 50 ? '#ff5ca8' : '#bfb8d8';
    ctx.fillText(`Corruption ${Math.round(s.corruption)}% · Fault depth ${s.faultDepth}`, 24, 116);
    ctx.fillStyle = '#2a213f'; ctx.fillRect(190, 110, 90, 6);
    ctx.fillStyle = '#ff5ca8'; ctx.fillRect(190, 110, 90 * clamp(s.corruption / 100, 0, 1), 6);

    ctx.textAlign = 'center';
    ctx.font = '800 16px Orbitron, sans-serif'; ctx.fillStyle = '#ffd166';
    ctx.fillText(`SEASON ${s.season} · ${verseName().toUpperCase()}`, W / 2, 30);
    ctx.font = '600 12px Inter, sans-serif'; ctx.fillStyle = '#e9e4ff';
    const wk = week(), wd = VERSE_WEEKS[wk - 1];
    ctx.fillText(`Week ${wk}/10 — ${wd.name}: ${wd.desc}   ·   Pass tier ${passTier()}/40`, W / 2, 48);

    if (this.prompt) {
      const o = this.prompt;
      ctx.font = '800 14px Orbitron, sans-serif'; ctx.fillStyle = o.color;
      ctx.fillText(`[E] ${o.sub ? o.sub : o.label}`, W / 2, H - 70);
    }
    ctx.font = '600 12px Inter, sans-serif'; ctx.fillStyle = 'rgba(223,232,255,0.75)';
    ctx.fillText('WASD move · Hold click: dig rock/veins or shoot · Right-click: place Yuv Brick on your plot · [Space] YUV Bind · [E] interact · [M] mute', W / 2, H - 14);

    // chat
    ctx.textAlign = 'left';
    let y = H - 44 - this.chat.length * 16;
    ctx.font = '700 10px Orbitron, sans-serif'; ctx.fillStyle = '#7c7398';
    ctx.fillText('LATTICE CHAT · ghost Choruses are AI', 16, y - 6);
    ctx.font = '600 12px Inter, sans-serif';
    for (const c of this.chat) { ctx.fillStyle = c.color; ctx.fillText(c.text, 16, y + 10); y += 16; }
    ctx.restore();
  }
};
