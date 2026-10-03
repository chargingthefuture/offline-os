// Peace Battle 2 — The Lit Country. The map on the canvas.
//
// Draws from game state and a few animation records; keeps no rules. Hit testing and the
// pan/pinch gesture live here too because they are about screen space, not about the game.

import { sectorHue, YEARS, DAYS_PER_YEAR } from './game.js';

const AMBER = '#ffb000';

export function createRenderer(canvas, onTap) {
  const ctx = canvas.getContext('2d');
  let state = null;
  let sectorsN = 20;
  let dpr = 1, W = 0, H = 0;
  // View: map unit square -> screen. fit() sets the base; pan and pinch move cam.
  const cam = { scale: 1, x: 0, y: 0 };
  let base = { scale: 1, x: 0, y: 0 };
  let hand = null;                 // screen point of the sliver in hand
  let anim = { t0: 0, dur: 0, arrivals: [], lit: [], sung: [], lampRoad: null, reached: [] };
  let litPulse = 0;
  const fogSeeds = [];

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr; canvas.height = H * dpr;
    fit();
  }

  function fit() {
    const pad = 22;
    const s = Math.min(W, H) - pad * 2;
    base = { scale: s, x: (W - s) / 2, y: (H - s) / 2 };
    cam.scale = 1; cam.x = 0; cam.y = 0;
  }

  const toScreen = (x, y) => [base.x + cam.x + (x * base.scale) * cam.scale, base.y + cam.y + (y * base.scale) * cam.scale];
  const px = (h) => toScreen(h.x, h.y);

  function setState(s) {
    state = s;
    if (s && !fogSeeds.length) for (let i = 0; i < 64; i++) fogSeeds.push([Math.random(), Math.random(), Math.random()]);
  }

  function dayAnimation(today, now) {
    anim = { t0: now, dur: 1500, arrivals: today.arrivals.slice(0, 60), lit: today.lit.slice(), sung: today.sung.slice(), lampRoad: today.lampRoad, reached: today.reached.slice() };
  }

  function draw(now) {
    if (!state) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const s = state;
    const k = base.scale * cam.scale;
    const rH = Math.max(1.6, Math.min(5, k * 0.0045));   // hearth radius in px
    const prog = anim.dur ? Math.min(1, (now - anim.t0) / anim.dur) : 1;

    drawYearRing(s);

    // Fog: the schemes. Sits where the hearths are dark, drifts, and never over a singing land.
    s.lands.forEach((land, li) => {
      if (land.sing) return;
      let n = 0, dark = 0;
      for (const h of s.hearths) if (h.land === li) { n++; if (!h.lit) dark++; }
      const f = n ? dark / n : 0;
      if (f < 0.03) return;
      for (let b = 0; b < 3; b++) {
        const sd = fogSeeds[(li * 3 + b) % fogSeeds.length];
        const t = now / 1000;
        const dx = Math.cos(t * 0.11 + sd[0] * 6.28) * land.r * 0.45;
        const dy = Math.sin(t * 0.09 + sd[1] * 6.28) * land.r * 0.4;
        const [cx, cy] = toScreen(land.cx + dx, land.cy + dy);
        const rad = land.r * k * (0.55 + sd[2] * 0.4) * (0.5 + f * 0.6);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, 'rgba(120,124,134,' + (0.22 * f).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(120,124,134,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
      }
    });

    // Singing halos.
    for (const land of s.lands) {
      if (!land.sing) continue;
      const [cx, cy] = toScreen(land.cx, land.cy);
      const rad = land.r * k * 1.25;
      const pulse = 0.5 + 0.5 * Math.sin(now / 900 + land.i);
      const g = ctx.createRadialGradient(cx, cy, rad * 0.3, cx, cy, rad);
      g.addColorStop(0, 'rgba(255,176,0,' + (0.10 + 0.04 * pulse).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,176,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,176,0,' + (0.18 + 0.1 * pulse).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, rad * (0.92 + 0.03 * pulse), 0, Math.PI * 2); ctx.stroke();
    }

    // Fog threads: the informant net between dark hearths. Lighting a hearth cuts them.
    ctx.strokeStyle = 'rgba(140,144,154,0.22)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (const h of s.hearths) {
      if (h.lit) continue;
      for (const n of s.nbrs[h.i]) {
        if (n < h.i || s.hearths[n].lit) continue;
        const [ax, ay] = px(h), [bx, by] = px(s.hearths[n]);
        ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      }
    }
    ctx.stroke();

    // Roads.
    ctx.strokeStyle = 'rgba(255,176,0,0.28)';
    ctx.lineWidth = Math.max(0.8, rH * 0.4);
    ctx.beginPath();
    for (const [a, b] of s.roads) {
      const [ax, ay] = px(s.hearths[a]), [bx, by] = px(s.hearths[b]);
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    }
    ctx.stroke();

    // Lamp: the first customer.
    if (s.lamp.on && s.lamp.customer >= 0) {
      const [ax, ay] = px(s.hearths[s.you]), [bx, by] = px(s.hearths[s.lamp.customer]);
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,214,120,0.7)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore();
    }

    // Hearths. Dark ones are a dot; lit ones carry a soft glow in their sector's tint.
    for (const h of s.hearths) {
      const [x, y] = px(h);
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      if (!h.lit) {
        ctx.fillStyle = '#2b2e36';
        ctx.beginPath(); ctx.arc(x, y, rH, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(141,144,154,0.35)'; ctx.lineWidth = 0.6; ctx.stroke();
        continue;
      }
      const sing = s.lands[h.land].sing;
      const hue = sectorHue(h.s, sectorsN);
      const glow = sing ? 3.2 : 2.2;
      ctx.fillStyle = 'hsla(' + hue + ',100%,55%,' + (sing ? 0.22 : 0.14) + ')';
      ctx.beginPath(); ctx.arc(x, y, rH * glow, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'hsl(' + hue + ',100%,' + (sing ? 72 : 60) + '%)';
      ctx.beginPath(); ctx.arc(x, y, rH * (sing ? 1.15 : 1), 0, Math.PI * 2); ctx.fill();
    }

    // Newly lit this day: a brief flare.
    if (prog < 1) {
      const a = 1 - prog;
      for (const hi of anim.lit) {
        const [x, y] = px(s.hearths[hi]);
        ctx.strokeStyle = 'rgba(255,214,120,' + a.toFixed(3) + ')'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, rH + 10 * prog, 0, Math.PI * 2); ctx.stroke();
      }
      for (const li of anim.sung) {
        const land = s.lands[li];
        const [cx, cy] = toScreen(land.cx, land.cy);
        ctx.strokeStyle = 'rgba(255,214,120,' + (a * 0.8).toFixed(3) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, land.r * k * (0.6 + 1.6 * prog), 0, Math.PI * 2); ctx.stroke();
      }
      // Lights travelling along roads to the cards.
      const tp = Math.min(1, prog * 1.4);
      for (const ar of anim.arrivals) {
        const [ax, ay] = px(s.hearths[ar.from]), [bx, by] = px(s.hearths[ar.to]);
        const x = ax + (bx - ax) * tp, y = ay + (by - ay) * tp;
        ctx.fillStyle = 'rgba(255,230,160,0.95)';
        ctx.beginPath(); ctx.arc(x, y, Math.max(2, rH * 0.9), 0, Math.PI * 2); ctx.fill();
      }
      if (anim.lampRoad != null) {
        const [ax, ay] = px(s.hearths[s.you]), [bx, by] = px(s.hearths[anim.lampRoad]);
        const x = ax + (bx - ax) * tp, y = ay + (by - ay) * tp;
        ctx.fillStyle = 'rgba(255,230,160,0.95)';
        ctx.beginPath(); ctx.arc(x, y, Math.max(2.5, rH), 0, Math.PI * 2); ctx.fill();
      }
    }

    // Your hearth.
    {
      const you = s.hearths[s.you];
      const [x, y] = px(you);
      litPulse = 0.5 + 0.5 * Math.sin(now / 600);
      ctx.strokeStyle = 'rgba(255,230,160,' + (0.6 + 0.3 * litPulse).toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      for (let r = 0; r <= Math.min(3, s.youLevel); r++) {
        ctx.beginPath(); ctx.arc(x, y, rH + 5 + r * 3.5, 0, Math.PI * 2); ctx.stroke();
      }
      if (s.lamp.on) {
        ctx.fillStyle = 'rgba(255,230,160,' + (0.25 + 0.2 * litPulse).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(x, y, rH * 4.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Quest cards: a small card over the hearth.
    for (const c of s.cards) {
      const h = s.hearths[c.h];
      const [x, y] = px(h);
      const done = c.tasks.reduce((a, t) => a + Math.min(t.got.length, t.need), 0);
      const need = c.tasks.reduce((a, t) => a + t.need, 0);
      const started = c.own || c.tasks.some((t) => t.got.includes(s.you));
      const w = 14, hh = 11;
      const cx = x - w / 2, cy = y - rH - hh - 7;
      ctx.fillStyle = started ? '#3a2e10' : '#262931';
      ctx.strokeStyle = c.own ? '#ffe39a' : AMBER;
      ctx.lineWidth = 1;
      roundRect(cx, cy, w, hh, 2.5); ctx.fill(); ctx.stroke();
      // progress line along the card's foot
      ctx.strokeStyle = AMBER; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + 2, cy + hh - 2.5); ctx.lineTo(cx + 2 + (w - 4) * (done / need), cy + hh - 2.5); ctx.stroke();
      // stem
      ctx.strokeStyle = 'rgba(255,176,0,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, cy + hh); ctx.lineTo(x, y - rH - 1); ctx.stroke();
    }

    // The sliver in hand.
    if (hand) {
      const g = ctx.createRadialGradient(hand[0], hand[1], 0, hand[0], hand[1], 22);
      g.addColorStop(0, 'rgba(255,230,160,0.9)'); g.addColorStop(0.3, 'rgba(255,176,0,0.5)'); g.addColorStop(1, 'rgba(255,176,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(hand[0], hand[1], 22, 0, Math.PI * 2); ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  // Fifty ticks around the edge, one a year; the years gone are brighter. Years are seven days
  // each, so the tick for the current year fills as the week does.
  function drawYearRing(s) {
    const per = (W + H) * 2;
    const yearsDone = (s.day - 1) / DAYS_PER_YEAR;
    for (let i = 0; i < YEARS; i++) {
      const d = ((i + 0.5) / YEARS) * per;
      let x, y, nx, ny;
      if (d < W) { x = d; y = 0; nx = 0; ny = 1; }
      else if (d < W + H) { x = W; y = d - W; nx = -1; ny = 0; }
      else if (d < W * 2 + H) { x = W - (d - W - H); y = H; nx = 0; ny = -1; }
      else { x = 0; y = H - (d - W * 2 - H); nx = 1; ny = 0; }
      const f = Math.max(0, Math.min(1, yearsDone - i));
      const len = i % 10 === 9 ? 11 : 7;
      ctx.strokeStyle = f > 0 ? 'rgba(255,176,0,' + (0.35 + 0.55 * f).toFixed(3) + ')' : 'rgba(141,144,154,0.3)';
      ctx.lineWidth = f > 0 ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + nx * len, y + ny * len); ctx.stroke();
    }
  }

  // Screen point -> what sits there. Cards first, because they are what a thumb aims at.
  function hitTest(sx, sy) {
    if (!state) return null;
    const s = state;
    let best = null, bd = 1e9;
    const rH = Math.max(1.6, Math.min(5, base.scale * cam.scale * 0.0045));
    for (const c of s.cards) {
      const [x, y] = px(s.hearths[c.h]);
      const d = Math.hypot(sx - x, sy - (y - rH - 12));
      if (d < 22 && d < bd) { bd = d; best = { type: 'card', id: c.id }; }
    }
    if (best) return best;
    const [yx, yy] = px(s.hearths[s.you]);
    if (Math.hypot(sx - yx, sy - yy) < 20) return { type: 'you' };
    for (const h of s.hearths) {
      const [x, y] = px(h);
      const d = Math.hypot(sx - x, sy - y);
      if (d < 12 && d < bd) { bd = d; best = { type: 'hearth', i: h.i }; }
    }
    return best;
  }

  // Gestures: tap, one-finger pan, two-finger pinch. Mouse wheel zooms on desktop.
  const pointers = new Map();
  let gesture = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    const r = canvas.getBoundingClientRect();
    if (pointers.size === 1) gesture = { kind: 'tap', x0: e.clientX, y0: e.clientY, cx: cam.x, cy: cam.y, t0: performance.now(), local: [e.clientX - r.left, e.clientY - r.top] };
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      gesture = { kind: 'pinch', d0: Math.hypot(a[0] - b[0], a[1] - b[1]), s0: cam.scale, cx: cam.x, cy: cam.y, mx: (a[0] + b[0]) / 2 - r.left, my: (a[1] + b[1]) / 2 - r.top };
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) {
      if (hand) { const r = canvas.getBoundingClientRect(); hand = [e.clientX - r.left, e.clientY - r.top]; }
      return;
    }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    const r = canvas.getBoundingClientRect();
    if (hand) hand = [e.clientX - r.left, e.clientY - r.top];
    if (!gesture) return;
    if (gesture.kind === 'pinch' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const ns = Math.max(1, Math.min(6, gesture.s0 * (d / gesture.d0)));
      zoomAt(gesture.mx, gesture.my, ns, gesture.s0, gesture.cx, gesture.cy);
      return;
    }
    const dx = e.clientX - gesture.x0, dy = e.clientY - gesture.y0;
    if (gesture.kind === 'tap' && Math.hypot(dx, dy) > 8) gesture.kind = 'pan';
    if (gesture.kind === 'pan') { cam.x = gesture.cx + dx; cam.y = gesture.cy + dy; clampCam(); }
  });
  function endPointer(e) {
    const wasTap = gesture && gesture.kind === 'tap' && pointers.has(e.pointerId);
    pointers.delete(e.pointerId);
    if (wasTap) { const g = gesture; gesture = null; onTap(hitTest(g.local[0], g.local[1]), g.local); }
    if (pointers.size === 0) gesture = null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const ns = Math.max(1, Math.min(6, cam.scale * (e.deltaY < 0 ? 1.15 : 0.87)));
    zoomAt(e.clientX - r.left, e.clientY - r.top, ns, cam.scale, cam.x, cam.y);
  }, { passive: false });

  function zoomAt(mx, my, ns, s0, cx0, cy0) {
    // Keep the map point under the fingers where it is.
    const ux = (mx - base.x - cx0) / s0, uy = (my - base.y - cy0) / s0;
    cam.scale = ns;
    cam.x = mx - base.x - ux * ns;
    cam.y = my - base.y - uy * ns;
    clampCam();
  }
  function clampCam() {
    const over = base.scale * (cam.scale - 1);
    cam.x = Math.max(-over - 40, Math.min(40, cam.x));
    cam.y = Math.max(-over - 40, Math.min(40, cam.y));
  }

  function focusOn(hi) {
    if (!state) return;
    const h = state.hearths[hi];
    cam.scale = Math.max(cam.scale, 2.2);
    cam.x = W / 2 - base.x - h.x * base.scale * cam.scale;
    cam.y = H / 2 - base.y - h.y * base.scale * cam.scale;
    clampCam();
  }

  return {
    resize, fit, setState, draw, hitTest, dayAnimation, focusOn,
    setSectors(n) { sectorsN = n; },
    setHand(p) { hand = p; },
    hearthScreen(hi) { return px(state.hearths[hi]); },
  };
}
