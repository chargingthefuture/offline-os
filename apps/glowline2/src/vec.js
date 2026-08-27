// Small 2D vector helpers. Vectors are plain {x, y} objects. Functions return new
// objects unless noted, so callers never mutate a shared vector by accident.

export const v = (x = 0, y = 0) => ({ x, y });

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const len = (a) => Math.hypot(a.x, a.y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function norm(a) {
  const l = Math.hypot(a.x, a.y);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
}

export const fromAngle = (a, m = 1) => ({ x: Math.cos(a) * m, y: Math.sin(a) * m });
export const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);

// Closest point on segment a->b to point p, plus the parameter t in [0, 1].
export function closestOnSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 1e-9 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return { point: { x: a.x + abx * t, y: a.y + aby * t }, t };
}

// Rotate the direction of `from` toward the direction of `to` by fraction f in [0, 1],
// keeping the original magnitude. Used to give the ship inertia while it carves.
export function steerToward(from, to, f) {
  const m = Math.hypot(from.x, from.y);
  if (m < 1e-6) return { x: to.x, y: to.y };
  const fd = { x: from.x / m, y: from.y / m };
  const td = norm(to);
  const bx = fd.x + (td.x - fd.x) * f;
  const by = fd.y + (td.y - fd.y) * f;
  const bl = Math.hypot(bx, by);
  if (bl < 1e-6) return { x: from.x, y: from.y };
  return { x: (bx / bl) * m, y: (by / bl) * m };
}
