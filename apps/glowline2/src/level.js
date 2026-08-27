// Runtime wrapper around a level definition. Flattens the wall polylines into
// segments once, and buckets them by x so the ship only tests nearby walls.

export class Level {
  constructor(def) {
    this.def = def;
    this.name = def.name;
    this.theme = def.theme;
    this.par = def.par;
    this.start = def.start;
    this.finishX = def.finishX;
    this.bounds = def.bounds;
    this.checkpoints = def.checkpoints || [];
    this.gravity = def.gravity || { x: 0, y: 0 };
    // A circuit level is a closed loop raced for a number of laps against the clock,
    // rather than a point-to-point sprint. { laps, line:{a,b,forward}, check:{x,y,r} }.
    this.circuit = def.circuit || null;

    this.segments = [];
    for (const poly of def.walls) {
      for (let i = 0; i < poly.length - 1; i++) {
        this.segments.push({ a: poly[i], b: poly[i + 1] });
      }
    }

    this.bucketSize = 260;
    this.buckets = new Map();
    this.segments.forEach((seg, idx) => {
      const minx = Math.min(seg.a.x, seg.b.x);
      const maxx = Math.max(seg.a.x, seg.b.x);
      for (let bx = Math.floor(minx / this.bucketSize); bx <= Math.floor(maxx / this.bucketSize); bx++) {
        if (!this.buckets.has(bx)) this.buckets.set(bx, []);
        this.buckets.get(bx).push(idx);
      }
    });
  }

  // Segments in the three buckets around world-x. Deduplicated across buckets.
  nearby(x) {
    const b = Math.floor(x / this.bucketSize);
    const seen = new Set();
    const out = [];
    for (let k = b - 1; k <= b + 1; k++) {
      const list = this.buckets.get(k);
      if (!list) continue;
      for (const idx of list) {
        if (seen.has(idx)) continue;
        seen.add(idx);
        out.push(this.segments[idx]);
      }
    }
    return out;
  }

  // The nearest checkpoint x at or behind the given x (falls back to the start).
  lastCheckpoint(x) {
    let cp = this.start.x;
    for (const c of this.checkpoints) if (c <= x) cp = c;
    return cp;
  }

  // A safe y for respawning at checkpoint-x: midpoint between the closest top and
  // bottom wall points found near that x.
  midYAt(x) {
    let top = Infinity;
    let bottom = -Infinity;
    for (const seg of this.nearby(x)) {
      for (const p of [seg.a, seg.b]) {
        if (Math.abs(p.x - x) > this.bucketSize) continue;
        if (p.y < top) top = p.y;
        if (p.y > bottom) bottom = p.y;
      }
    }
    if (top === Infinity || bottom === -Infinity) return this.start.y;
    return (top + bottom) / 2;
  }
}
