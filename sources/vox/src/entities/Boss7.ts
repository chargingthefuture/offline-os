// THE RECRUITERS — World 7 boss, the last of the Specterati. The club that was never yours
// to join: it recruits fake friends against you and dangles lures. Beat it and the whole
// network is done. Shrinks with every hit, like all of them.

import Phaser from 'phaser';
import { BossBase, type BossHost } from './BossBase';
import type { Player } from './Player';

export class RecruitersBoss extends BossBase {
  private baseY: number;
  private lureTimer = 2600;
  private recruitTimer = 3800;
  private closeTimer = 3200;
  private closing = 0;

  constructor(scene: Phaser.Scene, host: BossHost, x: number, y: number) {
    super(scene, host, x, y, 'vox-boss7', 30, 'THE RECRUITERS', 'the club that was never yours to join');
    this.baseY = y;
    this.setSize(84, 92).setOffset(6, 10);
  }

  protected tick(dtMs: number, player: Player): void {
    this.y = this.baseY + Math.sin(this.scene.time.now / 680) * 26;
    if (this.closing > 0) {
      this.closing -= dtMs;
      if (this.closing <= 0) this.setVelocityX(0);
    } else {
      const dx = player.x - this.x;
      this.setVelocityX(Phaser.Math.Clamp(dx, -60, 60));
      this.setFlipX(dx < 0);
    }

    const speedUp = this.phase === 2 ? 0.68 : 1;

    // Drop lures under VOX
    this.lureTimer -= dtMs;
    if (this.lureTimer <= 0) {
      this.lureTimer = 3000 * speedUp;
      this.host.bossAttack('lure', player.x, 0);
    }

    // Recruit fake friends
    this.recruitTimer -= dtMs;
    if (this.recruitTimer <= 0) {
      this.recruitTimer = 5200 * speedUp;
      this.host.bossMinion(this.x);
    }

    if (this.phase === 2) {
      this.closeTimer -= dtMs;
      if (this.closeTimer <= 0 && this.closing <= 0) {
        this.closeTimer = 3200;
        this.scene.tweens.add({
          targets: this,
          scaleX: this.scaleX * 1.1,
          scaleY: this.scaleY * 1.1,
          duration: 420,
          yoyo: true,
          onComplete: () => {
            if (this.defeated || !this.active) return;
            this.closing = 660;
            this.setVelocityX(Math.sign(player.x - this.x || 1) * 250);
          },
        });
      }
    }
  }
}
