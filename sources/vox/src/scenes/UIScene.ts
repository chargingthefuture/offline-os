// HUD + the payoff cards. Cards are the empowerment-to-action bridge: defeat a tactic,
// see the real-world tool that answers it. One line, skippable, never a sales pitch.

import Phaser from 'phaser';
import { getProblem } from '../data/problems';
import { getWorld, WORLDS } from '../data/worlds';
import { EVENTS } from '../systems/events';
import { headingStyle, textShadow } from '../systems/fx';
import { gpConfirmPressed, sampleGamepad } from '../systems/gamepad';
import { virtualPress, virtualRelease } from '../systems/input';
import { pal } from '../systems/palette';
import { progress, saveProgress, settings, motionReduced, type BindableAction } from '../systems/settings';
import { onCaption } from '../systems/sound';
import {
  addScanlines,
  drawPixelMatrix,
  drawPixelPanel,
  drawSegmentMeter,
  HEART_EMPTY,
  HEART_FULL,
  MONO_FONT,
  PIXEL_FONT,
} from '../systems/uikit';

const W = 960;
const H = 540;

export class UIScene extends Phaser.Scene {
  private hearts!: Phaser.GameObjects.Graphics;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossLabel!: Phaser.GameObjects.Text;
  private captionText!: Phaser.GameObjects.Text;
  private captionTimer: Phaser.Time.TimerEvent | null = null;
  private cardQueue: number[] = [];
  private cardShowing = false;
  private clearShown = false;
  /** Armed while a dismissable overlay (card / world clear) is up; gamepad confirm fires it. */
  private overlayDismiss: (() => void) | null = null;
  private worldLabel!: Phaser.GameObjects.Text;
  private repBar!: Phaser.GameObjects.Graphics;
  private repLabel!: Phaser.GameObjects.Text;
  /** Scene key of the world scene that launched the HUD (stop target on world clear). */
  private worldSceneKey = 'world1';

  constructor() {
    super('ui');
  }

  create(): void {
    const p = pal();
    this.clearShown = false;
    this.cardQueue = [];
    this.cardShowing = false;

    // HP as blocky pixel hearts, drawn per-pixel from the spec matrices.
    this.hearts = this.add.graphics().setDepth(100);

    // Chrome labels use the pixel font; small size keeps them crisp and unobtrusive.
    this.worldLabel = textShadow(
      this.add
        .text(W / 2, 12, '', {
          fontFamily: PIXEL_FONT,
          fontSize: '10px',
          color: p.uiDim,
        })
        .setOrigin(0.5, 0)
        .setDepth(100),
    );

    this.repBar = this.add.graphics().setDepth(100);
    this.repLabel = this.add
      .text(16, 40, '', { fontFamily: PIXEL_FONT, fontSize: '8px', color: p.uiDim })
      .setDepth(100);

    this.bossBar = this.add.graphics().setDepth(100);
    this.bossLabel = textShadow(
      this.add
        .text(W / 2, 46, '', { fontFamily: PIXEL_FONT, fontSize: '9px', color: p.uiText })
        .setOrigin(0.5, 0)
        .setDepth(100)
        .setVisible(false),
    );

    // Captions are short prose — keep them in readable monospace.
    this.captionText = textShadow(
      this.add
        .text(W - 14, H - 12, '', { fontFamily: MONO_FONT, fontSize: '14px', color: p.uiDim })
        .setOrigin(1, 1)
        .setDepth(100),
    );

    // CRT scanline overlay, gated off for calm mode / reduced motion.
    addScanlines(this, settings.calmMode || motionReduced());

    onCaption((text) => this.showCaption(text));

    if (this.sys.game.device.input.touch) this.buildTouchControls();

    const g = this.game.events;
    g.on(EVENTS.hp, this.onHp, this);
    g.on(EVENTS.problemDefeated, this.onProblemDefeated, this);
    g.on(EVENTS.bossHp, this.onBossHp, this);
    g.on(EVENTS.worldClear, this.onWorldClear, this);
    g.on(EVENTS.respawn, this.onRespawn, this);
    g.on(EVENTS.worldInfo, this.onWorldInfo, this);
    g.on(EVENTS.reputation, this.onReputation, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      onCaption(() => undefined);
      g.off(EVENTS.hp, this.onHp, this);
      g.off(EVENTS.problemDefeated, this.onProblemDefeated, this);
      g.off(EVENTS.bossHp, this.onBossHp, this);
      g.off(EVENTS.worldClear, this.onWorldClear, this);
      g.off(EVENTS.respawn, this.onRespawn, this);
      g.off(EVENTS.worldInfo, this.onWorldInfo, this);
      g.off(EVENTS.reputation, this.onReputation, this);
    });
  }

  private onWorldInfo(_worldId: number, name: string, sceneKey: string): void {
    this.worldLabel.setText(name);
    this.worldSceneKey = sceneKey;
  }

  private onReputation(value: number): void {
    const p = pal();
    this.repBar.clear();
    this.repLabel.setText('VOICE');
    // 10 hard-edged segments; lit count tracks the value. No gradient, no rounded corners.
    const count = 10;
    const filled = Math.round((value / 100) * count);
    drawSegmentMeter(this.repBar, 18, 54, {
      segW: 10,
      segH: 12,
      gap: 3,
      count,
      filled,
      lit: Phaser.Display.Color.HexStringToColor(p.uiAccent).color,
      empty: 0x2a2a4a,
      ink: p.ink,
    });
  }

  // On-screen buttons for phones/tablets: move on the left, jump + attack on the right.
  // They feed the same action-input layer as the keyboard. Styled to stay out of the way:
  // small, faint, tucked into the bottom corners — the hit zone is bigger than the drawing.
  private buildTouchControls(): void {
    const p = pal();
    // Two thumbs at once (move + jump/attack) need extra touch pointers
    this.input.addPointer(3);

    const button = (x: number, y: number, label: string, action: BindableAction): void => {
      const r = 34;
      const zone = this.add.circle(x, y, r, p.uiCard, 0.16).setDepth(95).setStrokeStyle(1.5, 0xffffff, 0.18);
      // Generous invisible hit area so smaller visuals don't mean missed presses
      zone.setInteractive(
        new Phaser.Geom.Circle(r, r, r + 18),
        Phaser.Geom.Circle.Contains as (shape: Phaser.Geom.Circle, x: number, y: number) => boolean,
      );
      this.add
        .text(x, y, label, { fontFamily: 'monospace', fontSize: '22px', color: p.uiText })
        .setOrigin(0.5)
        .setAlpha(0.45)
        .setDepth(96);
      const press = (): void => {
        zone.setFillStyle(p.uiCard, 0.45);
        virtualPress(action);
      };
      const release = (): void => {
        zone.setFillStyle(p.uiCard, 0.16);
        virtualRelease(action);
      };
      zone.on('pointerdown', press);
      zone.on('pointerup', release);
      zone.on('pointerout', release);
    };

    button(52, H - 44, '◀', 'left');
    button(140, H - 44, '▶', 'right');
    button(W - 140, H - 44, '✦', 'attack');
    button(W - 52, H - 44, '⤒', 'jump');
  }

  update(): void {
    // Gamepad confirm dismisses whatever overlay is up (cards, world clear)
    sampleGamepad(this.game.loop.frame);
    if (this.overlayDismiss && gpConfirmPressed()) {
      const fn = this.overlayDismiss;
      this.overlayDismiss = null;
      fn();
    }
  }

  private onHp(hp: number, max: number): void {
    const p = pal();
    const cell = 3; // px per heart-pixel
    const hw = 5 * cell; // heart matrix is 5 cols wide
    const gap = 8;
    this.hearts.clear();
    for (let i = 0; i < max; i++) {
      const ox = 16 + i * (hw + gap);
      const filled = i < hp;
      drawPixelMatrix(
        this.hearts,
        filled ? HEART_FULL : HEART_EMPTY,
        { X: filled ? p.hurt : 0x444466 },
        cell,
        ox,
        12,
      );
    }
  }

  private onRespawn(): void {
    this.showCaption('Knocked down, not out.');
  }

  private onBossHp(hp: number, max: number, name: string, tagline: string): void {
    const p = pal();
    this.bossLabel.setVisible(hp > 0).setText(`${name} — ${tagline}`);
    this.bossBar.clear();
    if (hp <= 0) return;
    const w = 420;
    const x0 = W / 2 - w / 2;
    const accent = Phaser.Display.Color.HexStringToColor(p.uiAccent).color;
    // Hard-edged health bar: black frame, muted track, flat red fill — no rounding, no blur.
    this.bossBar.fillStyle(p.ink, 1).fillRect(x0 - 2, 30, w + 4, 14);
    this.bossBar.fillStyle(0x2a2a4a, 1).fillRect(x0, 32, w, 10);
    this.bossBar.fillStyle(p.hurt, 1).fillRect(x0, 32, Math.max(4, w * (hp / max)), 10);
    this.bossBar.fillStyle(accent, 1).fillRect(x0, 32, Math.max(4, w * (hp / max)), 2); // cyan top edge
  }

  private showCaption(text: string): void {
    if (!settings.captions) return;
    this.captionText.setText(text).setAlpha(1);
    this.captionTimer?.remove();
    this.captionTimer = this.time.delayedCall(1400, () => this.captionText.setAlpha(0));
  }

  // --- payoff cards -----------------------------------------------------------

  private onProblemDefeated(pid: number): void {
    if (progress.cardsSeen.includes(pid)) {
      // Already explained once — just a tiny confirmation, no interruption
      this.showCaption(`${getProblem(pid).label} — down`);
      return;
    }
    this.cardQueue.push(pid);
    this.pumpCards();
  }

  private pumpCards(): void {
    if (this.cardShowing || this.cardQueue.length === 0 || this.clearShown) return;
    const pid = this.cardQueue.shift()!;
    if (progress.cardsSeen.includes(pid)) {
      this.pumpCards();
      return;
    }
    this.cardShowing = true;
    progress.cardsSeen = [...progress.cardsSeen, pid];
    saveProgress();

    const p = pal();
    const problem = getProblem(pid);
    const solutions = problem.solutions.join(' and ');
    const verb = problem.solutions.length > 1 ? 'help' : 'helps';

    const card = this.add.container(W / 2, H + 60).setDepth(110);
    const accent = Phaser.Display.Color.HexStringToColor(p.uiAccent).color;
    // Hard pixel panel: black frame, cyan ring, flat fill, offset drop-shadow.
    const bg = this.add.graphics();
    drawPixelPanel(bg, -330, -44, 660, 88, { fill: p.uiCard, ring: accent, ink: p.ink });
    card.add(bg);
    // Pixel-font kicker (short), then the payoff line in readable monospace.
    card.add(
      this.add
        .text(0, -26, `TACTIC DEFEATED — ${problem.label.toUpperCase()}`, {
          fontFamily: PIXEL_FONT,
          fontSize: '9px',
          color: p.uiAccent,
          align: 'center',
        })
        .setOrigin(0.5),
    );
    card.add(
      this.add
        .text(0, 2, `In real life: ${solutions} ${verb} with this.`, {
          fontFamily: MONO_FONT,
          fontSize: '15px',
          color: p.uiText,
        })
        .setOrigin(0.5),
    );
    card.add(
      this.add
        .text(0, 28, 'any key to dismiss', { fontFamily: MONO_FONT, fontSize: '11px', color: p.uiDim })
        .setOrigin(0.5),
    );

    this.tweens.add({ targets: card, y: H - 64, duration: 260, ease: 'Back.easeOut' });

    let done = false;
    const dismiss = (): void => {
      if (done) return;
      done = true;
      this.overlayDismiss = null;
      this.input.keyboard?.off('keydown', dismiss);
      this.input.off('pointerdown', dismiss);
      this.tweens.add({
        targets: card,
        y: H + 60,
        duration: 200,
        ease: 'Sine.easeIn',
        onComplete: () => {
          card.destroy();
          this.cardShowing = false;
          this.pumpCards();
        },
      });
    };
    this.time.delayedCall(5200, dismiss);
    // Dismissable with any key, tap, or gamepad press, a beat after it appears (so a
    // mid-combo press doesn't eat it)
    this.time.delayedCall(450, () => {
      if (done) return;
      this.input.keyboard?.once('keydown', dismiss);
      this.input.once('pointerdown', dismiss);
      this.overlayDismiss = dismiss;
    });
  }

  // --- world clear --------------------------------------------------------------

  private onWorldClear(worldId: number): void {
    if (this.clearShown) return;
    this.clearShown = true;
    const p = pal();
    const world = getWorld(worldId);

    const overlay = this.add.container(0, 0).setDepth(200);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.82);
    overlay.add(dim);
    const clearTitle = headingStyle(
      this.add
        .text(W / 2, 60, `${world.name.toUpperCase()} — CLEARED`, {
          fontFamily: PIXEL_FONT,
          fontSize: '18px',
          color: p.uiAccent,
        })
        .setOrigin(0.5),
    );
    overlay.add(clearTitle);
    // A gentle pop on the headline (skipped when motion is reduced by the tween scale staying 1)
    clearTitle.setScale(0.9);
    this.tweens.add({ targets: clearTitle, scale: 1, duration: 320, ease: 'Back.easeOut' });
    overlay.add(
      this.add
        .text(W / 2, 102, 'The Specterati shrink. Your voice does not.', {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: p.uiText,
        })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(W / 2, 138, `The whole ${world.name.replace(/^The /, '')} runbook, and what answers it in real life:`, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: p.uiDim,
        })
        .setOrigin(0.5),
    );

    // Two columns of the world's problems and their real-world answers
    const col = (items: string[], x: number): void => {
      overlay.add(
        this.add.text(x, 166, items.join('\n\n'), {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: p.uiText,
          lineSpacing: 2,
          wordWrap: { width: 420 },
        }),
      );
    };
    const lines = world.problemIds.map((pid) => {
      const pr = getProblem(pid);
      return `• ${pr.label} → ${pr.solutions.join(', ')}`;
    });
    const half = Math.ceil(lines.length / 2);
    col(lines.slice(0, half), 60);
    col(lines.slice(half), 500);

    // Every implemented world cleared → the whole Specterati runbook is done.
    const allDone = WORLDS.filter((w) => w.implemented.length > 0).every((w) =>
      progress.worldsCleared.includes(w.id),
    );
    const next = WORLDS.find((w) => w.id === worldId + 1);
    let nextUp: string;
    if (allDone) {
      nextUp = 'you flattened all 51 tactics — the Specterati are done';
      overlay.add(
        this.add
          .text(W / 2, H - 72, 'VOX — Bane of the Specterati.', {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: p.uiAccent,
          })
          .setOrigin(0.5),
      );
    } else if (next && next.implemented.length > 0) {
      nextUp = `World ${next.id}: ${next.name.replace(/^The /, '')} is now open`;
    } else {
      nextUp = `Worlds ${worldId + 1}–7 are on their way`;
    }
    overlay.add(
      this.add
        .text(W / 2, H - 44, `press any key or tap — ${nextUp}`, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: p.uiDim,
        })
        .setOrigin(0.5),
    );

    overlay.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 400 });

    this.time.delayedCall(900, () => {
      let used = false;
      const toTitle = (): void => {
        if (used) return;
        used = true;
        this.overlayDismiss = null;
        this.scene.stop(this.worldSceneKey);
        this.scene.start('title');
        this.scene.stop();
      };
      this.input.keyboard?.once('keydown', toTitle);
      this.input.once('pointerdown', toTitle);
      this.overlayDismiss = toTitle;
    });
  }
}
