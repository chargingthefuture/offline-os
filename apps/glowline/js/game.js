// Canvas game: animated neon Core background + steer-and-dodge race levels.
// Ports player.gd (ship), hazard.gd (falling obstacles), glitch_overlay.gd.
// Everything draws in virtual 720x1280 coordinates; main.js sets the transform.

import * as audio from "./audio.js";

export const VW = 720;
export const VH = 1280;

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------------------------------------------------------------------------
// Background — scrolling perspective grid, drifting particles, glitch bursts.
// ---------------------------------------------------------------------------
export class Background {
  constructor() {
    this.t = 0;
    this.scroll = 0;
    this.intensity = 0.15;          // 0 calm .. 1 intense
    this.glitchLevel = 0;
    this.particles = Array.from({ length: 60 }, () => ({
      x: rnd(0, VW), y: rnd(0, VH), z: rnd(0.2, 1), s: rnd(1, 3),
    }));
  }

  setIntensity(v) { this.intensity = v; }
  glitch(amount = 1) { this.glitchLevel = Math.min(1.4, this.glitchLevel + amount); }

  update(dt) {
    this.t += dt;
    this.scroll = (this.scroll + dt * (120 + this.intensity * 360)) % 80;
    for (const p of this.particles) {
      p.y += dt * (40 + p.z * 160) * (0.4 + this.intensity);
      if (p.y > VH) { p.y = -10; p.x = rnd(0, VW); }
    }
    if (this.glitchLevel > 0) this.glitchLevel = Math.max(0, this.glitchLevel - dt * 1.6);
  }

  draw(ctx) {
    // base wash
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, "#0a0a1e");
    g.addColorStop(1, `rgb(${13 + this.intensity * 30 | 0}, 10, ${31 + this.intensity * 20 | 0})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    // perspective grid converging toward a horizon
    const horizon = VH * 0.32;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(120, 90, 255, ${0.10 + this.intensity * 0.12})`;
    ctx.beginPath();
    for (let i = -8; i <= 8; i++) {
      const x = VW / 2 + i * 60;
      ctx.moveTo(VW / 2 + (x - VW / 2) * 0.06, horizon);
      ctx.lineTo(x * 1.6 - VW * 0.3, VH);
    }
    // horizontal scan lines receding
    for (let j = 0; j < 14; j++) {
      const f = j / 14;
      const y = horizon + (VH - horizon) * f * f + this.scroll * (0.2 + f);
      if (y > VH) continue;
      ctx.moveTo(0, y); ctx.lineTo(VW, y);
    }
    ctx.stroke();

    // central neon track line (from Main.tscn)
    ctx.strokeStyle = `rgba(0, 255, 204, ${0.28 + this.intensity * 0.25})`;
    ctx.lineWidth = 6;
    ctx.shadowColor = "rgba(0,255,204,0.8)";
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.moveTo(VW / 2, horizon);
    ctx.lineTo(VW / 2, VH);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = 0.25 + p.z * 0.5;
      ctx.fillStyle = p.z > 0.7 ? "#7a5aff" : "#00ffcc";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // glitch burst (ported from glitch_overlay.gd)
    if (this.glitchLevel > 0) {
      const n = (this.glitchLevel * 12) | 0;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = `rgba(0,255,204,${rnd(0.08, 0.35)})`;
        ctx.fillRect(rnd(0, VW), rnd(0, VH), rnd(20, 160), rnd(2, 9));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Ship — neon rhombus with glow + thruster trail (from player.gd _draw()).
// ---------------------------------------------------------------------------
function drawShip(ctx, x, y, tilt, blink) {
  if (blink) { ctx.globalAlpha = 0.35; }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt * 0.25);

  // thruster trail
  const grad = ctx.createLinearGradient(0, 30, 0, 130);
  grad.addColorStop(0, "rgba(0,255,204,0.6)");
  grad.addColorStop(1, "rgba(0,255,204,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-10, 24); ctx.lineTo(10, 24);
  ctx.lineTo(0, 120 + Math.random() * 20); ctx.closePath();
  ctx.fill();

  // glow layers
  const pts = [[0, -30], [20, 0], [0, 30], [-20, 0]];
  for (let i = 3; i >= 1; i--) {
    ctx.fillStyle = `rgba(0,255,204,${0.18 / i})`;
    ctx.beginPath();
    pts.forEach((p, k) => { const m = 1 + i * 0.35; k ? ctx.lineTo(p[0] * m, p[1] * m) : ctx.moveTo(p[0] * m, p[1] * m); });
    ctx.closePath(); ctx.fill();
  }
  // core
  ctx.shadowColor = "rgba(0,255,204,0.9)"; ctx.shadowBlur = 18;
  ctx.fillStyle = "rgba(180,255,245,0.95)";
  ctx.beginPath();
  pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Race — one steer-and-dodge level. update/draw driven by main's RAF loop.
// ---------------------------------------------------------------------------
const MODES = {
  calm:    { hazard: 0,    fall: 220, motes: 1.4, color: "#ff5a7a" },
  hazard:  { hazard: 1.1,  fall: 280, motes: 1.6, color: "#ff5a7a" },
  fast:    { hazard: 0.8,  fall: 380, motes: 1.8, color: "#ff7a3a" },
  intense: { hazard: 0.55, fall: 460, motes: 2.0, color: "#ff3a5a" },
  maze:    { hazard: 1.35, fall: 320, motes: 1.5, color: "#ff5a7a" },
};

export class Race {
  constructor(cfg, hooks = {}) {
    this.cfg = cfg;
    this.m = MODES[cfg.mode] || MODES.hazard;
    this.hooks = hooks;            // { onHit, onProgress, bg }
    this.ship = { x: VW / 2, tilt: 0 };
    this.steer = 0;
    this.hazards = [];
    this.motes = [];
    this.walls = [];
    this.progress = 0;
    this.hazardTimer = 0;
    this.moteTimer = 0;
    this.wallTimer = 0.4;
    this.wallIndex = 0;
    this.invuln = 0;
    this.setback = cfg.setback ?? 0.2;
    this.moteBoost = cfg.moteBoost ?? 0.03;
    this.done = false;
    this._resolve = null;
    this.maze = cfg.maze ? {
      gap: cfg.maze.gap ?? 210,
      wallHeight: cfg.maze.wallHeight ?? 78,
      interval: cfg.maze.interval ?? 1.25,
      minX: cfg.maze.minX ?? 150,
      maxX: cfg.maze.maxX ?? (VW - 150),
      shift: cfg.maze.shift ?? 150,
      spawnUntil: cfg.maze.spawnUntil ?? 0.92,
      boostAmount: cfg.maze.boostAmount ?? 0,
      boostRange: cfg.maze.boostRange ?? 34,
      gaps: cfg.maze.gaps ?? null,
      boostEdges: cfg.maze.boostEdges ?? null,
      lastGap: cfg.maze.startGap ?? (VW / 2),
    } : null;
  }

  start() { return new Promise((res) => { this._resolve = res; }); }
  setSteer(d) { this.steer = d; }

  _spawnHazard() {
    this.hazards.push({ x: rnd(70, VW - 70), y: -40, r: 26, rot: rnd(0, 6.28) });
  }
  _spawnMote() {
    this.motes.push({ x: rnd(70, VW - 70), y: -30, r: 12, hue: Math.random() < 0.5 ? "#00ffcc" : "#7a5aff" });
  }
  _spawnWall() {
    if (!this.maze) return;
    let gapCenter;
    if (this.maze.gaps && this.maze.gaps.length) {
      gapCenter = this.maze.gaps[this.wallIndex % this.maze.gaps.length];
    } else {
      gapCenter = this.maze.lastGap + rnd(-this.maze.shift, this.maze.shift);
    }
    gapCenter = clamp(gapCenter, this.maze.minX, this.maze.maxX);
    this.maze.lastGap = gapCenter;
    this.wallIndex += 1;
    this.walls.push({
      y: -this.maze.wallHeight,
      h: this.maze.wallHeight,
      gapCenter,
      gap: this.maze.gap,
      boostEdge: this.maze.boostEdges ? this.maze.boostEdges[(this.wallIndex - 1) % this.maze.boostEdges.length] : null,
      boosted: false,
      pulse: rnd(0, 6.28),
    });
  }

  _addProgress(amount) {
    this.progress = clamp(this.progress + amount, 0, 1);
    if (this.hooks.onProgress) this.hooks.onProgress(this.progress);
    if (this.progress >= 1) { this.done = true; this._resolve("win"); return true; }
    return false;
  }

  update(dt) {
    if (this.done) return;
    const SHIP_Y = 980;

    // steering (player.gd)
    this.ship.x = clamp(this.ship.x + this.steer * 540 * dt, 60, VW - 60);
    this.ship.tilt += (this.steer - this.ship.tilt) * Math.min(1, dt * 8);

    // progress
    if (this._addProgress(dt / this.cfg.seconds)) return;

    if (this.invuln > 0) this.invuln -= dt;

    // spawning
    if (this.m.hazard > 0) {
      this.hazardTimer -= dt;
      if (this.hazardTimer <= 0) { this._spawnHazard(); this.hazardTimer = this.m.hazard * rnd(0.7, 1.3); }
    }
    if (this.maze && this.progress < this.maze.spawnUntil) {
      this.wallTimer -= dt;
      if (this.wallTimer <= 0) {
        this._spawnWall();
        this.wallTimer = this.maze.interval * rnd(0.9, 1.12);
      }
    }
    this.moteTimer -= dt;
    if (this.moteTimer <= 0) { this._spawnMote(); this.moteTimer = this.m.motes * rnd(0.7, 1.3); }

    // move + collide hazards (hazard.gd)
    for (const h of this.hazards) {
      h.y += this.m.fall * dt;
      h.rot += dt * 2;
      if (this.invuln <= 0) {
        const dx = h.x - this.ship.x, dy = h.y - SHIP_Y;
        if (dx * dx + dy * dy < (h.r + 24) ** 2) this._hit(h);
      }
    }
    this.hazards = this.hazards.filter((h) => h.y < VH + 60 && !h.dead);

    // maze walls: moving gates with a single safe opening
    for (const w of this.walls) {
      w.y += this.m.fall * dt;
      w.pulse += dt * 3;
      if (this.invuln <= 0) {
        const gapLeft = w.gapCenter - w.gap / 2;
        const gapRight = w.gapCenter + w.gap / 2;
        const overlapsY = SHIP_Y + 24 > w.y && SHIP_Y - 24 < w.y + w.h;
        const insideGap = this.ship.x - 22 > gapLeft && this.ship.x + 22 < gapRight;
        if (overlapsY && !insideGap) this._hit(w);
        if (overlapsY && insideGap && w.boostEdge && !w.boosted && this.maze.boostAmount > 0) {
          const edgeX = w.boostEdge === "left" ? gapLeft : gapRight;
          if (Math.abs(this.ship.x - edgeX) <= this.maze.boostRange) {
            w.boosted = true;
            audio.blip();
            if (this._addProgress(this.maze.boostAmount)) return;
          }
        }
      }
    }
    this.walls = this.walls.filter((w) => w.y < VH + 90 && !w.dead);

    // move + collect motes
    for (const mt of this.motes) {
      mt.y += (this.m.fall * 0.7) * dt;
      const dx = mt.x - this.ship.x, dy = mt.y - SHIP_Y;
      if (dx * dx + dy * dy < (mt.r + 26) ** 2) {
        mt.got = true;
        audio.blip();
        if (this._addProgress(this.moteBoost)) break;
      }
    }
    this.motes = this.motes.filter((mt) => mt.y < VH + 40 && !mt.got);
  }

  _hit(h) {
    h.dead = true;
    this.invuln = 1.3;
    this.progress = Math.max(0, this.progress - this.setback);
    this.hazards.forEach((x) => { if (Math.abs(x.y - 980) < 240) x.dead = true; });
    this.walls.forEach((x) => { if (Math.abs(x.y - 980) < 220) x.dead = true; });
    audio.error();
    if (this.hooks.bg) this.hooks.bg.glitch(1.2);
    if (this.hooks.onHit) this.hooks.onHit();
  }

  draw(ctx) {
    const SHIP_Y = 980;
    // motes
    for (const mt of this.motes) {
      ctx.shadowColor = mt.hue; ctx.shadowBlur = 14;
      ctx.fillStyle = mt.hue;
      ctx.beginPath(); ctx.arc(mt.x, mt.y, mt.r, 0, 6.283); ctx.fill();
      ctx.shadowBlur = 0;
    }
    // hazards (corrupted diamonds)
    for (const h of this.hazards) {
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot);
      ctx.shadowColor = this.m.color; ctx.shadowBlur = 16;
      ctx.fillStyle = this.m.color;
      ctx.beginPath();
      ctx.moveTo(0, -h.r); ctx.lineTo(h.r, 0); ctx.lineTo(0, h.r); ctx.lineTo(-h.r, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.shadowBlur = 0;
    }
    // maze walls
    for (const w of this.walls) {
      const gapLeft = w.gapCenter - w.gap / 2;
      const gapRight = w.gapCenter + w.gap / 2;
      const glow = 0.55 + Math.sin(w.pulse) * 0.2;
      ctx.save();
      ctx.shadowColor = "#7a5aff";
      ctx.shadowBlur = 20;
      ctx.fillStyle = `rgba(122, 90, 255, ${0.58 + glow * 0.18})`;
      ctx.fillRect(0, w.y, gapLeft, w.h);
      ctx.fillRect(gapRight, w.y, VW - gapRight, w.h);
      const drawEdge = (x, color, width = 4) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, w.y);
        ctx.lineTo(x, w.y + w.h);
        ctx.stroke();
      };
      const boostColor = w.boosted ? `rgba(180, 255, 245, ${0.45 + glow * 0.18})` : `rgba(128, 255, 72, ${0.7 + glow * 0.25})`;
      const normalColor = `rgba(0, 255, 204, ${0.45 + glow * 0.25})`;
      drawEdge(gapLeft, w.boostEdge === "left" ? boostColor : normalColor, w.boostEdge === "left" ? 7 : 4);
      drawEdge(gapRight, w.boostEdge === "right" ? boostColor : normalColor, w.boostEdge === "right" ? 7 : 4);
      ctx.restore();
      ctx.shadowBlur = 0;
    }
    // ship
    const blink = this.invuln > 0 && (Math.floor(this.invuln * 12) % 2 === 0);
    drawShip(ctx, this.ship.x, SHIP_Y, this.ship.tilt, blink);
  }
}
