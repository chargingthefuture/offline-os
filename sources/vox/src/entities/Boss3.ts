// SPECTERFORCE — World 3 boss. The badge that answers to no one: it slams compliance
// shockwaves along the ground and calls in circling Sirens. Loud, heavy, and — like every
// Specterati — shrinking with every hit you land.

import Phaser from 'phaser';
import { BossBase, type BossHost } from './BossBase';
import type { Player } from './Player';

export class SpecterforceBoss extends BossBase {
  private baseY: number;
  private slamTimer = 2200;
  private summonTimer = 4600;
  private chargeTimer = 3200;
  private charging = 0;

  constructor(scene: Phaser.Scene, host: BossHost, x: number, y: number) {
    super(scene, host, x, y, 'vox-boss3', 26, 'SPECTERFORCE', 'the badge that answers to no one');
    this.baseY = y;
    this.setSize(82, 92).setOffset(7, 10);
  }

  protected tick(dtMs: number, player: Player): void {
    this.y = this.baseY + Math.sin(this.scene.time.now / 720) * 26;

    if (this.charging > 0) {
      this.charging -= dtMs;
      if (this.charging <= 0) this.setVelocityX(0);
    } else {
      const dx = player.x - this.x;
      this.setVelocityX(Phaser.Math.Clamp(dx, -60, 60));
      this.setFlipX(dx < 0);
    }

    const speedUp = this.phase === 2 ? 0.7 : 1;

    // Compliance slam — a shockwave rolls out both directions along the ground
    this.slamTimer -= dtMs;
    if (this.slamTimer <= 0) {
      this.slamTimer = 2800 * speedUp;
      this.host.bossAttack('shock', this.x, 1);
      this.host.bossAttack('shock', this.x, -1);
    }

    // Call in a circling Siren
    this.summonTimer -= dtMs;
    if (this.summonTimer <= 0) {
      this.summonTimer = 5400 * speedUp;
      this.host.bossMinion(this.x);
    }

    if (this.phase === 2) {
      this.chargeTimer -= dtMs;
      if (this.chargeTimer <= 0 && this.charging <= 0) {
        this.chargeTimer = 3400;
        this.scene.tweens.add({
          targets: this,
          scaleX: this.scaleX * 1.1,
          scaleY: this.scaleY * 1.1,
          duration: 420,
          yoyo: true,
          onComplete: () => {
            if (this.defeated || !this.active) return;
            this.charging = 640;
            this.setVelocityX(Math.sign(player.x - this.x || 1) * 250);
          },
        });
      }
    }
  }
}
