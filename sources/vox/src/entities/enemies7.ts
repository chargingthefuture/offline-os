// The Recruiters enemies — entrapment, fake friends, occult secrecy. Pushy newcomers, the
// people who know too much, the lodge, baiters, propositions, secret-keepers, fake friends,
// and forced family. Every one is a cartoon of a trap, built to be flattened.

import Phaser from 'phaser';
import { Enemy } from './enemies';
import type { Player } from './Player';

/** What world 7 enemies may ask of their scene. */
export interface World7Host {
  /** A baiter sets a tempting lure on the ground — touch it and it bites. */
  dropLure(x: number): void;
}

/** #14 Pushy newcomer — rushes in hard to be your friend and clings, dragging you slow
 * until you shake it off. No damage, just smothering. */
export class PushyNewcomer extends Enemy {
  private readonly fieldR = 90;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-pushy', 3, 14);
    this.touchDamage = 0;
    this.setSize(24, 34).setOffset(4, 4);
  }

  updateEnemy(_dtMs: number, player: Player): void {
    if (this.defeated) return;
    const dx = player.x - this.x;
    this.setVelocityX(Math.sign(dx) * 120); // always crowding in
    this.setFlipX(dx < 0);
    if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < this.fieldR) {
      player.slowFactor = Math.min(player.slowFactor, 0.55);
    }
  }
}

/** #15 Knows too much — dashes to where you are about to be, not where you are. Anticipate
 * back: it overshoots and is open after each read. */
export class Knower extends Enemy {
  private st: 'read' | 'dash' | 'open' = 'read';
  private stateTimer = 900;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-knower', 2, 15);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setSize(24, 28).setOffset(4, 4);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    this.stateTimer -= dtMs;
    const pv = (player.body as Phaser.Physics.Arcade.Body).velocity.x;
    switch (this.st) {
      case 'read':
        this.setVelocity(0, 0);
        this.setFlipX(player.x < this.x);
        if (this.stateTimer <= 0) {
          this.st = 'dash';
          this.stateTimer = 520;
          // Aim ahead of the player, where they're headed
          const lead = player.x + Math.sign(pv || 1) * 140;
          this.scene.tweens.add({ targets: this, x: lead, y: player.y, duration: 500, ease: 'Cubic.easeIn' });
        }
        break;
      case 'dash':
        if (this.stateTimer <= 0) { this.st = 'open'; this.stateTimer = 700; }
        break;
      case 'open':
        if (this.stateTimer <= 0) { this.st = 'read'; this.stateTimer = 1000; }
        break;
    }
  }
}

/** #19 The lodge — a members-only hall with an all-seeing symbol. A static prop; smash it. */
export class Lodge extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-lodge', 4, 19);
    this.touchDamage = 0;
    this.setImmovable(true);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setSize(48, 44).setOffset(2, 4);
  }

  updateEnemy(_dtMs: number, _player: Player): void {
    if (this.defeated) return;
    this.setScale(1 + Math.sin(this.scene.time.now / 700) * 0.02);
  }
}

/** #25 Baiter — dangles a tempting lure to entrap you. Don't take the bait: the lures it
 * drops bite. Smash the baiter to stop the offers. */
export class Baiter extends Enemy {
  private host: World7Host;
  private dropTimer = 1500;

  constructor(scene: Phaser.Scene, host: World7Host, x: number, y: number) {
    super(scene, x, y, 'vox-baiter', 3, 25);
    this.host = host;
    this.setSize(24, 34).setOffset(4, 4);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    const dx = player.x - this.x;
    this.setVelocityX(0);
    this.setFlipX(dx < 0);
    this.dropTimer -= dtMs;
    if (Math.abs(dx) < 360 && this.dropTimer <= 0) {
      this.dropTimer = 2400;
      this.host.dropLure(this.x + Math.sign(dx) * 60);
    }
  }
}

/** #26 Proposition — a stranger who forces themselves at you. Lunges when near, then is
 * open. Abstract and cartoonish; VOX flattens it. */
export class Proposition extends Enemy {
  private st: 'idle' | 'lunge' | 'spent' = 'idle';
  private stateTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-proposition', 3, 26);
    this.setSize(24, 34).setOffset(4, 3);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    this.stateTimer -= dtMs;
    const dx = player.x - this.x;
    switch (this.st) {
      case 'idle':
        this.setVelocityX(Math.sign(dx) * 40);
        this.setFlipX(dx < 0);
        if (Math.abs(dx) < 150 && Math.abs(player.y - this.y) < 54) {
          this.st = 'lunge'; this.stateTimer = 360; this.setVelocityX(Math.sign(dx || 1) * 300);
        }
        break;
      case 'lunge':
        if (this.stateTimer <= 0) { this.st = 'spent'; this.stateTimer = 800; this.setVelocityX(0); }
        break;
      case 'spent':
        if (this.stateTimer <= 0) this.st = 'idle';
        break;
    }
  }
}

/** #33 Everyone keeps a secret — armored while it clams up, but the secret slips out on a
 * timer, and only then can you land a hit. */
export class SecretKeeper extends Enemy {
  private leaking = false;
  private leakTimer = 2000;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-secret', 2, 33);
    this.setSize(24, 34).setOffset(4, 4);
  }

  override hit(damage: number, dir: 1 | -1, finisher: boolean): void {
    if (!this.leaking) {
      // Clammed up — the hit glances off; a tiny shake to show it is guarded
      this.scene.tweens.add({ targets: this, angle: dir * 6, duration: 60, yoyo: true });
      return;
    }
    super.hit(damage, dir, finisher);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    this.leakTimer -= dtMs;
    if (this.leakTimer <= 0) {
      this.leaking = !this.leaking;
      this.leakTimer = this.leaking ? 1200 : 2000;
      // Clammed up reads dimmer; the secret slipping out brightens it (the hittable window)
      this.setAlpha(this.leaking ? 1 : 0.6);
    }
    const dx = player.x - this.x;
    this.setVelocityX(Math.sign(dx) * (this.leaking ? 30 : 55));
    this.setFlipX(dx < 0);
  }
}

/** #37 Fake friend — approaches wearing a friendly face (VOX's own colors), then drops the
 * act and lunges once close. */
export class FakeFriend extends Enemy {
  private revealed = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-fakefriend', 3, 37);
    this.touchDamage = 0; // harmless-looking until it reveals
    this.setSize(24, 36).setOffset(4, 3);
  }

  updateEnemy(_dtMs: number, player: Player): void {
    if (this.defeated) return;
    const dx = player.x - this.x;
    this.setFlipX(dx < 0);
    if (!this.revealed) {
      this.setVelocityX(Math.sign(dx) * 55); // sidles up all friendly
      if (Math.abs(dx) < 90) {
        this.revealed = true;
        this.touchDamage = 1;
        this.setTexture('vox-fakefriend-real');
      }
    } else {
      this.setVelocityX(Math.sign(dx) * 150); // drops the act and chases
    }
  }
}

/** #49 Forced family — barges into your space and shoves, over and over. No damage, just
 * forceful; smash it to get your room back. */
export class ForcedFamily extends Enemy {
  private shoveTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-family', 4, 49);
    this.touchDamage = 0;
    this.setSize(26, 36).setOffset(3, 3);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    const dx = player.x - this.x;
    this.setVelocityX(Math.sign(dx) * 70);
    this.setFlipX(dx < 0);
    this.shoveTimer -= dtMs;
    if (Math.abs(dx) < 56 && Math.abs(player.y - this.y) < 44 && this.shoveTimer <= 0) {
      this.shoveTimer = 800;
      player.setVelocityX(Math.sign(dx || 1) * 240);
      this.scene.tweens.add({ targets: this, scaleX: 1.15, duration: 90, yoyo: true });
    }
  }
}
