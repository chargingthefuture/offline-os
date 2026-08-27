// World 3 — Specterforce: authority and enforcement. Police shadowing, the doorway beep,
// the customer-service hold-loop, and circling sirens. The hold-loop is expressed as a
// section that keeps shoving you back (bounced, never hurt) until you smash its generator.

import Phaser from 'phaser';
import { SpecterforceBoss } from '../../entities/Boss3';
import type { BossBase } from '../../entities/BossBase';
import { Detector, LoopGenerator, Shadow, Siren, type World3Host } from '../../entities/enemies3';
import { buildPrecinctBackdrop } from '../../systems/backdrops';
import { cue } from '../../systems/sound';
import { BaseWorldScene, GROUND_Y } from './BaseWorldScene';

export class World3Scene extends BaseWorldScene implements World3Host {
  readonly worldId = 3;
  readonly worldName = 'WORLD 3 — SPECTERFORCE';
  readonly worldWidth = 4400;
  readonly checkpointXs = [80, 1300, 2500, 3400];
  readonly bossTriggerX = 3620;
  readonly bossWallX = 3520;

  private holdWaves!: Phaser.Physics.Arcade.Group;
  private shockWaves!: Phaser.Physics.Arcade.Group;

  constructor() {
    super('world3');
  }

  protected override buildBackdrop(): void {
    buildPrecinctBackdrop(this, this.worldWidth);
  }

  protected buildWorld(): void {
    // Platforms
    this.block(820, 400, 128, 24);
    this.block(1540, 390, 128, 24);
    this.block(1740, 318, 96, 24);
    this.block(2160, 372, 128, 24);
    this.block(2780, 400, 128, 24);
    this.block(2980, 330, 96, 24);
    this.block(3200, 396, 128, 24);

    this.hint(220, 'Specterforce enforces.\nsirens circle — dodge and punish');
    this.hint(760, 'the detector calls a cop —\nsilence it with one hit');
    this.hint(2500, 'on hold forever? smash the loop\nto stop getting shoved back');

    // Section 1 — a shadowing cop and the doorway detector
    this.spawnEnemy(new Detector(this, this, 560, GROUND_Y - 32));
    this.spawnEnemy(new Shadow(this, 900, GROUND_Y - 40));
    // Section 2 — a siren circling its post, plus escort
    this.spawnEnemy(new Siren(this, 1560, GROUND_Y - 150, 100, 0));
    this.spawnEnemy(new Shadow(this, 1720, GROUND_Y - 40));
    // Section 3 — the hold-loop and its noise
    this.spawnEnemy(new LoopGenerator(this, this, 2200, GROUND_Y - 44));
    this.spawnEnemy(new Siren(this, 2500, GROUND_Y - 140, 90, Math.PI));
    // Section 4 — the gauntlet
    this.spawnEnemy(new Shadow(this, 2820, GROUND_Y - 40));
    this.spawnEnemy(new Siren(this, 3080, GROUND_Y - 150, 100, Math.PI / 2));
    this.spawnEnemy(new Detector(this, this, 3300, GROUND_Y - 32));

    this.holdWaves = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.player, this.holdWaves, (_pl, wave) => {
      const w = wave as Phaser.Physics.Arcade.Sprite;
      // On hold: bounced back a bit, never damaged. The annoyance is the point.
      const away = this.player.x >= w.x ? 1 : -1;
      this.player.setVelocityX(away * 240);
      cue('alarm');
      w.destroy();
    });

    this.shockWaves = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.player, this.shockWaves, (_pl, wave) => {
      this.hurtPlayer((wave as Phaser.Physics.Arcade.Sprite).x);
    });
  }

  protected createBoss(): BossBase {
    return new SpecterforceBoss(this, this, 3960, 400);
  }

  // --- World3Host --------------------------------------------------------------

  detectorAlarm(x: number): void {
    this.spawnEnemy(new Shadow(this, x + 120, GROUND_Y - 40));
  }

  spawnHoldWave(x: number, dir: number): void {
    const wave = this.holdWaves.create(x + dir * 30, GROUND_Y - 14, 'vox-holdwave') as Phaser.Physics.Arcade.Sprite;
    wave.setVelocityX(dir * 150);
    wave.setDepth(5);
    this.time.delayedCall(4500, () => wave.active && wave.destroy());
  }

  bossAttack(_kind: string, x: number, dir: number): void {
    if (!this.boss || this.boss.defeated) return;
    const wave = this.shockWaves.create(x, GROUND_Y - 14, 'vox-wave') as Phaser.Physics.Arcade.Sprite;
    wave.setVelocityX(dir * 190);
    wave.setDepth(5);
    this.time.delayedCall(3800, () => wave.active && wave.destroy());
  }

  bossMinion(x: number): void {
    if (!this.boss || this.boss.defeated) return;
    const nearby = this.enemies.filter((e) => e.active && e instanceof Siren && e.x > this.bossWallX);
    if (nearby.length >= 2) return;
    this.spawnEnemy(new Siren(this, x - 40, GROUND_Y - 150, 110, Math.random() * Math.PI * 2));
  }
}
