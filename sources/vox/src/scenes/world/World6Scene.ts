// World 6 — Specterrise: systems and infrastructure sabotage. Endless forms, tampered
// mail, spam calls, wild goose chases, car trouble, vanishing items, frozen accounts.

import Phaser from 'phaser';
import { SpecterriseBoss } from '../../entities/Boss6';
import type { BossBase } from '../../entities/BossBase';
import {
  Clunker,
  Locker,
  MailThief,
  RunAround,
  Spammer,
  Spinner,
  Vanisher,
  type World6Host,
} from '../../entities/enemies6';
import { buildServerBackdrop } from '../../systems/backdrops';
import { BaseWorldScene, GROUND_Y } from './BaseWorldScene';

export class World6Scene extends BaseWorldScene implements World6Host {
  readonly worldId = 6;
  readonly worldName = 'WORLD 6 — SPECTERRISE';
  readonly worldWidth = 4800;
  readonly checkpointXs = [80, 1400, 2700, 3600];
  readonly bossTriggerX = 3820;
  readonly bossWallX = 3720;

  private calls!: Phaser.Physics.Arcade.Group;

  constructor() {
    super('world6');
  }

  protected override buildBackdrop(): void {
    buildServerBackdrop(this, this.worldWidth);
  }

  protected buildWorld(): void {
    this.block(880, 400, 128, 24);
    this.block(1580, 388, 128, 24);
    this.block(1780, 316, 96, 24);
    this.block(2280, 372, 128, 24);
    this.block(2600, 330, 96, 24);
    this.block(3120, 396, 128, 24);
    this.block(3400, 340, 96, 24);

    this.hint(240, 'Specterrise jams the works.\ndodge the spam calls');
    this.hint(760, 'the form never submits —\nkeep hitting until it breaks');
    this.hint(2700, "vanishing items blink away —\nhit them while they're here");

    // Section 1 — the paperwork wall and the spam line
    this.spawnEnemy(new Spinner(this, 620, GROUND_Y - 36));
    this.spawnEnemy(new Spammer(this, this, 980, 250));
    this.spawnEnemy(new MailThief(this, 1150, GROUND_Y - 40));
    // Section 2 — goose chase and car trouble
    this.spawnEnemy(new RunAround(this, 1600, GROUND_Y - 40));
    this.spawnEnemy(new Clunker(this, 1900, GROUND_Y - 20));
    this.spawnEnemy(new Spammer(this, this, 2100, 250));
    // Section 3 — the vanishing shelf
    this.spawnEnemy(new Vanisher(this, 2500, GROUND_Y - 40));
    this.spawnEnemy(new Vanisher(this, 2700, GROUND_Y - 40));
    this.spawnEnemy(new Locker(this, 2950, GROUND_Y - 34));
    // Section 4 — the gauntlet: everything at once
    this.spawnEnemy(new Spinner(this, 3200, GROUND_Y - 36));
    this.spawnEnemy(new RunAround(this, 3350, GROUND_Y - 40));
    this.spawnEnemy(new Clunker(this, 3500, GROUND_Y - 20));
    this.spawnEnemy(new MailThief(this, 3600, GROUND_Y - 40));

    this.calls = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.player, this.calls, (_pl, c) => {
      const s = c as Phaser.Physics.Arcade.Sprite;
      s.destroy();
      this.hurtPlayer(s.x);
    });
  }

  protected createBoss(): BossBase {
    return new SpecterriseBoss(this, this, 4280, 380);
  }

  // --- World6Host --------------------------------------------------------------

  lobCall(x: number, y: number, tx: number, ty: number): void {
    const call = this.calls.create(x, y, 'vox-call') as Phaser.Physics.Arcade.Sprite;
    const d = Math.max(1, Phaser.Math.Distance.Between(x, y, tx, ty));
    const speed = 180;
    call.setVelocity(((tx - x) / d) * speed, ((ty - y) / d) * speed);
    call.setDepth(7);
    this.time.delayedCall(5000, () => call.active && call.destroy());
  }

  bossAttack(kind: string, x: number, spread: number): void {
    if (!this.boss || this.boss.defeated || kind !== 'call') return;
    // spread is a vertical offset on the aim point, for a fan of calls
    this.lobCall(x, this.boss.y + 10, this.player.x, this.player.y + spread);
  }

  bossMinion(x: number): void {
    if (!this.boss || this.boss.defeated) return;
    const nearby = this.enemies.filter((e) => e.active && e instanceof Clunker && e.x > this.bossWallX);
    if (nearby.length >= 2) return;
    this.spawnEnemy(new Clunker(this, x + Phaser.Math.Between(-120, -40), GROUND_Y - 20));
  }
}
