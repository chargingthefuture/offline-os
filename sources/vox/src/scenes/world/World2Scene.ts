// World 2 — Spectervox: slander, reputation, being recorded and baited. The gimmick is
// deflection: attack a lie-bubble mid-air and it flips into a truth that flies back and
// hurts whoever threw it. Reputation fills as you deflect and defeat; at full, your
// finisher hits harder (truth armor).

import Phaser from 'phaser';
import { SpectervoxBoss } from '../../entities/Boss2';
import type { BossBase } from '../../entities/BossBase';
import { Accuser, Clerk, Gatekeeper, Recorder, Slanderer, type World2Host } from '../../entities/enemies2';
import type { Player } from '../../entities/Player';
import { LieBubble } from '../../entities/projectiles';
import { buildOfficeBackdrop } from '../../systems/backdrops';
import { EVENTS } from '../../systems/events';
import { BaseWorldScene, GROUND_Y } from './BaseWorldScene';

const REP_MAX = 100;

export class World2Scene extends BaseWorldScene implements World2Host {
  readonly worldId = 2;
  readonly worldName = 'WORLD 2 — SPECTERVOX';
  readonly worldWidth = 4400;
  readonly checkpointXs = [80, 1250, 2500, 3400];
  readonly bossTriggerX = 3620;
  readonly bossWallX = 3520;

  private bubbles: LieBubble[] = [];
  private rep = 40;
  private truthArmorAnnounced = false;

  constructor() {
    super('world2');
  }

  protected override buildBackdrop(): void {
    buildOfficeBackdrop(this, this.worldWidth);
  }

  protected buildWorld(): void {
    this.bubbles = [];
    this.rep = 40;
    this.truthArmorAnnounced = false;

    // Platforms
    this.block(820, 400, 128, 24);
    this.block(1520, 390, 128, 24);
    this.block(1720, 318, 96, 24);
    this.block(2120, 370, 128, 24);
    this.block(2760, 400, 128, 24);
    this.block(2960, 330, 96, 24);
    this.block(3180, 396, 128, 24);

    this.hint(220, 'Spectervox flings lies.\nattack a lie mid-air to fling it back');
    this.hint(680, 'deflected lies become truths —\nthey hurt whoever threw them');
    this.hint(2500, 'full reputation = your finisher hits harder');

    // Section 1 — the check-in desk and the first gossip
    this.spawnEnemy(new Clerk(this, this, 520, GROUND_Y - 34));
    this.spawnEnemy(new Slanderer(this, this, 880, GROUND_Y - 40));
    // Section 2 — the boom mic and its writer
    this.spawnEnemy(new Recorder(this, this, 1520, 270));
    this.spawnEnemy(new Slanderer(this, this, 1700, GROUND_Y - 40));
    // Section 3 — the denial corridor
    this.spawnEnemy(new Gatekeeper(this, 2060, GROUND_Y - 46));
    this.spawnEnemy(new Gatekeeper(this, 2220, GROUND_Y - 46));
    this.spawnEnemy(new Recorder(this, this, 2140, 260));
    // Section 4 — pointed fingers
    this.spawnEnemy(new Accuser(this, 2720, GROUND_Y - 40));
    this.spawnEnemy(new Slanderer(this, this, 2960, GROUND_Y - 40));
    this.spawnEnemy(new Accuser(this, 3160, GROUND_Y - 40));

    this.time.delayedCall(0, () => this.emitRep());
  }

  protected createBoss(): BossBase {
    return new SpectervoxBoss(this, this, 3960, 400);
  }

  // --- World2Host -------------------------------------------------------------

  spawnLie(x: number, y: number, tx: number, ty: number): void {
    const d = Math.max(1, Phaser.Math.Distance.Between(x, y, tx, ty));
    const speed = 165;
    const vx = ((tx - x) / d) * speed;
    const vy = Phaser.Math.Clamp(((ty - y) / d) * speed, -70, 70);
    this.bubbles.push(new LieBubble(this, x, y, vx, vy));
  }

  clerkAlarm(x: number): void {
    this.spawnEnemy(new Slanderer(this, this, x + 260, 300));
  }

  bossAttack(_kind: string, x: number, _dir: number): void {
    if (!this.boss || this.boss.defeated) return;
    const count = this.boss.phase === 2 ? 3 : 2;
    const spreads = count === 2 ? [-40, 30] : [-60, 0, 60];
    for (const spread of spreads) {
      this.spawnLie(x, this.boss.y + 18, this.player.x, this.player.y + spread);
    }
  }

  bossMinion(x: number): void {
    if (!this.boss || this.boss.defeated) return;
    const nearby = this.enemies.filter((e) => e.active && e instanceof Slanderer && e.x > this.bossWallX);
    if (nearby.length >= 2) return;
    this.spawnEnemy(new Slanderer(this, this, x + Phaser.Math.Between(-140, -40), 300));
  }

  // --- reputation ---------------------------------------------------------------

  private emitRep(): void {
    this.game.events.emit(EVENTS.reputation, this.rep);
  }

  private addRep(delta: number): void {
    this.rep = Phaser.Math.Clamp(this.rep + delta, 0, REP_MAX);
    this.emitRep();
    if (this.rep >= REP_MAX && !this.truthArmorAnnounced) {
      this.truthArmorAnnounced = true;
      this.game.events.emit(EVENTS.checkpoint); // nudge the HUD
    }
  }

  protected override finisherBonus(): number {
    return this.rep >= REP_MAX ? 1 : 0;
  }

  protected override onProblemDefeated(pid: number, x: number, y: number): void {
    super.onProblemDefeated(pid, x, y);
    this.addRep(15);
  }

  // --- deflection ------------------------------------------------------------------

  protected override processAttackExtras(box: NonNullable<ReturnType<Player['attackBox']>>): void {
    for (const b of this.bubbles) {
      if (!b.active || b.deflected) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(box.rect, b.getBounds())) {
        b.deflect(this.player.facing);
        this.addRep(10);
      }
    }
  }

  protected override worldTick(dtMs: number): void {
    this.bubbles = this.bubbles.filter((b) => b.active);
    for (const b of this.bubbles) {
      b.updateBubble(dtMs);
      if (!b.active) continue;
      const bounds = b.getBounds();

      if (!b.deflected) {
        // A lie that reaches VOX stings (and dings the meter a little)
        if (
          !this.player.invulnerable &&
          Phaser.Geom.Intersects.RectangleToRectangle(bounds, this.player.getBounds())
        ) {
          b.pop();
          this.addRep(-8);
          this.hurtPlayer(b.x);
        }
        continue;
      }

      // A truth on its way back hurts whoever it reaches — boss takes it doubled
      if (this.boss && this.boss.active && !this.boss.defeated) {
        if (Phaser.Geom.Intersects.RectangleToRectangle(bounds, this.boss.getBounds())) {
          this.boss.hit(b.truthDamage * 2, b.body && (b.body as Phaser.Physics.Arcade.Body).velocity.x > 0 ? 1 : -1);
          this.confetti.explode(10, b.x, b.y);
          b.pop();
          continue;
        }
      }
      for (const e of this.enemies) {
        if (!e.active || e.defeated) continue;
        if (Phaser.Geom.Intersects.RectangleToRectangle(bounds, e.getBounds())) {
          e.hit(b.truthDamage, (b.body as Phaser.Physics.Arcade.Body).velocity.x > 0 ? 1 : -1, false);
          this.confetti.explode(10, b.x, b.y);
          b.pop();
          break;
        }
      }
    }
  }
}
