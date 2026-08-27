// The Specterforce enemies — authority and enforcement. Police shadowing, the doorway
// beep, the customer-service hold-loop, and circling sirens. Same rule: the tactic is the
// enemy, drawn as a cartoon, built to be flattened.

import Phaser from 'phaser';
import { cue } from '../systems/sound';
import { Enemy } from './enemies';
import type { Player } from './Player';

/** What world 3 enemies may ask of their scene. */
export interface World3Host {
  /** The detector beeped — a Shadow comes to check you out. */
  detectorAlarm(x: number): void;
  /** The hold-loop generator puts you on hold: a shove-wave slides out toward VOX. */
  spawnHoldWave(x: number, dir: number): void;
}

/** #9 Police shadowing — follows you around for no reason. Chases at a steady pace when it
 * has eyes on you, and stands watch otherwise. Contact means a shove-and-sting. */
export class Shadow extends Enemy {
  private alerted = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-shadow', 3, 9);
    this.setSize(24, 34).setOffset(4, 4);
  }

  updateEnemy(_dtMs: number, player: Player): void {
    if (this.defeated) return;
    const dx = player.x - this.x;
    const sees = Math.abs(dx) < 460 && Math.abs(player.y - this.y) < 150;
    if (sees) this.alerted = true;
    // Once it has clocked you it keeps following, but never faster than you can outrun
    if (this.alerted && Math.abs(dx) > 24) {
      this.setVelocityX(Math.sign(dx) * 96);
      this.setFlipX(dx < 0);
    } else {
      this.setVelocityX(0);
    }
  }
}

/** #39 Doorway beeps — the theft detector that pings once when you walk in and calls a
 * Shadow over. No contact damage; one hit silences it. */
export class Detector extends Enemy {
  private host: World3Host;
  private rang = false;

  constructor(scene: Phaser.Scene, host: World3Host, x: number, y: number) {
    super(scene, x, y, 'vox-detector', 1, 39);
    this.host = host;
    this.touchDamage = 0;
    this.setSize(40, 56).setOffset(4, 4);
    this.setImmovable(true);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
  }

  updateEnemy(_dtMs: number, player: Player): void {
    if (this.defeated || this.rang) return;
    if (Math.abs(player.x - this.x) < 60 && Math.abs(player.y - this.y) < 120) {
      this.rang = true;
      cue('alarm');
      this.scene.tweens.add({ targets: this, alpha: 0.5, duration: 80, yoyo: true, repeat: 3 });
      this.host.detectorAlarm(this.x);
    }
  }
}

/** #41 Hold-loop — customer service that puts you on hold forever and hangs up. While it
 * runs it slides shove-waves at you (bounced back, never hurt); smash it and the loop
 * collapses. */
export class LoopGenerator extends Enemy {
  private host: World3Host;
  private holdTimer = 1400;

  constructor(scene: Phaser.Scene, host: World3Host, x: number, y: number) {
    super(scene, x, y, 'vox-loopgen', 6, 41);
    this.host = host;
    this.touchDamage = 0;
    this.setSize(40, 44).setOffset(4, 4);
    this.setImmovable(true);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    // A slow, hypnotic spin — the endless hold music, made visible
    this.rotation += 0.02;
    this.holdTimer -= dtMs;
    const dx = player.x - this.x;
    if (Math.abs(dx) < 520 && this.holdTimer <= 0) {
      this.holdTimer = 2000;
      this.host.spawnHoldWave(this.x, Math.sign(dx) || 1);
    }
  }

  protected override defeat(): void {
    this.setRotation(0);
    super.defeat();
  }
}

/** #47 Siren circles — motorcycles and squad cars circling the block. Rides a fixed loop
 * around its post; contact stings. Predictable path, so it is dodge-and-punish. */
export class Siren extends Enemy {
  private readonly cx: number;
  private readonly cy: number;
  private readonly radius: number;
  private orbit: number;
  private readonly speed: number;

  constructor(scene: Phaser.Scene, cx: number, cy: number, radius = 90, startAngle = 0) {
    super(scene, cx + radius, cy, 'vox-siren', 2, 47);
    this.cx = cx;
    this.cy = cy;
    this.radius = radius;
    this.orbit = startAngle;
    this.speed = 1.6;
    this.setSize(28, 20).setOffset(2, 4);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setImmovable(true);
  }

  updateEnemy(dtMs: number, _player: Player): void {
    if (this.defeated) return;
    this.orbit += this.speed * (dtMs / 1000);
    const x = this.cx + Math.cos(this.orbit) * this.radius;
    const y = this.cy + Math.sin(this.orbit) * this.radius * 0.6;
    // Drive via body velocity so collisions still resolve, but track the loop tightly
    this.setVelocity((x - this.x) * 12, (y - this.y) * 12);
    this.setFlipX(Math.cos(this.orbit) < 0);
  }
}
