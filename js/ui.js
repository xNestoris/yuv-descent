'use strict';
// ============================================================
//  UI panels (HTML overlay)
// ============================================================

const UI = {
  el: null, open: false, current: null, onClose: null,
  init() {
    this.el = document.getElementById('ui');
    this.el.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      Sound.init();
      Game.action(b.dataset.act, b.dataset);
    });
  },
  show(id, html, opts = {}) {
    this.current = id;
    this.el.innerHTML = `<div class="panel ${opts.cls || ''}">${opts.noClose ? '' : '<button class="x" data-act="close" title="Close (Esc)">✕</button>'}${html}</div>`;
    this.el.classList.add('on');
    this.open = true;
  },
  close() {
    this.el.classList.remove('on');
    this.el.innerHTML = '';
    this.open = false; this.current = null;
    if (this.onClose) { const f = this.onClose; this.onClose = null; f(); }
  },
  toast(text, color = YUV_CYAN) {
    const t = document.createElement('div');
    t.className = 'toast'; t.style.borderColor = color; t.style.color = color; t.textContent = text;
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => t.remove(), 3600);
  }
};

const Panels = {
  wallet() {
    const s = Save.data;
    return `<div class="wallet"><span class="yuv">${fmt(s.yuv)} YUV</span><span>${s.stone} stone</span><span>${s.anchors} anchors</span><span>${s.sp} skill pts</span></div>`;
  },

  title(hasSave) {
    const s = Save.data;
    return `
      <div class="logo"><span>Y</span><span>U</span><span>V</span></div>
      <h1>DESCENT OF THE UNFINISHED</h1>
      <p class="tag">Say it. Fuse it. Come back up.</p>
      <p class="lore">The Lattice is a world its Architect, <b>YUV</b>, never finished. You are an Echo, a fragment of that name.
        <b>Yuv down</b> into the Fault, crack YUV nodes, and carry the glow home. Everyone can see your Yield Aura.
        Survive the Surge and <b>yuv up</b> through a Rift Gate, or get <b>yuv'd</b>.</p>
      ${hasSave ? `
        <button class="big" data-act="continue">CONTINUE AS ${esc(s.name.toUpperCase())}</button>
        <div class="sub">${rankName(s.lifetime)} · Lv ${s.level} · ${fmt(s.yuv)} YUV · Season ${s.season}</div>
        <details><summary>New game</summary>
          <label>Echo name <input id="nm" maxlength="16" value="YUV"></label>
          <button data-act="newgame">Start over (erases save)</button>
        </details>` : `
        <label>Echo name <input id="nm" maxlength="16" value="YUV"></label>
        <button class="big" data-act="newgame">YUV DOWN · START</button>`}
      <div class="controls">
        <div><b>WASD</b> move</div><div><b>Mouse</b> aim · <b>Click</b> shoot / dig</div>
        <div><b>E</b> mine / interact</div><div><b>Space</b> YUV Bind</div>
        <div><b>Shift</b> Overdrive (burns YUV)</div><div><b>Right-click</b> build on your plot</div>
        <div><b>Esc</b> close / pause</div><div><b>M</b> mute · <b>V</b> voice</div>
      </div>
      <p class="fine">Prototype: single-player. Squadmates, rivals and ghost Choruses are AI, and they're labeled. Progress saves in this browser. No real-money purchases.</p>`;
  },

  tutorial() {
    return `<h2>Welcome to the Lattice, ${esc(Save.data.name)}</h2>
      <ol class="steps">
        <li><b>Dig.</b> Hold click on rock for stone and on glowing veins for YUV. Overmining spreads <span class="pink">Corruption</span> and Hollows, but it also deepens the Fault below (richer dives).</li>
        <li><b>Build.</b> Right-click inside your plot to place Yuv Bricks. Upgrade your <b>Spire</b> with Ilo for faster extraction and a bigger season vault.</li>
        <li><b>Yuv down.</b> Walk to <b>THE FAULT</b> and press E. Crack nodes, grab the glow, and avoid rival squads and Hollows.</li>
        <li><b>Glow.</b> The more YUV you carry, the bigger your <span class="cy">YUV glyph</span>. Everyone sees it, and you move slower.</li>
        <li><b>Yuv up.</b> Stand inside an open Rift Gate before the <span class="pink">Surge</span> closes. If you die, you get <b>yuv'd</b> and drop part of your haul.</li>
        <li><b>YUV Bind</b> [Space]: shout the name to blast rock and enemies. Squadmates nearby join in for a <b>Chorus Bind</b>.</li>
      </ol>
      <button class="big" data-act="close">GOT IT</button>`;
  },

  fault() {
    const s = Save.data, wk = VERSE_WEEKS[week() - 1], st = playerStats();
    const toll = Math.min(s.yuv, 5 + s.faultDepth);
    return `<h2>THE FAULT</h2>
      <p class="lore">YUV: "${esc(pick(YUV_LINES))}"</p>
      <div class="grid2">
        <div><b>Week ${week()}:</b> ${wk.name}<br><span class="desc">${wk.desc}</span></div>
        <div><b>Fault depth ${s.faultDepth}</b><br><span class="desc">Nodes +${s.faultDepth * 6}% · Hollows tougher</span></div>
        <div><b>Death drop ${Math.round(deathDropPct() * 100)}%</b><br><span class="desc">${s.dives < 10 ? 'Newbie safety net (first 10 dives)' : 'Full risk'}${st.safeCap ? ` · first ${st.safeCap} YUV death-safe` : ''}</span></div>
        <div><b>Echo Anchors: ${s.anchors}</b><br><span class="desc">Auto-used on death: keep +40% of haul</span></div>
      </div>
      <p class="desc">Squad: you + 3 Echo AI squadmates vs 2 rival squads. The Surge closes in about ${Math.round(200 / mod('surge', 1) / 60 * 10) / 10} minutes.</p>
      <button class="big" data-act="dive">YUV DOWN${toll ? ` · toll ${toll} YUV` : ''}</button>`;
  },

  smith() {
    return `<h2>Kesh · Tool Smith</h2><p class="lore">"YUV built the first pick from the word itself. Mine's close enough."</p>
      ${this.wallet()}${['pick', 'caster'].map(id => this.gearRow(id)).join('')}`;
  },
  quarter() {
    const s = Save.data, c = anchorCost();
    return `<h2>Ama · Quartermaster</h2><p class="lore">"Glow is a promise. Plate is insurance."</p>
      ${this.wallet()}${this.gearRow('armor')}
      <div class="row"><div><b>Echo Anchor</b> <span class="lv">${s.anchors}/5</span><div class="desc">Consumed on death: keeps +40% of your carried haul.</div></div>
      ${s.anchors >= 5 ? '<span class="max">FULL</span>' : `<button data-act="anchor" ${s.yuv < c ? 'disabled' : ''}>${c} YUV</button>`}</div>`;
  },
  gearRow(id) {
    const s = Save.data, g = GEAR[id], lv = s.gear[id], c = gearCost(id);
    return `<div class="row"><div><b>${g.name}</b> <span class="lv">Lv ${lv}/${g.max}</span><div class="desc">${g.desc}</div></div>
      ${lv >= g.max ? '<span class="max">MAX</span>' : `<button data-act="gear" data-id="${id}" ${s.yuv < c ? 'disabled' : ''}>${fmt(c)} YUV</button>`}</div>`;
  },
  spire() {
    const s = Save.data, c = spireCost(), st = playerStats();
    return `<h2>Ilo · Spire Keeper</h2><p class="lore">"Every House raises a Spire to say the name a little louder."</p>
      ${this.wallet()}
      <div class="row"><div><b>House ${esc(s.name)} Spire</b> <span class="lv">Lv ${s.spire}/10</span>
        <div class="desc">Extract in ${st.extractTime.toFixed(1)}s · squad share ${Math.round(st.squadShare * 100)}% · season vault protects ${fmt(st.vault)} YUV from the Tithe.</div></div>
        ${s.spire >= 10 ? '<span class="max">MAX</span>' : `<button data-act="spireup" ${s.yuv < c ? 'disabled' : ''}>${fmt(c)} YUV</button>`}</div>
      <p class="desc">Each level: -5% extract time, +2% squad share, +100 vault. Your Spire is visible from across the hub.</p>`;
  },

  shrine() {
    const s = Save.data;
    let html = `<h2>Skill Shrine</h2><p class="lore">Lv ${s.level}/40 · ${fmt(s.xp)} / ${fmt(levelXp(s.level))} XP</p>${this.wallet()}<div class="trees">`;
    for (const tree in SKILLS) {
      html += `<div class="tree"><h3>${tree}</h3>`;
      for (const k of SKILLS[tree]) {
        const r = skill(k.id);
        const pips = Array.from({ length: k.max }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('');
        html += `<div class="row"><div><b>${k.name}</b> <span class="pips">${pips}</span><div class="desc">${k.desc}</div></div>
          ${r >= k.max ? '<span class="max">MAX</span>' : `<button data-act="skill" data-id="${k.id}" ${s.sp < 1 ? 'disabled' : ''}>+1</button>`}</div>`;
      }
      html += '</div>';
    }
    return html + '</div>';
  },

  wall() {
    const s = Save.data, rows = wallBoard();
    let html = `<h2>THE YUV WALL</h2><p class="lore">Season ${s.season} · the top names are carved in the hub, and YUV Prime belongs to the top of the Wall.</p><table class="board"><tr><th>#</th><th>Name</th><th>House</th><th>Season YUV</th></tr>`;
    rows.slice(0, 13).forEach((r, i) => {
      html += `<tr class="${r.me ? 'me' : ''}"><td>${i === 0 ? '👑' : i + 1}</td><td>${esc(r.name)}${r.me ? '' : ' <span class="ai">AI</span>'}</td><td>${esc(r.house)}</td><td>${fmt(r.total)}</td></tr>`;
    });
    html += '</table>';
    const myPos = rows.findIndex(r => r.me) + 1;
    html += `<p class="desc">You are #${myPos}. Week 6 (Wall of Names) counts extractions double.</p>`;
    if (s.sigils.length) {
      html += '<h3>Y-Sigils of past seasons</h3><ul class="sigils">' + s.sigils.map(g => `<li>Season ${g.season}: ${g.names.map(esc).join(', ')}</li>`).join('') + '</ul>';
    }
    return html;
  },

  board() {
    const s = Save.data, wk = week(), tier = passTier();
    let html = `<h2>Season ${s.season} · Verse "${verseName()}"</h2><div class="weeks">`;
    VERSE_WEEKS.forEach((w, i) => {
      html += `<div class="wk ${i + 1 === wk ? 'now' : i + 1 < wk ? 'done' : ''}"><b>W${i + 1}</b> ${w.name}<div class="desc">${w.desc}</div></div>`;
    });
    html += `</div><p class="desc">The week advances every ${DIVES_PER_WEEK} dives. Finishing a dive in week 10 triggers <b>The Unwriting</b>: the server says the name, the Wall is carved into Sigils, and a 30% Tithe is taken from YUV above your Spire vault.</p>`;
    html += `<h3>Season Pass · tier ${tier}/40</h3><div class="bar"><i style="width:${(s.passXp % PASS_XP) / PASS_XP * 100}%"></i></div><div class="pass">`;
    PASS.forEach((r, i) => {
      const label = r.type === 'yuv' ? `${r.amt} YUV` : r.type === 'aura' ? `<span class="sw" style="background:${r.color}"></span>${r.name}` : r.type === 'anchor' ? `${r.amt} Anchor` : `"${r.name}"`;
      html += `<div class="tier ${i < tier ? 'got' : ''} ${r.type !== 'yuv' ? 'special' : ''}"><small>${i + 1}</small>${label}</div>`;
    });
    html += `</div><p class="fine">Free track shown. The premium track isn't available in this prototype (no payments).</p>`;
    return html;
  },

  wardrobe() {
    const s = Save.data;
    const all = [{ color: YUV_CYAN, name: 'Lattice Cyan' }].concat(PASS.filter(r => r.type === 'aura'));
    let html = `<h2>Wardrobe</h2><p class="lore">Your Yield Aura is the color everyone sees when you glow.</p><h3>Auras</h3><div class="swatches">`;
    for (const a of all) {
      const own = s.auras.includes(a.color);
      html += `<button class="swatch ${s.aura === a.color ? 'sel' : ''}" data-act="aura" data-id="${a.color}" ${own ? '' : 'disabled'} title="${a.name}${own ? '' : ' (season pass)'}">
        <span style="background:${a.color}"></span>${a.name}</button>`;
    }
    html += '</div><h3>Titles</h3><div class="titles">';
    for (const t of s.titles) html += `<button class="${s.title === t ? 'sel' : ''}" data-act="title" data-id="${esc(t)}">${esc(t)}</button>`;
    html += `</div><h3>Y-Shard Store</h3><p class="fine">Planned cosmetic-only price points. Purchasing is disabled in this prototype.</p><div class="store">`;
    for (const it of STORE) html += `<div class="row"><div><b>${it.name}</b></div><button disabled>${it.price}</button></div>`;
    html += `</div><h3>Settings</h3><button data-act="mute">${s.muted ? 'Unmute sound' : 'Mute sound'}</button>
      <button data-act="voice">${s.voice ? 'Disable' : 'Enable'} "YUV!" voice</button>
      <button data-act="wipe" class="danger">Erase save</button>`;
    return html;
  },

  result(r, gains) {
    const s = Save.data;
    const head = r.success
      ? `<div class="res up">YUV UP!</div><p class="lore">Extracted through ${esc(r.cause)} with ${fmt(r.haul)} YUV glowing on your back.</p>`
      : `<div class="res down">YOU GOT YUV'D</div><p class="lore">Taken by ${esc(r.cause)}. You carried ${fmt(r.haul)} YUV and dropped ${Math.round(r.dropPct * 100)}% of the unsafe part${r.anchorUsed ? ', but an Echo Anchor saved 40%' : ''}.</p>`;
    return `${head}
      <div class="grid2">
        <div><b>Banked</b><br><span class="cy big2">${fmt(r.kept)}</span> YUV</div>
        <div><b>Squad share</b><br><span class="cy big2">${fmt(r.share)}</span> YUV</div>
        <div><b>Rivals yuv'd</b><br>${r.kills}</div>
        <div><b>Hollows</b><br>${r.hollowKills}</div>
        <div><b>XP</b><br>+${fmt(gains.xp)}${gains.levels ? ` · <span class="cy">LEVEL ${s.level}!</span>` : ''}</div>
        <div><b>Pass</b><br>tier ${passTier()}/40${gains.rewards.length ? ` · ${gains.rewards.length} reward(s)` : ''}</div>
      </div>
      ${gains.rankUp ? `<p class="rankup">RANK UP: ${esc(gains.rankUp)}</p>` : ''}
      ${gains.rewards.length ? `<p class="desc">Unlocked: ${gains.rewards.map(esc).join(' · ')}</p>` : ''}
      ${gains.weekMsg ? `<p class="desc">${gains.weekMsg}</p>` : ''}
      <p class="desc">The Yuv Tide restored ${gains.regrown} veins in the hub.</p>
      <button class="big" data-act="close">RETURN TO THE LATTICE</button>`;
  },

  unwriting(u) {
    return `<div class="logo unwrite"><span>Y</span><span>U</span><span>V</span></div>
      <h2>THE UNWRITING</h2>
      <p class="lore">The whole server says it at once. The name is re-spelled, and the Lattice rewrites itself.</p>
      <div class="grid2">
        <div><b>Y-Sigils of Season ${u.season}</b><br>${u.top.map(esc).join(', ')}</div>
        <div><b>Your final place</b><br>#${u.place}${u.title ? ` · title "${esc(u.title)}"` : ''}</div>
        <div><b>Tithe to YUV</b><br>${fmt(u.tithe)} YUV (30% above vault)</div>
        <div><b>Vault protected</b><br>${fmt(u.vault)} YUV</div>
      </div>
      <p class="desc">You keep your level, rank, skills, gear, Spire, auras, titles and plot. The Wall, the pass and Corruption reset.</p>
      <button class="big" data-act="close">BEGIN SEASON ${u.season + 1}: "${esc(VERSE_NAMES[u.season % VERSE_NAMES.length])}"</button>`;
  },

  pause() {
    return `<h2>Paused</h2><p class="desc">The Surge doesn't wait in the real thing.</p>
      <button class="big" data-act="close">RESUME</button>
      <button data-act="abandon" class="danger">Abandon dive (counts as getting yuv'd)</button>`;
  }
};
