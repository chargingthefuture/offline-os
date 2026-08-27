// SPECTERVOX — World 2 boss. The megaphone that eats voices: it flings fans of lie-bubbles
// and hides behind Slanderers. Deflected lies hit it twice as hard — its own words are its
// weakness.

import Phaser from 'phaser';
import { BossBase, type BossHost } from './BossBase';
import type { Player } from './Player';

export class SpectervoxBoss extends BossBase {
  private baseY: number;
  private barrageTimer = 2000;
  private summonTimer = 5000;
  private swoopTimer = 3200;
  private swooping = 0;

  constructor(scene: Phaser.Scene, host: BossHost, x: number, y: number) {
    super(scene, host, x, y, 'vox-boss2', 24, 'SPECTERVOX', 'the megaphone that eats voices');
    this.baseY = y;
    this.setSize(80, 90).setOffset(8, 10);
  }

  protected tick(dtMs: number, player: Player): void {
    this.y = this.baseY + Math.sin(this.scene.time.now / 650) * 30;

    if (this.swooping > 0) {
      this.swooping -= dtMs;
      if (this.swooping <= 0) this.setVelocityX(0);
    } else {
      // Keeps its distance — a megaphone, not a brawler. Backs off when cornered.
      const dx = player.x - this.x;
      const want = Math.abs(dx) < 220 ? -Math.sign(dx) * 70 : Math.sign(dx) * 40;
      this.setVelocityX(want);
      this.setFlipX(dx < 0);
    }

    const speedUp = this.phase === 2 ? 0.7 : 1;

    this.barrageTimer -= dtMs;
    if (this.barrageTimer <= 0) {
      this.barrageTimer = 2500 * speedUp;
      // A fan of lies at VOX; the scene spawns 2 (phase 1) or 3 (phase 2) bubbles
      this.host.bossAttack('lie-fan', this.x, Math.sign(player.x - this.x) || 1);
    }

    this.summonTimer -= dtMs;
    if (this.summonTimer <= 0) {
      this.summonTimer = 6200 * speedUp;
      this.host.bossMinion(this.x);
    }

    if (this.phase === 2) {
      this.swoopTimer -= dtMs;
      if (this.swoopTimer <= 0 && this.swooping <= 0) {
        this.swoopTimer = 3600;
        this.scene.tweens.add({
          targets: this,
          scaleX: this.scaleX * 1.12,
          scaleY: this.scaleY * 1.12,
          duration: 420,
          yoyo: true,
          onComplete: () => {
            if (this.defeated || !this.active) return;
            this.swooping = 600;
            this.setVelocityX(Math.sign(player.x - this.x || 1) * 230);
          },
        });
      }
    }
  }
}
