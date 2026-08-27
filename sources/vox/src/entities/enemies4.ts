// The Specterrealm enemies — the surveilled neighborhood. Twelve tactics, drawn as the
// props of a watched street: parked-car watchers, fake neighbors, antennas, drones,
// peekers, revolving doors, strange window-lights, the humming emitter, light-flashes, a
// pet-sensed prowler, doorstep lurkers, and a commanded bark-speaker. Every one is a
// cartoon to be flattened; the tactic is always the enemy.

import Phaser from 'phaser';
import { cue } from '../systems/sound';
import { pal } from '../systems/palette';
import { Enemy } from './enemies';
import type { Player } from './Player';

/** What world 4 enemies may ask of their scene. */
export interface World4Host {
  /** A bark-speaker or revolving door calls a Lurker over. */
  callLurker(x: number): void;
  /** A revolving door lets a harmless passer-by drift across. */
  spawnPasserby(x: number, dir: number): void;
}

/** A stationary surveillance prop: no contact damage, a soft pulse, smash it for its card.
 * Antennas, strange window-lights, parked cars, fake neighbors — the street's dead props. */
export class RealmNode extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number, key: string, hp: number, problemId: number) {
    super(scene, x, y, key, hp, problemId);
    this.touchDamage = 0;
    this.setImmovable(true);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
  }

  updateEnemy(_dtMs: number, _player: Player): void {
    if (this.defeated) return;
    // A slow breathing pulse so it reads as "watching", never a strobe
    this.setScale(1 + Math.sin(this.scene.time.now / 600 + this.x) * 0.03);
  }
}

/** #3 Parked-car watcher — sits outside your home. */
export class ParkedCar extends RealmNode {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-car', 3, 3);
    this.setSize(48, 26).setOffset(2, 4);
  }
}

/** #5 Fake new-neighbor — moved in overnight, never actually home. Stands and stares. */
export class NewNeighbor extends RealmNode {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-neighbor', 2, 5);
    this.setSize(22, 34).setOffset(3, 3);
  }
}

/** #6 New antenna — installed around your home last week. */
export class Antenna extends RealmNode {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-antenna', 2, 6);
    this.setSize(20, 48).setOffset(6, 4);
  }
}

/** #12 Strange window-light — the neighbors' odd-colored glow at night. */
export class WindowLight extends RealmNode {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-window', 2, 12);
    this.setSize(30, 30).setOffset(3, 3);
  }
}

/** #32 Light-flashes — strange flashes wherever you go. A steady glow, not a strobe
 * (reduced-motion safe by construction). */
export class Flasher extends RealmNode {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-flash', 2, 32);
    this.setSize(26, 26).setOffset(3, 3);
  }
}

/** #7 Drone — hovers around you and your home. Tracks in the air; contact stings. */
export class Drone extends Enemy {
  private readonly baseY: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-drone', 2, 7);
    this.baseY = y;
    this.setSize(30, 16).setOffset(1, 4);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
  }

  updateEnemy(_dtMs: number, player: Player): void {
    if (this.defeated) return;
    const dx = player.x - this.x;
    if (Math.abs(dx) < 460) this.setVelocityX(Phaser.Math.Clamp(dx, -110, 110));
    else this.setVelocityX(0);
    this.y = this.baseY + Math.sin(this.scene.time.now / 300) * 8;
    this.setFlipX(dx < 0);
  }
}

/** #10 Peeking neighbor — comes out when you're around, ducks back when you get close.
 * Always hittable; just runs from you, so corner it. */
export class PeekNeighbor extends Enemy {
  private readonly homeX: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-neighbor', 2, 10);
    this.homeX = x;
    this.setSize(22, 34).setOffset(3, 3);
  }

  updateEnemy(_dtMs: number, player: Player): void {
    if (this.defeated) return;
    const dx = player.x - this.x;
    if (Math.abs(dx) < 120) {
      // Too close — duck back toward the doorway
      this.setVelocityX(Math.sign(this.homeX - this.x || 1) * 60);
    } else if (Math.abs(dx) < 340) {
      // Out watching — sidle a little toward you, the nosy way
      this.setVelocityX(Math.sign(dx) * 24);
    } else {
      this.setVelocityX(0);
    }
    this.setFlipX(dx < 0);
  }
}

/** #46 Doorstep lurker — turns up in the neighborhood where they never were. Patrols a
 * beat; contact stings. */
export class Lurker extends Enemy {
  private dir: 1 | -1;
  private readonly homeX: number;
  private readonly range: number;

  constructor(scene: Phaser.Scene, x: number, y: number, dir: 1 | -1 = 1, range = 120) {
    super(scene, x, y, 'vox-lurker', 3, 46);
    this.dir = dir;
    this.homeX = x;
    this.range = range;
    this.setSize(22, 34).setOffset(3, 3);
  }

  updateEnemy(_dtMs: number, _player: Player): void {
    if (this.defeated) return;
    if (this.x > this.homeX + this.range) this.dir = -1;
    else if (this.x < this.homeX - this.range) this.dir = 1;
    this.setVelocityX(this.dir * 55);
    this.setFlipX(this.dir < 0);
  }
}

/** #36 Pet-sensed prowler — invisible until your pet's instinct catches it. Faint at range,
 * it sharpens into view (and into range of your fist) as you approach. */
export class Prowler extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-prowler', 2, 36);
    this.setSize(24, 32).setOffset(4, 4);
    this.setAlpha(0.2);
  }

  updateEnemy(_dtMs: number, player: Player): void {
    if (this.defeated) return;
    const dist = Math.abs(player.x - this.x);
    // Your pet feels it before you see it: closer = clearer
    const clarity = Phaser.Math.Clamp(1 - (dist - 60) / 320, 0.2, 1);
    this.setAlpha(clarity);
    // Only creeps toward you once it has been sensed (clarity high)
    if (clarity > 0.6) {
      this.setVelocityX(Math.sign(player.x - this.x) * 40);
      this.setFlipX(player.x < this.x);
    } else {
      this.setVelocityX(0);
    }
  }
}

/** #22 Humming emitter — the buzz you can't place. Slows VOX while you stand in its field;
 * smash it and the drone stops. */
export class Hummer extends Enemy {
  private readonly fieldR = 150;
  private ring: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-hummer', 4, 22);
    this.touchDamage = 0;
    this.setImmovable(true);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setSize(28, 40).setOffset(2, 4);
    this.ring = scene.add.circle(x, y, this.fieldR, pal().projectile, 0.05).setDepth(1);
    this.ring.setStrokeStyle(1.5, pal().projectile, 0.25);
  }

  updateEnemy(_dtMs: number, player: Player): void {
    if (this.defeated) return;
    // Gentle steady pulse of the field — audible-looking, never flashing
    const t = 0.05 + Math.sin(this.scene.time.now / 500) * 0.02;
    this.ring.setFillStyle(pal().projectile, t);
    if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < this.fieldR) {
      player.slowFactor = Math.min(player.slowFactor, 0.45);
    }
  }

  protected override defeat(): void {
    this.ring.destroy();
    super.defeat();
  }
}

/** #11 Revolving door — the neighbors' house that people endlessly come and go from. Lets
 * a harmless passer-by drift out now and then; smash the door to end the parade. */
export class RevolvingDoor extends Enemy {
  private host: World4Host;
  private spawnTimer = 1600;

  constructor(scene: Phaser.Scene, host: World4Host, x: number, y: number) {
    super(scene, x, y, 'vox-door', 4, 11);
    this.host = host;
    this.touchDamage = 0;
    this.setImmovable(true);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setSize(34, 48).setOffset(3, 4);
  }

  updateEnemy(dtMs: number, player: Player): void {
    if (this.defeated) return;
    this.spawnTimer -= dtMs;
    if (this.spawnTimer <= 0 && Math.abs(player.x - this.x) < 620) {
      this.spawnTimer = 2600;
      this.host.spawnPasserby(this.x, player.x < this.x ? -1 : 1);
    }
  }
}

/** A harmless passer-by from the revolving door — comes and goes, never hurts you, cannot
 * be hit (it is not the tactic; the door is). Drifts across and leaves. */
export class Passerby extends Phaser.Physics.Arcade.Sprite {
  private life = 4000;

  constructor(scene: Phaser.Scene, x: number, y: number, dir: number) {
    super(scene, x, y, 'vox-neighbor');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setDepth(4).setAlpha(0.7).setScale(0.9);
    this.setVelocityX(dir * 50);
    this.setFlipX(dir < 0);
  }

  tick(dtMs: number): void {
    this.life -= dtMs;
    if (this.life <= 0) this.destroy();
  }
}

/** #50 Commanded bark — a loud-hailer rigged to set dogs off. (A speaker, not an animal:
 * the tactic is the command, not the dog.) Barks when you near it and calls a Lurker; one
 * hit cuts the signal. */
export class BarkSpeaker extends Enemy {
  private host: World4Host;
  private barked = false;

  constructor(scene: Phaser.Scene, host: World4Host, x: number, y: number) {
    super(scene, x, y, 'vox-bark', 1, 50);
    this.host = host;
    this.touchDamage = 0;
    this.setImmovable(true);
    (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    this.setSize(28, 24).setOffset(2, 4);
  }

  updateEnemy(_dtMs: number, player: Player): void {
    if (this.defeated || this.barked) return;
    if (Math.abs(player.x - this.x) < 180 && Math.abs(player.y - this.y) < 100) {
      this.barked = true;
      cue('alarm');
      this.scene.tweens.add({ targets: this, scaleX: 1.2, duration: 90, yoyo: true, repeat: 2 });
      this.host.callLurker(this.x);
    }
  }
}
