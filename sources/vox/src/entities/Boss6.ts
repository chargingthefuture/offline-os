// SPECTERRISE — World 6 boss. The system with your name on hold: it floods you with spam
// calls and jams the works with clunkers. Shrinks with every hit, like every Specterati.

import Phaser from 'phaser';
import { BossBase, type BossHost } from './BossBase';
import type { Player } from './Player';

export class SpecterriseBoss extends BossBase {
  private baseY: number;
  private callTimer = 1600;
  private summonTimer = 4600;
  private surgeTimer = 3400;
  private surging = 0;

  constructor(scene: Phaser.Scene, host: BossHost, x: number, y: number) {
    super(scene, host, x, y, 'vox-boss6', 26, 'SPECTERRISE', 'the system with your name on hold');
    this.baseY = y;
    this.setSize(82, 90).setOffset(7, 12);
  }

  protected tick(dtMs: number, player: Player): void {
    this.y = this.baseY + Math.sin(this.scene.time.now / 700) * 24;
    if (this.surging > 0) {
      this.surging -= dtMs;
      if (this.surging <= 0) this.setVelocityX(0);
    } else {
      const dx = player.x - this.x;
      this.setVelocityX(Phaser.Math.Clamp(dx, -56, 56));
      this.setFlipX(dx < 0);
    }

    const speedUp = this.phase === 2 ? 0.7 : 1;

    // Spam-call barrage
    this.callTimer -= dtMs;
    if (this.callTimer <= 0) {
      this.callTimer = 2100 * speedUp;
      const spread = this.phase === 2 ? [-40, 0, 40] : [-30, 30];
      for (const s of spread) this.host.bossAttack('call', this.x, s);
    }

    this.summonTimer -= dtMs;
    if (this.summonTimer <= 0) {
      this.summonTimer = 5600 * speedUp;
      this.host.bossMinion(this.x);
    }

    if (this.phase === 2) {
      this.surgeTimer -= dtMs;
      if (this.surgeTimer <= 0 && this.surging <= 0) {
        this.surgeTimer = 3400;
        this.scene.tweens.add({
          targets: this,
          scaleX: this.scaleX * 1.1,
          scaleY: this.scaleY * 1.1,
          duration: 420,
          yoyo: true,
          onComplete: () => {
            if (this.defeated || !this.active) return;
            this.surging = 640;
            this.setVelocityX(Math.sign(player.x - this.x || 1) * 240);
          },
        });
      }
    }
  }
}
