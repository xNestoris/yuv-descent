'use strict';
// ============================================================
//  YUV: Descent of the Unfinished — core utilities
// ============================================================

const TILE = 32;
const T = { FLOOR: 0, ROCK: 1, WALL: 2, VEIN: 3, BLOCK: 4 };
const SOLID = [false, true, true, true, true];
const YUV_CYAN = '#7cf7ff';
const TEAM_COLORS = ['#7cf7ff', '#ff5c7a', '#ffb347'];

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const fmt = n => Math.floor(n).toLocaleString();
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- Input ----------------
const Input = {
  keys: {},
  pressed: {},
  mouse: { x: 0, y: 0, down: false, right: false, clicked: false, rclicked: false },
  init(canvas) {
    const typing = e => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    window.addEventListener('keydown', e => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      if (k === ' ' || k === 'tab' || k.startsWith('arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouse.down = false; this.mouse.right = false; });
    canvas.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    canvas.addEventListener('mousedown', e => {
      Sound.init();
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rclicked = true; }
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  },
  endFrame() { this.pressed = {}; this.mouse.clicked = false; this.mouse.rclicked = false; },
  axis() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k['a'] || k['arrowleft']) x -= 1;
    if (k['d'] || k['arrowright']) x += 1;
    if (k['w'] || k['arrowup']) y -= 1;
    if (k['s'] || k['arrowdown']) y += 1;
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  }
};

// ---------------- Sound ----------------
const Sound = {
  ctx: null,
  get muted() { return Save.data ? !!Save.data.muted : false; },
  get voice() { return Save.data ? Save.data.voice !== false : true; },
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
  },
  tone(freq, dur, type = 'square', vol = 0.05, slide = 0, delay = 0) {
    if (this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio is optional */ }
  },
  shoot(near = 1) { this.tone(640, 0.07, 'square', 0.025 * near, -320); },
  hit() { this.tone(170, 0.1, 'sawtooth', 0.04, -70); },
  pickup() { this.tone(900, 0.05, 'sine', 0.03, 500); },
  dig() { this.tone(120, 0.05, 'triangle', 0.04, -40); },
  buy() { this.tone(520, 0.08, 'triangle', 0.05); this.tone(780, 0.12, 'triangle', 0.05, 0, 0.08); },
  bind(n = 1) {
    this.tone(90, 0.7, 'sawtooth', 0.07, 200);
    this.tone(180, 0.6, 'triangle', 0.06, 400);
    for (let i = 1; i < n; i++) this.tone(140 + i * 40, 0.5, 'triangle', 0.05, 300, i * 0.12);
  },
  up() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.06, 0, i * 0.09)); },
  down() { [784, 587, 440, 294].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.05, 0, i * 0.09)); },
  death() { this.tone(320, 1.0, 'sawtooth', 0.07, -280); },
  say(text) {
    if (this.muted || !this.voice) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95; u.pitch = 0.55; u.volume = 0.9;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { /* speech is optional */ }
  }
};

// ---------------- Save ----------------
const Save = {
  KEY: 'yuv-descent-save-v1',
  data: null,
  fresh(name) {
    return {
      name: name || 'Echo',
      yuv: 60, stone: 6, lifetime: 0, wallScore: 0, best: 0,
      xp: 0, level: 1, sp: 0, skills: {},
      dives: 0, seasonDives: 0, deaths: 0, extracts: 0, kills: 0,
      gear: { pick: 0, caster: 0, armor: 0 },
      anchors: 1, spire: 1,
      season: 1, passXp: 0, passClaimed: 0,
      aura: YUV_CYAN, auras: [YUV_CYAN], title: 'Echo', titles: ['Echo'],
      corruption: 0, veinsMined: 0, faultDepth: 0,
      hubEdits: {},
      rivals: makeRivals(),
      sigils: [],
      muted: false, voice: true, tutorialDone: false
    };
  },
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const d = JSON.parse(raw);
        this.data = Object.assign(this.fresh(d.name), d);
        return true;
      }
    } catch (e) { /* storage unavailable */ }
    this.data = null;
    return false;
  },
  write() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ }
  },
  wipe() {
    try { localStorage.removeItem(this.KEY); } catch (e) { /* storage unavailable */ }
    this.data = null;
  }
};
