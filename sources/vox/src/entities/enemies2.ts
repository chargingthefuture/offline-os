// The Spectervox enemies — slander, denial, recording, accusation, the name-check flinch.
// Same rule as world 1: the tactic is the enemy, drawn as a cartoon, built to be flattened.

import Phaser from 'phaser';
import { cue } from '../systems/sound';
import { Enemy } from './enemies';
import type { Player } from './Player';

/** What world 2 enemies may ask of their scene. */
export interface World2Host {
  /** Throw a lie-bubble from (x, y) toward (tx, ty). */
  spawnLie(x: number, y: number, tx: number, ty: number): void;
  /** The clerk rang the bell — a Slanderer answers it. */
  clerkAlarm(x: number): void;
}

/** #2 Workplace turn — the coworker who suddenly flings lies. Keeps its distance and
 * lobs speech-bubbles; deflect them back to shut it up faster. */
export class Slanderer extends Enemy {
  private host: World2Host;
  private throwTimer = 1400;

  constructor(scene: Phaser.Scene, host: World2Host, x: number, y: number) {
    super(scene, x, y, 'vox-slanderer', 2, 2);
    this.host = host;
    this.setSize(24, 30).setOffset(4, 4);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    const dx = player.x - this.x;
    const inRange = Math.abs(dx) < 480 && Math.abs(player.y - this.y) < 160;
    this.setFlipX(dx < 0);

    // A gossip, not a fighter: backs off when you close in
    if (inRange && Math.abs(dx) < 170) this.setVelocityX(-Math.sign(dx) * 70);
    else this.setVelocityX(0);

    this.throwTimer -= dtMs;
    if (inRange && this.throwTimer <= 0) {
      this.throwTimer = 2300;
      const mouthX = this.x + Math.sign(dx) * 14;
      this.host.spawnLie(mouthX, this.y - 8, player.x, player.y - 8);
    }
  }
}

/** #18 Unfair denials — a stamping gate. Deals no contact damage; blocks the path and
 * slams a DENIED stamp when you linger in front. Break it to get your yes. */
export class Gatekeeper extends Enemy {
  private stampTimer = 1000;
  private stamping = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-gatekeeper', 5, 18);
    this.touchDamage = 0;
    this.setSize(44, 48).setOffset(2, 3);
    this.setImmovable(true);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    this.setVelocityX(0);
    this.stampTimer -= dtMs;
    const dx = player.x - this.x;
    const near = Math.abs(dx) < 84 && Math.abs(player.y - this.y) < 50;
    if (near && this.stampTimer <= 0 && !this.stamping) {
      this.stamping = true;
      // Telegraph: winds up tall, then slams. Steady motion, no flash.
      this.scene.tweens.add({
        targets: this,
        scaleY: 1.14,
        duration: 380,
        yoyo: true,
        ease: 'Sine.easeInOut',
        onYoyo: () => {
          if (this.defeated || !this.active) return;
          const pdx = player.x - this.x;
          if (Math.abs(pdx) < 76 && Math.abs(player.y - this.y) < 54) this.requestPlayerHit();
        },
        onComplete: () => {
          this.stamping = false;
          this.stampTimer = 1700;
        },
      });
    }
  }
}

/** #30 Recorded baiting — a hovering mic that trails you and drops loaded questions. */
export class Recorder extends Enemy {
  private host: World2Host;
  private throwTimer = 2000;
  private readonly hoverY: number;

  constructor(scene: Phaser.Scene, host: World2Host, x: number, y: number) {
    super(scene, x, y, 'vox-recorder', 2, 30);
    this.host = host;
    this.hoverY = y;
    this.setSize(26, 22).setOffset(3, 3);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    const dx = player.x - this.x;
    // Trails VOX like a boom mic that thinks it is subtle
    if (Math.abs(dx) < 420) this.setVelocityX(Phaser.Math.Clamp(dx * 0.6, -90, 90));
    else this.setVelocityX(0);
    this.y = this.hoverY + Math.sin(this.scene.time.now / 450) * 6;
    this.setFlipX(dx < 0);

    this.throwTimer -= dtMs;
    if (Math.abs(dx) < 340 && this.throwTimer <= 0) {
      this.throwTimer = 2600;
      this.host.spawnLie(this.x, this.y + 10, player.x, player.y - 6);
    }
  }
}

/** #31 False accusation — points, then lunges. After the lunge it is winded and wide open,
 * because accusations with nothing behind them always are. */
export class Accuser extends Enemy {
  private aiState: 'patrol' | 'telegraph' | 'dash' | 'winded' = 'patrol';
  private stateTimer = 0;
  private patrolDir: 1 | -1 = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-accuser', 3, 31);
    this.setSize(24, 34).setOffset(4, 3);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    this.stateTimer -= dtMs;
    const dx = player.x - this.x;

    switch (this.aiState) {
      case 'patrol':
        this.setVelocityX(this.patrolDir * 40);
        this.setFlipX(this.patrolDir < 0);
        if (this.stateTimer <= 0) {
          this.stateTimer = 1500;
          this.patrolDir = this.patrolDir === 1 ? -1 : 1;
        }
        if (Math.abs(dx) < 260 && Math.abs(player.y - this.y) < 60) {
          this.aiState = 'telegraph';
          this.stateTimer = 480;
          this.setVelocityX(0);
          this.setFlipX(dx < 0);
          // The accusatory lean — readable wind-up, no flash
          this.scene.tweens.add({ targets: this, angle: dx < 0 ? -10 : 10, duration: 420 });
        }
        break;
      case 'telegraph':
        if (this.stateTimer <= 0) {
          this.aiState = 'dash';
          this.stateTimer = 480;
          this.setAngle(0);
          this.setVelocityX(Math.sign(dx || 1) * 330);
        }
        break;
      case 'dash':
        if (this.stateTimer <= 0) {
          this.aiState = 'winded';
          this.stateTimer = 950;
          this.setVelocityX(0);
        }
        break;
      case 'winded':
        // Bent over, catching its breath — free hit window
        if (this.stateTimer <= 0) this.aiState = 'patrol';
        break;
    }
  }
}

/** #38 Name flinch — a check-in desk that dings the moment it reads your name, and a
 * Slanderer comes running. One hit shuts the bell up for good. */
export class Clerk extends Enemy {
  private host: World2Host;
  private rang = false;

  constructor(scene: Phaser.Scene, host: World2Host, x: number, y: number) {
    super(scene, x, y, 'vox-clerk', 1, 38);
    this.host = host;
    this.touchDamage = 0;
    this.setSize(32, 26).setOffset(2, 4);
    this.setImmovable(true);
  }

  updateEnemy(_dtMs: number, player: Player): void {
    if (this.defeated || this.rang) return;
    if (Math.abs(player.x - this.x) < 220 && Math.abs(player.y - this.y) < 90) {
      this.rang = true;
      cue('alarm');
      this.scene.tweens.add({ targets: this, y: this.y - 6, duration: 90, yoyo: true, repeat: 2 });
      this.host.clerkAlarm(this.x);
    }
  }
}
