// Lie-bubbles: the Spectervox projectile. A lie drifts at VOX; hit it mid-air and it flips
// into a truth that flies back and hurts whoever threw it. Deflected lies are the point of
// World 2 — the tactic's own words turned around.

import Phaser from 'phaser';
import { cue } from '../systems/sound';

export class LieBubble extends Phaser.Physics.Arcade.Sprite {
  /** false = a lie heading for VOX; true = deflected truth heading back. */
  deflected = false;
  /** Damage a deflected bubble deals (bosses take it doubled by their own hit call). */
  readonly truthDamage = 1;
  private lifeMs = 5000;

  constructor(scene: Phaser.Scene, x: number, y: number, vx: number, vy: number) {
    super(scene, x, y, 'vox-bubble');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setVelocity(vx, vy);
    this.setDepth(7);
    this.setFlipX(vx < 0);
  }

  /** Flip the lie into a truth, aimed back where it came from. */
  deflect(dir: 1 | -1): void {
    if (this.deflected) return;
    this.deflected = true;
    this.setTexture('vox-bubble-truth');
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = Math.max(220, Math.abs(body.velocity.x) * 1.4);
    this.setVelocity(dir * speed, -Math.abs(body.velocity.y) * 0.3);
    this.setFlipX(dir < 0);
    this.lifeMs = 3000;
    cue('deflect');
  }

  pop(): void {
    this.destroy();
  }

  updateBubble(dtMs: number): void {
    this.lifeMs -= dtMs;
    // A gentle wobble so it reads as a floaty word, not a bullet
    this.y += Math.sin(this.scene.time.now / 250 + this.x / 60) * 0.2;
    if (this.lifeMs <= 0) this.destroy();
  }
}
