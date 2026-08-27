// Shared boss behavior: health, hit flash, the shrink-as-you-win rule (pillar 1 made
// mechanical), and the pop-not-spectacle defeat. Each world's boss subclasses this and
// talks to its scene through the BossHost interface.

import Phaser from 'phaser';
import { EVENTS } from '../systems/events';
import { cue } from '../systems/sound';
import type { Player } from './Player';

/** What a boss is allowed to ask of the world scene that owns it. */
export interface BossHost {
  hurtPlayer(sourceX: number): void;
  bossMinion(x: number): void;
  bossAttack(kind: string, x: number, dir: number): void;
  onBossDown(x: number, y: number): void;
}

export abstract class BossBase extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  readonly maxHp: number;
  readonly bossName: string;
  readonly tagline: string;
  defeated = false;
  touchDamage = 1;
  protected host: BossHost;
  private hitFlash = 0;

  constructor(
    scene: Phaser.Scene,
    host: BossHost,
    x: number,
    y: number,
    key: string,
    maxHp: number,
    bossName: string,
    tagline: string,
  ) {
    super(scene, x, y, key);
    this.host = host;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.bossName = bossName;
    this.tagline = tagline;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setDepth(6);
    cue('boss-appear');
    this.emitHp();
  }

  get phase(): 1 | 2 {
    return this.hp > this.maxHp / 2 ? 1 : 2;
  }

  protected emitHp(): void {
    this.scene.game.events.emit(EVENTS.bossHp, this.hp, this.maxHp, this.bossName, this.tagline);
  }

  hit(damage: number, dir: 1 | -1, _finisher?: boolean): void {
    if (this.defeated) return;
    this.hp = Math.max(0, this.hp - damage);
    this.setTintFill(0xffffff);
    this.hitFlash = 70;
    this.x += dir * 6;
    // The Specterati shrink as you win. Down to ~55% size at 1 hp.
    this.setScale(0.55 + 0.45 * (this.hp / this.maxHp));
    this.emitHp();
    if (this.hp <= 0) this.defeat();
  }

  protected defeat(): void {
    this.defeated = true;
    cue('boss-down');
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.scene.tweens.add({
      targets: this,
      scale: 0.05,
      angle: 360,
      alpha: 0,
      y: this.y - 30,
      duration: 900,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.host.onBossDown(this.x, this.y);
        this.destroy();
      },
    });
  }

  /** Per-frame update while alive; ticks the shared hit flash then defers to the subclass. */
  updateBoss(dtMs: number, player: Player): void {
    if (this.defeated) return;
    this.hitFlash -= dtMs;
    if (this.hitFlash <= 0) this.clearTint();
    this.tick(dtMs, player);
  }

  protected abstract tick(dtMs: number, player: Player): void;
}
