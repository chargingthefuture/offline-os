// The shared world scene: player, input, combat, checkpoints, respawn, boss plumbing,
// and the safety rules that hold across every world. Each world subclasses this and
// supplies its layout, enemies, and boss.

import Phaser from 'phaser';
import type { BossBase, BossHost } from '../../entities/BossBase';
import { Enemy } from '../../entities/enemies';
import { Player, PLAYER_MAX_HP } from '../../entities/Player';
import { EVENTS } from '../../systems/events';
import { addSceneFX, cameraPunch, impactRing, makeDust, makeSparks } from '../../systems/fx';
import { sampleGamepad } from '../../systems/gamepad';
import { ActionInput } from '../../systems/input';
import { pal } from '../../systems/palette';
import { getCheckpoint, motionReduced, progress, saveProgress, setCheckpoint } from '../../systems/settings';
import { cue } from '../../systems/sound';
import { ensureTextures } from '../../systems/textures';

export const WORLD_H = 540;
export const GROUND_Y = 500;

export abstract class BaseWorldScene extends Phaser.Scene implements BossHost {
  // --- per-world configuration ------------------------------------------------
  abstract readonly worldId: number;
  abstract readonly worldName: string;
  abstract readonly worldWidth: number;
  /** Spawn + beacon x positions; index 0 is the spawn (no beacon there). */
  abstract readonly checkpointXs: number[];
  abstract readonly bossTriggerX: number;
  abstract readonly bossWallX: number;

  /** Build platforms, decor, hints, and enemies (via spawnEnemy). */
  protected abstract buildWorld(): void;
  /** Create this world's boss sprite. */
  protected abstract createBoss(): BossBase;
  /** Boss attack hook — 'wave', 'lie-fan', whatever the world's boss throws. */
  abstract bossAttack(kind: string, x: number, dir: number): void;
  /** Boss minion hook. */
  abstract bossMinion(x: number): void;

  /** World-specific per-frame work (projectiles, meters). */
  protected worldTick(_dtMs: number): void {}
  /** World-specific attack-box processing (deflection and the like). */
  protected processAttackExtras(_box: NonNullable<ReturnType<Player['attackBox']>>): void {}
  /** Extra damage on combo finishers (world buffs). */
  protected finisherBonus(): number {
    return 0;
  }

  // --- shared state -------------------------------------------------------------
  player!: Player;
  protected inputMap!: ActionInput;
  protected platforms!: Phaser.Physics.Arcade.StaticGroup;
  enemies: Enemy[] = [];
  boss: BossBase | null = null;
  protected bossStarted = false;
  protected confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  protected sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  protected dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private beacons: { sprite: Phaser.GameObjects.Image; index: number }[] = [];
  private lastSwingHit = new Map<number, Set<object>>();
  private wasGrounded = true;
  protected respawning = false;
  protected clearing = false;

  create(): void {
    ensureTextures(this);
    const p = pal();

    this.enemies = [];
    this.boss = null;
    this.bossStarted = false;
    this.respawning = false;
    this.clearing = false;
    this.lastSwingHit.clear();
    this.beacons = [];

    this.physics.world.setBounds(0, 0, this.worldWidth, WORLD_H);
    this.cameras.main.setBounds(0, 0, this.worldWidth, WORLD_H);
    this.cameras.main.setBackgroundColor(p.sky);

    this.buildBackdrop();
    this.platforms = this.physics.add.staticGroup();
    // Solid ground the whole way — no bottomless pits anywhere in VOX
    this.block(this.worldWidth / 2, GROUND_Y + 20, this.worldWidth, 40);

    const spawnIdx = Math.min(getCheckpoint(this.worldId), this.checkpointXs.length - 1);
    this.player = new Player(this, this.checkpointXs[spawnIdx], GROUND_Y - 60);
    // Zoom into the action band: the level lives in the bottom ~360px of the 540px world,
    // so an unzoomed camera shows half a screen of empty sky. Bounds clamp the zoomed view.
    this.cameras.main.setZoom(1.55);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(110, 90);

    this.inputMap = new ActionInput();
    this.inputMap.attach();

    this.physics.add.collider(this.player, this.platforms);

    this.confetti = this.add.particles(0, 0, 'vox-particle', {
      speed: { min: 90, max: 260 },
      angle: { min: 210, max: 330 },
      gravityY: 600,
      lifespan: { min: 400, max: 850 },
      scale: { start: 1, end: 0 },
      tint: p.confetti,
      emitting: false,
    });
    this.confetti.setDepth(20);
    this.sparks = makeSparks(this);
    this.dust = makeDust(this);

    // Beacons (checkpoints)
    for (let i = 1; i < this.checkpointXs.length; i++) {
      const lit = getCheckpoint(this.worldId) >= i;
      const sprite = this.add
        .image(this.checkpointXs[i], GROUND_Y - 28, lit ? 'vox-beacon-lit' : 'vox-beacon')
        .setDepth(2);
      this.beacons.push({ sprite, index: i });
    }

    this.buildWorld();

    const g = this.game.events;
    g.on(EVENTS.playerHit, this.onPlayerHitRequest, this);
    g.on(EVENTS.problemDefeated, this.onProblemDefeated, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputMap.detach();
      g.off(EVENTS.playerHit, this.onPlayerHitRequest, this);
      g.off(EVENTS.problemDefeated, this.onProblemDefeated, this);
    });

    addSceneFX(this);
    this.cameras.main.fadeIn(320, 0, 0, 0);

    this.scene.launch('ui');
    this.time.delayedCall(0, () => {
      g.emit(EVENTS.worldInfo, this.worldId, this.worldName, this.scene.key);
      g.emit(EVENTS.hp, this.player.hp, PLAYER_MAX_HP);
    });

    // Test/debug handle, only with ?debug in the URL (used by automated browser checks)
    if (new URLSearchParams(location.search).has('debug')) {
      (window as unknown as { __voxDebug: unknown }).__voxDebug = this;
    }
  }

  /** Exposed for the ?debug handle. */
  get debugBoss(): BossBase | null {
    return this.boss;
  }

  protected buildBackdrop(): void {
    const p = pal();
    this.add
      .rectangle(this.worldWidth / 2, WORLD_H / 2, this.worldWidth, WORLD_H, p.sky)
      .setDepth(-10)
      .setScrollFactor(1);
    this.add.rectangle(this.worldWidth / 2, WORLD_H - 120, this.worldWidth, 240, p.skyBottom).setDepth(-9);
    for (let x = 60; x < this.worldWidth; x += 170) {
      const h = 60 + ((x * 37) % 130);
      this.add
        .rectangle(x, GROUND_Y - h / 2 + 6, 70 + ((x * 13) % 50), h, p.ground, 0.55)
        .setDepth(-8)
        .setScrollFactor(0.4, 1);
    }
  }

  protected block(x: number, y: number, w: number, h: number): Phaser.Physics.Arcade.Sprite {
    const b = this.platforms.create(x, y, 'vox-block') as Phaser.Physics.Arcade.Sprite;
    b.setScale(w / 32, h / 32).refreshBody();
    return b;
  }

  protected hint(x: number, text: string): void {
    this.add
      .text(x, 300, text, { fontFamily: 'monospace', fontSize: '15px', color: pal().uiDim, align: 'center' })
      .setOrigin(0.5)
      .setDepth(-5);
  }

  /** Register an enemy: physics colliders + the update list. */
  protected spawnEnemy<T extends Enemy>(e: T): T {
    this.enemies.push(e);
    this.physics.add.collider(e, this.platforms);
    // Harmless immovable enemies (walls, desks) physically block the player
    const body = e.body as Phaser.Physics.Arcade.Body;
    if (body.immovable && e.touchDamage === 0) this.physics.add.collider(this.player, e);
    return e;
  }

  // --- boss ---------------------------------------------------------------------

  protected startBoss(): void {
    this.bossStarted = true;
    // Tall enough that the player's ~163px jump apex cannot clear it — this wall seals the
    // arena, so it has to stay well above jump height.
    const wall = this.block(this.bossWallX, GROUND_Y - 120, 24, 240);
    wall.setVisible(false);
    this.boss = this.createBoss();
    this.physics.add.overlap(this.player, this.boss, () => this.boss && this.hurtPlayer(this.boss.x));
    if (!motionReduced()) this.cameras.main.shake(180, 0.004);
  }

  onBossDown(x: number, y: number): void {
    this.confetti.explode(48, x, y);
    this.sparks.explode(24, x, y);
    impactRing(this, x, y, true);
    cameraPunch(this, this.cameras.main.zoom, 0.09, 300);
    this.boss = null;
    this.game.events.emit(EVENTS.bossHp, 0, 1, '', '');
    if (this.clearing) return;
    this.clearing = true;
    progress.worldsCleared = Array.from(new Set([...progress.worldsCleared, this.worldId]));
    setCheckpoint(this.worldId, 0);
    saveProgress();
    this.time.delayedCall(1300, () => this.game.events.emit(EVENTS.worldClear, this.worldId));
  }

  // --- event handlers -------------------------------------------------------------

  private onPlayerHitRequest(sourceX: number): void {
    this.hurtPlayer(sourceX);
  }

  protected onProblemDefeated(_pid: number, x: number, y: number): void {
    this.confetti.explode(16, x, y);
  }

  // --- combat -----------------------------------------------------------------------

  hurtPlayer(sourceX: number): void {
    if (this.respawning || this.clearing) return;
    if (!this.player.takeHit(sourceX)) return;
    this.game.events.emit(EVENTS.hp, this.player.hp, PLAYER_MAX_HP);
    if (!motionReduced()) this.cameras.main.shake(90, 0.004);
    if (this.player.hp <= 0) this.respawn();
  }

  private respawn(): void {
    this.respawning = true;
    this.game.events.emit(EVENTS.respawn);
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.time.delayedCall(420, () => {
      const idx = Math.min(getCheckpoint(this.worldId), this.checkpointXs.length - 1);
      this.player.setPosition(this.checkpointXs[idx], GROUND_Y - 60).setVelocity(0, 0);
      this.player.refill();
      this.game.events.emit(EVENTS.hp, this.player.hp, PLAYER_MAX_HP);
      // The boss does NOT heal while you were down — no punishing resets
      if (this.boss && !this.boss.defeated) this.boss.setPosition(this.bossTriggerX + 320, 400);
      this.cameras.main.fadeIn(280, 0, 0, 0);
      this.respawning = false;
    });
  }

  private processAttack(): void {
    const box = this.player.attackBox();
    if (!box) return;
    let hitSet = this.lastSwingHit.get(box.swingId);
    if (!hitSet) {
      hitSet = new Set();
      this.lastSwingHit.set(box.swingId, hitSet);
      for (const key of this.lastSwingHit.keys()) {
        if (key < box.swingId - 3) this.lastSwingHit.delete(key);
      }
    }
    const dir = this.player.facing;
    const targets: (Enemy | BossBase)[] = [...this.enemies.filter((e) => e.active && !e.defeated)];
    if (this.boss && this.boss.active && !this.boss.defeated) targets.push(this.boss);
    for (const t of targets) {
      if (hitSet.has(t)) continue;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(box.rect, t.getBounds())) continue;
      hitSet.add(t);
      const damage = box.damage + (box.finisher ? this.finisherBonus() : 0);
      t.hit(damage, dir, box.finisher);
      cue(box.finisher ? 'combo-finish' : 'hit');
      this.hitstop(box.finisher ? 70 : 45);
      // Impact juice: a spark burst and an expanding ring where the blow lands
      const hx = t.x - dir * 6;
      const hy = t.y;
      this.sparks.explode(box.finisher ? 12 : 6, hx, hy);
      impactRing(this, hx, hy, box.finisher);
      if (box.finisher && !motionReduced()) this.cameras.main.shake(70, 0.003);
    }
    this.processAttackExtras(box);
  }

  protected hitstop(ms: number): void {
    if (this.physics.world.isPaused) return;
    this.physics.pause();
    this.time.delayedCall(ms, () => this.physics.resume());
  }

  // --- main loop -----------------------------------------------------------------------

  update(_time: number, delta: number): void {
    sampleGamepad(this.game.loop.frame);
    if (this.respawning || this.clearing) {
      this.inputMap.endFrame();
      return;
    }

    // Player moves using the slow-factor that hazards set last frame; then reset it so this
    // frame's enemy updates (e.g. the noise emitter) can lower it again for next frame.
    this.player.updatePlayer(delta, this.inputMap);
    this.player.slowFactor = 1;

    // A puff of dust the moment the player lands from the air.
    const grounded = (this.player.body as Phaser.Physics.Arcade.Body).blocked.down;
    if (grounded && !this.wasGrounded) {
      this.dust.emitParticleAt(this.player.x, this.player.y + 18, 5);
    }
    this.wasGrounded = grounded;

    for (const e of this.enemies) {
      if (e.active && !e.defeated) e.updateEnemy(delta, this.player);
    }
    this.enemies = this.enemies.filter((e) => e.active);

    if (this.boss) this.boss.updateBoss(delta, this.player);

    // Contact damage
    for (const e of this.enemies) {
      if (!e.active || e.defeated || e.touchDamage <= 0) continue;
      if (this.player.invulnerable) break;
      if (Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), e.getBounds())) {
        this.hurtPlayer(e.x);
        break;
      }
    }

    this.processAttack();
    this.worldTick(delta);

    // Checkpoints
    for (const b of this.beacons) {
      if (b.index > getCheckpoint(this.worldId) && Math.abs(this.player.x - b.sprite.x) < 26) {
        setCheckpoint(this.worldId, b.index);
        b.sprite.setTexture('vox-beacon-lit');
        cue('checkpoint');
        this.game.events.emit(EVENTS.checkpoint);
      }
    }

    if (!this.bossStarted && this.player.x > this.bossTriggerX) this.startBoss();

    // Safety net — should be unreachable (solid ground), but never soft-lock
    if (this.player.y > WORLD_H + 40) {
      const idx = Math.min(getCheckpoint(this.worldId), this.checkpointXs.length - 1);
      this.player.setPosition(this.checkpointXs[idx], GROUND_Y - 60).setVelocity(0, 0);
    }

    this.inputMap.endFrame();
  }
}
