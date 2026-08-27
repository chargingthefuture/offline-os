// World 4 — Specterrealm: the surveilled neighborhood. Twelve tactics, all represented as
// the props and people of a watched street. The longest world, so it runs a touch wider.

import Phaser from 'phaser';
import { SpecterrealmBoss } from '../../entities/Boss4';
import type { BossBase } from '../../entities/BossBase';
import {
  Antenna,
  BarkSpeaker,
  Drone,
  Flasher,
  Hummer,
  Lurker,
  NewNeighbor,
  ParkedCar,
  Passerby,
  PeekNeighbor,
  Prowler,
  RevolvingDoor,
  WindowLight,
  type World4Host,
} from '../../entities/enemies4';
import { buildCuldesacBackdrop } from '../../systems/backdrops';
import { BaseWorldScene, GROUND_Y } from './BaseWorldScene';

export class World4Scene extends BaseWorldScene implements World4Host {
  readonly worldId = 4;
  readonly worldName = 'WORLD 4 — SPECTERREALM';
  readonly worldWidth = 5200;
  readonly checkpointXs = [80, 1400, 2800, 4100];
  readonly bossTriggerX = 4320;
  readonly bossWallX = 4220;

  private sweeps!: Phaser.Physics.Arcade.Group;
  private passersby: Passerby[] = [];

  constructor() {
    super('world4');
  }

  protected override buildBackdrop(): void {
    buildCuldesacBackdrop(this, this.worldWidth);
  }

  protected buildWorld(): void {
    this.passersby = [];

    // Platforms
    this.block(880, 400, 128, 24);
    this.block(1600, 388, 128, 24);
    this.block(1800, 316, 96, 24);
    this.block(2300, 372, 128, 24);
    this.block(2600, 330, 96, 24);
    this.block(3100, 396, 128, 24);
    this.block(3700, 372, 128, 24);
    this.block(3920, 320, 96, 24);

    this.hint(240, 'The surveilled neighborhood.\nsmash the watchers and their gear');
    this.hint(820, "the humming field slows you —\nsmash the emitter to shake it off");
    this.hint(2800, 'your pet senses what you cannot —\nprowlers sharpen as you near');

    // Section 1 — the street outside your door: parked car, antenna, fake neighbor
    this.spawnEnemy(new ParkedCar(this, 620, GROUND_Y - 20));
    this.spawnEnemy(new Antenna(this, 820, GROUND_Y - 28));
    this.spawnEnemy(new NewNeighbor(this, 1050, GROUND_Y - 40));
    this.spawnEnemy(new Drone(this, 1250, 250));
    // Section 2 — the noise and the peekers
    this.spawnEnemy(new Hummer(this, 1650, GROUND_Y - 28));
    this.spawnEnemy(new PeekNeighbor(this, 1500, GROUND_Y - 40));
    this.spawnEnemy(new WindowLight(this, 1820, 300));
    this.spawnEnemy(new Antenna(this, 2050, GROUND_Y - 28));
    // Section 3 — the revolving door and its parade, plus flashes
    this.spawnEnemy(new RevolvingDoor(this, this, 2500, GROUND_Y - 30));
    this.spawnEnemy(new Flasher(this, 2700, 280));
    this.spawnEnemy(new Prowler(this, 2900, GROUND_Y - 38));
    this.spawnEnemy(new Lurker(this, 3050, GROUND_Y - 40, 1, 130));
    // Section 4 — the gauntlet home: bark-speaker, drones, lurkers, more watchers
    this.spawnEnemy(new BarkSpeaker(this, this, 3400, GROUND_Y - 26));
    this.spawnEnemy(new Drone(this, 3600, 240));
    this.spawnEnemy(new PeekNeighbor(this, 3800, GROUND_Y - 40));
    this.spawnEnemy(new WindowLight(this, 3950, 290));
    this.spawnEnemy(new Prowler(this, 4050, GROUND_Y - 38));

    this.sweeps = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.player, this.sweeps, (_pl, wave) => {
      this.hurtPlayer((wave as Phaser.Physics.Arcade.Sprite).x);
    });
  }

  protected createBoss(): BossBase {
    return new SpecterrealmBoss(this, this, 4680, 380);
  }

  protected override worldTick(dtMs: number): void {
    this.passersby = this.passersby.filter((p) => p.active);
    for (const p of this.passersby) p.tick(dtMs);
  }

  // --- World4Host --------------------------------------------------------------

  callLurker(x: number): void {
    this.spawnEnemy(new Lurker(this, x + 160, GROUND_Y - 40, -1, 120));
  }

  spawnPasserby(x: number, dir: number): void {
    if (this.passersby.length >= 3) return;
    const p = new Passerby(this, x, GROUND_Y - 40, dir);
    this.passersby.push(p);
    this.physics.add.collider(p, this.platforms);
  }

  bossAttack(_kind: string, x: number, dir: number): void {
    if (!this.boss || this.boss.defeated) return;
    const wave = this.sweeps.create(x, GROUND_Y - 14, 'vox-wave') as Phaser.Physics.Arcade.Sprite;
    wave.setVelocityX(dir * 195);
    wave.setDepth(5);
    this.time.delayedCall(3800, () => wave.active && wave.destroy());
  }

  bossMinion(x: number): void {
    if (!this.boss || this.boss.defeated) return;
    const nearby = this.enemies.filter((e) => e.active && e instanceof Drone && e.x > this.bossWallX);
    if (nearby.length >= 2) return;
    this.spawnEnemy(new Drone(this, x + Phaser.Math.Between(-80, 80), 240));
  }
}
