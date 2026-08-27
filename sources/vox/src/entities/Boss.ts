// SPECTERWAVE — World 1 boss. A big smug ghost that pushes crowd-waves and summons
// Crowders.

import Phaser from 'phaser';
import { BossBase, type BossHost } from './BossBase';
import type { Player } from './Player';

export class SpecterwaveBoss extends BossBase {
  private baseY: number;
  private waveTimer = 2200;
  private summonTimer = 4200;
  private dashTimer = 3000;
  private dashing = 0;

  constructor(scene: Phaser.Scene, host: BossHost, x: number, y: number) {
    super(scene, host, x, y, 'vox-boss', 22, 'SPECTERWAVE', 'the wave that thinks it is the ocean');
    this.baseY = y;
    this.setSize(78, 92).setOffset(9, 8);
  }

  protected tick(dtMs: number, player: Player): void {
    // Hover in a lazy sine, low enough to hit with a jump
    this.y = this.baseY + Math.sin(this.scene.time.now / 700) * 34;

    if (this.dashing > 0) {
      this.dashing -= dtMs;
      if (this.dashing <= 0) this.setVelocityX(0);
    } else {
      // Drift toward VOX, slowly — it is a wave, not a missile
      const dx = player.x - this.x;
      this.setVelocityX(Phaser.Math.Clamp(dx, -55, 55));
      this.setFlipX(dx < 0);
    }

    const speedUp = this.phase === 2 ? 0.72 : 1;
    this.waveTimer -= dtMs;
    if (this.waveTimer <= 0) {
      this.waveTimer = 2600 * speedUp;
      this.host.bossAttack('wave', this.x, Math.sign(player.x - this.x) || 1);
    }

    this.summonTimer -= dtMs;
    if (this.summonTimer <= 0) {
      this.summonTimer = 5200 * speedUp;
      this.host.bossMinion(this.x);
    }

    if (this.phase === 2) {
      this.dashTimer -= dtMs;
      if (this.dashTimer <= 0 && this.dashing <= 0) {
        this.dashTimer = 3400;
        // Telegraph: a slow, readable puff-up, then the swoop. No flash.
        this.scene.tweens.add({
          targets: this,
          scaleX: this.scaleX * 1.12,
          scaleY: this.scaleY * 1.12,
          duration: 420,
          yoyo: true,
          onComplete: () => {
            if (this.defeated || !this.active) return;
            this.dashing = 620;
            this.setVelocityX(Math.sign(player.x - this.x || 1) * 240);
          },
        });
      }
    }
  }
}
