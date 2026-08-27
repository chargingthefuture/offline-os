// The Specterrise enemies — systems and infrastructure sabotage. Endless forms, tampered
// mail, spam calls, wild goose chases, car trouble, vanishing items, frozen accounts. Each
// is a cartoon of a broken system, built to be flattened.

import Phaser from 'phaser';
import { Enemy } from './enemies';
import type { Player } from './Player';

/** What world 6 enemies may ask of their scene. */
export interface World6Host {
  /** Lob a spam-call projectile from (x, y) toward (tx, ty). */
  lobCall(x: number, y: number, tx: number, ty: number): void;
}

/** #20 Endless forms — the application that never submits. A stubborn wall of buffering;
 * it takes a lot of clicks (hits) to get through, just like the real thing. */
export class Spinner extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-spinner', 8, 20);
    this.touchDamage = 0;
    this.setImmovable(true);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setSize(36, 40).setOffset(2, 4);
  }

  updateEnemy(_dtMs: number, _player: Player): void {
    if (this.defeated) return;
    this.rotation += 0.06; // the eternal loading spinner
  }

  protected override defeat(): void {
    this.setRotation(0);
    super.defeat();
  }
}

/** #23 Mail tampering — a thief with your envelope who bolts when you get close. Corner it
 * to get your mail back. */
export class MailThief extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-mailthief', 2, 23);
    this.setCollideWorldBounds(true);
    this.setSize(24, 30).setOffset(4, 4);
  }

  updateEnemy(_dtMs: number, player: Player): void {
    if (this.defeated) return;
    const dx = player.x - this.x;
    if (Math.abs(dx) < 200) {
      // Bolts away from you
      this.setVelocityX(-Math.sign(dx) * 130);
      this.setFlipX(-Math.sign(dx) < 0);
    } else {
      this.setVelocityX(0);
    }
  }
}

/** #35 Strange calls/texts — an unknown number that keeps ringing you. Lobs call-bubbles;
 * dodge them and smash the phone. */
export class Spammer extends Enemy {
  private host: World6Host;
  private ringTimer = 1200;
  private readonly hoverY: number;

  constructor(scene: Phaser.Scene, host: World6Host, x: number, y: number) {
    super(scene, x, y, 'vox-spammer', 2, 35);
    this.host = host;
    this.hoverY = y;
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setSize(26, 30).setOffset(3, 4);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    const dx = player.x - this.x;
    this.y = this.hoverY + Math.sin(this.scene.time.now / 420) * 6;
    this.setFlipX(dx < 0);
    this.ringTimer -= dtMs;
    if (Math.abs(dx) < 420 && this.ringTimer <= 0) {
      this.ringTimer = 1900;
      this.host.lobCall(this.x, this.y, player.x, player.y - 8);
    }
  }
}

/** #40 Wild goose chase — wastes your time by darting somewhere new whenever you close in.
 * It only jumps every so often, so time your swing between hops. */
export class RunAround extends Enemy {
  private hopTimer = 0;
  private readonly homeX: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-runaround', 2, 40);
    this.homeX = x;
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setSize(24, 28).setOffset(4, 4);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    this.hopTimer -= dtMs;
    const dx = player.x - this.x;
    this.setVelocityX(0);
    if (Math.abs(dx) < 130 && this.hopTimer <= 0) {
      this.hopTimer = 1500;
      // Blink to a new spot along its stretch — always somewhere you now have to walk to
      const away = Math.sign(this.homeX - player.x) || (Math.random() < 0.5 ? -1 : 1);
      const to = Phaser.Math.Clamp(this.x + away * 220, this.homeX - 260, this.homeX + 260);
      this.scene.tweens.add({ targets: this, alpha: 0.2, duration: 120, yoyo: true });
      this.scene.time.delayedCall(120, () => { if (this.active) this.setX(to); });
    }
  }
}

/** #42 Car trouble — a stalled clunker that backfires forward when you come near. */
export class Clunker extends Enemy {
  private st: 'idle' | 'rev' | 'lurch' = 'idle';
  private stateTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-clunker', 4, 42);
    this.setSize(48, 26).setOffset(2, 6);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    this.stateTimer -= dtMs;
    const dx = player.x - this.x;
    switch (this.st) {
      case 'idle':
        this.setVelocityX(0);
        if (Math.abs(dx) < 180 && Math.abs(player.y - this.y) < 50) {
          this.st = 'rev'; this.stateTimer = 460; this.setFlipX(dx < 0);
          this.scene.tweens.add({ targets: this, scaleX: (dx < 0 ? -1 : 1) * 0.9, duration: 440, yoyo: true });
        }
        break;
      case 'rev':
        if (this.stateTimer <= 0) { this.st = 'lurch'; this.stateTimer = 420; this.setVelocityX(Math.sign(dx || 1) * 300); }
        break;
      case 'lurch':
        if (this.stateTimer <= 0) { this.st = 'idle'; this.stateTimer = 900; this.setVelocityX(0); this.setScale(1); }
        break;
    }
  }
}

/** #43 Vanishing items — here, then gone, then back weeks later somewhere else. Blinks fully
 * out (untouchable) and reappears a little way off; land a hit while it is present. */
export class Vanisher extends Enemy {
  private phaseTimer = 1800;
  private gone = false;
  private readonly homeX: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-vanisher', 2, 43);
    this.homeX = x;
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setSize(26, 26).setOffset(3, 4);
  }

  override hit(damage: number, dir: 1 | -1, finisher: boolean): void {
    if (this.gone) return; // not here — nothing to hit
    super.hit(damage, dir, finisher);
  }

  updateEnemy(dtMs: number, _player: Player): void {
    if (this.defeated) return;
    this.phaseTimer -= dtMs;
    if (this.phaseTimer <= 0) {
      this.gone = !this.gone;
      this.touchDamage = this.gone ? 0 : 1;
      if (this.gone) {
        this.setAlpha(0);
        this.phaseTimer = 1100;
      } else {
        // Reappear somewhere along its shelf
        this.setX(Phaser.Math.Clamp(this.homeX + Phaser.Math.Between(-120, 120), this.homeX - 120, this.homeX + 120));
        this.scene.tweens.add({ targets: this, alpha: 1, duration: 200 });
        this.phaseTimer = 2000;
      }
    }
  }
}

/** #51 Frozen account — a padlock slapped on your money for no reason. No contact damage;
 * smash the false freeze to get your funds back. */
export class Locker extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-locker', 5, 51);
    this.touchDamage = 0;
    this.setImmovable(true);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setSize(34, 40).setOffset(3, 4);
  }

  updateEnemy(_dtMs: number, _player: Player): void {
    if (this.defeated) return;
    // A tiny defiant shake now and then, otherwise it just sits there denying you
    this.setAngle(Math.sin(this.scene.time.now / 700) * 2);
  }
}
