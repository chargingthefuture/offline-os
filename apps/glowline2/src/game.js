// Game orchestration: states (menu / playing / won), the camera, the run timer,
// best-time storage, and the frame loop that ties input, physics, and drawing together.

import { LEVELS } from './levels.js';
import { Level } from './level.js';
import { Ship } from './ship.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import * as audio from './audio.js';

const BEST_KEY = (i) => `glowline2.best.${i}`;

export class Game {
  constructor(canvas) {
    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas);
    this.ship = new Ship();
    this.hud = new Hud({
      onSelectLevel: (i) => this.startLevel(i),
      onNext: () => this.startLevel(Math.min(this.levelIndex + 1, LEVELS.length - 1)),
      onReplay: () => this.startLevel(this.levelIndex),
      onMenu: () => this.toMenu(),
    });

    this.state = 'menu';
    this.level = null;
    this.levelIndex = 0;
    this.time = 0;
    this.best = null;
    this.camera = { x: 0, y: 0 };
    this.showTouch = this.input.usingTouch;
    this._prevBoosting = false;

    // Sound must be unlocked by a user gesture; start() is safe to call repeatedly
    // and also resumes the audio if the browser suspended it.
    const kick = () => audio.start();
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);

    this.toMenu();
    this._last = null;
    requestAnimationFrame((t) => this._frame(t));
  }

  bestTime(i) {
    const raw = localStorage.getItem(BEST_KEY(i));
    return raw != null ? parseFloat(raw) : null;
  }

  toMenu() {
    this.state = 'menu';
    this.level = null;
    const bests = LEVELS.map((_, i) => this.bestTime(i));
    this.hud.showMenu(LEVELS, bests);
  }

  startLevel(i) {
    this.levelIndex = i;
    this.level = new Level(LEVELS[i]);
    this.best = this.bestTime(i);
    this.ship.reset(this.level.start);
    this.camera = { x: this.level.start.x, y: this.level.start.y };
    this.time = 0;
    this.state = 'playing';
    this._prevBoosting = false;
    // Circuit lap tracking. A lap counts when the ship crosses the finish line in
    // the forward direction, but only after it has touched the mid-loop check gate
    // (so you can't score laps by wiggling back and forth over the line).
    this.lap = 0;
    this._lapArmed = false;
    this._prevPos = { x: this.level.start.x, y: this.level.start.y };
    this.hud.hideMenu();
    this.hud.hideWin();
  }

  _win() {
    this.state = 'won';
    audio.finish();
    const prev = this.bestTime(this.levelIndex);
    const isRecord = prev == null || this.time < prev;
    if (isRecord) localStorage.setItem(BEST_KEY(this.levelIndex), this.time.toFixed(3));
    this.best = isRecord ? this.time : prev;
    this.hud.showWin({
      time: this.time,
      best: this.best,
      isRecord,
      par: this.level.par,
      beatPar: this.time <= this.level.par,
      hasNext: this.levelIndex < LEVELS.length - 1,
    });
  }

  _respawn() {
    if (this.level.circuit) {
      // On a loop, drop back to the start line. Disarm the lap so you still have to
      // round the check gate again — no free lap from the respawn.
      this.ship.reset(this.level.start);
      this._lapArmed = false;
    } else {
      const cp = this.level.lastCheckpoint(this.ship.pos.x);
      this.ship.reset({ x: cp, y: this.level.midYAt(cp), angle: 0 });
    }
    this._prevPos = { x: this.ship.pos.x, y: this.ship.pos.y };
    this._prevBoosting = false;
    audio.respawn();
  }

  // Count laps on a circuit: arm when the ship touches the mid-loop check gate, and
  // score a lap when it then crosses the finish line moving in the forward direction.
  _circuitLaps(prev, cur) {
    const c = this.level.circuit;
    if (c.check) {
      const dx = cur.x - c.check.x;
      const dy = cur.y - c.check.y;
      if (dx * dx + dy * dy < c.check.r * c.check.r) this._lapArmed = true;
    }
    const L = c.line;
    const s0 = (prev.x - L.a.x) * L.forward.x + (prev.y - L.a.y) * L.forward.y;
    const s1 = (cur.x - L.a.x) * L.forward.x + (cur.y - L.a.y) * L.forward.y;
    if (s0 < 0 && s1 >= 0) {
      const ex = L.b.x - L.a.x;
      const ey = L.b.y - L.a.y;
      const t = ((cur.x - L.a.x) * ex + (cur.y - L.a.y) * ey) / (ex * ex + ey * ey);
      if (t >= -0.1 && t <= 1.1 && this._lapArmed) {
        this.lap++;
        this._lapArmed = false;
        if (this.lap < c.laps) audio.blip(); // a tick for each lap but the last
      }
    }
  }

  _update(dt) {
    this.input.poll(); // refresh gamepad state before anything reads it this frame
    this.showTouch = this.input.usingTouch;

    if (this.input.consumeMuteToggle()) {
      audio.toggleMute();
      audio.blip(); // audible only when turning sound back on
    }

    if (this.input.consumeRestart() && this.level) {
      this.startLevel(this.levelIndex);
      return;
    }

    // Back out to the level menu from a level or the win screen.
    if (this.input.consumeMenu() && this.level) {
      this.toMenu();
      return;
    }

    // Gamepad drives the DOM overlays when we are not in a level. Consume the
    // one-shots every frame so a press during play never carries over to a menu.
    const nav = this.input.consumeNav();
    const confirm = this.input.consumeConfirm();
    if (this.state === 'menu' || this.state === 'won') {
      if (nav) this.hud.moveFocus(nav);
      if (confirm) this.hud.activateFocus();
    }

    if (this.state !== 'playing') {
      return;
    }

    this.ship.update(dt, this.input.sample(), this.level);
    this.time += dt;

    // Sound tied to what the ship is doing this frame. Wall contact makes no
    // sound — only the boost cue plays here.
    if (this.ship.boosting && !this._prevBoosting) audio.boost();
    this._prevBoosting = this.ship.boosting;

    const b = this.level.bounds;
    const p = this.ship.pos;
    if (this.level.circuit) {
      // Loop track: respawn only if the ship leaves the arena entirely.
      if (p.y < b.top || p.y > b.bottom || p.x < b.left || p.x > b.right) this._respawn();
      this._circuitLaps(this._prevPos, p);
      if (this.lap >= this.level.circuit.laps) this._win();
    } else {
      // Point-to-point: fell off the back or out of the corridor -> last checkpoint.
      if (p.y < b.top || p.y > b.bottom || p.x < b.left) this._respawn();
      if (p.x >= this.level.finishX) this._win();
    }
    this._prevPos = { x: p.x, y: p.y };

    // Camera follows with a little look-ahead in the travel direction.
    const targetX = p.x + this.ship.vel.x * 0.35 + 120;
    const targetY = p.y + this.ship.vel.y * 0.2;
    const k = Math.min(1, 6 * dt);
    this.camera.x += (targetX - this.camera.x) * k;
    this.camera.y += (targetY - this.camera.y) * k;
  }

  _frame(t) {
    if (this._last == null) this._last = t;
    let dt = (t - this._last) / 1000;
    this._last = t;
    if (dt > 0.05) dt = 0.05; // clamp after a tab switch or a slow frame

    this._update(dt);
    const layout = this.renderer.draw(this);
    this.input.setButtons(layout);

    requestAnimationFrame((nt) => this._frame(nt));
  }
}
