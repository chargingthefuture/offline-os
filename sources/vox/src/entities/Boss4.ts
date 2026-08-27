// SPECTERREALM — World 4 boss. A watchtower eye that rules the block by fear: it sweeps
// surveillance pulses along the ground and launches drones. Shrinks with every hit, like
// every Specterati.

import Phaser from 'phaser';
import { BossBase, type BossHost } from './BossBase';
import type { Player } from './Player';

export class SpecterrealmBoss extends BossBase {
  private baseY: number;
  private sweepTimer = 2400;
  private droneTimer = 4200;
  private loomTimer = 3400;
  private looming = 0;

  constructor(scene: Phaser.Scene, host: BossHost, x: number, y: number) {
    super(scene, host, x, y, 'vox-boss4', 26, 'SPECTERREALM', 'the block that watches back');
    this.baseY = y;
    this.setSize(82, 90).setOffset(7, 12);
  }

  protected tick(dtMs: number, player: Player): void {
    this.y = this.baseY + Math.sin(this.scene.time.now / 760) * 24;

    if (this.looming > 0) {
      this.looming -= dtMs;
      if (this.looming <= 0) this.setVelocityX(0);
    } else {
      const dx = player.x - this.x;
      this.setVelocityX(Phaser.Math.Clamp(dx, -58, 58));
      this.setFlipX(dx < 0);
    }

    const speedUp = this.phase === 2 ? 0.7 : 1;

    // Surveillance sweep — pulses roll out both ways along the ground
    this.sweepTimer -= dtMs;
    if (this.sweepTimer <= 0) {
      this.sweepTimer = 2900 * speedUp;
      this.host.bossAttack('sweep', this.x, 1);
      this.host.bossAttack('sweep', this.x, -1);
    }

    // Launch a drone
    this.droneTimer -= dtMs;
    if (this.droneTimer <= 0) {
      this.droneTimer = 5200 * speedUp;
      this.host.bossMinion(this.x);
    }

    if (this.phase === 2) {
      this.loomTimer -= dtMs;
      if (this.loomTimer <= 0 && this.looming <= 0) {
        this.loomTimer = 3500;
        this.scene.tweens.add({
          targets: this,
          scaleX: this.scaleX * 1.1,
          scaleY: this.scaleY * 1.1,
          duration: 440,
          yoyo: true,
          onComplete: () => {
            if (this.defeated || !this.active) return;
            this.looming = 640;
            this.setVelocityX(Math.sign(player.x - this.x || 1) * 240);
          },
        });
      }
    }
  }
}
