// SPECTERBANE — World 5 boss. The ache with no cause: it rolls tinnitus rings, fires a
// bright beam, and calls in Strikers. Shrinks with every hit, like every Specterati.

import Phaser from 'phaser';
import { pal } from '../systems/palette';
import { BossBase, type BossHost } from './BossBase';
import type { Player } from './Player';

export class SpecterbaneBoss extends BossBase {
  private baseY: number;
  private ringTimer = 2200;
  private beamTimer = 3400;
  private summonTimer = 5000;
  private beaming = 0;
  private beamGfx: Phaser.GameObjects.Graphics;
  private beamTarget = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, host: BossHost, x: number, y: number) {
    super(scene, host, x, y, 'vox-boss5', 26, 'SPECTERBANE', 'the ache with no cause');
    this.baseY = y;
    this.setSize(82, 90).setOffset(7, 12);
    this.beamGfx = scene.add.graphics().setDepth(7);
  }

  protected tick(dtMs: number, player: Player): void {
    this.y = this.baseY + Math.sin(this.scene.time.now / 700) * 24;
    const dx = player.x - this.x;
    this.setVelocityX(Phaser.Math.Clamp(dx, -55, 55));
    this.setFlipX(dx < 0);

    const speedUp = this.phase === 2 ? 0.7 : 1;

    this.ringTimer -= dtMs;
    if (this.ringTimer <= 0) {
      this.ringTimer = 2700 * speedUp;
      this.host.bossAttack('ring', this.x, 1);
      this.host.bossAttack('ring', this.x, -1);
    }

    this.summonTimer -= dtMs;
    if (this.summonTimer <= 0) {
      this.summonTimer = 5600 * speedUp;
      this.host.bossMinion(this.x);
    }

    // A telegraphed bright beam at VOX (steady line, no strobe)
    this.beamGfx.clear();
    this.beamTimer -= dtMs;
    if (this.beamTimer <= 0 && this.beaming <= 0) {
      this.beamTimer = 3600 * speedUp;
      this.beaming = 900;
      this.beamTarget.set(player.x, player.y);
    }
    if (this.beaming > 0) {
      this.beaming -= dtMs;
      const telegraph = this.beaming > 500;
      this.beamGfx.lineStyle(telegraph ? 2 : 7, pal().projectile, telegraph ? 0.35 : 0.9);
      this.beamGfx.lineBetween(this.x, this.y, this.beamTarget.x, this.beamTarget.y);
      if (!telegraph) {
        const line = new Phaser.Geom.Line(this.x, this.y, this.beamTarget.x, this.beamTarget.y);
        const near = Phaser.Geom.Line.GetNearestPoint(line, new Phaser.Geom.Point(player.x, player.y), new Phaser.Geom.Point());
        if (Phaser.Math.Distance.Between(near.x, near.y, player.x, player.y) < 22) this.host.hurtPlayer(this.x);
      }
    }
  }

  protected override defeat(): void {
    this.beamGfx.destroy();
    super.defeat();
  }
}
