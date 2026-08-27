// Level definitions. Each maze is a set of wall polylines the ship must thread
// left-to-right. Corridors are built from a centreline plus a half-width so the
// shapes stay smooth and reproducible; pillars are closed loops dropped inside.

// Build the two edges of a winding corridor by sampling a centre and half-width.
function corridor({ length, step = 40, mid, half }) {
  const top = [];
  const bottom = [];
  for (let x = 0; x <= length; x += step) {
    const m = mid(x);
    const h = half(x);
    top.push({ x, y: m - h });
    bottom.push({ x, y: m + h });
  }
  return { top, bottom };
}

// A closed polygon obstacle (an "island" in the corridor).
function pillar(cx, cy, rx, ry, sides = 6, rot = 0) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  pts.push({ ...pts[0] }); // close the loop
  return pts;
}

// A closed ellipse outline — used for circuit walls (an outer ring and an inner
// island together make a lap track).
function ellipse(cx, cy, rx, ry, n = 72) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

// A figure-eight tube. The centreline is a Gerono lemniscate (a sideways 8); the
// walls are that line pushed out by a half-width on each side. Wall points inside
// `gap` of the centre are dropped, so the two arms of the 8 meet in an open crossing
// you drive straight through — the loop genuinely crosses itself. Returns the wall
// polylines split at those gaps.
function eightTube(cx, cy, a, b, half, gap) {
  const P = (t) => ({ x: cx + a * Math.cos(t), y: cy + (b / 2) * Math.sin(2 * t) });
  const tangent = (t) => {
    const dx = -a * Math.sin(t);
    const dy = b * Math.cos(2 * t);
    const m = Math.hypot(dx, dy);
    return { x: dx / m, y: dy / m };
  };
  const n = 220;
  const sides = [[], []];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const p = P(t);
    const tv = tangent(t);
    const nrm = { x: -tv.y, y: tv.x }; // left normal
    for (const [s, sign] of [[0, 1], [1, -1]]) {
      const q = { x: p.x + nrm.x * half * sign, y: p.y + nrm.y * half * sign };
      sides[s].push(Math.hypot(q.x - cx, q.y - cy) > gap ? q : null);
    }
  }
  const walls = [];
  for (const arr of sides) {
    let cur = [];
    for (const q of arr) {
      if (q) cur.push(q);
      else { if (cur.length > 1) walls.push(cur); cur = []; }
    }
    if (cur.length > 1) walls.push(cur);
  }
  return walls;
}

// A closed 3-lobe rounded-triangle ring: r(th) = base*(1 + k*cos(3*(th-rot))).
function roundTri(cx, cy, base, k = 0.2, rot = Math.PI / 3, n = 168) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * Math.PI * 2;
    const r = base * (1 + k * Math.cos(3 * (th - rot)));
    pts.push({ x: cx + Math.cos(th) * r, y: cy + Math.sin(th) * r });
  }
  return pts;
}

// Two-circle teardrop: big round end at (xb,cy) radius Rb, small rounded nose at
// (xt,cy) radius Rt (xt>xb, Rt<Rb), joined by external tangent lines. Returns an
// ordered closed polyline. Offsetting Rb and Rt inward by the same amount (same
// centers) yields a nested teardrop with a constant-width channel.
function teardrop2(xb, cy, Rb, xt, Rt, A = 44, T = 30) {
  const d = xt - xb;
  const phi = Math.acos((Rb - Rt) / d);
  const C1 = { x: xb, y: cy }, C2 = { x: xt, y: cy };
  const P = (C, R, a) => ({ x: C.x + R * Math.cos(a), y: C.y + R * Math.sin(a) });
  const lerp = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const pts = [];
  for (let i = 0; i <= A; i++) { const a = phi + (i / A) * ((2 * Math.PI - phi) - phi); pts.push(P(C1, Rb, a)); }
  const bl = pts[pts.length - 1];
  const tl = P(C2, Rt, 2 * Math.PI - phi);
  for (let i = 1; i <= T; i++) pts.push(lerp(bl, tl, i / T));
  for (let i = 1; i <= A; i++) { const a = (2 * Math.PI - phi) + (i / A) * (2 * phi); pts.push(P(C2, Rt, a)); }
  const tu = pts[pts.length - 1];
  const bu = pts[0];
  for (let i = 1; i < T; i++) pts.push(lerp(tu, bu, i / T));
  pts.push({ ...pts[0] });
  return pts;
}

// Two overlapping ellipses woven into ONE closed self-crossing tube.
// Right ellipse centered at (cx+E,cy), left at (cx-E,cy); parametrized so the whole
// right ellipse is traced (t in [0,PI]) then the whole left ellipse (t in [PI,2PI]).
// The two ellipses overlap, so the curve crosses itself at TWO points — the top and
// bottom of the overlap lens, at (cx, cy +/- b*s). Wall points within junctionR of
// either crossing are dropped, opening both crossing junctions (like eightTube).
function linkedTube(cx, cy, a, b, E, half, junctionR, n = 360) {
  const s = Math.sqrt(1 - (E / a) * (E / a));
  const phiR = Math.atan2(s, -E / a);
  const phiL = Math.atan2(s, E / a);
  const P = (t) => {
    if (t < Math.PI) { const g = 2 * t + phiR; return { x: cx + E + a * Math.cos(g), y: cy + b * Math.sin(g) }; }
    const g = 2 * (t - Math.PI) + phiL; return { x: cx - E + a * Math.cos(g), y: cy + b * Math.sin(g) };
  };
  const T = (t) => { const h = 1e-4; const p0 = P(t - h), p1 = P(t + h); const dx = p1.x - p0.x, dy = p1.y - p0.y; const m = Math.hypot(dx, dy) || 1; return { x: dx / m, y: dy / m }; };
  const crossings = [{ x: cx, y: cy + b * s }, { x: cx, y: cy - b * s }];
  const sides = [[], []];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2; const p = P(t), tv = T(t), nrm = { x: -tv.y, y: tv.x };
    for (const [k, sign] of [[0, 1], [1, -1]]) {
      const q = { x: p.x + nrm.x * half * sign, y: p.y + nrm.y * half * sign };
      let open = false; for (const c of crossings) { if (Math.hypot(q.x - c.x, q.y - c.y) <= junctionR) { open = true; break; } }
      sides[k].push(open ? null : q);
    }
  }
  const walls = [];
  for (const arr of sides) { let cur = []; for (const q of arr) { if (q) cur.push(q); else { if (cur.length > 1) walls.push(cur); cur = []; } } if (cur.length > 1) walls.push(cur); }
  return { walls, P, crossings };
}

// --- Level 1: wide, gentle waves, room to learn the wall-riding. ---------
function level1() {
  const length = 5200;
  const mid = (x) => 500 + Math.sin(x / 700) * 150;
  const half = () => 140;
  const { top, bottom } = corridor({ length, mid, half });
  return {
    name: 'First Light',
    theme: { wall: '#38f0d0', glow: 'rgba(56,240,208,0.55)', accent: '#8affee' },
    par: 26,
    start: { x: 120, y: mid(120), angle: 0 },
    finishX: length - 180,
    bounds: { left: -80, right: length + 80, top: -200, bottom: 1200 },
    checkpoints: [1300, 2600, 3900],
    walls: [
      top,
      bottom,
      pillar(2100, mid(2100), 70, 90, 6),
      pillar(3600, mid(3600) - 40, 60, 70, 5, 0.4),
    ],
  };
}

// --- Level 2: tighter, taller swings, staggered pillars. -----------------
function level2() {
  const length = 6400;
  const mid = (x) => 520 + Math.sin(x / 520) * 230 + Math.sin(x / 190) * 30;
  const half = (x) => 110 - Math.sin(x / 900) * 18;
  const { top, bottom } = corridor({ length, mid, half });
  const walls = [top, bottom];
  for (let x = 1200; x < length - 600; x += 900) {
    const up = ((x / 900) | 0) % 2 === 0;
    walls.push(pillar(x, mid(x) + (up ? -55 : 55), 55, 75, 6, 0.3));
  }
  return {
    name: 'Switchback',
    theme: { wall: '#7c5cff', glow: 'rgba(124,92,255,0.55)', accent: '#c3b4ff' },
    par: 34,
    start: { x: 120, y: mid(120), angle: 0 },
    finishX: length - 200,
    bounds: { left: -80, right: length + 80, top: -300, bottom: 1300 },
    checkpoints: [1500, 3000, 4500, 5800],
    walls,
  };
}

// --- Level 3: narrow gauntlet, alternating gates. ------------------------
function level3() {
  const length = 7200;
  const mid = (x) => 540 + Math.sin(x / 430) * 250 + Math.cos(x / 150) * 34;
  const half = (x) => 96 - Math.sin(x / 700) * 10;
  const { top, bottom } = corridor({ length, mid, half });
  const walls = [top, bottom];
  for (let x = 1100; x < length - 700; x += 620) {
    const side = ((x / 620) | 0) % 2 === 0 ? -1 : 1;
    walls.push(pillar(x, mid(x) + side * 46, 40, 62, 5, side * 0.5));
  }
  return {
    name: 'The Gauntlet',
    theme: { wall: '#ff4d9d', glow: 'rgba(255,77,157,0.55)', accent: '#ffb3d4' },
    par: 44,
    start: { x: 120, y: mid(120), angle: 0 },
    finishX: length - 220,
    bounds: { left: -80, right: length + 80, top: -400, bottom: 1500 },
    checkpoints: [1400, 2800, 4200, 5600, 6600],
    walls,
  };
}

// --- Level 4: gravity. A wide cave that pulls you down; aim up to hold a line,
// and grind the ceiling or floor to keep the boost topped up. ------------
function level4() {
  const length = 6600;
  const mid = (x) => 520 + Math.sin(x / 900) * 60;
  const half = () => 175;
  const { top, bottom } = corridor({ length, mid, half });
  const walls = [top, bottom];
  for (let x = 1200; x < length - 700; x += 780) {
    const ceiling = ((x / 780) | 0) % 2 === 0;
    const m = mid(x);
    const y = ceiling ? m - 175 + 60 : m + 175 - 60; // stalactite from the roof / stalagmite from the floor
    walls.push(pillar(x, y, 34, 74, 4, Math.PI / 4));
  }
  return {
    name: 'Gravity Well',
    theme: { wall: '#ffb020', glow: 'rgba(255,176,32,0.5)', accent: '#ffd98a' },
    par: 40,
    gravity: { x: 0, y: 250 },
    start: { x: 120, y: mid(120), angle: 0 },
    finishX: length - 200,
    bounds: { left: -80, right: length + 80, top: -400, bottom: 1400 },
    checkpoints: [1500, 3000, 4500, 5800],
    walls,
  };
}

// --- Level 5: heavier gravity, a tighter cave, obstacles from both sides. -
function level5() {
  const length = 7000;
  const mid = (x) => 540 + Math.sin(x / 780) * 90 + Math.sin(x / 240) * 20;
  const half = (x) => 138 - Math.sin(x / 800) * 12;
  const { top, bottom } = corridor({ length, mid, half });
  const walls = [top, bottom];
  for (let x = 1000; x < length - 700; x += 560) {
    const ceiling = ((x / 560) | 0) % 2 === 0;
    const m = mid(x);
    const h = half(x);
    const y = ceiling ? m - h + 48 : m + h - 48;
    walls.push(pillar(x, y, 30, 62, 4, Math.PI / 4));
  }
  return {
    name: 'Undertow',
    theme: { wall: '#ff7043', glow: 'rgba(255,112,67,0.5)', accent: '#ffb59b' },
    par: 48,
    gravity: { x: 0, y: 340 },
    start: { x: 120, y: mid(120), angle: 0 },
    finishX: length - 220,
    bounds: { left: -80, right: length + 80, top: -500, bottom: 1500 },
    checkpoints: [1400, 2800, 4200, 5600, 6600],
    walls,
  };
}

// --- Level 6: steep switchbacks with pinch pillars. The corridor swings hard and
// narrow, so you have to slide the outer wall of each bend to hold your speed
// through it rather than nose in and stall. -------------------------------
function level6() {
  const length = 7600;
  const mid = (x) => 640 + Math.sin(x / 360) * 330 + Math.sin(x / 120) * 40;
  const half = (x) => 92 - Math.sin(x / 650) * 10;
  const { top, bottom } = corridor({ length, mid, half });
  const walls = [top, bottom];
  for (let x = 1000; x < length - 700; x += 520) {
    const s = ((x / 520) | 0) % 2 ? 1 : -1;
    walls.push(pillar(x, mid(x) + s * 44, 40, 60, 5, s * 0.5));
  }
  return {
    name: 'Hairpins',
    theme: { wall: '#5cff9e', glow: 'rgba(92,255,158,0.5)', accent: '#b9ffd6' },
    par: 52,
    start: { x: 120, y: mid(120), angle: 0 },
    finishX: length - 200,
    bounds: { left: -80, right: length + 80, top: -500, bottom: 1700 },
    checkpoints: [1500, 3000, 4500, 6000, 7000],
    walls,
  };
}

// --- Level 7: heavy gravity through a tight, winding cave with teeth from both
// sides. The pull is strong and the gaps are small, so you grind the roof and
// floor to keep the boost charged and thread each gate. --------------------
function level7() {
  const length = 7400;
  const mid = (x) => 700 + Math.sin(x / 520) * 300 + Math.cos(x / 175) * 44;
  const half = (x) => 104 - Math.sin(x / 720) * 14;
  const { top, bottom } = corridor({ length, mid, half });
  const walls = [top, bottom];
  for (let x = 900; x < length - 700; x += 470) {
    const ceiling = ((x / 470) | 0) % 2 === 0;
    const m = mid(x);
    const h = half(x);
    const y = ceiling ? m - h + 46 : m + h - 46;
    walls.push(pillar(x, y, 30, 58, 4, Math.PI / 4));
  }
  return {
    name: 'Riptide',
    theme: { wall: '#ff5cc8', glow: 'rgba(255,92,200,0.5)', accent: '#ffb3e6' },
    par: 58,
    gravity: { x: 0, y: 300 },
    start: { x: 120, y: mid(120), angle: 0 },
    finishX: length - 220,
    bounds: { left: -80, right: length + 80, top: -600, bottom: 1800 },
    checkpoints: [1400, 2800, 4200, 5600, 6800],
    walls,
  };
}

// --- Level 8: a circuit. Race the oval three times and beat the clock. The bends
// are long, so you carry speed by leaning on the outer wall through each one. ----
function level8() {
  const Cx = 1400, Cy = 760;
  const ORx = 1000, ORy = 560, IRx = 560, IRy = 210;
  return {
    name: 'Speedway',
    theme: { wall: '#ffd54a', glow: 'rgba(255,213,74,0.5)', accent: '#ffe9a0' },
    par: 40,
    circuit: {
      laps: 3,
      // Start/finish line across the right side of the track; cross it heading down.
      line: { a: { x: Cx + IRx, y: Cy }, b: { x: Cx + ORx, y: Cy }, forward: { x: 0, y: 1 } },
      // The check gate on the far side; you must round it before a lap counts.
      check: { x: Cx - (ORx + IRx) / 2, y: Cy, r: 220 },
    },
    start: { x: Cx + (ORx + IRx) / 2, y: Cy - 40, angle: Math.PI / 2 },
    bounds: { left: Cx - ORx - 120, right: Cx + ORx + 120, top: Cy - ORy - 120, bottom: Cy + ORy + 120 },
    checkpoints: [],
    walls: [ellipse(Cx, Cy, ORx, ORy), ellipse(Cx, Cy, IRx, IRy)],
  };
}

// --- Level 9: a figure-eight circuit. The track crosses itself in the middle, so
// each lap runs both loops and threads the open crossing twice. Two laps, on the
// clock. -----------------------------------------------------------------------
function level9() {
  const Cx = 1500, Cy = 780, A = 820, B = 1040, half = 180, gap = 210;
  return {
    name: 'Crossover',
    theme: { wall: '#7c5cff', glow: 'rgba(124,92,255,0.55)', accent: '#c3b4ff' },
    par: 36,
    circuit: {
      laps: 2,
      line: { a: { x: Cx + A - half, y: Cy }, b: { x: Cx + A + half, y: Cy }, forward: { x: 0, y: 1 } },
      check: { x: Cx - A, y: Cy, r: 220 },
    },
    start: { x: Cx + A, y: Cy - 40, angle: Math.PI / 2 },
    bounds: { left: Cx - A - 160, right: Cx + A + 160, top: Cy - B / 2 - 260, bottom: Cy + B / 2 + 260 },
    checkpoints: [],
    walls: eightTube(Cx, Cy, A, B, half, gap),
  };
}

function level10() {
  // "Maelstrom" — a vortex sprint. The centreline is a chirp: it swings back and
  // forth and the swings get steadily faster (wavelength ~1750 -> ~700, about 2.5x)
  // as the corridor half-width shrinks (205 -> 120), so lazy wide sweeps wind down
  // into fast, precise weaving — a corridor spiralling tighter, like a whirlpool.
  const length = 6000;
  const step = 30;
  const B = 620;
  const A = (x) => 180 - 80 * (x / length);
  const half = (x) => 205 - 85 * (x / length);
  const a0 = 2 * Math.PI / 1750;
  const finishX = length - 200;
  const phiEnd = 2 * Math.PI / 700;
  const bq = (phiEnd - a0) / (2 * finishX);
  const phase = (x) => a0 * x + bq * x * x;
  const mid = (x) => B + A(x) * Math.sin(phase(x));
  const { top, bottom } = corridor({ length, step, mid, half });
  return {
    name: 'Maelstrom',
    theme: { wall: '#2fb6ff', glow: 'rgba(47,182,255,0.5)', accent: '#a6e2ff' },
    par: 21,
    start: { x: 120, y: mid(120), angle: 0 },
    finishX,
    bounds: { left: -80, right: length + 80, top: -320, bottom: 1420 },
    checkpoints: [1200, 2400, 3600, 4800],
    walls: [top, bottom],
  };
}

function level11() {
  const length = 6400;
  const period = 1400;
  const amp = 140;
  const base = 580;
  const halfW = 150;
  const smoothstep = (a, b, u) => { u = Math.max(0, Math.min(1, (u - a) / (b - a))); return u * u * (3 - 2 * u); };
  const wave = (x) => {
    const p = (((x % period) + period) % period) / period; // 0..1
    const f = 0.20; // plateau fraction on each half
    if (p < f) return 1;
    if (p < 0.5) return 1 - 2 * smoothstep(f, 0.5, p);      // top -> bottom jog
    if (p < 0.5 + f) return -1;
    return -1 + 2 * smoothstep(0.5 + f, 1, p);              // bottom -> top jog
  };
  const mid = (x) => base + amp * wave(x);
  const half = () => halfW;
  const { top, bottom } = corridor({ length, step: 30, mid, half });
  const walls = [top, bottom];
  // Offset pillar-gates at each bend entry, alternating side -> a slalom.
  const ry = 48, rx = 44;
  let gateIdx = 0;
  for (let p = 0; p * period < length - 700; p++) {
    for (const base01 of [0.10, 0.60]) {
      const cx = p * period + base01 * period + 0.10 * period;
      if (cx < 900 || cx > length - 700) continue;
      const m = mid(cx);
      const side = gateIdx % 2 === 0 ? 1 : -1;
      const off = side * (ry + 30);
      walls.push(pillar(cx, m + off, rx, ry, 5, 0.3));
      gateIdx++;
    }
  }
  return {
    name: 'Slalom',
    theme: { wall: '#1fa8ff', glow: 'rgba(31,168,255,0.5)', accent: '#9ad4ff' },
    par: 44,
    start: { x: 120, y: mid(120), angle: 0 },
    finishX: length - 200,
    bounds: { left: -120, right: length + 120, top: -200, bottom: 1300 },
    checkpoints: [1350, 2750, 4150, 5550],
    walls,
  };
}

function level12() {
  // "Debris Belt": a WIDE open corridor with NO gravity, packed with many small
  // pillars scattered at varied, non-periodic positions like an asteroid field.
  // A clear lane snakes through the rubble; dense rock banks flank it on both
  // sides, with extra loose rocks scattered out toward the walls.
  const length = 6200;
  const step = 30;
  const half = 250;                 // WIDE corridor: full width 500
  const laneHalf = 112;             // clear weaving lane half-width (free ~200 after margins)
  const finishX = length - 200;

  // Deterministic pseudo-random so the field is reproducible.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(0x5eed17);
  const rnd = (a, b) => a + rng() * (b - a);

  // Gentle centreline; the lane weaves around it with two incommensurate waves so
  // the path never feels periodic. Amplitude ramps up from 0 at the start.
  const mid = (x) => 600 + 40 * Math.sin(x / 1300);
  const ramp = (x) => { const u = (x - 220) / 900; return u < 0 ? 0 : (u > 1 ? 1 : u); };
  const g = (x) => mid(x) + ramp(x) * (72 * Math.sin(x / 270 + 0.7) + 30 * Math.sin(x / 150 + 2.1));

  const { top, bottom } = corridor({ length, step, mid, half: () => half });
  const walls = [top, bottom];

  function drop(cx, cy, rx, ry, sides, rot) {
    walls.push(pillar(cx, cy, rx, ry, sides, rot));
  }

  // A framing pillar sits flush against the lane edge so the clear lane stays the
  // single widest vertical gap; loose rocks fill the space out toward the wall.
  function fillSide(x, wallY, laneEdge, sign) {
    const H = Math.abs(wallY - laneEdge);
    if (H < 44) return;                    // sliver: the wall itself bounds the lane
    const r = Math.min(rnd(34, 42), (H - 8) / 2);
    const cy = laneEdge + sign * r;        // flush against the lane edge
    drop(x, cy, r * rnd(0.92, 1.12), r, 6, rnd(0, 1));
    const inner = laneEdge + sign * 2 * r; // outer face of the framing pillar
    const spanLo = Math.min(inner, wallY);
    const spanHi = Math.max(inner, wallY);
    const room = spanHi - spanLo;
    if (room < 46) return;
    const n = room > 150 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const rr = rnd(15, 27);
      const cyR = rnd(spanLo + rr + 4, spanHi - rr - 4);
      drop(x + rnd(-24, 24), cyR, rr * rnd(0.85, 1.2), rr, rng() < 0.5 ? 5 : 6, rnd(0, 1));
    }
  }

  let x = 720;
  while (x < finishX - 150) {
    const c = g(x);
    fillSide(x, mid(x) - half, c - laneHalf, -1);  // above the lane
    fillSide(x, mid(x) + half, c + laneHalf, +1);  // below the lane
    x += rnd(48, 58);
  }

  return {
    name: 'Debris Belt',
    theme: { wall: '#b24bff', glow: 'rgba(178,75,255,0.5)', accent: '#e2b6ff' },
    par: 18,
    start: { x: 120, y: mid(120), angle: 0 },
    finishX,
    bounds: { left: -140, right: length + 140, top: -260, bottom: 1360 },
    checkpoints: [1500, 3000, 4500],
    walls,
  };
}

function level13() {
  // Inversion cave: gravity pulls UP, so the ship falls toward the ceiling, rides it,
  // and must aim DOWN to hold a line. A wide, continuously winding cave (no dead-
  // straight stretch to drift in) with teeth alternating from ceiling and floor; the
  // ceiling teeth reach in deeper, so the roof you cling to is the busy side.
  const length = 7000;
  const mid = (x) => 640 + Math.sin(x / 600) * 250 + Math.cos(x / 205) * 44;
  const half = (x) => 150 - Math.sin(x / 700) * 14; // ~136..164 -> wide corridor
  const { top, bottom } = corridor({ length, step: 30, mid, half });
  const walls = [top, bottom];
  for (let x = 760; x < length - 700; x += 480) {
    const ceiling = ((x / 480) | 0) % 2 === 0;
    const m = mid(x), h = half(x);
    const ry = ceiling ? 64 : 48; // ceiling teeth (the ride side) bite deeper
    const rx = 30;
    const e = ry * 0.707; // vertical half-extent of the 45deg-rotated diamond
    const cy = ceiling ? (m - h) + e : (m + h) - e; // outer tip touches the wall
    walls.push(pillar(x, cy, rx, ry, 4, Math.PI / 4));
  }
  return {
    name: 'Overhang',
    theme: { wall: '#b6ff3a', glow: 'rgba(182,255,58,0.5)', accent: '#e4ffab' },
    par: 28,
    gravity: { x: 0, y: -260 },
    start: { x: 120, y: mid(120), angle: 0 },
    finishX: length - 200,
    bounds: { left: -80, right: length + 80, top: -900, bottom: 1800 },
    checkpoints: [1400, 2800, 4200, 5600, 6600],
    walls,
  };
}

function level14() {
  const length = 7600;
  const mid = (x) => 640 + Math.sin(x / 920) * 190 + Math.sin(x / 2600) * 70;
  const half = () => 176;
  const { top, bottom } = corridor({ length, mid, half });
  return {
    name: 'Backdraft',
    theme: { wall: '#f4212e', glow: 'rgba(244,33,46,0.5)', accent: '#ff8f96' },
    par: 26,
    gravity: { x: -180, y: 120 },
    start: { x: 120, y: mid(120), angle: 0 },
    finishX: length - 200,
    bounds: { left: -320, right: length + 80, top: -240, bottom: 1440 },
    checkpoints: [1500, 3000, 4400, 5800, 6800],
    walls: [top, bottom],
  };
}

function level15() {
  const length = 5600;
  const P = 900; // gate spacing
  // Wide rooms (half=220) pinched to narrow gates (half=84) on a cosine pulse.
  const half = (x) => 152 + 68 * Math.cos((2 * Math.PI * x) / P);
  // Very gentle long centreline drift so the gates stay near-straight.
  const mid = (x) => 620 + Math.sin(x / 1300) * 70;
  const { top, bottom } = corridor({ length, step: 30, mid, half });
  return {
    name: 'The Narrows',
    theme: { wall: '#2ea8ff', glow: 'rgba(46,168,255,0.5)', accent: '#a9dbff' },
    par: 15,
    start: { x: 140, y: mid(140), angle: 0 },
    finishX: length - 200,
    bounds: { left: -120, right: length + 120, top: 120, bottom: 1160 },
    checkpoints: [900, 1800, 2700, 3600, 4500],
    walls: [top, bottom],
  };
}

function level16() {
  const Cx = 1500, Cy = 950;
  const BASE_O = 980, BASE_I = 560, K = 0.2, ROT = Math.PI / 3; // corner at 60/180/300deg, flat side at theta=0
  // Outer 3-lobe rounded-triangle ring + matching smaller inner island.
  const outer = roundTri(Cx, Cy, BASE_O, K, ROT);
  const island = roundTri(Cx, Cy, BASE_I, K, ROT);
  const rc = (th) => ((BASE_O + BASE_I) / 2) * (1 + K * Math.cos(3 * (th - ROT)));
  const ro = (th) => BASE_O * (1 + K * Math.cos(3 * (th - ROT)));
  const ri = (th) => BASE_I * (1 + K * Math.cos(3 * (th - ROT)));
  // Finish line at theta=0 (right-hand flat side), radial inner->outer; crossing direction is +y.
  const line = { a: { x: Cx + ri(0), y: Cy }, b: { x: Cx + ro(0), y: Cy }, forward: { x: 0, y: 1 } };
  // Mid-loop gate at the far (left) corner.
  const checkTh = Math.PI, crk = rc(checkTh);
  const check = { x: Cx + Math.cos(checkTh) * crk, y: Cy + Math.sin(checkTh) * crk, r: 220 };
  // Start just before the line, facing the racing direction (downward).
  const startTh = -0.08, sr = rc(startTh);
  const start = { x: Cx + Math.cos(startTh) * sr, y: Cy + Math.sin(startTh) * sr, angle: Math.PI / 2 };
  const MAXR = BASE_O * (1 + K);
  const bounds = { left: Cx - MAXR - 120, right: Cx + MAXR + 120, top: Cy - MAXR - 120, bottom: Cy + MAXR + 120 };
  return {
    name: 'Trinity',
    theme: { wall: '#2fa9ff', glow: 'rgba(47,169,255,0.5)', accent: '#a8dcff' },
    par: 42,
    circuit: { laps: 3, line, check },
    start,
    bounds,
    checkpoints: [],
    walls: [outer, island],
  };
}

function level17() {
  const cy = 780, xb = 720, Rb = 560, xt = 2120, Rt = 250, w = 200, A = 44, T = 30;
  const outer = teardrop2(xb, cy, Rb, xt, Rt, A, T);
  const island = teardrop2(xb, cy, Rb - w, xt, Rt - w, A, T);
  // centerline (racing line): the same teardrop offset inward by half the channel
  const C = teardrop2(xb, cy, Rb - w / 2, xt, Rt - w / 2, A, T).slice(0, -1);
  const N = C.length, finishIdx = A + Math.floor(T / 2); // middle of a tangent side
  const prev = C[(finishIdx - 1 + N) % N], next = C[(finishIdx + 1) % N];
  let fwd = { x: next.x - prev.x, y: next.y - prev.y };
  const fl = Math.hypot(fwd.x, fwd.y); fwd = { x: fwd.x / fl, y: fwd.y / fl };
  const Pc = C[finishIdx], nrm = { x: -fwd.y, y: fwd.x };
  const line = {
    a: { x: Pc.x - nrm.x * (w / 2 + 20), y: Pc.y - nrm.y * (w / 2 + 20) },
    b: { x: Pc.x + nrm.x * (w / 2 + 20), y: Pc.y + nrm.y * (w / 2 + 20) },
    forward: fwd,
  };
  const check = { x: xb - (Rb - w / 2), y: cy, r: 210 }; // mid-loop gate at the bulb
  const sIdx = (finishIdx - 4 + N) % N, sp = C[sIdx], sn = C[(sIdx + 1) % N];
  const start = { x: sp.x, y: sp.y, angle: Math.atan2(sn.y - sp.y, sn.x - sp.x) };
  return {
    name: 'Comet',
    theme: { wall: '#22e0c8', glow: 'rgba(34,224,200,0.5)', accent: '#b6fff4' },
    par: 40,
    circuit: { laps: 3, line, check },
    start,
    bounds: { left: 40, right: 2500, top: 80, bottom: 1480 },
    checkpoints: [],
    walls: [outer, island],
  };
}

function level18() {
  // Maelstrom: a wide oval loop raced under a steady downward pull, 3 laps.
  const Cx = 1500, Cy = 820;
  const ORx = 1220, ORy = 600;   // outer ring
  const IRx = 720,  IRy = 250;   // inner island
  const MRx = (ORx + IRx) / 2, MRy = (ORy + IRy) / 2; // racing line radii

  const outer = ellipse(Cx, Cy, ORx, ORy);
  const island = ellipse(Cx, Cy, IRx, IRy);

  // Finish line across the RIGHT end, crossed while moving DOWN (+y).
  const line = { a: { x: Cx + IRx, y: Cy }, b: { x: Cx + ORx, y: Cy }, forward: { x: 0, y: 1 } };
  // Mid-loop gate at the LEFT end so a lap only counts after a full circuit.
  const check = { x: Cx - MRx, y: Cy, r: 240 };
  // Start just above the finish line (negative side), facing down into the turn.
  const start = { x: Cx + MRx, y: Cy - 40, angle: Math.PI / 2 };

  return {
    name: 'Whirlpool',
    theme: { wall: '#ff3ea5', glow: 'rgba(255,62,165,0.5)', accent: '#ff9fd4' },
    par: 40,
    circuit: { laps: 3, line, check },
    start,
    bounds: { left: Cx - ORx - 140, right: Cx + ORx + 140, top: Cy - ORy - 140, bottom: Cy + ORy + 140 },
    checkpoints: [],
    gravity: { x: 0, y: 260 },
    walls: [outer, island],
  };
}

function level19() {
  const Cx = 1300, Cy = 760, A = 680, B = 460, E = 420, HALF = 180, JR = 250;
  const { walls } = linkedTube(Cx, Cy, A, B, E, HALF, JR, 360);
  const FX = Cx + E + A; // rightmost point of the right lobe
  return {
    name: 'Interlock',
    theme: { wall: '#ff4dd8', glow: 'rgba(255,77,216,0.5)', accent: '#ffb3f0' },
    par: 42,
    circuit: {
      laps: 2,
      line: { a: { x: FX - HALF, y: Cy }, b: { x: FX + HALF, y: Cy }, forward: { x: 0, y: 1 } },
      check: { x: Cx - E - A, y: Cy, r: 240 },
    },
    start: { x: FX, y: Cy - 70, angle: Math.PI / 2 },
    bounds: { left: -40, right: 2660, top: 100, bottom: 1440 },
    checkpoints: [],
    walls,
  };
}

export const LEVELS = [
  level1(), level2(), level3(), level4(), level5(), level6(), level7(), level8(), level9(), level10(), level11(), level12(), level13(), level14(), level15(), level16(), level17(), level18(), level19(),
];
