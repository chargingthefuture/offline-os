// The dart. It always thrusts forward along its heading; the player only steers and
// boosts. Sliding along a wall at a shallow angle charges the boost meter and keeps
// the ship's speed; hitting a wall head-on bleeds speed. That trade is the whole game.

import { add, sub, scale, dot, len, norm, fromAngle, clamp, closestOnSegment, steerToward } from './vec.js';

const RADIUS = 9;
const TURN = 3.4;          // steering rate, rad/s
const ACCEL = 780;         // constant forward thrust
const CRUISE_MAX = 300;    // top speed without boost
const BOOST_ACCEL = 1500;  // extra thrust while boosting
const BOOST_MAX = 560;     // top speed while boosting
const GRIP = 4.6;          // how fast velocity swings to follow the heading
const RESTITUTION = 0.3;   // wall bounce
const HEADON_PENALTY = 0.9; // speed lost on a head-on hit
const GRIND_GAIN = 1.35;   // boost charge per second while grinding at cruise speed
const BOOST_DRAIN = 0.55;  // charge spent per second while boosting
const CHARGE_REGEN = 0.05; // slow passive charge so a stuck player can still nudge

export class Ship {
  constructor() {
    this.trail = [];
    this.reset({ x: 0, y: 0, angle: 0 });
  }

  reset({ x, y, angle }) {
    this.pos = { x, y };
    this.vel = fromAngle(angle, 40);
    this.angle = angle;
    this.charge = 0;
    this.grinding = false;
    this.speed = 40;
    this.trail.length = 0;
  }

  update(dt, input, level) {
    // Steer the heading.
    this.angle += input.steer * TURN * dt;
    const fwd = fromAngle(this.angle);

    // Forward thrust, with an extra kick while boosting (if there is charge).
    const boosting = input.boost && this.charge > 0.001;
    const accel = ACCEL + (boosting ? BOOST_ACCEL : 0);
    const maxSpeed = boosting ? BOOST_MAX : CRUISE_MAX;

    let speed = len(this.vel) + accel * dt;
    if (speed > maxSpeed) speed += (maxSpeed - speed) * Math.min(1, 6 * dt); // ease down to the cap

    // Velocity carries inertia but swings toward the heading (carving).
    const dir = norm(steerToward(len(this.vel) > 1 ? this.vel : fwd, fwd, Math.min(1, GRIP * dt)));
    this.vel = scale(dir.x || dir.y ? dir : fwd, speed);

    // External gravity: zero for the cruise levels, a steady pull for the gravity
    // mazes. Added after the carve so the player has to aim into it to hold a line.
    const g = level.gravity;
    if (g && (g.x || g.y)) {
      this.vel = { x: this.vel.x + g.x * dt, y: this.vel.y + g.y * dt };
    }

    // Integrate, then push out of any walls.
    this.pos = add(this.pos, scale(this.vel, dt));
    this._collide(level, dt);

    // Charge bookkeeping.
    if (boosting) this.charge -= BOOST_DRAIN * dt;
    this.charge = clamp(this.charge + CHARGE_REGEN * dt, 0, 1);
    this.speed = len(this.vel);
    this.boosting = boosting;

    // Trail for the render layer.
    this.trail.push({ x: this.pos.x, y: this.pos.y });
    if (this.trail.length > 26) this.trail.shift();
  }

  _collide(level, dt) {
    this.grinding = false;
    for (const seg of level.nearby(this.pos.x)) {
      const { point } = closestOnSegment(this.pos, seg.a, seg.b);
      const d = sub(this.pos, point);
      const dd = len(d);
      if (dd >= RADIUS) continue;

      // Outward normal: away from the wall, or the segment's perpendicular if we are
      // sitting exactly on it.
      let n = dd > 1e-4 ? scale(d, 1 / dd) : this._segNormal(seg);
      if (dot(n, this.vel) > 0) n = scale(n, -1);

      this.pos = add(this.pos, scale(n, RADIUS - dd)); // depenetrate

      const vn = dot(this.vel, n);
      if (vn >= 0) continue; // moving away already

      const tang = sub(this.vel, scale(n, vn)); // component along the wall
      const tSpeed = len(tang);
      const speed = len(this.vel);
      const headOn = speed > 1 ? clamp(-vn / speed, 0, 1) : 0; // 0 = grazing, 1 = straight in

      // Reward a shallow slide with boost charge; grinding also flags the trail.
      if (headOn < 0.6 && tSpeed > 40) {
        this.grinding = true;
        this.charge = clamp(this.charge + GRIND_GAIN * (tSpeed / CRUISE_MAX) * (1 - headOn) * dt, 0, 1);
      }

      const keep = 1 - headOn * HEADON_PENALTY;
      this.vel = add(scale(tang, keep), scale(n, -vn * RESTITUTION));
    }
  }

  _segNormal(seg) {
    return norm({ x: -(seg.b.y - seg.a.y), y: seg.b.x - seg.a.x });
  }
}

export const SHIP_RADIUS = RADIUS;
export const SHIP_CRUISE_MAX = CRUISE_MAX;
export const SHIP_BOOST_MAX = BOOST_MAX;
