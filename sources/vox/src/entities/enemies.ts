// The Specterwave enemies. Each one is a cartoon stand-in for a real tactic (its problemId)
// and exists to be flattened. The tactic is always the enemy; VOX is never the victim.

import Phaser from 'phaser';
import { EVENTS } from '../systems/events';
import { pal } from '../systems/palette';
import { cue } from '../systems/sound';
import type { Player } from './Player';

export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  readonly problemId: number;
  /** Hearts of contact damage (0 = safe to touch). */
  touchDamage = 1;
  defeated = false;

  constructor(scene: Phaser.Scene, x: number, y: number, key: string, hp: number, problemId: number) {
    super(scene, x, y, key);
    this.hp = hp;
    this.problemId = problemId;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(5);
  }

  /** Take a hit from VOX. dir is the knockback direction (+1 right). */
  hit(damage: number, dir: 1 | -1, finisher: boolean): void {
    if (this.defeated) return;
    this.hp -= damage;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => {
      if (this.active) this.clearTint();
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body.immovable) {
      this.setVelocityX(dir * (finisher ? 260 : 140));
      if (!finisher) this.setVelocityY(-80);
    }
    if (this.hp <= 0) this.defeat();
  }

  protected defeat(): void {
    if (this.defeated) return;
    this.defeated = true;
    cue('defeat');
    this.scene.game.events.emit(EVENTS.problemDefeated, this.problemId, this.x, this.y);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.scene.tweens.add({
      targets: this,
      scale: 0.1,
      angle: this.flipX ? -180 : 180,
      alpha: 0,
      duration: 320,
      ease: 'Back.easeIn',
      onComplete: () => this.destroy(),
    });
  }

  /** Ask the scene to damage the player (it applies invulnerability rules). */
  protected requestPlayerHit(): void {
    this.scene.game.events.emit(EVENTS.playerHit, this.x);
  }

  abstract updateEnemy(dtMs: number, player: Player): void;
}

/** #1 Phone crowding — shuffles into your personal space, phone first. */
export class Crowder extends Enemy {
  private wanderDir: 1 | -1 = 1;
  private wanderTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-crowder', 2, 1);
    this.setSize(22, 30).setOffset(5, 4);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    const dx = player.x - this.x;
    if (Math.abs(dx) < 300 && Math.abs(player.y - this.y) < 120) {
      // Personal-space invasion mode: walk straight at VOX
      this.setVelocityX(Math.sign(dx) * 80);
      this.setFlipX(dx < 0);
    } else {
      this.wanderTimer -= dtMs;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 1200 + Math.random() * 1400;
        this.wanderDir = Math.random() < 0.5 ? -1 : 1;
      }
      this.setVelocityX(this.wanderDir * 30);
      this.setFlipX(this.wanderDir < 0);
    }
  }
}

/** #4 Path blocking — a smug wall. Deals no damage; it is simply In The Way until broken. */
export class Blocker extends Enemy {
  private shoveTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-blocker', 4, 4);
    this.touchDamage = 0;
    this.setSize(44, 44).setOffset(2, 3);
    this.setImmovable(true);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = true;
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    this.setVelocityX(0);
    // Standing right next to it for a while earns a gentle shove — annoying, not harmful.
    this.shoveTimer -= dtMs;
    const dx = player.x - this.x;
    if (Math.abs(dx) < 52 && Math.abs(player.y - this.y) < 40 && this.shoveTimer <= 0) {
      this.shoveTimer = 900;
      player.setVelocityX(Math.sign(dx || 1) * 200);
      this.scene.tweens.add({ targets: this, angle: dx < 0 ? -4 : 4, duration: 80, yoyo: true });
    }
  }
}

/** #13 Hostile staring — a floating eyeball that telegraphs a stare-beam. No strobe: the
 * telegraph is a steady dim line and the beam is a steady bright line. */
export class Starer extends Enemy {
  private beamState: 'idle' | 'telegraph' | 'fire' = 'idle';
  private stateTimer = 900;
  private beamTarget = new Phaser.Math.Vector2();
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-starer', 2, 13);
    this.setSize(26, 26).setOffset(3, 3);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setImmovable(true);
    this.gfx = scene.add.graphics().setDepth(4);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    this.stateTimer -= dtMs;
    this.gfx.clear();
    const p = pal();

    // A gentle bob so it reads as floating
    this.y += Math.sin(this.scene.time.now / 400) * 0.15;

    switch (this.beamState) {
      case 'idle': {
        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (this.stateTimer <= 0 && dist < 360) {
          this.beamState = 'telegraph';
          this.stateTimer = 650;
          this.beamTarget.set(player.x, player.y - 6);
        }
        break;
      }
      case 'telegraph': {
        // Steady dim aim line — clearly readable, never flashing
        this.gfx.lineStyle(2, p.projectile, 0.35);
        this.gfx.lineBetween(this.x, this.y, this.beamTarget.x, this.beamTarget.y);
        if (this.stateTimer <= 0) {
          this.beamState = 'fire';
          this.stateTimer = 260;
        }
        break;
      }
      case 'fire': {
        this.gfx.lineStyle(6, p.projectile, 0.85);
        this.gfx.lineBetween(this.x, this.y, this.beamTarget.x, this.beamTarget.y);
        const line = new Phaser.Geom.Line(this.x, this.y, this.beamTarget.x, this.beamTarget.y);
        const nearest = Phaser.Geom.Line.GetNearestPoint(
          line,
          new Phaser.Geom.Point(player.x, player.y),
          new Phaser.Geom.Point(),
        );
        if (Phaser.Math.Distance.Between(nearest.x, nearest.y, player.x, player.y) < 22) {
          this.requestPlayerHit();
        }
        if (this.stateTimer <= 0) {
          this.beamState = 'idle';
          this.stateTimer = 1500;
        }
        break;
      }
    }
  }

  protected override defeat(): void {
    this.gfx.destroy();
    super.defeat();
  }
}

/** #48 Mirroring — copies your movement on a short delay. Corner it to catch it. */
export class Mimic extends Enemy {
  private history: { t: number; vx: number }[] = [];
  private static readonly DELAY_MS = 550;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-mimic', 2, 48);
    this.setSize(22, 36).setOffset(5, 3);
    this.setCollideWorldBounds(true);
  }

  updateEnemy(_dtMs: number, player: Player): void {
    if (this.defeated) return;
    const now = this.scene.time.now;
    const pv = (player.body as Phaser.Physics.Arcade.Body).velocity.x;
    this.history.push({ t: now, vx: pv });
    while (this.history.length > 0 && now - this.history[0].t > Mimic.DELAY_MS + 50) {
      this.history.shift();
    }
    const past = this.history.find((h) => now - h.t >= Mimic.DELAY_MS);
    const vx = past ? past.vx * 0.9 : 0;
    this.setVelocityX(vx);
    if (vx !== 0) this.setFlipX(vx < 0);
  }
}
