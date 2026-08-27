// World 7 — The Recruiters: entrapment, fake friends, occult secrecy. The last world; clear
// it and every one of the 51 tactics has been flattened.

import Phaser from 'phaser';
import { RecruitersBoss } from '../../entities/Boss7';
import type { BossBase } from '../../entities/BossBase';
import {
  Baiter,
  FakeFriend,
  ForcedFamily,
  Knower,
  Lodge,
  Proposition,
  PushyNewcomer,
  SecretKeeper,
  type World7Host,
} from '../../entities/enemies7';
import { buildLodgeBackdrop } from '../../systems/backdrops';
import { BaseWorldScene, GROUND_Y } from './BaseWorldScene';

export class World7Scene extends BaseWorldScene implements World7Host {
  readonly worldId = 7;
  readonly worldName = 'WORLD 7 — THE RECRUITERS';
  readonly worldWidth = 5000;
  readonly checkpointXs = [80, 1450, 2800, 3800];
  readonly bossTriggerX = 4020;
  readonly bossWallX = 3920;

  private lures!: Phaser.Physics.Arcade.Group;

  constructor() {
    super('world7');
  }

  protected override buildBackdrop(): void {
    buildLodgeBackdrop(this, this.worldWidth);
  }

  protected buildWorld(): void {
    this.block(880, 400, 128, 24);
    this.block(1580, 388, 128, 24);
    this.block(1780, 316, 96, 24);
    this.block(2320, 372, 128, 24);
    this.block(2620, 330, 96, 24);
    this.block(3160, 396, 128, 24);
    this.block(3440, 340, 96, 24);

    this.hint(240, 'The Recruiters want you in.\nnothing here is a real friend');
    this.hint(760, "don't take the bait —\nits lures bite; smash the baiter");
    this.hint(2800, 'the secret slips out on a beat —\nhit the keeper only when it does');

    // Section 1 — the hard sell
    this.spawnEnemy(new PushyNewcomer(this, 640, GROUND_Y - 40));
    this.spawnEnemy(new Knower(this, 980, 250));
    this.spawnEnemy(new FakeFriend(this, 1150, GROUND_Y - 40));
    // Section 2 — the lodge and the bait
    this.spawnEnemy(new Lodge(this, 1650, GROUND_Y - 32));
    this.spawnEnemy(new Baiter(this, this, 1900, GROUND_Y - 40));
    this.spawnEnemy(new Proposition(this, 2150, GROUND_Y - 40));
    // Section 3 — secrets and forced ties
    this.spawnEnemy(new SecretKeeper(this, 2550, GROUND_Y - 40));
    this.spawnEnemy(new ForcedFamily(this, 2750, GROUND_Y - 40));
    this.spawnEnemy(new SecretKeeper(this, 2950, GROUND_Y - 40));
    // Section 4 — the whole recruitment drive
    this.spawnEnemy(new FakeFriend(this, 3200, GROUND_Y - 40));
    this.spawnEnemy(new Baiter(this, this, 3350, GROUND_Y - 40));
    this.spawnEnemy(new PushyNewcomer(this, 3550, GROUND_Y - 40));
    this.spawnEnemy(new Proposition(this, 3700, GROUND_Y - 40));

    this.lures = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.player, this.lures, (_pl, l) => {
      this.hurtPlayer((l as Phaser.Physics.Arcade.Sprite).x);
    });
  }

  protected createBoss(): BossBase {
    return new RecruitersBoss(this, this, 4480, 380);
  }

  // --- World7Host --------------------------------------------------------------

  dropLure(x: number): void {
    const lure = this.lures.create(x, GROUND_Y - 12, 'vox-lure') as Phaser.Physics.Arcade.Sprite;
    lure.setImmovable(true);
    lure.setDepth(4);
    // A tempting sparkle, then it bites; clears itself so the floor never fills up
    this.tweens.add({ targets: lure, scale: 1.15, duration: 500, yoyo: true, repeat: -1 });
    this.time.delayedCall(3200, () => lure.active && lure.destroy());
  }

  bossAttack(kind: string, x: number, _dir: number): void {
    if (!this.boss || this.boss.defeated || kind !== 'lure') return;
    this.dropLure(x);
  }

  bossMinion(x: number): void {
    if (!this.boss || this.boss.defeated) return;
    const nearby = this.enemies.filter((e) => e.active && e instanceof FakeFriend && e.x > this.bossWallX);
    if (nearby.length >= 2) return;
    this.spawnEnemy(new FakeFriend(this, x + Phaser.Math.Between(-140, -40), GROUND_Y - 40));
  }
}
