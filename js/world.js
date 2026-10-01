'use strict';
// ============================================================
//  World: tile grid, procedural caves, pathing, shared drawing
// ============================================================

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

class Grid {
  constructor(w, h, fill = T.FLOOR) {
    this.w = w; this.h = h;
    this.t = new Uint8Array(w * h).fill(fill);
    this.dirty = true;
  }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.t[y * this.w + x] : T.WALL; }
  set(x, y, v) { if (this.in(x, y)) { this.t[y * this.w + x] = v; this.dirty = true; } }
  solid(x, y) { return SOLID[this.get(x, y)]; }
  solidAt(px, py) { return this.solid(Math.floor(px / TILE), Math.floor(py / TILE)); }
  los(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.ceil(d / 10);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.solidAt(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  }
  // BFS shortest path over floor cells; returns list of [x,y] cells (excluding start) or null
  path(sx, sy, tx, ty, limit = 6000) {
    if (!this.in(sx, sy) || !this.in(tx, ty)) return null;
    const w = this.w, start = sy * w + sx, goal = ty * w + tx;
    if (start === goal) return [];
    const prev = new Int32Array(w * this.h).fill(-1);
    const q = new Int32Array(w * this.h);
    let qh = 0, qt = 0, visited = 0;
    prev[start] = start; q[qt++] = start;
    while (qh < qt) {
      const c = q[qh++];
      if (c === goal) break;
      if (++visited > limit) return null;
      const cx = c % w, cy = (c / w) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.in(nx, ny)) continue;
        const n = ny * w + nx;
        if (prev[n] !== -1) continue;
        if (n !== goal && this.solid(nx, ny)) continue;
        prev[n] = c; q[qt++] = n;
      }
    }
    if (prev[goal] === -1) return null;
    const out = [];
    let c = goal;
    while (c !== start) { out.push([c % w, (c / w) | 0]); c = prev[c]; }
    return out.reverse();
  }
  carve(cx, cy, r) {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if (x > 0 && y > 0 && x < this.w - 1 && y < this.h - 1 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r)
          this.set(x, y, T.FLOOR);
  }
}

function genCave(w, h, rng = Math.random, fillP = 0.46, veinP = 0.07) {
  const g = new Grid(w, h, T.FLOOR);
  const edge = (x, y) => x === 0 || y === 0 || x === w - 1 || y === h - 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      g.t[y * w + x] = edge(x, y) ? T.WALL : (rng() < fillP ? T.ROCK : T.FLOOR);
  g.carve(w >> 1, h >> 1, 4);
  for (let it = 0; it < 5; it++) {
    const nt = g.t.slice();
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if ((dx || dy) && g.t[(y + dy) * w + x + dx] !== T.FLOOR) n++;
        const i = y * w + x;
        if (n >= 5) nt[i] = T.ROCK; else if (n <= 3) nt[i] = T.FLOOR;
      }
    g.t = nt;
  }
  // keep only the largest connected floor region
  const label = new Int32Array(w * h).fill(-1);
  let best = -1, bestSize = 0, id = 0;
  for (let i = 0; i < w * h; i++) {
    if (g.t[i] !== T.FLOOR || label[i] !== -1) continue;
    const stack = [i]; label[i] = id; let size = 0;
    while (stack.length) {
      const c = stack.pop(); size++;
      const cx = c % w, cy = (c / w) | 0;
      for (const [dx, dy] of DIRS4) {
        const n = (cy + dy) * w + cx + dx;
        if (g.t[n] === T.FLOOR && label[n] === -1) { label[n] = id; stack.push(n); }
      }
    }
    if (size > bestSize) { bestSize = size; best = id; }
    id++;
  }
  for (let i = 0; i < w * h; i++) if (g.t[i] === T.FLOOR && label[i] !== best) g.t[i] = T.ROCK;
  // yuv veins on rock faces
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      if (g.get(x, y) !== T.ROCK) continue;
      const face = DIRS4.some(([dx, dy]) => g.get(x + dx, y + dy) === T.FLOOR);
      if (face && rng() < veinP) g.set(x, y, T.VEIN);
    }
  g.dirty = true;
  return g;
}

// random open floor point (pixel centre) satisfying an optional filter
function randomFloor(g, filter, tries = 3000) {
  for (let i = 0; i < tries; i++) {
    const x = randi(1, g.w - 2), y = randi(1, g.h - 2);
    if (g.get(x, y) !== T.FLOOR) continue;
    if (!DIRS4.every(([dx, dy]) => g.get(x + dx, y + dy) === T.FLOOR)) continue;
    const p = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, tx: x, ty: y };
    if (!filter || filter(p)) return p;
  }
  return null;
}

function cellOf(e) { return [Math.floor(e.x / TILE), Math.floor(e.y / TILE)]; }

function blocked(g, x, y, r) {
  return g.solidAt(x - r, y - r) || g.solidAt(x + r, y - r) || g.solidAt(x - r, y + r) || g.solidAt(x + r, y + r);
}
function moveCircle(g, e, dx, dy) {
  if (!blocked(g, e.x + dx, e.y, e.r)) e.x += dx;
  if (!blocked(g, e.x, e.y + dy, e.r)) e.y += dy;
}

// ---------------- shared drawing ----------------
const PAL_DIVE = { floorA: '#15111f', floorB: '#17131f', rock: '#2b2140', edge: '#3d2f5c', wall: '#0c0915', block: '#3b6f88' };
const PAL_HUB = { floorA: '#1e1a30', floorB: '#211c34', rock: '#3a2d55', edge: '#54427a', wall: '#120e1e', block: '#3f7b96' };

function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

function drawTiles(ctx, g, cam, vw, vh, pal) {
  const x0 = Math.max(0, Math.floor((cam.x - vw / 2) / TILE) - 1), x1 = Math.min(g.w - 1, Math.floor((cam.x + vw / 2) / TILE) + 1);
  const y0 = Math.max(0, Math.floor((cam.y - vh / 2) / TILE) - 1), y1 = Math.min(g.h - 1, Math.floor((cam.y + vh / 2) / TILE) + 1);
  const time = performance.now() / 1000;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = g.t[y * g.w + x], px = x * TILE, py = y * TILE;
      if (t === T.FLOOR) {
        ctx.fillStyle = (x + y) & 1 ? pal.floorA : pal.floorB;
        ctx.fillRect(px, py, TILE, TILE);
        continue;
      }
      if (t === T.WALL) { ctx.fillStyle = pal.wall; ctx.fillRect(px, py, TILE, TILE); continue; }
      if (t === T.BLOCK) {
        ctx.fillStyle = pal.block; ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(124,247,255,0.55)'; ctx.lineWidth = 2; ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = 'rgba(124,247,255,0.7)'; ctx.font = 'bold 12px Orbitron, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Y', px + TILE / 2, py + TILE / 2 + 5);
        continue;
      }
      ctx.fillStyle = pal.rock; ctx.fillRect(px, py, TILE, TILE);
      if (!g.solid(x, y + 1)) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(px, py + TILE - 5, TILE, 5); }
      if (!g.solid(x, y - 1)) { ctx.fillStyle = pal.edge; ctx.fillRect(px, py, TILE, 5); }
      if (t === T.VEIN) {
        const pulse = 0.6 + 0.4 * Math.sin(time * 3 + x + y);
        ctx.fillStyle = `rgba(124,247,255,${0.55 + 0.45 * pulse})`;
        for (let k = 0; k < 4; k++) {
          const sx = px + 4 + hash2(x * 7 + k, y) * (TILE - 10), sy = py + 6 + hash2(x, y * 5 + k) * (TILE - 12);
          ctx.fillRect(sx, sy, 4 + k % 2 * 2, 3);
        }
      }
    }
  }
}

function drawAura(ctx, x, y, r, color, alpha = 0.35) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(color, alpha));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// the floating Yield Aura glyph — your haul, visible to everyone
function drawGlyph(ctx, x, y, carry, color) {
  if (carry < 40) return;
  const size = clamp(12 + Math.sqrt(carry) * 1.4, 14, 46);
  const bob = Math.sin(performance.now() / 300 + x * 0.01) * 3;
  ctx.save();
  ctx.font = `800 ${size}px Orbitron, sans-serif`;
  ctx.textAlign = 'center';
  ctx.shadowColor = color; ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText('YUV', x, y - 30 - size * 0.4 + bob);
  ctx.shadowBlur = 0;
  ctx.font = '600 11px Inter, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(fmt(carry), x, y - 24 + bob);
  ctx.restore();
}

function drawBody(ctx, e, color, opts = {}) {
  const { x, y, r } = e;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.8, r, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = e.hit > 0 ? '#ffffff' : color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2; ctx.stroke();
  // visor + caster
  const a = e.aim || 0;
  ctx.strokeStyle = '#e8f6ff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4); ctx.lineTo(x + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8)); ctx.stroke();
  ctx.fillStyle = '#0b0814';
  ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.35, r * 0.35, 0, Math.PI * 2); ctx.fill();
  if (opts.name) {
    ctx.font = '600 11px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = opts.nameColor || '#dfe8ff';
    ctx.fillText(opts.name, x, y + r + 16);
  }
  if (opts.hpFrac !== undefined && opts.hpFrac < 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 16, y - r - 9, 32, 4);
    ctx.fillStyle = opts.hpFrac > 0.4 ? '#7dff9a' : '#ff5c7a'; ctx.fillRect(x - 16, y - r - 9, 32 * Math.max(0, opts.hpFrac), 4);
  }
  ctx.restore();
}

function drawHollow(ctx, h) {
  const t = performance.now() / 200 + h.seed;
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.fillStyle = h.hit > 0 ? '#fff' : (h.stun > 0 ? '#5a4c7a' : '#2a0f2e');
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rr = h.r * (i % 2 ? 0.75 : 1.15 + 0.1 * Math.sin(t + i));
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#a0306a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = h.stun > 0 ? '#aaa' : '#ff3b6b';
  ctx.beginPath(); ctx.arc(-4, -2, 2.5, 0, Math.PI * 2); ctx.arc(4, -2, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (h.hp < h.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(h.x - 14, h.y - h.r - 9, 28, 3);
    ctx.fillStyle = '#ff3b6b'; ctx.fillRect(h.x - 14, h.y - h.r - 9, 28 * Math.max(0, h.hp / h.maxHp), 3);
  }
}

// ---------------- simple effects shared by hub + dive ----------------
class FX {
  constructor() { this.parts = []; this.texts = []; this.rings = []; }
  burst(x, y, color, n = 10, speed = 140, life = 0.6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(speed * 0.3, speed);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(life * 0.5, life), max: life, color, size: rand(2, 4) });
    }
  }
  text(x, y, text, color = '#fff', size = 14, life = 1.1) { this.texts.push({ x, y, text, color, size, life, max: life }); }
  ring(x, y, R, color) { this.rings.push({ x, y, R, t: 0, color }); }
  update(dt) {
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const t of this.texts) { t.y -= 28 * dt; t.life -= dt; }
    this.texts = this.texts.filter(t => t.life > 0);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < 0.6);
  }
  draw(ctx) {
    for (const p of this.parts) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const k = r.t / 0.6;
      ctx.strokeStyle = hexA(r.color, 1 - k); ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.R * (0.3 + 0.7 * Math.sqrt(k)), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      ctx.globalAlpha = clamp(t.life / t.max * 1.5, 0, 1);
      ctx.font = `800 ${t.size}px Orbitron, sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
