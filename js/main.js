'use strict';
// ============================================================
//  Game orchestration: scenes, actions, progression
// ============================================================

const Game = {
  scene: 'title', W: 0, H: 0, last: 0, letters: [],

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    Input.init(this.canvas);
    UI.init();
    for (let i = 0; i < 40; i++) this.letters.push({ x: Math.random(), y: Math.random(), s: rand(14, 60), v: rand(0.02, 0.08), c: 'YUV'[i % 3] });
    window.addEventListener('keydown', e => {
      if (e.target && e.target.tagName === 'INPUT') {
        if (e.key === 'Enter') { const b = UI.el.querySelector('[data-act="newgame"]'); if (b) b.click(); }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (this.scene === 'dive' && !Dive.over) {
          if (UI.current === 'pause') UI.close(); else this.pauseDive();
        } else if (UI.open && UI.current !== 'title' && UI.current !== 'result' && UI.current !== 'unwriting') UI.close();
      }
      if (k === 'm' && Save.data) { Save.data.muted = !Save.data.muted; Save.write(); UI.toast(Save.data.muted ? 'Sound muted' : 'Sound on'); }
      if (k === 'v' && Save.data) { Save.data.voice = !Save.data.voice; Save.write(); UI.toast(Save.data.voice ? '"YUV!" voice on' : '"YUV!" voice off'); }
    });
    this.showTitle();
    requestAnimationFrame(t => this.loop(t));
  },

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * dpr); this.canvas.height = Math.floor(this.H * dpr);
    this.canvas.style.width = this.W + 'px'; this.canvas.style.height = this.H + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },

  loop(ts) {
    const dt = Math.min(0.05, (ts - (this.last || ts)) / 1000);
    this.last = ts;
    try { this.step(dt); } catch (err) { console.error(err); }
    Input.endFrame();
    requestAnimationFrame(t => this.loop(t));
  },

  step(dt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    if (this.scene === 'hub') { Hub.update(dt); Hub.draw(ctx, W, H); }
    else if (this.scene === 'dive') { if (!UI.open) Dive.update(dt); Dive.draw(ctx, W, H); }
    else this.drawTitle(ctx, W, H, dt);
  },

  drawTitle(ctx, W, H, dt) {
    ctx.fillStyle = '#07050d'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    for (const l of this.letters) {
      l.y += l.v * dt; if (l.y > 1.1) { l.y = -0.1; l.x = Math.random(); }
      ctx.font = `800 ${l.s}px Orbitron, sans-serif`;
      ctx.fillStyle = hexA(YUV_CYAN, 0.05 + l.s / 600);
      ctx.fillText(l.c, l.x * W, l.y * H);
    }
  },

  showTitle() {
    this.scene = 'title';
    const has = Save.load();
    UI.show('title', Panels.title(has), { noClose: true, cls: 'title' });
  },

  startGame(fresh) {
    if (fresh) {
      const inp = document.getElementById('nm');
      const name = (inp && inp.value.trim()) || 'YUV';
      Save.wipe();
      Save.data = Save.fresh(name.slice(0, 16));
      Save.write();
    }
    UI.close();
    Hub.init();
    this.scene = 'hub';
    Sound.say('Yuv');
    if (!Save.data.tutorialDone) {
      Save.data.tutorialDone = true; Save.write();
      UI.show('tutorial', Panels.tutorial());
    }
  },

  openPanel(id) {
    const f = Panels[id];
    if (!f) return;
    UI.show(id, f.call(Panels));
  },
  refresh() { if (UI.current && Panels[UI.current] && UI.current !== 'result') UI.show(UI.current, Panels[UI.current].call(Panels)); },

  action(act, data) {
    const s = Save.data;
    switch (act) {
      case 'close': UI.close(); break;
      case 'continue': this.startGame(false); break;
      case 'newgame': this.startGame(true); break;
      case 'dive': UI.close(); this.startDive(); break;
      case 'gear': {
        const c = gearCost(data.id);
        if (s.yuv >= c && s.gear[data.id] < GEAR[data.id].max) { s.yuv -= c; s.gear[data.id]++; Sound.buy(); UI.toast(`${GEAR[data.id].name} upgraded to Lv ${s.gear[data.id]}`); }
        break;
      }
      case 'anchor': { const c = anchorCost(); if (s.yuv >= c && s.anchors < 5) { s.yuv -= c; s.anchors++; Sound.buy(); } break; }
      case 'spireup': {
        const c = spireCost();
        if (s.yuv >= c && s.spire < 10) { s.yuv -= c; s.spire++; Sound.buy(); Sound.say('Yuv'); UI.toast(`House ${s.name} Spire rises to level ${s.spire}`); }
        break;
      }
      case 'skill': {
        const k = Object.values(SKILLS).flat().find(x => x.id === data.id);
        if (k && s.sp > 0 && skill(k.id) < k.max) { s.sp--; s.skills[k.id] = skill(k.id) + 1; Sound.buy(); }
        break;
      }
      case 'aura': if (s.auras.includes(data.id)) s.aura = data.id; break;
      case 'title': if (s.titles.includes(data.id)) s.title = data.id; break;
      case 'mute': s.muted = !s.muted; break;
      case 'voice': s.voice = !s.voice; break;
      case 'wipe':
        if (confirm('Erase your Echo and all progress?')) { Save.wipe(); UI.close(); this.showTitle(); }
        return;
      case 'abandon':
        UI.close();
        if (this.scene === 'dive' && !Dive.over) Dive.endDive(false, 'abandoning the dive');
        return;
    }
    if (Save.data) Save.write();
    this.refresh();
  },

  startDive(opts) {
    const s = Save.data;
    const toll = Math.min(s.yuv, 5 + s.faultDepth);
    s.yuv -= toll;
    Save.write();
    Dive.start(opts);
    this.scene = 'dive';
    Sound.down();
    Sound.say('Yuv down');
  },

  pauseDive() {
    UI.show('pause', Panels.pause());
  },

  gainXp(xp) {
    const s = Save.data;
    let levels = 0;
    s.xp += xp;
    while (s.level < 40 && s.xp >= levelXp(s.level)) { s.xp -= levelXp(s.level); s.level++; s.sp++; levels++; }
    const rewards = [];
    s.passXp += xp;
    const tier = passTier();
    while (s.passClaimed < tier) {
      const r = PASS[s.passClaimed]; s.passClaimed++;
      if (r.type === 'yuv') { s.yuv += r.amt; rewards.push(`${r.amt} YUV`); }
      if (r.type === 'anchor') { s.anchors = Math.min(5, s.anchors + r.amt); rewards.push(`${r.amt} Echo Anchor`); }
      if (r.type === 'aura' && !s.auras.includes(r.color)) { s.auras.push(r.color); rewards.push(`${r.name} aura`); }
      if (r.type === 'title' && !s.titles.includes(r.name)) { s.titles.push(r.name); rewards.push(`title "${r.name}"`); }
    }
    return { levels, rewards };
  },

  finishDive(r) {
    const s = Save.data;
    const wkBefore = week();
    const rankBefore = rankIndex(s.lifetime);
    const total = r.kept + r.share;
    s.yuv += total; s.lifetime += total;
    s.wallScore += total * mod('wall', 1);
    s.best = Math.max(s.best, total);
    s.dives++; s.seasonDives++;
    if (r.success) s.extracts++; else s.deaths++;
    s.kills += r.kills;
    const xp = Math.floor(total * 0.6 + r.kills * 25 + r.hollowKills * 8 + (r.success ? 40 : 10));
    const g = this.gainXp(xp);
    // rivals keep playing too (AI ghosts)
    for (const rv of s.rivals) rv.total += Math.floor((r.rivalBanked[rv.name] || 0) * mod('wall', 1) + randi(0, 90) * (0.5 + wkBefore * 0.15));
    Hub.init();
    const regrown = Hub.regrow(6);
    const rankAfter = rankIndex(s.lifetime);
    const gains = { xp, levels: g.levels, rewards: g.rewards, regrown, rankUp: rankAfter > rankBefore ? RANKS[rankAfter].name : null, weekMsg: '' };
    const unwrite = wkBefore === 10;
    if (!unwrite && week() !== wkBefore) {
      const w = VERSE_WEEKS[week() - 1];
      gains.weekMsg = `A new week begins: Week ${week()}, ${w.name}. ${w.desc}`;
    }
    Save.write();
    this.scene = 'hub';
    UI.show('result', Panels.result(r, gains), { noClose: true });
    if (gains.rankUp) Sound.say(gains.rankUp);
    if (unwrite) UI.onClose = () => this.unwriting();
  },

  unwriting() {
    const s = Save.data, st = playerStats();
    const board = wallBoard();
    const place = board.findIndex(x => x.me) + 1;
    const top = board.slice(0, 3).map(x => x.name);
    const tithe = Math.floor(Math.max(0, s.yuv - st.vault) * 0.3);
    s.yuv -= tithe;
    s.sigils.push({ season: s.season, names: top });
    let title = null;
    if (place <= 10) { title = `Unwritten S${s.season}`; if (!s.titles.includes(title)) s.titles.push(title); }
    if (place === 1 && !s.titles.includes('YUV Prime')) s.titles.push('YUV Prime');
    const u = { season: s.season, top, place, tithe, vault: st.vault, title };
    s.season++; s.seasonDives = 0; s.passXp = 0; s.passClaimed = 0; s.corruption = 0; s.wallScore = 0;
    for (const rv of s.rivals) rv.total = randi(0, 250);
    Save.write();
    Sound.say('Yuv. Yuv. Yuv.');
    UI.show('unwriting', Panels.unwriting(u), { noClose: true });
  }
};

// ---------------- self test (open index.html#selftest) ----------------
function selfTest() {
  const out = [];
  try {
    Save.KEY = 'yuv-descent-selftest';
    Save.data = Save.fresh('Tester');
    Hub.init();
    for (let i = 0; i < 120; i++) { Hub.update(1 / 60); Hub.draw(Game.ctx, Game.W, Game.H); }
    out.push('hub ok');
    // run a full autopilot dive several times through to the end
    for (let run = 0; run < 6; run++) {
      Save.data.seasonDives = run === 5 ? 27 : run * 3;
      Game.startDive({ autopilot: true });
      let frames = 0;
      while (Game.scene === 'dive' && frames < 60 * 400) {
        Dive.update(1 / 30);
        if (frames % 15 === 0) Dive.draw(Game.ctx, Game.W, Game.H);
        frames++;
      }
      const pl = Dive.player;
      if (!Dive.result) throw new Error('dive did not finish');
      out.push(`dive${run}: ${Dive.result ? (Dive.result.success ? 'extracted' : 'yuvd by ' + Dive.result.cause) : 'none'} haul=${Dive.result && Dive.result.haul} t=${Math.round(Dive.t)} kills=${Dive.kills}` +
        ` [p hp=${pl.hp} x=${Math.round(pl.x)} y=${Math.round(pl.y)} dead=${pl.dead} out=${pl.out} over=${Dive.over} carry=${pl.carry} alive=${Dive.divers.filter(d => Dive.alive(d)).length}]`);
      if (UI.current === 'result') UI.close();
      if (UI.current === 'unwriting') { out.push('unwriting ok season=' + Save.data.season); UI.close(); }
    }
    for (const id of ['fault', 'smith', 'quarter', 'spire', 'shrine', 'wall', 'board', 'wardrobe']) { Game.openPanel(id); UI.close(); }
    out.push('panels ok');
    Hub.update(1 / 60); Hub.draw(Game.ctx, Game.W, Game.H);
    out.push(`lvl=${Save.data.level} yuv=${Save.data.yuv} life=${Save.data.lifetime} tier=${passTier()}`);
    out.push('SELFTEST PASS');
  } catch (e) {
    out.push('SELFTEST FAIL ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 4).join(' | '));
  }
  try { localStorage.removeItem('yuv-descent-selftest'); } catch (e) { /* ignore */ }
  document.body.setAttribute('data-selftest', out.join(' ; '));
  console.log(out.join('\n'));
}

// screenshot helpers for docs: #shot-hub / #shot-dive
function shotScene(which) {
  Save.KEY = 'yuv-descent-selftest';
  Save.data = Save.fresh('YUV');
  Save.data.yuv = 740; Save.data.spire = 4; Save.data.corruption = 35;
  UI.close();
  Hub.init();
  Game.scene = 'hub';
  if (which === 'dive') {
    Game.startDive({ autopilot: true });
    for (let i = 0; i < 30 * 45 && !Dive.over; i++) Dive.update(1 / 30);
    Dive.player.carry = Math.max(Dive.player.carry, 180);
  } else {
    for (let i = 0; i < 200; i++) Hub.update(1 / 60);
  }
}

window.addEventListener('load', () => {
  Game.init();
  if (location.hash === '#selftest') selfTest();
  if (location.hash === '#shot-hub') shotScene('hub');
  if (location.hash === '#shot-dive') shotScene('dive');
});
