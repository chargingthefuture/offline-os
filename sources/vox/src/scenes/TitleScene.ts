// Title screen: start, comfort settings (calm mode one tap away), control remapping,
// and the first-launch content note.

import Phaser from 'phaser';
import { WORLDS } from '../data/worlds';
import { addSceneFX, textShadow } from '../systems/fx';
import { gpConfirmPressed, sampleGamepad } from '../systems/gamepad';
import { pal } from '../systems/palette';
import {
  DEFAULT_BINDINGS,
  motionReduced,
  progress,
  saveSettings,
  settings,
  type BindableAction,
} from '../systems/settings';
import { cue } from '../systems/sound';
import { toggleFullscreen } from '../systems/fullscreen';
import { keyLabel } from '../systems/input';
import { exportSaveCode, exportSaveJSON, importSave } from '../systems/savecode';
import { ensureTextures } from '../systems/textures';
import { addScanlines, drawPixelMatrix, drawPixelPanel, MONO_FONT, PIXEL_FONT } from '../systems/uikit';

const W = 960;
const H = 540;

// Spec VOX logo matrix — rendered as pixel cells (canvas equivalent of the box-shadow sprite).
const LOGO_MATRIX = [
  'XXXXX   XXXXX    OOOOOOO    XXXXX   XXXXX',
  'XXXXX   XXXXX  OOO     OOO   XXXXX XXXXX ',
  ' XXXXX XXXXX   OOO     OOO    XXXXXXXX   ',
  '  XXXXXXXXX    OOO     OOO     XXXXXX    ',
  '   XXXXXXX     OOO     OOO    XXXXXXXX   ',
  '    XXXXX      OOO     OOO   XXXXX XXXXX ',
  '     XXX         OOOOOOO    XXXXX   XXXXX',
];

export class TitleScene extends Phaser.Scene {
  private overlayOpen = false;
  /** When the content note is up, gamepad confirm triggers this (the play button). */
  private noteConfirm: (() => void) | null = null;

  constructor() {
    super('title');
  }

  update(): void {
    sampleGamepad(this.game.loop.frame);
    if (!gpConfirmPressed()) return;
    if (this.noteConfirm) this.noteConfirm();
    else if (!this.overlayOpen) this.startGame();
  }

  create(): void {
    ensureTextures(this);
    this.overlayOpen = false;
    const p = pal();
    this.cameras.main.setBackgroundColor(p.sky);
    this.add.rectangle(W / 2, H - 90, W, 180, p.skyBottom);
    this.add.rectangle(W / 2, H - 20, W, 40, p.ground);

    // Distant drifting skyline behind the title, for a little depth.
    for (let x = 40; x < W; x += 130) {
      const h = 50 + ((x * 29) % 90);
      this.add.rectangle(x, H - 110 - h / 2 + 40, 60 + ((x * 11) % 40), h, p.ground, 0.4).setDepth(-5);
    }

    // Pixel VOX logo: purple cells, black outline, cyan drop-shadow — the box-shadow sprite
    // technique rendered onto a Graphics inside a container we can breathe.
    const logo = this.add.container(W / 2, 96).setDepth(5);
    const g = this.add.graphics();
    const cell = 11;
    const cols = LOGO_MATRIX[0].length;
    const rows = LOGO_MATRIX.length;
    const ox = -(cols * cell) / 2;
    const oy = -(rows * cell) / 2;
    const purple = 0x9b5de5;
    const cyan = 0x00f5d4;
    const black = 0x000000;
    const both = (c: number, dx: number, dy: number): void =>
      drawPixelMatrix(g, LOGO_MATRIX, { X: c, O: c }, cell, ox + dx, oy + dy);
    both(cyan, 8, 8); // drop-shadow
    both(black, 3, 0);
    both(black, -3, 0);
    both(black, 0, 3);
    both(black, 0, -3); // black outline
    both(purple, 0, 0); // face
    logo.add(g);
    // A slow idle breath on the logo (skipped when motion is reduced).
    if (!motionReduced()) {
      this.tweens.add({ targets: logo, scale: 1.03, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    textShadow(
      this.add
        .text(W / 2, 160, 'TAKE YOUR VOICE BACK', { fontFamily: PIXEL_FONT, fontSize: '13px', color: p.uiAccent })
        .setOrigin(0.5),
    );

    const allDone = WORLDS.filter((w) => w.implemented.length > 0).every((w) =>
      progress.worldsCleared.includes(w.id),
    );
    this.add
      .text(
        W / 2,
        196,
        allDone
          ? '✓ every world cleared — all 51 tactics flattened. VOX, Bane of the Specterati.'
          : 'Every enemy is a real harassment tactic, drawn as the cartoon it deserves to be.\nFlatten it, and see the real-world tool that answers it.',
        { fontFamily: 'monospace', fontSize: '13px', color: allDone ? p.uiAccent : p.uiDim, align: 'center' },
      )
      .setOrigin(0.5);

    // The hero, present and unbothered
    this.add.image(W / 2, H - 60, 'vox-player').setScale(2);

    type Row = { label: () => string; action: () => void; locked?: boolean; world?: boolean };
    const menu: Row[] = [];

    // A single "play" row targets the furthest open-but-uncleared world (else World 1);
    // the full list lives behind "select world…" so the menu stays short as worlds grow.
    const nextWorld = this.nextOpenWorld();
    const nextShort = nextWorld.name.replace(/^The /, '');
    const nextCleared = progress.worldsCleared.includes(nextWorld.id);
    menu.push({
      world: true,
      label: () => `▶ ${nextCleared ? 'replay' : 'play'} — World ${nextWorld.id}: ${nextShort}`,
      action: () => this.startGame(nextWorld.id),
    });
    menu.push({
      world: true,
      label: () => 'select world…',
      action: () => this.openWorldSelect(),
    });

    menu.push(
      {
        label: () => `calm mode: ${settings.calmMode ? 'ON' : 'off'}   (soft colors, muted, no shakes)`,
        action: () => {
          settings.calmMode = !settings.calmMode;
          saveSettings();
          this.scene.restart();
        },
      },
      {
        label: () => `reduced motion: ${settings.reducedMotion ? 'ON' : 'off'}`,
        action: () => {
          settings.reducedMotion = !settings.reducedMotion;
          saveSettings();
          this.scene.restart();
        },
      },
      {
        label: () => `sound: ${settings.sound ? 'ON' : 'off'}`,
        action: () => {
          settings.sound = !settings.sound;
          saveSettings();
          this.scene.restart();
        },
      },
      {
        label: () => `captions: ${settings.captions ? 'ON' : 'off'}`,
        action: () => {
          settings.captions = !settings.captions;
          saveSettings();
          this.scene.restart();
        },
      },
      { label: () => 'controls…', action: () => this.openControls() },
      { label: () => 'save / load progress…', action: () => this.openSaves() },
    );

    // Fit the rows between the intro text (~220) and VOX at the bottom; tighten as rows grow.
    const rowGap = menu.length > 7 ? 27 : 31;
    const top = 246;
    menu.forEach((item, i) => {
      const baseColor = item.locked ? p.uiDim : item.world ? p.uiText : p.uiDim;
      const t = textShadow(
        this.add
          .text(W / 2, top + i * rowGap, item.label(), {
            fontFamily: PIXEL_FONT,
            fontSize: item.world ? '12px' : '9px',
            color: baseColor,
          })
          .setOrigin(0.5)
          .setAlpha(item.locked ? 0.6 : 1),
        4,
      );
      if (!item.locked) {
        t.setInteractive({ useHandCursor: true });
        // Snap, don't slide — the pixel aesthetic wants hard state changes, no easing.
        t.on('pointerover', () => t.setColor(p.uiAccent).setScale(1.08));
        t.on('pointerout', () => t.setColor(baseColor).setScale(1));
        t.on('pointerdown', () => {
          if (this.overlayOpen) return;
          cue('ui');
          item.action();
        });
      }
    });

    // Fullscreen toggle, tucked in the top-right. On mobile the game also enters fullscreen
    // on the first tap (see main.ts); this lets anyone toggle it and desktop opt in.
    const fsBtn = this.add
      .text(W - 18, 16, '⛶', { fontFamily: 'monospace', fontSize: '24px', color: p.uiDim })
      .setOrigin(1, 0)
      .setDepth(50)
      .setInteractive({ useHandCursor: true });
    fsBtn.on('pointerover', () => fsBtn.setColor(p.uiAccent));
    fsBtn.on('pointerout', () => fsBtn.setColor(p.uiDim));
    fsBtn.on('pointerdown', () => {
      cue('ui');
      toggleFullscreen(this);
    });

    // Link back to the Offline OS dashboard, tucked in the top-left — mirrors the
    // fullscreen toggle opposite it. The dashboard root is resolved from the current
    // path so the link works with or without a trailing slash on the app URL.
    const osBtn = this.add
      .text(18, 16, '‹ OS', { fontFamily: 'monospace', fontSize: '18px', color: p.uiDim })
      .setOrigin(0, 0)
      .setDepth(50)
      .setInteractive({ useHandCursor: true });
    osBtn.on('pointerover', () => osBtn.setColor(p.uiAccent));
    osBtn.on('pointerout', () => osBtn.setColor(p.uiDim));
    osBtn.on('pointerdown', () => {
      if (this.overlayOpen) return;
      cue('ui');
      const m = window.location.pathname.match(/^(.*?\/)apps\//);
      window.location.href = m ? m[1] : '../../';
    });

    addSceneFX(this);
    addScanlines(this, settings.calmMode || motionReduced());
    this.cameras.main.fadeIn(320, 0, 0, 0);

    this.input.keyboard?.on('keydown-ENTER', () => {
      if (!this.overlayOpen) this.startGame();
    });

    if (!settings.contentNoteSeen) this.showContentNote();
  }

  /** True when a world is open to play (World 1 always; others need the prior world cleared). */
  private worldOpen(id: number): boolean {
    return id === 1 || progress.worldsCleared.includes(id - 1);
  }

  /** The lowest open-but-uncleared playable world, or World 1 if all cleared / none. */
  private nextOpenWorld() {
    const playable = WORLDS.filter((w) => w.implemented.length > 0);
    return (
      playable.find((w) => this.worldOpen(w.id) && !progress.worldsCleared.includes(w.id)) ?? playable[0]
    );
  }

  /** Start a world; with no argument, the furthest open world. */
  private startGame(worldId?: number): void {
    if (this.overlayOpen) return;
    this.fadeToWorld(worldId ?? this.nextOpenWorld().id);
  }

  /** Fade the title out, then launch the world (the world fades itself in). */
  private fadeToWorld(id: number): void {
    const cam = this.cameras.main;
    cam.fadeOut(240, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(`world${id}`));
  }

  // --- world select -------------------------------------------------------------

  private openWorldSelect(): void {
    this.overlayOpen = true;
    const p = pal();
    const playable = WORLDS.filter((w) => w.implemented.length > 0);
    const overlay = this.add.container(0, 0).setDepth(300);
    overlay.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.86));
    overlay.add(
      this.add
        .text(W / 2, 58, 'SELECT A WORLD', { fontFamily: PIXEL_FONT, fontSize: '16px', color: p.uiAccent })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(W / 2, 92, 'pick any world — cleared ones are marked ✓', {
          fontFamily: MONO_FONT,
          fontSize: '12px',
          color: p.uiDim,
        })
        .setOrigin(0.5),
    );

    const top = 132;
    const gap = Math.min(34, (H - 190) / playable.length);
    playable.forEach((w, i) => {
      // Every world is selectable. The campaign still shows what you've reached and cleared,
      // but nothing is hard-locked: this is offline with no server, so a lock would only risk
      // stranding honest players who lost their saved progress.
      const reached = this.worldOpen(w.id);
      const cleared = progress.worldsCleared.includes(w.id);
      const shortName = w.name.replace(/^The /, '');
      const tag = cleared ? '  ✓' : reached ? '' : '  ·';
      const color = reached ? p.uiText : p.uiDim;
      const t = this.add
        .text(W / 2, top + i * gap, `World ${w.id}: ${shortName}${tag}`, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color,
        })
        .setOrigin(0.5)
        .setAlpha(reached ? 1 : 0.7)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor(p.uiAccent));
      t.on('pointerout', () => t.setColor(color));
      t.on('pointerdown', () => {
        cue('ui');
        this.overlayOpen = false;
        this.fadeToWorld(w.id);
      });
      overlay.add(t);
    });

    const close = this.add
      .text(W / 2, H - 32, '[ BACK ]', { fontFamily: PIXEL_FONT, fontSize: '12px', color: p.uiAccent })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => {
      cue('ui');
      overlay.destroy();
      this.overlayOpen = false;
    });
    overlay.add(close);
  }

  // --- save / load progress -----------------------------------------------------

  private openSaves(): void {
    this.overlayOpen = true;
    const p = pal();
    const overlay = this.add.container(0, 0).setDepth(300);
    overlay.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.92));
    overlay.add(
      this.add
        .text(W / 2, 54, 'SAVE / LOAD PROGRESS', { fontFamily: PIXEL_FONT, fontSize: '15px', color: p.uiAccent })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(
          W / 2,
          98,
          'Your progress is kept only in this browser. Copy your code or download a\n' +
            'backup to keep it — then paste or load it back after you clear your browser,\n' +
            'or to move to another device.',
          { fontFamily: MONO_FONT, fontSize: '12px', color: p.uiDim, align: 'center', lineSpacing: 3 },
        )
        .setOrigin(0.5),
    );

    const status = this.add
      .text(W / 2, 396, '', { fontFamily: 'monospace', fontSize: '13px', color: p.uiAccent, align: 'center' })
      .setOrigin(0.5);
    overlay.add(status);
    const setStatus = (m: string): void => {
      status.setText(m);
    };

    const btn = (y: number, label: string, fn: () => void): void => {
      const t = this.add
        .text(W / 2, y, label, { fontFamily: 'monospace', fontSize: '16px', color: p.uiText })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor(p.uiAccent));
      t.on('pointerout', () => t.setColor(p.uiText));
      t.on('pointerdown', () => {
        cue('ui');
        fn();
      });
      overlay.add(t);
    };

    const reloadAfterImport = (): void => {
      setStatus('Loaded. Restarting…');
      this.time.delayedCall(600, () => this.scene.restart());
    };

    btn(170, '[ copy my progress code ]', () => {
      const code = exportSaveCode();
      const clip = navigator.clipboard?.writeText?.(code);
      if (clip) {
        clip.then(() => setStatus('Code copied — paste it somewhere safe.')).catch(() => {
          window.prompt('Copy this progress code:', code);
        });
      } else {
        window.prompt('Copy this progress code:', code);
      }
    });

    btn(206, '[ download a backup file ]', () => {
      try {
        const blob = new Blob([exportSaveJSON()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vox-save.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setStatus('Backup downloaded as vox-save.json.');
      } catch {
        setStatus('Could not download here — use the code instead.');
      }
    });

    btn(258, '[ paste a code to load ]', () => {
      const text = window.prompt('Paste your progress code (or backup) here:');
      if (text == null) return;
      if (importSave(text)) reloadAfterImport();
      else setStatus("That didn't look like a VOX save.");
    });

    btn(294, '[ load a backup file ]', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json,text/plain';
      input.onchange = (): void => {
        const f = input.files && input.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = (): void => {
          if (importSave(String(r.result))) reloadAfterImport();
          else setStatus("That file didn't look like a VOX save.");
        };
        r.readAsText(f);
      };
      input.click();
    });

    const close = this.add
      .text(W / 2, H - 32, '[ BACK ]', { fontFamily: PIXEL_FONT, fontSize: '12px', color: p.uiAccent })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => {
      cue('ui');
      overlay.destroy();
      this.overlayOpen = false;
    });
    overlay.add(close);
  }

  // --- first-launch content note ------------------------------------------------

  private showContentNote(): void {
    this.overlayOpen = true;
    const p = pal();
    const overlay = this.add.container(0, 0).setDepth(300);
    overlay.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.86));
    const panel = this.add.graphics();
    drawPixelPanel(panel, W / 2 - 340, 70, 680, 400, {
      fill: p.uiCard,
      ring: Phaser.Display.Color.HexStringToColor(p.uiAccent).color,
      ink: p.ink,
    });
    overlay.add(panel);
    overlay.add(
      this.add
        .text(W / 2, 104, 'BEFORE YOU PLAY', { fontFamily: PIXEL_FONT, fontSize: '16px', color: p.uiAccent })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(
          W / 2,
          230,
          'VOX turns real harassment tactics that survivors report into cartoon\n' +
            'enemies you can flatten. Nothing here is graphic, and the harassers are\n' +
            'always the ones losing. The point is relief, not reliving.\n\n' +
            'If anything ever feels like too much, calm mode is one tap away: softer\n' +
            'colors, sound off, no shakes or flashes. Flash-style effects are off by\n' +
            'default either way.\n\n' +
            'You are the powerful one here.',
          { fontFamily: 'monospace', fontSize: '14px', color: p.uiText, align: 'center', lineSpacing: 4 },
        )
        .setOrigin(0.5),
    );

    const calmBtn = this.add
      .text(W / 2, 372, `calm mode: ${settings.calmMode ? 'ON' : 'off'}`, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: p.uiDim,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    calmBtn.on('pointerdown', () => {
      settings.calmMode = !settings.calmMode;
      saveSettings();
      cue('ui');
      this.scene.restart(); // note reappears with the new palette until dismissed
    });
    overlay.add(calmBtn);

    const playBtn = this.add
      .text(W / 2, 420, '[ GOT IT — PLAY ]', { fontFamily: PIXEL_FONT, fontSize: '13px', color: p.uiAccent })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const acceptNote = (): void => {
      settings.contentNoteSeen = true;
      saveSettings();
      cue('ui');
      overlay.destroy();
      this.overlayOpen = false;
      this.noteConfirm = null;
    };
    playBtn.on('pointerdown', acceptNote);
    this.noteConfirm = acceptNote;
    overlay.add(playBtn);
  }

  // --- controls remap -------------------------------------------------------------

  private openControls(): void {
    this.overlayOpen = true;
    const p = pal();
    const overlay = this.add.container(0, 0).setDepth(300);
    overlay.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.86));
    const panel = this.add.graphics();
    drawPixelPanel(panel, W / 2 - 280, 90, 560, 360, {
      fill: p.uiCard,
      ring: Phaser.Display.Color.HexStringToColor(p.uiAccent).color,
      ink: p.ink,
    });
    overlay.add(panel);
    overlay.add(
      this.add
        .text(W / 2, 122, 'CONTROLS', { fontFamily: PIXEL_FONT, fontSize: '15px', color: p.uiAccent })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(W / 2, 152, 'click an action, then press the key you want\n(WASD and X always work too · gamepad: stick/d-pad moves, bottom button jumps, other face buttons attack)', {
          fontFamily: MONO_FONT,
          fontSize: '12px',
          color: p.uiDim,
          align: 'center',
        })
        .setOrigin(0.5),
    );

    const actions: [BindableAction, string][] = [
      ['left', 'move left'],
      ['right', 'move right'],
      ['jump', 'jump'],
      ['attack', 'attack'],
    ];
    const rows: Phaser.GameObjects.Text[] = [];
    let rebinding: BindableAction | null = null;

    const rowText = (a: BindableAction, name: string): string =>
      rebinding === a ? `${name}:  press a key…` : `${name}:  ${keyLabel(settings.bindings[a])}`;

    actions.forEach(([a, name], i) => {
      const t = this.add
        .text(W / 2, 200 + i * 40, rowText(a, name), { fontFamily: 'monospace', fontSize: '17px', color: p.uiText })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor(p.uiAccent));
      t.on('pointerout', () => t.setColor(p.uiText));
      t.on('pointerdown', () => {
        if (rebinding) return;
        rebinding = a;
        rows.forEach((r, j) => r.setText(rowText(actions[j][0], actions[j][1])));
        const capture = (e: KeyboardEvent): void => {
          e.preventDefault();
          if (e.code !== 'Escape') {
            settings.bindings[a] = e.code;
            saveSettings();
          }
          rebinding = null;
          rows.forEach((r, j) => r.setText(rowText(actions[j][0], actions[j][1])));
        };
        window.addEventListener('keydown', capture, { once: true, capture: true });
      });
      rows.push(t);
      overlay.add(t);
    });

    const resetBtn = this.add
      .text(W / 2, 372, 'reset to defaults', { fontFamily: 'monospace', fontSize: '14px', color: p.uiDim })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    resetBtn.on('pointerdown', () => {
      settings.bindings = { ...DEFAULT_BINDINGS };
      saveSettings();
      cue('ui');
      rows.forEach((r, j) => r.setText(rowText(actions[j][0], actions[j][1])));
    });
    overlay.add(resetBtn);

    const closeBtn = this.add
      .text(W / 2, 414, '[ DONE ]', { fontFamily: PIXEL_FONT, fontSize: '13px', color: p.uiAccent })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      cue('ui');
      overlay.destroy();
      this.overlayOpen = false;
    });
    overlay.add(closeBtn);
  }
}
