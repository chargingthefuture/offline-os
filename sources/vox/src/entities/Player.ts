// VOX — the player. Tight movement (coyote time + jump buffer), a three-hit melee combo
// with a lunging finisher, and forgiving hurt rules (long invulnerability, no humiliation).

import Phaser from 'phaser';
import type { ActionInput } from '../systems/input';
import { cue } from '../systems/sound';
import { ensureAnims } from '../systems/textures';

export const PLAYER_MAX_HP = 5;

const MOVE_SPEED = 250;
// Apex = JUMP_VELOCITY² / (2 × world gravity) = 700² / 3000 ≈ 163px. Every world's lowest
// floating platform sits 112px above the ground and the mid tier reaches 140px, so the old
// -560 (≈104px apex) left every platform in the game unreachable. Keep this above ~150.
const JUMP_VELOCITY = -700;
const COYOTE_MS = 110;
const JUMP_BUFFER_MS = 130;
const ATTACK_MS = [200, 200, 280]; // per combo step; the finisher lingers
const CHAIN_WINDOW_MS = 340;
const INVULN_MS = 1100;

export interface AttackBox {
  rect: Phaser.Geom.Rectangle;
  damage: number;
  finisher: boolean;
  /** Increments per swing so each swing hits an enemy once. */
  swingId: number;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp = PLAYER_MAX_HP;
  facing: 1 | -1 = 1;
  /** Movement multiplier for slow-fields (e.g. the World 4 noise emitter). Reset each frame
   * by the scene; hazards lower it while you are inside them. */
  slowFactor = 1;
  private coyote = 0;
  private jumpBuffer = 0;
  private comboStep = 0; // 0 = idle, 1..3 = current swing
  private attackTimer = 0;
  private chainTimer = 0;
  private invuln = 0;
  private swingCounter = 0;
  /** How long the hurt pose stays up after a hit, independent of full invulnerability. */
  private hurtDisplay = 0;

  /** Animation currently driven onto the sprite; lets us restart attacks deliberately. */
  private animState = '';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vox-player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    ensureAnims(scene);
    this.setSize(22, 36).setOffset(5, 3);
    this.setCollideWorldBounds(true);
    this.setDepth(10);
    this.play('vox-idle');
    this.animState = 'vox-idle';
  }

  /** Pick and play the animation that matches the current state, without restarting
   * a looping clip that is already running. Attacks and hurt are handled separately
   * because they must restart on the exact frame the action begins. */
  private setAnim(state: string): void {
    if (this.animState === state) return;
    this.animState = state;
    this.play(state, true);
  }

  get invulnerable(): boolean {
    return this.invuln > 0;
  }

  attackBox(): AttackBox | null {
    if (this.comboStep === 0 || this.attackTimer <= 0) return null;
    const finisher = this.comboStep === 3;
    const w = finisher ? 56 : 44;
    const h = 42;
    const x = this.facing === 1 ? this.x + 6 : this.x - 6 - w;
    return {
      rect: new Phaser.Geom.Rectangle(x, this.y - h / 2, w, h),
      damage: finisher ? 2 : 1,
      finisher,
      swingId: this.swingCounter,
    };
  }

  updatePlayer(dtMs: number, input: ActionInput): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down;

    this.coyote = grounded ? COYOTE_MS : Math.max(0, this.coyote - dtMs);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dtMs);
    this.invuln = Math.max(0, this.invuln - dtMs);
    this.hurtDisplay = Math.max(0, this.hurtDisplay - dtMs);
    if (this.invuln <= 0) this.setAlpha(1);

    // Horizontal movement (attacks lunge; otherwise direct control)
    const attacking = this.attackTimer > 0;
    if (!attacking) {
      let vx = 0;
      if (input.isDown('left')) vx -= MOVE_SPEED;
      if (input.isDown('right')) vx += MOVE_SPEED;
      this.setVelocityX(vx * this.slowFactor);
      if (vx !== 0) {
        this.facing = vx > 0 ? 1 : -1;
        this.setFlipX(this.facing === -1);
      }
    }

    // Jump (buffered + coyote)
    if (input.justPressed('jump')) this.jumpBuffer = JUMP_BUFFER_MS;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.setVelocityY(JUMP_VELOCITY);
      this.jumpBuffer = 0;
      this.coyote = 0;
      cue('jump');
    }
    // Short hop: releasing jump early cuts the rise
    if (!input.isDown('jump') && body.velocity.y < -200) this.setVelocityY(-200);

    // Combo attack
    if (this.attackTimer > 0) {
      this.attackTimer -= dtMs;
      if (this.attackTimer <= 0) {
        this.chainTimer = CHAIN_WINDOW_MS;
        this.setScale(1);
      }
    } else if (this.chainTimer > 0) {
      this.chainTimer -= dtMs;
      if (this.chainTimer <= 0) this.comboStep = 0;
    }

    if (input.justPressed('attack') && this.attackTimer <= 0) {
      this.comboStep = this.chainTimer > 0 && this.comboStep < 3 ? this.comboStep + 1 : 1;
      this.attackTimer = ATTACK_MS[this.comboStep - 1];
      this.chainTimer = 0;
      this.swingCounter++;
      // Lunge into the swing; the finisher lunges harder
      const lunge = this.comboStep === 3 ? 320 : 180;
      this.setVelocityX(this.facing * lunge);
      // A little squash-and-stretch as swing feedback
      this.setScale(this.comboStep === 3 ? 1.15 : 1.08, 0.95);
      // Drive the matching attack pose, forcing a restart on every swing.
      const atk = `vox-atk${this.comboStep}`;
      this.play(atk, false);
      this.animState = atk;
    }

    this.updateAnim();
  }

  /** Resolve which locomotion pose to show. Attacks and hurt own the sprite while
   * their timers run and are set at the moment they trigger; everything else falls
   * through to jump / fall / run / idle. */
  private updateAnim(): void {
    if (this.attackTimer > 0) return; // attack pose is playing
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.hurtDisplay > 0) {
      this.setAnim('vox-hurt');
      return;
    }
    if (!body.blocked.down) {
      this.setAnim(body.velocity.y < 20 ? 'vox-jump' : 'vox-fall');
      return;
    }
    this.setAnim(Math.abs(body.velocity.x) > 12 ? 'vox-run' : 'vox-idle');
  }

  /** Apply damage from a source at sourceX. Returns false if invulnerable. */
  takeHit(sourceX: number): boolean {
    if (this.invuln > 0) return false;
    this.hp = Math.max(0, this.hp - 1);
    this.invuln = INVULN_MS;
    this.hurtDisplay = 360;
    const away = this.x >= sourceX ? 1 : -1;
    this.setVelocity(away * 280, -220);
    this.setAlpha(0.5);
    // Face the blow and snap to the recoil pose immediately.
    this.facing = away === 1 ? -1 : 1;
    this.setFlipX(this.facing === -1);
    this.play('vox-hurt', true);
    this.animState = 'vox-hurt';
    cue('hurt');
    return true;
  }

  refill(): void {
    this.hp = PLAYER_MAX_HP;
    this.invuln = INVULN_MS;
  }
}
