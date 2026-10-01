'use strict';
// ============================================================
//  The Dive — extraction run inside the Fault
//  yuv down -> loot -> glow -> survive the Surge -> YUV UP
// ============================================================

const Dive = {
  start(opts = {}) {
    const s = Save.data;
    this.st = playerStats();
    this.grid = genCave(84, 64);
    const g = this.grid;
    this.t = 0; this.over = false; this.endTimer = 0; this.result = null; this.paused = false;
    this.depth = s.faultDepth; this.week = week();
    this.yieldMul = mod('diveYield', 1) * (1 + 0.06 * this.depth);
    this.shrinkDur = 200 / mod('surge', 1);
    this.collapseAt = this.shrinkDur + 45;
    this.center = { x: g.w * TILE / 2, y: g.h * TILE / 2 };
    this.R0 = Math.hypot(this.center.x, this.center.y) + 60;
    this.Rmin = 9 * TILE;
    this.divers = []; this.hollows = []; this.bolts = []; this.nodes = []; this.orbs = []; this.gates = [];
    this.fx = new FX(); this.feed = []; this.timers = [];
    this.kills = 0; this.hollowKills = 0; this.bounty = 0; this.squadBank = 0; this.rivalBanked = {};
    this.shake = 0; this.banner = null; this.hollowT = 8;
    this.finished = false; this.warned60 = false; this.warnedOpen = false;
    this.autopilot = !!opts.autopilot;

    // Rift Gates: one near the heart of the Fault, two far out
    const c = this.center;
    const g1 = randomFloor(g, p => dist(p, c) < this.Rmin * 0.5) || { x: c.x, y: c.y };
    g.carve(Math.floor(g1.x / TILE), Math.floor(g1.y / TILE), 2);
    this.gates.push({ x: g1.x, y: g1.y, r: 46, name: GATE_NAMES[0] });
    for (let i = 1; i < 3; i++) {
      const p = randomFloor(g, q => dist(q, c) > this.R0 * 0.42 && this.gates.every(o => dist(o, q) > 900))
        || randomFloor(g, q => this.gates.every(o => dist(o, q) > 500)) || randomFloor(g);
      g.carve(Math.floor(p.x / TILE), Math.floor(p.y / TILE), 2);
      this.gates.push({ x: p.x, y: p.y, r: 46, name: GATE_NAMES[i] });
    }

    // spawns for three squads, far apart
    const spawns = [];
    for (let i = 0; i < 3; i++) {
      const p = randomFloor(g, q => dist(q, c) > 500 && spawns.every(o => dist(o, q) > 1100) && this.gates.every(o => dist(o, q) > 350))
        || randomFloor(g, q => spawns.every(o => dist(o, q) > 600)) || randomFloor(g);
      g.carve(Math.floor(p.x / TILE), Math.floor(p.y / TILE), 3);
      spawns.push(p);
    }

    // the player squad: you + 3 Echo AI squadmates (always disclosed as AI)
    const st = this.st;
    this.player = this.mkDiver({
      name: s.name, team: 0, isPlayer: true, ai: this.autopilot, hp: st.maxHp, maxHp: st.maxHp,
      dmg: st.dmg, speed: st.speed, fireCd: st.fireCd, aura: s.aura, greed: 220
    });
    this.place(this.player, spawns[0], 0);
    this.cam = { x: this.player.x, y: this.player.y };
    const echoNames = shuffle(ECHO_NAMES.slice());
    for (let i = 0; i < 3; i++) {
      const d = this.mkDiver({ name: 'Echo-' + echoNames[i], team: 0, isEcho: true, hp: 90, maxHp: 90, dmg: 9 + this.week * 0.4, aura: YUV_CYAN });
      this.place(d, spawns[0], i + 1);
    }
    // two rival squads drawn from the YUV Wall
    const rivals = shuffle(s.rivals.slice());
    for (let team = 1; team <= 2; team++) {
      for (let i = 0; i < 3; i++) {
        const r = rivals[(team - 1) * 3 + i];
        const d = this.mkDiver({
          name: r.name, house: r.house, team, hp: 85 + this.week * 4, maxHp: 85 + this.week * 4,
          dmg: 8 + this.week * 0.6, aura: TEAM_COLORS[team]
        });
        this.place(d, spawns[team], i);
      }
    }

    // YUV nodes
    for (let i = 0; i < 24; i++) {
      const p = randomFloor(g, q => this.nodes.every(n => dist(n, q) > 170) && spawns.every(o => dist(o, q) > 200));
      if (!p) continue;
      const big = Math.random() < 0.18;
      const hp = big ? 70 : 34;
      this.nodes.push({ x: p.x, y: p.y, hp, maxHp: hp, big, yield: Math.round(randi(10, 22) * (big ? 2.6 : 1) * this.yieldMul) });
    }
    // Hollows
    const nh = Math.round(5 * mod('hollows', 1));
    for (let i = 0; i < nh; i++) this.spawnHollow();

    this.say(pick(YUV_LINES));
    this.flash('YUV DOWN', `${verseName()} · Week ${this.week}: ${VERSE_WEEKS[this.week - 1].name}`, YUV_CYAN);
    this.log(`Fault depth ${this.depth}. Nodes yield x${this.yieldMul.toFixed(2)}.`, '#9b8cff');
    this.log('Squadmates "Echo-" and rivals are AI (prototype).', '#8a83a8');
  },

  mkDiver(o) {
    return Object.assign({
      x: 0, y: 0, r: 11, hp: 100, maxHp: 100, team: 0, carry: 0, safe: 0, name: '?', house: '',
      aim: 0, cd: 0, bindCharges: 2, bindT: 0, dead: false, out: false, extractT: 0,
      path: null, pathT: 0, thinkT: Math.random() * 0.3, goal: null, foe: null, mode: 'loot',
      greed: randi(90, 200), isPlayer: false, isEcho: false, ai: true, kills: 0, dmg: 10, speed: 150,
      fireCd: 0.38, hit: 0, lastHitBy: null, overdrive: false, mvx: 0, mvy: 0, strafe: Math.random() < 0.5 ? 1 : -1,
      stuckT: 0, lastX: 0, lastY: 0, aura: YUV_CYAN
    }, o);
  },

  place(d, sp, i) {
    const offs = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]];
    d.x = sp.x + offs[i][0] * TILE; d.y = sp.y + offs[i][1] * TILE;
    this.divers.push(d);
  },

  spawnHollow(farFromPlayer = true) {
    const R = this.radius();
    const p = randomFloor(this.grid, q => dist(q, this.center) < R - 40 &&
      (!farFromPlayer || this.divers.every(d => d.dead || d.out || dist(d, q) > 450)));
    if (!p) return;
    const hp = Math.round(42 * (1 + 0.06 * this.depth));
    this.hollows.push({ x: p.x, y: p.y, r: 13, hp, maxHp: hp, speed: 92 + this.depth * 3, cd: 0, stun: 0, hit: 0,
      target: null, path: null, pathT: 0, thinkT: 0, wander: Math.random() * 6.28, seed: Math.random() * 10 });
  },

  radius() {
    if (this.t < this.shrinkDur) return lerp(this.R0, this.Rmin, this.t / this.shrinkDur);
    return this.Rmin * Math.max(0, 1 - (this.t - this.shrinkDur) / (this.collapseAt - this.shrinkDur));
  },

  gateOpen(gt) { return this.t >= 15 && dist(gt, this.center) < this.radius() - 10; },

  log(text, color = '#dfe8ff') { this.feed.push({ text, color, t: 7 }); if (this.feed.length > 7) this.feed.shift(); },
  flash(text, sub, color = '#fff') { this.banner = { text, sub, color, t: 2.6 }; },
  say(line) { this.log('YUV: "' + line + '"', YUV_CYAN); },
  after(delay, fn) { this.timers.push({ t: delay, fn }); },
  alive(d) { return d && !d.dead && !d.out && (d.hp === undefined || d.hp > 0); },

  // ---------------- update ----------------
  update(dt) {
    this.fx.update(dt);
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    for (const f of this.feed) f.t -= dt;
    this.feed = this.feed.filter(f => f.t > 0);
    this.shake = Math.max(0, this.shake - dt * 30);

    if (this.over) {
      this.endTimer -= dt;
      if (this.endTimer <= 0 && !this.finished) { this.finished = true; Game.finishDive(this.result); }
      return;
    }
    this.t += dt;
    const R = this.radius();

    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0) tm.fn(); }
    this.timers = this.timers.filter(tm => tm.t > 0);

    const p = this.player;
    if (this.alive(p)) {
      if (p.ai) this.think(p, dt); else this.playerInput(p, dt);
    }
    for (const d of this.divers) if (d.ai && d !== p && this.alive(d)) this.think(d, dt);

    // divers: movement, surge, pickups, extraction
    for (const d of this.divers) {
      if (!this.alive(d)) continue;
      d.hit = Math.max(0, d.hit - dt); d.cd -= dt;
      if (d.bindCharges < 2) { d.bindT += dt; if (d.bindT >= 7) { d.bindCharges++; d.bindT = 0; } }
      if (d.overdrive && d.carry > 0) {
        const cost = (d.isPlayer ? this.st.overdriveCost : 6) * dt;
        d.carry = Math.max(0, d.carry - cost); d.safe = Math.min(d.safe, d.carry);
        if (Math.random() < 0.5) this.fx.burst(d.x, d.y, d.aura, 1, 60, 0.4);
      } else d.overdrive = false;
      const greedSlow = 1 - Math.min(0.25, d.carry / 1200);
      const sp = d.speed * greedSlow * (d.overdrive ? 1.6 : 1);
      moveCircle(this.grid, d, d.mvx * sp * dt, d.mvy * sp * dt);

      const dc = dist(d, this.center);
      if (dc > R) {
        d.hp -= (this.t > this.shrinkDur ? 26 : 9) * dt;
        d.lastHitBy = d.lastHitBy && d.lastHitBy !== 'the Surge' && d.hit > 0 ? d.lastHitBy : 'the Surge';
        if (d.isPlayer && Math.random() < dt * 4) this.fx.burst(d.x, d.y, '#ff5ca8', 2, 80, 0.4);
      }
      if (this.t >= this.collapseAt) { d.hp = 0; d.lastHitBy = 'the Surge'; }

      for (const o of this.orbs) {
        if (o.amt <= 0) continue;
        const od = dist(o, d);
        if (od < 70) { o.x += (d.x - o.x) * dt * 6; o.y += (d.y - o.y) * dt * 6; }
        if (od < d.r + 10) {
          d.carry += o.amt;
          if (d.isPlayer) { d.safe = Math.min(d.carry, this.st.safeCap); Sound.pickup(); this.fx.text(d.x, d.y - 20, '+' + o.amt, YUV_CYAN, 12, 0.7); }
          o.amt = 0;
        }
      }

      let inGate = null;
      for (const gt of this.gates) if (this.gateOpen(gt) && dist(gt, d) < gt.r) inGate = gt;
      if (inGate) {
        const need = d.isPlayer ? this.st.extractTime : 2.6;
        d.extractT += dt;
        if (d.extractT >= need) this.extract(d, inGate);
      } else d.extractT = Math.max(0, d.extractT - dt * 2);

      if (d.hp <= 0) this.kill(d);
    }
    this.orbs = this.orbs.filter(o => o.amt > 0);

    this.updateHollows(dt, R);
    this.updateBolts(dt);

    this.hollowT -= dt;
    if (this.hollowT <= 0) {
      this.hollowT = 10 / mod('hollows', 1);
      if (this.hollows.length < 11 * mod('hollows', 1)) this.spawnHollow();
    }

    // warnings
    if (!this.warned60 && this.collapseAt - this.t < 60) { this.warned60 = true; this.flash('THE SURGE RISES', '60 seconds until total collapse. YUV UP!', '#ff5ca8'); this.say('The Surge comes for what is unspoken. Speak.'); }
    if (!this.warnedOpen && this.t >= 15) { this.warnedOpen = true; this.log('Rift Gates are open. Stand inside one to YUV UP.', '#7dff9a'); }
  },

  playerInput(p, dt) {
    const ax = Input.axis();
    p.mvx = ax.x; p.mvy = ax.y;
    const m = this.mouseWorld();
    p.aim = Math.atan2(m.y - p.y, m.x - p.x);
    p.overdrive = !!Input.keys['shift'] && p.carry > 0;
    if (Input.mouse.down && p.cd <= 0) this.fire(p);
    if (Input.pressed[' ']) this.bind(p);
    if (Input.keys['e']) {
      const n = this.nearestNode(p, 46);
      if (n) this.mineNode(p, n, dt);
    }
  },

  mouseWorld() {
    return { x: Input.mouse.x - Game.W / 2 + this.cam.x, y: Input.mouse.y - Game.H / 2 + this.cam.y };
  },

  nearestNode(d, range) {
    let best = null, bd = range;
    for (const n of this.nodes) { if (n.hp <= 0) continue; const k = dist(n, d); if (k < bd) { bd = k; best = n; } }
    return best;
  },

  mineNode(d, n, dt) {
    const rate = d.isPlayer ? this.st.mine : 20;
    n.hp -= rate * dt;
    if (Math.random() < dt * 10) this.fx.burst(n.x, n.y, YUV_CYAN, 2, 90, 0.4);
    if (d.isPlayer && Math.random() < dt * 6) Sound.dig();
    if (n.hp <= 0) this.breakNode(n);
  },

  breakNode(n) {
    if (n.broken) return;
    n.broken = true; n.hp = 0;
    this.spill(n.x, n.y, n.yield, 4);
    this.fx.burst(n.x, n.y, YUV_CYAN, 22, 220, 0.8);
    this.fx.ring(n.x, n.y, 60, YUV_CYAN);
  },

  spill(x, y, amount, pieces = 4) {
    amount = Math.floor(amount);
    if (amount <= 0) return;
    pieces = Math.max(1, Math.min(pieces, amount));
    const each = Math.floor(amount / pieces);
    for (let i = 0; i < pieces; i++) {
      const amt = i === pieces - 1 ? amount - each * (pieces - 1) : each;
      const a = Math.random() * 6.28, r = rand(6, 26);
      let ox = x + Math.cos(a) * r, oy = y + Math.sin(a) * r;
      if (this.grid.solidAt(ox, oy)) { ox = x; oy = y; }
      this.orbs.push({ x: ox, y: oy, amt, seed: Math.random() * 10 });
    }
  },

  fire(d) {
    const spread = d.isPlayer ? 0.03 : 0.1;
    const a = d.aim + rand(-spread, spread);
    this.bolts.push({ x: d.x + Math.cos(a) * 14, y: d.y + Math.sin(a) * 14, vx: Math.cos(a) * 580, vy: Math.sin(a) * 580,
      team: d.team, dmg: d.dmg, life: 0.85, owner: d, color: d.team === 0 ? (d.isPlayer ? d.aura : '#9ff') : TEAM_COLORS[d.team] });
    d.cd = d.fireCd;
    const near = d.isPlayer ? 1 : clamp(1 - dist(d, this.player) / 700, 0, 0.6);
    if (near > 0.05) Sound.shoot(near);
  },

  updateBolts(dt) {
    for (const b of this.bolts) {
      for (let sub = 0; sub < 2 && b.life > 0; sub++) {
        b.x += b.vx * dt / 2; b.y += b.vy * dt / 2;
        if (this.grid.solidAt(b.x, b.y)) { b.life = 0; this.fx.burst(b.x, b.y, b.color, 3, 80, 0.25); break; }
        for (const d of this.divers) {
          if (!this.alive(d) || d.team === b.team) continue;
          if (Math.hypot(d.x - b.x, d.y - b.y) < d.r + 3) { this.damage(d, b.dmg, b.owner); b.life = 0; break; }
        }
        if (b.life <= 0) break;
        for (const h of this.hollows) {
          if (h.hp <= 0) continue;
          if (Math.hypot(h.x - b.x, h.y - b.y) < h.r + 3) { this.damageHollow(h, b.dmg, b.owner); b.life = 0; break; }
        }
        if (b.life <= 0) break;
        for (const n of this.nodes) {
          if (n.hp <= 0) continue;
          if (Math.hypot(n.x - b.x, n.y - b.y) < 16) {
            n.hp -= b.dmg * 0.7; b.life = 0;
            this.fx.burst(b.x, b.y, YUV_CYAN, 3, 70, 0.3);
            if (n.hp <= 0) this.breakNode(n);
            break;
          }
        }
      }
      b.life -= dt;
    }
    this.bolts = this.bolts.filter(b => b.life > 0);
  },

  damage(d, amt, src) {
    if (!this.alive(d)) return;
    d.hp -= amt; d.hit = 0.12;
    d.lastHitBy = src;
    if (src && src.team !== undefined && d.ai && src !== d) { d.foe = src; }
    if (d.isPlayer) { Sound.hit(); this.shake = Math.max(this.shake, 6); }
    if (d.isPlayer || (src && src.isPlayer)) this.fx.text(d.x + rand(-8, 8), d.y - 18, Math.round(amt), d.isPlayer ? '#ff5c7a' : '#fff', 12, 0.6);
    if (d.hp <= 0) this.kill(d);
  },

  damageHollow(h, amt, src) {
    h.hp -= amt; h.hit = 0.1;
    if (src && src.team !== undefined) h.target = src;
    if (h.hp <= 0 && !h.dead) {
      h.dead = true;
      this.fx.burst(h.x, h.y, '#a0306a', 18, 180, 0.7);
      this.spill(h.x, h.y, randi(4, 8) * this.yieldMul, 2);
      if (src && src.isPlayer) {
        this.hollowKills++;
        const bounty = Math.round(8 * mod('bounty', 1));
        src.carry += bounty; src.safe = Math.min(src.carry, this.st.safeCap);
        this.fx.text(h.x, h.y - 20, '+' + bounty + ' bounty', '#ffd166', 13);
      }
    }
  },

  kill(d) {
    if (d.dead) return;
    d.dead = true; d.hp = 0;
    const killer = d.lastHitBy;
    const kname = killer === 'the Surge' ? 'the Surge' : killer && killer.name ? killer.name : 'a Hollow';
    this.fx.burst(d.x, d.y, d.aura, 30, 260, 1);
    this.fx.text(d.x, d.y - 26, "YUV'D", '#ff5c7a', 18, 1.4);
    if (d.isPlayer) { this.endDive(false, kname); return; }
    const drop = Math.floor(d.carry * 0.7);
    this.spill(d.x, d.y, drop, Math.min(8, Math.max(1, Math.ceil(drop / 15))));
    d.carry = 0;
    if (killer && killer.isPlayer) {
      this.kills++;
      this.flash("YOU YUV'D " + d.name.toUpperCase(), drop > 0 ? `${drop} YUV spilled on the floor` : '', '#ffd166');
    }
    this.log(`${kname} yuv'd ${d.name}${drop > 0 ? ` (${drop} spilled)` : ''}`, d.team === 0 ? '#ff5c7a' : '#ffd166');
  },

  extract(d, gate) {
    d.out = true;
    this.fx.burst(d.x, d.y, d.aura, 40, 300, 1.1);
    this.fx.ring(d.x, d.y, 120, d.aura);
    this.fx.text(d.x, d.y - 30, 'YUV UP!', d.aura, 20, 1.6);
    this.log(`${d.name} yuv'd up at ${gate.name} with ${fmt(d.carry)}`, d.team === 0 ? '#7dff9a' : '#ffb3c1');
    if (d.isEcho) this.squadBank += d.carry;
    else if (!d.isPlayer) this.rivalBanked[d.name] = (this.rivalBanked[d.name] || 0) + d.carry;
    if (d.isPlayer) this.endDive(true, gate.name);
  },

  endDive(success, cause) {
    if (this.over) return;
    const s = Save.data, p = this.player;
    let kept, anchorUsed = false;
    const dropPct = deathDropPct();
    if (success) kept = p.carry;
    else {
      kept = p.safe + (p.carry - p.safe) * (1 - dropPct);
      if (s.anchors > 0 && p.carry > 0) { s.anchors--; anchorUsed = true; kept += p.carry * 0.4; }
      kept = Math.min(p.carry, kept);
    }
    let share = this.squadBank;
    for (const d of this.divers) if (d.isEcho && this.alive(d)) share += d.carry * 0.5;
    share *= this.st.squadShare;
    this.result = {
      success, cause, haul: Math.floor(p.carry), kept: Math.floor(kept), share: Math.floor(share),
      kills: this.kills, hollowKills: this.hollowKills, anchorUsed, time: this.t, dropPct, rivalBanked: this.rivalBanked
    };
    this.over = true;
    this.endTimer = success ? 1.6 : 2.4;
    if (success) { Sound.up(); Sound.say('Yuv up!'); this.flash('YUV UP!', `Extracted with ${fmt(p.carry)} YUV`, '#7dff9a'); }
    else { Sound.death(); Sound.say("You got yuv'd"); this.flash("YOU GOT YUV'D", `by ${cause}`, '#ff5c7a'); }
  },

  // ---------------- YUV Bind ----------------
  bind(d) {
    if (d.bindCharges <= 0) { if (d.isPlayer) this.fx.text(d.x, d.y - 24, 'Bind recharging', '#aaa', 11, 0.8); return false; }
    d.bindCharges--;
    const echoes = [];
    const chorusR = d.isPlayer ? this.st.chorusR : 200;
    for (const m of this.divers) {
      if (m === d || m.team !== d.team || !this.alive(m)) continue;
      if (dist(m, d) < chorusR && (d.isPlayer || Math.random() < 0.6)) echoes.push(m);
    }
    const mul = 1 + 0.35 * echoes.length;
    const R = (d.isPlayer ? this.st.bindR : 80) * (1 + 0.2 * echoes.length);
    const dmg = (d.isPlayer ? this.st.bindDmg : 28) * mul;
    this.fx.text(d.x, d.y - 34, 'YUV!', d.aura, 22, 1.2);
    echoes.forEach((m, i) => this.after(0.12 * (i + 1), () => {
      if (!this.alive(m)) return;
      this.fx.text(m.x, m.y - 30, 'YUV!', m.aura, 16, 1);
      this.fx.ring(m.x, m.y, 60, m.aura);
    }));
    this.blast(d.x, d.y, R, dmg, d.team, d, d.aura);
    const near = d.isPlayer ? 1 : clamp(1 - dist(d, this.player) / 700, 0, 1);
    if (near > 0.1) { Sound.bind(echoes.length + 1); this.shake = Math.max(this.shake, 14 * near); }
    if (d.isPlayer) {
      Sound.say('Yuv!');
      if (echoes.length) this.flash('CHORUS BIND x' + (echoes.length + 1), 'Your squad says it with you', YUV_CYAN);
    }
    return true;
  },

  blast(x, y, R, dmg, team, src, color) {
    const g = this.grid;
    const tx0 = Math.floor((x - R) / TILE), tx1 = Math.floor((x + R) / TILE);
    const ty0 = Math.floor((y - R) / TILE), ty1 = Math.floor((y + R) / TILE);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = g.get(tx, ty);
        if (t !== T.ROCK && t !== T.VEIN) continue;
        const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
        if (Math.hypot(cx - x, cy - y) > R) continue;
        g.set(tx, ty, T.FLOOR);
        this.fx.burst(cx, cy, t === T.VEIN ? YUV_CYAN : '#4b3a6e', 4, 120, 0.5);
        if (t === T.VEIN) this.spill(cx, cy, randi(4, 8) * this.yieldMul, 1);
      }
    for (const d of this.divers) {
      if (!this.alive(d) || d.team === team) continue;
      const k = dist(d, { x, y });
      if (k > R + d.r) continue;
      this.damage(d, dmg, src);
      const a = Math.atan2(d.y - y, d.x - x);
      for (let i = 0; i < 6; i++) moveCircle(g, d, Math.cos(a) * 10, Math.sin(a) * 10);
    }
    for (const h of this.hollows) {
      if (h.hp <= 0 || dist(h, { x, y }) > R + h.r) continue;
      h.stun = 1.8;
      this.damageHollow(h, dmg, src);
    }
    for (const n of this.nodes) {
      if (n.hp <= 0 || dist(n, { x, y }) > R) continue;
      n.hp -= dmg * 0.8;
      if (n.hp <= 0) this.breakNode(n);
    }
    this.fx.ring(x, y, R, color);
    this.fx.burst(x, y, color, 30, R * 2.5, 0.6);
  },

  // ---------------- AI ----------------
  think(d, dt) {
    d.thinkT -= dt; d.pathT -= dt;
    if (d.thinkT <= 0) { d.thinkT = 0.25 + Math.random() * 0.1; this.decide(d); }

    // combat
    const f = d.foe;
    if (f && (f.hp > 0) && !f.dead && !f.out) {
      const fd = dist(d, f);
      if (fd < 400 && this.grid.los(d.x, d.y, f.x, f.y)) {
        d.aim = Math.atan2(f.y - d.y, f.x - d.x);
        if (d.cd <= 0) this.fire(d);
        if (fd < 75 && d.bindCharges > 0 && Math.random() < dt * 1.5) this.bind(d);
      }
    } else d.foe = null;

    // mining
    if (d.mode === 'loot' && d.goal && d.goal.isNode && d.goal.hp > 0 && dist(d, d.goal) < 36) {
      d.mvx = 0; d.mvy = 0;
      d.aim = Math.atan2(d.goal.y - d.y, d.goal.x - d.x);
      this.mineNode(d, d.goal, dt);
      return;
    }

    // steering along path
    let tx = null, ty = null;
    if (d.path && d.path.length) {
      const [cx, cy] = d.path[0];
      tx = (cx + 0.5) * TILE; ty = (cy + 0.5) * TILE;
      if (Math.hypot(tx - d.x, ty - d.y) < 8) { d.path.shift(); }
    } else if (d.goal) { tx = d.goal.x; ty = d.goal.y; }

    if (d.mode === 'fight' && d.foe) {
      const fd = dist(d, d.foe);
      const a = Math.atan2(d.foe.y - d.y, d.foe.x - d.x);
      if (fd < 230 && this.grid.los(d.x, d.y, d.foe.x, d.foe.y)) {
        const back = fd < 120 ? -0.7 : 0.15;
        d.mvx = Math.cos(a) * back + Math.cos(a + Math.PI / 2) * d.strafe * 0.8;
        d.mvy = Math.sin(a) * back + Math.sin(a + Math.PI / 2) * d.strafe * 0.8;
        const l = Math.hypot(d.mvx, d.mvy) || 1; d.mvx /= l; d.mvy /= l;
        if (Math.random() < dt * 0.6) d.strafe *= -1;
        return;
      }
    }
    if (tx !== null) {
      const a = Math.atan2(ty - d.y, tx - d.x);
      const dd = Math.hypot(tx - d.x, ty - d.y);
      if (dd > 4) { d.mvx = Math.cos(a); d.mvy = Math.sin(a); } else { d.mvx = 0; d.mvy = 0; }
      if (!d.foe) d.aim = a;
    } else { d.mvx = 0; d.mvy = 0; }

    // unstick: if barely moving while trying to, blast through with a Bind
    d.stuckT += dt;
    if (d.stuckT > 1) {
      const moved = Math.hypot(d.x - d.lastX, d.y - d.lastY);
      if (moved < 12 && (d.mvx || d.mvy)) { d.path = null; d.pathT = 0; if (d.bindCharges > 0 && !d.isPlayer) this.bind(d); }
      d.stuckT = 0; d.lastX = d.x; d.lastY = d.y;
    }
  },

  decide(d) {
    const R = this.radius();
    const timeLeft = this.collapseAt - this.t;
    const p = this.player;

    // pick a foe
    let foe = null, best = 1e9;
    const aggro = d.team === 0 ? 1 : mod('aggro', 1);
    for (const e of this.divers) {
      if (!this.alive(e) || e.team === d.team) continue;
      const k = dist(d, e);
      let range = 330;
      if (e.carry > 60) range += 140 * aggro * (e.isPlayer ? this.st.hush : 1);
      if (k < range && k < best && this.grid.los(d.x, d.y, e.x, e.y)) { foe = e; best = k; }
    }
    for (const h of this.hollows) {
      if (h.hp <= 0) continue;
      const k = dist(d, h);
      if (k < 250 && k < best && this.grid.los(d.x, d.y, h.x, h.y)) { foe = h; best = k; }
    }
    if (foe || !d.foe || d.foe.dead || d.foe.out || d.foe.hp <= 0 || dist(d, d.foe) > 600) d.foe = foe;

    const nearestGate = () => {
      let g = null, bd = 1e9;
      for (const gt of this.gates) {
        const gd = dist(gt, this.center);
        if (gd > R - 60 && this.t > 15) continue;
        const k = dist(gt, d) + (gd > R * 0.8 ? 300 : 0);
        if (k < bd) { bd = k; g = gt; }
      }
      return g || this.gates[0];
    };

    let wantOut = d.carry >= d.greed || (timeLeft < 80 && d.carry > 0) || (timeLeft < 40) || (d.hp < d.maxHp * 0.35 && d.carry > 25);
    if (d.isEcho && (!this.alive(p) || p.extractT > 0)) wantOut = true;
    if (d.isPlayer && this.autopilot && timeLeft < 120) wantOut = true;

    let goal = null, mode = 'loot';
    if (dist(d, this.center) > R - 30) { goal = nearestGate(); mode = 'extract'; }
    else if (wantOut) { goal = nearestGate(); mode = 'extract'; }
    else if (d.foe && d.hp > d.maxHp * 0.35) { goal = { x: d.foe.x, y: d.foe.y }; mode = 'fight'; }
    else {
      const anchor = d.isEcho && this.alive(p) ? p : null;
      if (anchor && dist(d, anchor) > 300) goal = { x: anchor.x, y: anchor.y };
      else {
        let bo = null, bd = 520;
        for (const o of this.orbs) {
          const k = dist(o, d);
          if (k < bd && dist(o, this.center) < R - 40 && (!anchor || dist(o, anchor) < 380)) { bd = k; bo = o; }
        }
        if (bo) goal = { x: bo.x, y: bo.y };
        else {
          let bn = null, bs = 1e9;
          for (const n of this.nodes) {
            if (n.hp <= 0 || dist(n, this.center) > R - 60) continue;
            if (anchor && dist(n, anchor) > 420) continue;
            const k = dist(n, d) - (n.big ? 150 : 0);
            if (k < bs) { bs = k; bn = n; }
          }
          if (bn) { goal = bn; bn.isNode = true; }
          else if (anchor) goal = { x: anchor.x, y: anchor.y };
          else goal = { x: this.center.x + rand(-200, 200), y: this.center.y + rand(-200, 200) };
        }
      }
    }
    const changed = !d.goal || !goal || Math.hypot(d.goal.x - goal.x, d.goal.y - goal.y) > 64;
    d.goal = goal; d.mode = mode;
    if (goal && (changed || d.pathT <= 0 || !d.path)) {
      const [sx, sy] = cellOf(d), [gx, gy] = cellOf(goal);
      d.path = this.grid.path(sx, sy, gx, gy);
      d.pathT = 0.8;
    }
  },

  updateHollows(dt, R) {
    const g = this.grid;
    for (const h of this.hollows) {
      if (h.hp <= 0) continue;
      h.hit = Math.max(0, h.hit - dt); h.cd -= dt; h.thinkT -= dt; h.pathT -= dt;
      if (h.stun > 0) { h.stun -= dt; continue; }
      if (h.thinkT <= 0) {
        h.thinkT = 0.5;
        let best = null, bs = 1e9;
        for (const d of this.divers) {
          if (!this.alive(d)) continue;
          const aura = 30 + Math.sqrt(d.carry) * 6 * (d.isPlayer ? this.st.hush : 1);
          const k = dist(h, d);
          if (k < 200 + aura * 1.5 && k - aura < bs) { bs = k - aura; best = d; }
        }
        if (best) h.target = best;
        if (h.target && !this.alive(h.target)) h.target = null;
        if (h.target && !g.los(h.x, h.y, h.target.x, h.target.y) && h.pathT <= 0) {
          const [sx, sy] = cellOf(h), [tx, ty] = cellOf(h.target);
          h.path = g.path(sx, sy, tx, ty, 2500); h.pathT = 1;
        }
      }
      let mx = 0, my = 0;
      const t = h.target;
      if (t && this.alive(t)) {
        if (g.los(h.x, h.y, t.x, t.y)) { const a = Math.atan2(t.y - h.y, t.x - h.x); mx = Math.cos(a); my = Math.sin(a); h.path = null; }
        else if (h.path && h.path.length) {
          const [cx, cy] = h.path[0]; const px = (cx + 0.5) * TILE, py = (cy + 0.5) * TILE;
          if (Math.hypot(px - h.x, py - h.y) < 8) h.path.shift();
          const a = Math.atan2(py - h.y, px - h.x); mx = Math.cos(a); my = Math.sin(a);
        }
        if (dist(h, t) < h.r + t.r + 3 && h.cd <= 0) {
          h.cd = 0.8;
          this.damage(t, 10 + this.depth, { name: 'a Hollow' });
          if (t.ai) t.foe = h;
        }
      } else {
        h.wander += rand(-1.5, 1.5) * dt;
        mx = Math.cos(h.wander) * 0.4; my = Math.sin(h.wander) * 0.4;
      }
      const before = h.x + h.y;
      moveCircle(g, h, mx * h.speed * dt, my * h.speed * dt);
      if (!t && Math.abs(h.x + h.y - before) < 0.01) h.wander += 2;
    }
    this.hollows = this.hollows.filter(h => h.hp > 0);
  },

  // ---------------- drawing ----------------
  draw(ctx, W, H) {
    const p = this.player;
    if (!this.cam) this.cam = { x: p.x, y: p.y };
    this.cam.x = lerp(this.cam.x, p.x, 0.15);
    this.cam.y = lerp(this.cam.y, p.y, 0.15);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    const R = this.radius();

    ctx.fillStyle = '#07050d'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(Math.round(W / 2 - this.cam.x + sx), Math.round(H / 2 - this.cam.y + sy));
    drawTiles(ctx, this.grid, this.cam, W, H, PAL_DIVE);

    // the Surge
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.cam.x - W, this.cam.y - H, W * 2, H * 2);
    ctx.arc(this.center.x, this.center.y, Math.max(1, R), 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(255,40,120,0.20)'; ctx.fill();
    ctx.setLineDash([18, 12]); ctx.lineDashOffset = -this.t * 40;
    ctx.strokeStyle = '#ff5ca8'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(this.center.x, this.center.y, Math.max(1, R), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // gates
    for (const gt of this.gates) {
      const open = this.gateOpen(gt);
      const col = open ? '#7dff9a' : (this.t < 15 ? '#ffd166' : '#555');
      drawAura(ctx, gt.x, gt.y, gt.r * 2, col, open ? 0.35 : 0.12);
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.setLineDash(open ? [] : [6, 6]);
      ctx.beginPath(); ctx.arc(gt.x, gt.y, gt.r, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.save(); ctx.translate(gt.x, gt.y); ctx.rotate(this.t * (open ? 1.5 : 0.3));
      ctx.strokeStyle = hexA(col, 0.7);
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, gt.r * 0.6, i * 2.1, i * 2.1 + 1.2); ctx.stroke(); }
      ctx.restore();
      ctx.font = '700 11px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = col;
      ctx.fillText(gt.name.toUpperCase(), gt.x, gt.y - gt.r - 8);
      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillText(open ? 'OPEN · stand inside to YUV UP' : (this.t < 15 ? `opens in ${Math.ceil(15 - this.t)}s` : 'COLLAPSED'), gt.x, gt.y + gt.r + 14);
    }

    // nodes
    for (const n of this.nodes) {
      if (n.hp <= 0) continue;
      const s = n.big ? 1.5 : 1, pulse = 1 + Math.sin(this.t * 4 + n.x) * 0.08;
      drawAura(ctx, n.x, n.y, 40 * s, YUV_CYAN, 0.25);
      ctx.save(); ctx.translate(n.x, n.y); ctx.scale(s * pulse, s * pulse);
      ctx.fillStyle = '#bffcff'; ctx.strokeStyle = '#2bb8c9'; ctx.lineWidth = 1.5;
      for (const [ox, oy, h] of [[-6, 4, 14], [0, 2, 20], [7, 5, 12]]) {
        ctx.beginPath(); ctx.moveTo(ox, oy - h); ctx.lineTo(ox + 4, oy); ctx.lineTo(ox, oy + 4); ctx.lineTo(ox - 4, oy); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      if (n.hp < n.maxHp) {
        ctx.strokeStyle = YUV_CYAN; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(n.x, n.y, 22 * s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - n.hp / n.maxHp)); ctx.stroke();
      }
    }

    // orbs
    for (const o of this.orbs) {
      const r = clamp(3 + Math.sqrt(o.amt), 4, 10), bob = Math.sin(this.t * 5 + o.seed) * 2;
      drawAura(ctx, o.x, o.y + bob, r * 3, YUV_CYAN, 0.4);
      ctx.fillStyle = '#e8feff'; ctx.beginPath(); ctx.arc(o.x, o.y + bob, r * 0.6, 0, Math.PI * 2); ctx.fill();
    }

    for (const h of this.hollows) drawHollow(ctx, h);

    // divers + Yield Auras
    for (const d of this.divers) {
      if (!this.alive(d)) continue;
      const auraR = 26 + Math.sqrt(d.carry) * 6;
      if (d.carry > 0) drawAura(ctx, d.x, d.y, auraR, d.aura, 0.45);
      if (d.extractT > 0) {
        const need = d.isPlayer ? this.st.extractTime : 2.6;
        ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, d.extractT / need)); ctx.stroke();
      }
      const tag = d.isPlayer ? d.name : d.isEcho ? d.name + ' (AI)' : d.name;
      drawBody(ctx, d, d.team === 0 ? (d.isPlayer ? '#e9fdff' : '#8fd9e6') : TEAM_COLORS[d.team],
        { name: tag, nameColor: d.team === 0 ? '#bdf6ff' : TEAM_COLORS[d.team], hpFrac: d.hp / d.maxHp });
    }

    for (const b of this.bolts) {
      ctx.strokeStyle = b.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.025, b.y - b.vy * 0.025); ctx.stroke();
    }
    this.fx.draw(ctx);
    ctx.restore();

    this.drawDarkness(ctx, W, H, sx, sy);

    // glyphs above the dark — a glowing carrier is visible to everyone
    ctx.save();
    ctx.translate(Math.round(W / 2 - this.cam.x + sx), Math.round(H / 2 - this.cam.y + sy));
    for (const d of this.divers) if (this.alive(d)) drawGlyph(ctx, d.x, d.y, d.carry, d.aura);
    ctx.restore();

    this.drawEdgeMarkers(ctx, W, H);
    this.drawHud(ctx, W, H);
  },

  drawDarkness(ctx, W, H, sx, sy) {
    if (!this.dark || this.dark.width !== W || this.dark.height !== H) {
      this.dark = document.createElement('canvas'); this.dark.width = W; this.dark.height = H;
    }
    const dc = this.dark.getContext('2d');
    dc.globalCompositeOperation = 'source-over';
    dc.clearRect(0, 0, W, H);
    dc.fillStyle = 'rgba(3,2,10,0.8)'; dc.fillRect(0, 0, W, H);
    dc.globalCompositeOperation = 'destination-out';
    const ox = W / 2 - this.cam.x + sx, oy = H / 2 - this.cam.y + sy;
    const light = (x, y, r, a = 1) => {
      const X = x + ox, Y = y + oy;
      if (X < -r || Y < -r || X > W + r || Y > H + r) return;
      const g = dc.createRadialGradient(X, Y, 0, X, Y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = g; dc.beginPath(); dc.arc(X, Y, r, 0, Math.PI * 2); dc.fill();
    };
    const p = this.player;
    light(p.x, p.y, 320);
    for (const d of this.divers) {
      if (!this.alive(d) || d === p) continue;
      if (d.team === 0) light(d.x, d.y, 150, 0.8);
      if (d.carry > 0) light(d.x, d.y, 40 + Math.sqrt(d.carry) * 9, 0.9);
    }
    for (const gt of this.gates) light(gt.x, gt.y, 150, 0.9);
    for (const n of this.nodes) if (n.hp > 0) light(n.x, n.y, n.big ? 90 : 60, 0.7);
    for (const o of this.orbs) light(o.x, o.y, 34, 0.7);
    for (const b of this.bolts) light(b.x, b.y, 40, 0.6);
    for (const r of this.fx.rings) light(r.x, r.y, r.R * 1.3, 0.9 * (1 - r.t / 0.6));
    ctx.drawImage(this.dark, 0, 0);
  },

  drawEdgeMarkers(ctx, W, H) {
    const mark = (x, y, color, label) => {
      const X = x - this.cam.x + W / 2, Y = y - this.cam.y + H / 2;
      if (X > 20 && Y > 20 && X < W - 20 && Y < H - 20) return;
      const a = Math.atan2(Y - H / 2, X - W / 2);
      const ex = clamp(W / 2 + Math.cos(a) * W, 40, W - 40), ey = clamp(H / 2 + Math.sin(a) * H, 40, H - 40);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.font = '700 10px Orbitron, sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center';
      ctx.fillText(label, ex, ey + (ey > H / 2 ? -14 : 22));
    };
    for (const gt of this.gates) if (this.gateOpen(gt) || this.t < 15) mark(gt.x, gt.y, this.gateOpen(gt) ? '#7dff9a' : '#ffd166', gt.name);
    for (const d of this.divers) if (this.alive(d) && !d.isPlayer && d.carry >= 150) mark(d.x, d.y, d.aura, 'YUV ' + fmt(d.carry));
  },

  drawMinimap(ctx, x, y, scale) {
    const g = this.grid;
    if (!this.mini || g.dirty) {
      if (!this.mini) { this.mini = document.createElement('canvas'); this.mini.width = g.w; this.mini.height = g.h; }
      const mc = this.mini.getContext('2d');
      const img = mc.createImageData(g.w, g.h);
      for (let i = 0; i < g.w * g.h; i++) {
        const t = g.t[i];
        const c = t === T.FLOOR ? [40, 32, 62] : t === T.VEIN ? [60, 130, 150] : t === T.WALL ? [8, 6, 14] : [18, 14, 30];
        img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
      }
      mc.putImageData(img, 0, 0);
      g.dirty = false;
    }
    const w = g.w * scale, h = g.h * scale, k = scale / TILE;
    ctx.save();
    ctx.globalAlpha = 0.9; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mini, x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(124,247,255,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = '#ff5ca8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x + this.center.x * k, y + this.center.y * k, Math.max(0.5, this.radius() * k), 0, Math.PI * 2); ctx.stroke();
    if (skill('veinsense')) for (const n of this.nodes) if (n.hp > 0) { ctx.fillStyle = YUV_CYAN; ctx.fillRect(x + n.x * k - 1, y + n.y * k - 1, 2, 2); }
    for (const gt of this.gates) { ctx.fillStyle = this.gateOpen(gt) ? '#7dff9a' : '#777'; ctx.beginPath(); ctx.arc(x + gt.x * k, y + gt.y * k, 3, 0, 6.3); ctx.fill(); }
    for (const d of this.divers) {
      if (!this.alive(d)) continue;
      if (d.team === 0 || d.carry >= 40) {
        ctx.fillStyle = d.isPlayer ? '#fff' : d.team === 0 ? '#8fd9e6' : TEAM_COLORS[d.team];
        const s = d.isPlayer ? 4 : 3;
        ctx.fillRect(x + d.x * k - s / 2, y + d.y * k - s / 2, s, s);
      }
    }
    ctx.restore();
  },

  drawHud(ctx, W, H) {
    const p = this.player, s = Save.data;
    ctx.save();
    // top-left panel
    ctx.fillStyle = 'rgba(10,7,20,0.72)'; ctx.fillRect(12, 12, 260, 128);
    ctx.strokeStyle = 'rgba(124,247,255,0.25)'; ctx.strokeRect(12.5, 12.5, 260, 128);
    ctx.textAlign = 'left';
    ctx.font = '800 13px Orbitron, sans-serif'; ctx.fillStyle = '#e9fdff';
    ctx.fillText(`${s.name}`, 24, 32);
    ctx.font = '600 11px Inter, sans-serif'; ctx.fillStyle = '#9b8cff';
    ctx.fillText(`${rankName(s.lifetime)} · "${s.title}"`, 24, 47);
    ctx.fillStyle = '#2a213f'; ctx.fillRect(24, 56, 236, 10);
    ctx.fillStyle = p.hp / p.maxHp > 0.35 ? '#7dff9a' : '#ff5c7a'; ctx.fillRect(24, 56, 236 * clamp(p.hp / p.maxHp, 0, 1), 10);
    ctx.font = '600 10px Inter, sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`, 28, 65);
    ctx.font = '800 18px Orbitron, sans-serif'; ctx.fillStyle = YUV_CYAN;
    ctx.fillText(`${fmt(p.carry)} YUV`, 24, 90);
    ctx.font = '600 11px Inter, sans-serif'; ctx.fillStyle = '#bfb8d8';
    ctx.fillText(`carried · ${fmt(p.safe)} death-safe · drop ${Math.round(deathDropPct() * 100)}% on death`, 24, 106);
    ctx.fillStyle = '#dfe8ff';
    ctx.fillText('YUV Bind [Space]', 24, 126);
    for (let i = 0; i < 2; i++) {
      ctx.beginPath(); ctx.arc(140 + i * 18, 122, 6, 0, Math.PI * 2);
      ctx.fillStyle = i < p.bindCharges ? YUV_CYAN : '#3a3150'; ctx.fill();
    }
    ctx.fillStyle = '#bfb8d8'; ctx.fillText(`Anchors ${s.anchors}`, 186, 126);

    // squad list
    let y = 160;
    ctx.font = '700 10px Orbitron, sans-serif'; ctx.fillStyle = '#7cf7ff'; ctx.fillText('YOUR SQUAD', 16, y); y += 14;
    ctx.font = '600 11px Inter, sans-serif';
    for (const d of this.divers.filter(d => d.team === 0)) {
      ctx.fillStyle = d.dead ? '#ff5c7a' : d.out ? '#7dff9a' : '#dfe8ff';
      ctx.fillText(`${d.isEcho ? d.name + ' (AI)' : d.name}  ${d.dead ? "yuv'd" : d.out ? 'yuv up' : fmt(d.carry)}`, 16, y); y += 14;
    }

    // top-centre: Surge clock
    const left = this.collapseAt - this.t;
    const shrinkLeft = this.shrinkDur - this.t;
    ctx.textAlign = 'center';
    ctx.font = '800 20px Orbitron, sans-serif';
    ctx.fillStyle = left < 60 ? '#ff5ca8' : '#e9fdff';
    const mmss = v => `${Math.floor(Math.max(0, v) / 60)}:${String(Math.floor(Math.max(0, v) % 60)).padStart(2, '0')}`;
    ctx.fillText(shrinkLeft > 0 ? `SURGE ${mmss(shrinkLeft)}` : `COLLAPSE ${mmss(left)}`, W / 2, 34);
    ctx.font = '600 11px Inter, sans-serif'; ctx.fillStyle = '#bfb8d8';
    ctx.fillText(`${verseName()} · Week ${this.week} — ${VERSE_WEEKS[this.week - 1].name} · Fault depth ${this.depth}`, W / 2, 52);

    // minimap
    const scale = 2;
    this.drawMinimap(ctx, W - this.grid.w * scale - 14, 14, scale);

    // feed
    ctx.textAlign = 'left'; ctx.font = '600 12px Inter, sans-serif';
    let fy = H - 20 - this.feed.length * 17;
    for (const f of this.feed) {
      ctx.globalAlpha = clamp(f.t / 1.5, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(12, fy - 12, ctx.measureText(f.text).width + 12, 16);
      ctx.fillStyle = f.color; ctx.fillText(f.text, 18, fy); fy += 17;
    }
    ctx.globalAlpha = 1;

    // hints
    ctx.textAlign = 'center'; ctx.font = '600 12px Inter, sans-serif'; ctx.fillStyle = 'rgba(223,232,255,0.75)';
    const n = this.nearestNode(p, 46);
    let hint = 'WASD move · Mouse aim · Click shoot · [E] mine · [Space] YUV Bind · [Shift] Overdrive · [Esc] pause';
    if (n) hint = 'Hold [E] to mine the YUV node';
    else if (p.extractT > 0) hint = 'Hold position... YUV UP incoming';
    ctx.fillText(hint, W / 2, H - 14);

    // banner
    if (this.banner) {
      const b = this.banner, a = clamp(b.t / 0.5, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = '800 44px Orbitron, sans-serif'; ctx.fillStyle = b.color;
      ctx.shadowColor = b.color; ctx.shadowBlur = 24;
      ctx.fillText(b.text, W / 2, H * 0.3);
      ctx.shadowBlur = 0;
      if (b.sub) { ctx.font = '600 15px Inter, sans-serif'; ctx.fillStyle = '#e9e4ff'; ctx.fillText(b.sub, W / 2, H * 0.3 + 30); }
      ctx.globalAlpha = 1;
    }
    if (this.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }
};
