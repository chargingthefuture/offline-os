// Pixel-UI toolkit: the shared vocabulary for the Dan-the-Man style overhaul. Font families,
// hard-edged panel/meter drawers, and CSS-matrix-style pixel sprites rendered onto a Phaser
// Graphics (canvas-native equivalent of the spec's box-shadow technique).

import Phaser from 'phaser';

/** Blocky pixel font for chrome: logo, buttons, HUD labels, meters, impact text. */
export const PIXEL_FONT = '"Press Start 2P", monospace';
/** Readable monospace for prose: payoff cards, world-clear runbook, captions, content note. */
export const MONO_FONT = 'monospace';

/** Draw a character matrix as solid pixel cells onto a Graphics (spec box-shadow technique,
 *  canvas-native). Space = empty; any other char is looked up in colorMap. */
export function drawPixelMatrix(
  g: Phaser.GameObjects.Graphics,
  matrix: string[],
  colorMap: Record<string, number>,
  size: number,
  ox = 0,
  oy = 0,
): void {
  matrix.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c !== ' ' && colorMap[c] !== undefined) {
        g.fillStyle(colorMap[c], 1).fillRect(ox + x * size, oy + y * size, size, size);
      }
    }
  });
}

/** Hard-edged segmented meter (VOICE / reputation / boss). No rounded corners, no gradient —
 *  lit blocks then muted blocks, each inked with a black border. */
export function drawSegmentMeter(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  opts: {
    segW: number;
    segH: number;
    gap: number;
    count: number;
    filled: number;
    lit: number;
    empty: number;
    ink: number;
  },
): void {
  const { segW, segH, gap, count, filled, lit, empty, ink } = opts;
  for (let i = 0; i < count; i++) {
    const sx = x + i * (segW + gap);
    g.fillStyle(ink, 1).fillRect(sx - 1, y - 1, segW + 2, segH + 2); // black outline
    g.fillStyle(i < filled ? lit : empty, 1).fillRect(sx, y, segW, segH);
  }
}

/** A hard pixel panel: black outline, colour inner ring, flat fill, offset drop-shadow (no blur). */
export function drawPixelPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill: number; ring: number; ink: number; shadow?: number },
): void {
  const shadow = opts.shadow ?? 0x000000;
  g.fillStyle(shadow, 0.9).fillRect(x + 5, y + 5, w, h); // hard drop-shadow
  g.fillStyle(opts.ink, 1).fillRect(x, y, w, h); // black outer border
  g.fillStyle(opts.ring, 1).fillRect(x + 3, y + 3, w - 6, h - 6); // colour ring
  g.fillStyle(opts.fill, 1).fillRect(x + 5, y + 5, w - 10, h - 10); // flat fill
}

/** 7×6 pixel hearts (spec matrices). */
export const HEART_FULL = ['XX XX', 'XXXXX', 'XXXXX', ' XXX ', '  X  '];
export const HEART_EMPTY = ['XX XX', 'X X X', 'X   X', ' X X ', '  X  '];

/** Add a static CRT scanline overlay to a scene, unless the player has calm mode or reduced
 *  motion on (kept subtle and gated for the safety pillars). Returns the object or null. */
export function addScanlines(
  scene: Phaser.Scene,
  disabled: boolean,
  w = 960,
  h = 540,
): Phaser.GameObjects.Grid | null {
  if (disabled) return null;
  // Faint horizontal lines: a grid of thin dark rows over the whole view.
  const grid = scene.add
    .grid(0, 0, w, h, w, 3, undefined, undefined, 0x000000, 0.14)
    .setOrigin(0, 0)
    .setDepth(999)
    .setScrollFactor(0);
  return grid;
}
