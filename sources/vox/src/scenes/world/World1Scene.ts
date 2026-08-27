// World 1 — Specterwave: public crowding and street harassment.

import Phaser from 'phaser';
import { SpecterwaveBoss } from '../../entities/Boss';
import type { BossBase } from '../../entities/BossBase';
import { Blocker, Crowder, Mimic, Starer } from '../../entities/enemies';
import { pal } from '../../systems/palette';
import { BaseWorldScene, GROUND_Y, WORLD_H } from './BaseWorldScene';

export class World1Scene extends BaseWorldScene {
  readonly worldId = 1;
  readonly worldName = 'WORLD 1 — SPECTERWAVE';
  readonly worldWidth = 4200;
  readonly checkpointXs = [80, 1250, 2450, 3350];
  readonly bossTriggerX = 3560;
  readonly bossWallX = 3480;

  private waves!: Phaser.Physics.Arcade.Group;

  constructor() {
    super('world1');
  }

  /** A crowded night street: far neon skyline, mid apartment blocks with lit windows,
   * a band of shuffling crowd silhouettes, and near streetlamps — the public space the
   * Specterwave crowds you in. Each layer is a single Graphics with its own scroll
   * factor for cheap parallax, and reads as a moody backdrop behind the action. */
  protected override buildBackdrop(): void {
    const p = pal();
    const W = this.worldWidth;

    // Sky wash (fixed, no parallax)
    this.add.rectangle(W / 2, WORLD_H / 2, W, WORLD_H, p.sky).setDepth(-20).setScrollFactor(0);
    this.add.rectangle(W / 2, WORLD_H - 150, W, 300, p.skyBottom).setDepth(-19).setScrollFactor(0);

    // Far skyline — flat dark silhouettes
    const far = this.add.graphics().setDepth(-18).setScrollFactor(0.2, 1);
    far.fillStyle(p.ground, 0.75);
    for (let x = -40; x < W * 1.2; x += 150) {
      const h = 90 + ((x * 29) % 150);
      far.fillRect(x, GROUND_Y - h, 120, h);
    }

    // Mid apartment blocks with grids of lit windows
    const mid = this.add.graphics().setDepth(-16).setScrollFactor(0.5, 1);
    for (let x = -60; x < W * 1.4; x += 210) {
      const h = 150 + ((x * 53) % 150);
      const bw = 160;
      mid.fillStyle(p.platform, 0.95);
      mid.fillRect(x, GROUND_Y - h, bw, h);
      mid.fillStyle(p.projectile, 0.45);
      for (let wy = GROUND_Y - h + 18; wy < GROUND_Y - 22; wy += 28) {
        for (let wx = x + 16; wx < x + bw - 16; wx += 32) {
          if ((wx + wy) % 3 !== 0) mid.fillRect(wx, wy, 11, 13); // some windows dark
        }
      }
    }

    // A band of crowd silhouettes shuffling near the ground — the "wave" of people
    const crowd = this.add.graphics().setDepth(-8).setScrollFactor(0.8, 1);
    crowd.fillStyle(p.enemy, 0.4);
    for (let x = -20; x < W * 1.3; x += 24) {
      const bob = (x * 17) % 9;
      crowd.fillCircle(x, GROUND_Y - 6 - bob, 8);
      crowd.fillRect(x - 8, GROUND_Y - 6 - bob, 16, 24);
    }

    // Near streetlamps with a soft glow (steady, never flashing)
    const lamps = this.add.graphics().setDepth(-6).setScrollFactor(0.95, 1);
    for (let x = 260; x < W; x += 540) {
      lamps.fillStyle(p.checkpoint, 1);
      lamps.fillRect(x, GROUND_Y - 130, 5, 130);
      lamps.fillStyle(p.projectile, 0.16);
      lamps.fillCircle(x + 2, GROUND_Y - 132, 22);
      lamps.fillStyle(p.projectile, 0.85);
      lamps.fillCircle(x + 2, GROUND_Y - 132, 7);
    }
  }

  protected buildWorld(): void {
    // Floating platforms
    this.block(760, 400, 128, 24);
    this.block(1500, 392, 128, 24);
    this.block(1690, 320, 96, 24);
    this.block(2120, 380, 128, 24);
    this.block(2680, 400, 128, 24);
    this.block(2880, 330, 96, 24);
    this.block(3120, 396, 128, 24);

    this.hint(200, 'move: ← → / stick\njump: Space / bottom button');
    this.hint(560, 'attack: J / X / any other pad button\npress again for a 3-hit combo');
    this.hint(1250, 'beacons save your spot');

    // Section 1 — meet the Crowders
    this.spawnEnemy(new Crowder(this, 820, GROUND_Y - 40));
    this.spawnEnemy(new Crowder(this, 1050, GROUND_Y - 40));
    // Section 2 — Starer overwatch + escort
    this.spawnEnemy(new Starer(this, 1690, 240));
    this.spawnEnemy(new Crowder(this, 1560, GROUND_Y - 40));
    // Section 3 — the queue of Blockers
    this.spawnEnemy(new Blocker(this, 2050, GROUND_Y - 44));
    this.spawnEnemy(new Blocker(this, 2210, GROUND_Y - 44));
    this.spawnEnemy(new Starer(this, 2120, 250));
    // Section 4 — hall of mirrors
    this.spawnEnemy(new Mimic(this, 2760, GROUND_Y - 40));
    this.spawnEnemy(new Crowder(this, 2950, GROUND_Y - 40));
    this.spawnEnemy(new Mimic(this, 3120, GROUND_Y - 40));

    this.waves = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.player, this.waves, (_pl, wave) => {
      this.hurtPlayer((wave as Phaser.Physics.Arcade.Sprite).x);
    });
  }

  protected createBoss(): BossBase {
    return new SpecterwaveBoss(this, this, 3880, 400);
  }

  bossAttack(_kind: string, x: number, dir: number): void {
    if (!this.boss || this.boss.defeated) return;
    const wave = this.waves.create(x, GROUND_Y - 14, 'vox-wave') as Phaser.Physics.Arcade.Sprite;
    wave.setVelocityX(dir * 170);
    wave.setDepth(5);
    this.time.delayedCall(4200, () => wave.destroy());
  }

  bossMinion(x: number): void {
    if (!this.boss || this.boss.defeated) return;
    const nearby = this.enemies.filter((e) => e.active && e instanceof Crowder && e.x > this.bossWallX);
    if (nearby.length >= 2) return;
    this.spawnEnemy(new Crowder(this, x + Phaser.Math.Between(-120, 120), 300));
  }
}
