// World 5 — Specterbane: attacks on body and mind. Tinnitus, denied care, fatigue, bright
// beams, unexplained injuries — five tactics, each drawn as a cartoon to be flattened.

import Phaser from 'phaser';
import { SpecterbaneBoss } from '../../entities/Boss5';
import type { BossBase } from '../../entities/BossBase';
import { Beamer, Drainer, FalseDoctor, Ringer, Striker, type World5Host } from '../../entities/enemies5';
import { buildClinicBackdrop } from '../../systems/backdrops';
import { BaseWorldScene, GROUND_Y } from './BaseWorldScene';

export class World5Scene extends BaseWorldScene implements World5Host {
  readonly worldId = 5;
  readonly worldName = 'WORLD 5 — SPECTERBANE';
  readonly worldWidth = 4600;
  readonly checkpointXs = [80, 1350, 2650, 3500];
  readonly bossTriggerX = 3720;
  readonly bossWallX = 3620;

  private rings!: Phaser.Physics.Arcade.Group;

  constructor() {
    super('world5');
  }

  protected override buildBackdrop(): void {
    buildClinicBackdrop(this, this.worldWidth);
  }

  protected buildWorld(): void {
    this.block(860, 400, 128, 24);
    this.block(1560, 388, 128, 24);
    this.block(1760, 316, 96, 24);
    this.block(2260, 372, 128, 24);
    this.block(2560, 330, 96, 24);
    this.block(3080, 396, 128, 24);
    this.block(3360, 340, 96, 24);

    this.hint(240, 'Specterbane attacks body and mind.\njump the tinnitus rings');
    this.hint(720, 'the doctor ghosts you —\nhit it only while it is solid');
    this.hint(2650, 'fatigue drags you slow —\nsmash the drainer to shake it');

    // Section 1 — the ringing and the beam
    this.spawnEnemy(new Ringer(this, this, 700, GROUND_Y - 34));
    this.spawnEnemy(new Beamer(this, 980, 250));
    this.spawnEnemy(new Striker(this, 1150, GROUND_Y - 40));
    // Section 2 — the ghosting doctor
    this.spawnEnemy(new FalseDoctor(this, 1600, GROUND_Y - 40));
    this.spawnEnemy(new Drainer(this, 1800, GROUND_Y - 120));
    this.spawnEnemy(new Beamer(this, 2050, 250));
    // Section 3 — fatigue and unexplained blows
    this.spawnEnemy(new Drainer(this, 2500, GROUND_Y - 120));
    this.spawnEnemy(new Striker(this, 2700, GROUND_Y - 40));
    this.spawnEnemy(new FalseDoctor(this, 2950, GROUND_Y - 40));
    // Section 4 — the gauntlet
    this.spawnEnemy(new Ringer(this, this, 3200, GROUND_Y - 34));
    this.spawnEnemy(new Striker(this, 3400, GROUND_Y - 40));
    this.spawnEnemy(new Beamer(this, 3550, 250));

    this.rings = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.player, this.rings, (_pl, r) => {
      this.hurtPlayer((r as Phaser.Physics.Arcade.Sprite).x);
    });
  }

  protected createBoss(): BossBase {
    return new SpecterbaneBoss(this, this, 4080, 380);
  }

  // --- World5Host --------------------------------------------------------------

  ringPulse(x: number, dir: number): void {
    const ring = this.rings.create(x + dir * 24, GROUND_Y - 16, 'vox-ringwave') as Phaser.Physics.Arcade.Sprite;
    ring.setVelocityX(dir * 165);
    ring.setDepth(5);
    this.time.delayedCall(5000, () => ring.active && ring.destroy());
  }

  bossAttack(kind: string, x: number, dir: number): void {
    if (!this.boss || this.boss.defeated) return;
    if (kind === 'ring') this.ringPulse(x, dir);
  }

  bossMinion(x: number): void {
    if (!this.boss || this.boss.defeated) return;
    const nearby = this.enemies.filter((e) => e.active && e instanceof Striker && e.x > this.bossWallX);
    if (nearby.length >= 2) return;
    this.spawnEnemy(new Striker(this, x + Phaser.Math.Between(-100, 100), GROUND_Y - 40));
  }
}
