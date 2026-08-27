// All canvas drawing: the neon maze, the ship and its trail, the in-game HUD, and
// the on-screen touch buttons. Everything is drawn in CSS pixels (the context is
// pre-scaled by the device pixel ratio), so the button rectangles returned here line
// up with the pointer coordinates the input layer reads.

import { SHIP_CRUISE_MAX, SHIP_BOOST_MAX } from './ship.js';
import { formatTime } from './hud.js';
import { isMuted } from './audio.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.W = 0;
    this.H = 0;
    this.scale = 1;
    this.safe = { top: 0, right: 0, bottom: 0, left: 0 };

    // A hidden probe whose padding is the device's safe-area insets (the space
    // under a notch or home indicator). Reading its computed padding is the only
    // way to get those numbers into the canvas layout.
    this._safeProbe = document.createElement('div');
    this._safeProbe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
    document.body.appendChild(this._safeProbe);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.W = cssW;
    this.H = cssH;
    this.scale = cssH / 720; // world units of height kept in view

    const cs = getComputedStyle(this._safeProbe);
    this.safe = {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
  }

  // Layout of the on-screen buttons, returned so input can hit-test them.
  buttonLayout() {
    const s = this.safe;
    const m = 20;
    const b = Math.max(60, Math.min(this.W, this.H) * 0.14);
    const big = b * 1.2;
    const bottom = this.H - m - s.bottom;
    const top = 12 + s.top;
    const rightEdge = this.W - 12 - s.right;
    return {
      left: { x: m + s.left, y: bottom - b, w: b, h: b },
      right: { x: m + s.left + b + 12, y: bottom - b, w: b, h: b },
      boost: { x: this.W - m - s.right - big, y: bottom - big, w: big, h: big },
      restart: { x: rightEdge - 44, y: top, w: 44, h: 44 },
      mute: { x: rightEdge - (44 + 8), y: top, w: 44, h: 44 },
      home: { x: rightEdge - (44 + 8) * 2, y: top, w: 44, h: 44 },
    };
  }

  toScreen(cam, wx, wy) {
    return { x: (wx - cam.x) * this.scale + this.W / 2, y: (wy - cam.y) * this.scale + this.H / 2 };
  }

  draw(game) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._background();
    if (!game.level) return this.buttonLayout();

    const cam = game.camera;
    this._grid(cam);
    this._walls(game.level, cam);
    if (game.level.circuit) {
      this._circuit(game.level, cam, game.time);
    } else {
      this._checkpoints(game.level, cam);
      this._finish(game.level, cam, game.time);
    }
    this._ship(game.ship, game.level.theme, cam);
    this._hud(game);
    return this.buttonLayout();
  }

  _background() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, '#080a16');
    g.addColorStop(1, '#04050c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
  }

  _grid(cam) {
    const ctx = this.ctx;
    const step = 200 * this.scale;
    ctx.save();
    ctx.strokeStyle = 'rgba(90,120,200,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const ox = ((-cam.x * this.scale + this.W / 2) % step + step) % step;
    for (let x = ox; x < this.W; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.H);
    }
    const oy = ((-cam.y * this.scale + this.H / 2) % step + step) % step;
    for (let y = oy; y < this.H; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.W, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  _walls(level, cam) {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = level.theme.glow;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = level.theme.wall;
    ctx.lineWidth = 3;
    for (const poly of level.def.walls) {
      ctx.beginPath();
      for (let i = 0; i < poly.length; i++) {
        const s = this.toScreen(cam, poly[i].x, poly[i].y);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  _checkpoints(level, cam) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(140,170,255,0.18)';
    ctx.setLineDash([6, 10]);
    ctx.lineWidth = 2;
    for (const cx of level.checkpoints) {
      const top = this.toScreen(cam, cx, level.bounds.top);
      const bot = this.toScreen(cam, cx, level.bounds.bottom);
      if (top.x < -20 || top.x > this.W + 20) continue;
      ctx.beginPath();
      ctx.moveTo(top.x, Math.max(0, top.y));
      ctx.lineTo(bot.x, Math.min(this.H, bot.y));
      ctx.stroke();
    }
    ctx.restore();
  }

  _finish(level, cam, time) {
    const ctx = this.ctx;
    const x = level.finishX;
    const top = this.toScreen(cam, x, level.bounds.top);
    const bot = this.toScreen(cam, x, level.bounds.bottom);
    if (top.x < -40 || top.x > this.W + 40) return;
    const pulse = 0.6 + 0.4 * Math.sin(time * 5);
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 18 * pulse;
    ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.35 * pulse})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(top.x, Math.max(-20, top.y));
    ctx.lineTo(bot.x, Math.min(this.H + 20, bot.y));
    ctx.stroke();
    // Checkered blocks along the gate.
    const y0 = Math.max(0, top.y);
    const y1 = Math.min(this.H, bot.y);
    ctx.shadowBlur = 0;
    for (let y = y0, k = 0; y < y1; y += 14, k++) {
      ctx.fillStyle = k % 2 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(top.x - 3, y, 6, 14);
    }
    ctx.restore();
  }

  // Circuit markers: the checkered start/finish line and a faint ring for the
  // mid-loop check gate you must round each lap.
  _circuit(level, cam, time) {
    const ctx = this.ctx;
    const c = level.circuit;
    const pulse = 0.6 + 0.4 * Math.sin(time * 5);
    ctx.save();

    if (c.check) {
      const g = this.toScreen(cam, c.check.x, c.check.y);
      ctx.strokeStyle = 'rgba(140,170,255,0.25)';
      ctx.setLineDash([5, 9]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(g.x, g.y, c.check.r * this.scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const a = this.toScreen(cam, c.line.a.x, c.line.a.y);
    const b = this.toScreen(cam, c.line.b.x, c.line.b.y);
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 18 * pulse;
    ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.35 * pulse})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    // Checkered blocks along the line.
    ctx.shadowBlur = 0;
    const n = 10;
    for (let i = 0; i < n; i++) {
      if (i % 2) continue;
      const t0 = i / n;
      const t1 = (i + 1) / n;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0);
      ctx.lineTo(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
      ctx.stroke();
    }
    ctx.restore();
  }

  _ship(ship, theme, cam) {
    const ctx = this.ctx;
    // Trail.
    if (ship.trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 1; i < ship.trail.length; i++) {
        const a = this.toScreen(cam, ship.trail[i - 1].x, ship.trail[i - 1].y);
        const b = this.toScreen(cam, ship.trail[i].x, ship.trail[i].y);
        const alpha = (i / ship.trail.length) * 0.5;
        ctx.strokeStyle = ship.grinding ? `rgba(255,255,255,${alpha})` : `rgba(120,200,255,${alpha})`;
        ctx.lineWidth = (i / ship.trail.length) * 6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    const s = this.toScreen(cam, ship.pos.x, ship.pos.y);
    const r = 13;
    const glow = ship.boosting ? '#fff2a8' : ship.grinding ? '#ffffff' : theme.accent;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(ship.angle);
    ctx.shadowColor = glow;
    ctx.shadowBlur = ship.boosting ? 26 : 16;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.8, r * 0.7);
    ctx.lineTo(-r * 0.45, 0);
    ctx.lineTo(-r * 0.8, -r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _hud(game) {
    const ctx = this.ctx;
    const st = this.safe;
    ctx.save();
    ctx.textBaseline = 'top';

    // Level name (top-left).
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(180,200,255,0.7)';
    ctx.textAlign = 'left';
    ctx.fillText(game.level.name.toUpperCase(), 16 + st.left, 16 + st.top);

    // Timer (top-centre).
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.fillStyle = '#eaf6ff';
    ctx.textAlign = 'center';
    ctx.fillText(formatTime(game.time), this.W / 2, 12 + st.top);

    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(180,200,255,0.55)';
    const bestTxt = game.best != null ? `best ${formatTime(game.best)}` : `par ${formatTime(game.level.par)}`;
    ctx.fillText(bestTxt, this.W / 2, 48 + st.top);

    // Boost meter (bottom-centre).
    const mw = Math.min(240, this.W * 0.5);
    const mx = (this.W - mw) / 2;
    const my = this.H - 26 - st.bottom;
    ctx.fillStyle = 'rgba(20,28,52,0.85)';
    roundRect(ctx, mx, my, mw, 10, 5);
    ctx.fill();
    const c = game.ship.charge;
    ctx.fillStyle = c > 0.001 ? (game.ship.boosting ? '#fff2a8' : game.level.theme.accent) : 'rgba(80,100,150,0.5)';
    ctx.shadowColor = game.level.theme.glow;
    ctx.shadowBlur = c > 0.5 ? 10 : 0;
    roundRect(ctx, mx, my, mw * c, 10, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(180,200,255,0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('BOOST', this.W / 2, my - 14);

    // Speed readout (bottom-left of centre).
    const spd = Math.round((game.ship.speed / SHIP_BOOST_MAX) * 100);
    ctx.textAlign = 'right';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(180,200,255,0.5)';
    ctx.fillText(`${spd}%`, mx - 12, my - 4);

    // Progress under the timer: lap count for circuits, distance for sprints.
    let prog;
    if (game.level.circuit) {
      const laps = game.level.circuit.laps;
      prog = Math.max(0, Math.min(1, game.lap / laps));
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(180,200,255,0.7)';
      ctx.textAlign = 'center';
      ctx.fillText(`LAP ${Math.min(game.lap + 1, laps)} / ${laps}`, this.W / 2, 86 + st.top);
    } else {
      prog = Math.max(0, Math.min(1, (game.ship.pos.x - game.level.start.x) / (game.level.finishX - game.level.start.x)));
    }
    ctx.fillStyle = 'rgba(120,150,220,0.25)';
    roundRect(ctx, this.W / 2 - 90, 70 + st.top, 180, 4, 2);
    ctx.fill();
    ctx.fillStyle = game.level.theme.wall;
    roundRect(ctx, this.W / 2 - 90, 70 + st.top, 180 * prog, 4, 2);
    ctx.fill();

    ctx.restore();

    this._buttons(game);
  }

  _buttons(game) {
    const L = this.buttonLayout();
    // Home (back to levels), mute, and restart are always shown while in a level.
    this._btn(L.home, '☰', 0.5);
    this._btn(L.mute, isMuted() ? '🔇' : '🔊', 0.5);
    this._btn(L.restart, '↺', 0.5);
    if (!game.showTouch) return;
    this._btn(L.left, '◀', 0.4);
    this._btn(L.right, '▶', 0.4);
    this._btn(L.boost, '▲', 0.55, game.level ? game.level.theme.accent : '#38f0d0');
  }

  _btn(rect, glyph, alpha, tint) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(20,28,52,0.75)';
    ctx.strokeStyle = tint || 'rgba(150,180,255,0.6)';
    ctx.lineWidth = 2;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(16, rect.w / 4));
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = Math.min(1, alpha + 0.4);
    ctx.fillStyle = tint || '#cfe0ff';
    ctx.font = `${Math.round(rect.h * 0.4)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
