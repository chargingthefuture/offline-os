// The Specterbane enemies — attacks on body and mind. Tinnitus, denied care, fatigue,
// bright beams, unexplained injuries. Every one is a cartoon to be flattened; the tactic is
// always the enemy, never a wound on VOX.

import Phaser from 'phaser';
import { pal } from '../systems/palette';
import { Enemy } from './enemies';
import type { Player } from './Player';

/** What world 5 enemies may ask of their scene. */
export interface World5Host {
  /** A ring of tinnitus rolls outward along the ground — jump it. */
  ringPulse(x: number, dir: number): void;
}

/** #8 Tinnitus — the ringing you can't place. A stationary emitter that rolls dodgeable
 * ring-pulses out along the ground; smash it to end the ringing. */
export class Ringer extends Enemy {
  private host: World5Host;
  private pulseTimer = 1600;
  private ring: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, host: World5Host, x: number, y: number) {
    super(scene, x, y, 'vox-ringer', 3, 8);
    this.host = host;
    this.touchDamage = 0;
    this.setImmovable(true);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setSize(28, 36).setOffset(2, 4);
    this.ring = scene.add.circle(x, y, 8, pal().projectile, 0.2).setDepth(1);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    // A steady expanding-then-resetting halo, never a strobe
    const r = 8 + ((this.scene.time.now / 12) % 40);
    this.ring.setRadius(r).setFillStyle(pal().projectile, 0.2 * (1 - (r - 8) / 40));
    this.pulseTimer -= dtMs;
    if (this.pulseTimer <= 0 && Math.abs(player.x - this.x) < 640) {
      this.pulseTimer = 2400;
      this.host.ringPulse(this.x, player.x < this.x ? -1 : 1);
    }
  }

  protected override defeat(): void {
    this.ring.destroy();
    super.defeat();
  }
}

/** #21 Denied care — the doctor who ghosts you. Phases solid ↔ transparent; you can only
 * land a hit while it is solid, just as you only get care when they finally pick up. */
export class FalseDoctor extends Enemy {
  private ghostTimer = 2200;
  private ghosted = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-doctor', 3, 21);
    this.setSize(24, 34).setOffset(4, 4);
  }

  private setGhost(on: boolean): void {
    this.ghosted = on;
    this.touchDamage = on ? 0 : 1;
    this.scene.tweens.add({ targets: this, alpha: on ? 0.25 : 1, duration: 260 });
  }

  override hit(damage: number, dir: 1 | -1, finisher: boolean): void {
    if (this.ghosted) return; // ghosted — the hit passes through, like your call to the desk
    super.hit(damage, dir, finisher);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    this.ghostTimer -= dtMs;
    if (this.ghostTimer <= 0) {
      this.setGhost(!this.ghosted);
      this.ghostTimer = this.ghosted ? 1400 : 2200;
    }
    // Drifts toward you slowly whether solid or not
    const dx = player.x - this.x;
    this.setVelocityX(Phaser.Math.Clamp(dx, -50, 50));
    this.setFlipX(dx < 0);
  }
}

/** #24 Fatigue — the tiredness that shouldn't be there. Trails you and, while near, drags
 * you slow; no contact damage, it just wears you down. Smash it to shake the weight. */
export class Drainer extends Enemy {
  private readonly fieldR = 170;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-drainer', 3, 24);
    this.touchDamage = 0;
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setSize(28, 28).setOffset(2, 4);
  }

  updateEnemy(_dtMs: number, player: Player): void {
    if (this.defeated) return;
    const dx = player.x - this.x;
    this.setVelocityX(Phaser.Math.Clamp(dx * 0.5, -55, 55));
    this.y += Math.sin(this.scene.time.now / 500) * 0.2;
    this.setFlipX(dx < 0);
    if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < this.fieldR) {
      player.slowFactor = Math.min(player.slowFactor, 0.6);
    }
  }
}

/** #28 Bright beams / DEWs — headlights, flashlights, directed energy. Telegraphs with a
 * steady dim line, then a steady bright beam (no strobe; reduced-motion safe by design). */
export class Beamer extends Enemy {
  private beamState: 'idle' | 'telegraph' | 'fire' = 'idle';
  private stateTimer = 1100;
  private target = new Phaser.Math.Vector2();
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-beamer', 2, 28);
    this.touchDamage = 0;
    this.setImmovable(true);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setSize(30, 24).setOffset(1, 4);
    this.gfx = scene.add.graphics().setDepth(4);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    this.stateTimer -= dtMs;
    this.gfx.clear();
    const p = pal();
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    switch (this.beamState) {
      case 'idle':
        if (this.stateTimer <= 0 && dist < 420) {
          this.beamState = 'telegraph';
          this.stateTimer = 620;
          this.target.set(player.x, player.y);
        }
        break;
      case 'telegraph':
        this.gfx.lineStyle(2, p.projectile, 0.35);
        this.gfx.lineBetween(this.x, this.y, this.target.x, this.target.y);
        if (this.stateTimer <= 0) {
          this.beamState = 'fire';
          this.stateTimer = 280;
        }
        break;
      case 'fire': {
        this.gfx.lineStyle(7, p.projectile, 0.9);
        this.gfx.lineBetween(this.x, this.y, this.target.x, this.target.y);
        const line = new Phaser.Geom.Line(this.x, this.y, this.target.x, this.target.y);
        const near = Phaser.Geom.Line.GetNearestPoint(line, new Phaser.Geom.Point(player.x, player.y), new Phaser.Geom.Point());
        if (Phaser.Math.Distance.Between(near.x, near.y, player.x, player.y) < 22) this.requestPlayerHit();
        if (this.stateTimer <= 0) {
          this.beamState = 'idle';
          this.stateTimer = 1700;
        }
        break;
      }
    }
  }

  protected override defeat(): void {
    this.gfx.destroy();
    super.defeat();
  }
}

/** #45 Unexplained injuries — pain that arrives from nowhere. Patrols, then telegraphs a
 * quick pounce; land your own hit in the window after it overreaches. */
export class Striker extends Enemy {
  private st: 'patrol' | 'wind' | 'pounce' | 'spent' = 'patrol';
  private stateTimer = 0;
  private dir: 1 | -1 = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-striker', 3, 45);
    this.setSize(26, 30).setOffset(3, 6);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    this.stateTimer -= dtMs;
    const dx = player.x - this.x;
    switch (this.st) {
      case 'patrol':
        this.setVelocityX(this.dir * 45);
        this.setFlipX(this.dir < 0);
        if (this.stateTimer <= 0) { this.stateTimer = 1400; this.dir = this.dir === 1 ? -1 : 1; }
        if (Math.abs(dx) < 220 && Math.abs(player.y - this.y) < 60) {
          this.st = 'wind'; this.stateTimer = 380; this.setVelocityX(0); this.setFlipX(dx < 0);
          this.scene.tweens.add({ targets: this, scaleX: 1.2, scaleY: 0.85, duration: 360, yoyo: true });
        }
        break;
      case 'wind':
        if (this.stateTimer <= 0) { this.st = 'pounce'; this.stateTimer = 420; this.setVelocity(Math.sign(dx || 1) * 340, -180); }
        break;
      case 'pounce':
        if (this.stateTimer <= 0) { this.st = 'spent'; this.stateTimer = 850; this.setVelocityX(0); }
        break;
      case 'spent':
        if (this.stateTimer <= 0) this.st = 'patrol';
        break;
    }
  }
}
