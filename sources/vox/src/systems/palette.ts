// Two palettes: the normal one (night-city, defiant neon) and the calm one (soft pastel,
// low contrast, no harsh brights). Everything that draws reads colors from here so the
// calm-mode switch restyles the whole game at once.

import { settings } from './settings';

export interface Palette {
  sky: number;
  skyBottom: number;
  ground: number;
  platform: number;
  player: number;
  playerAccent: number;
  enemy: number;
  enemyAccent: number;
  boss: number;
  bossAccent: number;
  projectile: number;
  checkpoint: number;
  checkpointLit: number;
  confetti: number[];
  uiText: string;
  uiDim: string;
  uiCard: number;
  uiAccent: string;
  hurt: number;
  /** Confident cartoon outline color. Used to ink every sprite. */
  ink: number;
  /** A soft light used for rim/shine accents that survive the calm recolor. */
  shine: number;
}

// Pixel-UI palette (Dan-the-Man style): deep indigo ground, electric purple, cyan, red, gold,
// and hard black ink on every outline.
const NORMAL: Palette = {
  sky: 0x0d0b1e, // --bg-deep
  skyBottom: 0x120f2b, // --bg-surface
  ground: 0x120f2b,
  platform: 0x9b5de5, // --purple
  player: 0x00f5d4, // --cyan (hero body)
  playerAccent: 0x9b5de5, // --purple (hero torso)
  enemy: 0xff3355, // --red
  enemyAccent: 0xb3243d,
  boss: 0xffd60a, // --gold (villain suit)
  bossAccent: 0xc79e00,
  projectile: 0xffd60a,
  checkpoint: 0x2a2a4a, // --muted
  checkpointLit: 0x00f5d4,
  confetti: [0x9b5de5, 0x00f5d4, 0xff3355, 0xffd60a, 0xffffff],
  uiText: '#ffffff',
  uiDim: '#a9b0d6',
  uiCard: 0x0d0b1e,
  uiAccent: '#00f5d4', // --cyan
  hurt: 0xff3355,
  ink: 0x000000, // hard black outlines — spec rule
  shine: 0xffffff,
};

// Calm mode: the same pixel palette desaturated — softer purples/cyans, no harsh brights,
// slate ink instead of hard black. Same hue family so the identity carries across the switch.
const CALM: Palette = {
  sky: 0x1a1830,
  skyBottom: 0x232140,
  ground: 0x232140,
  platform: 0x8a7aa8,
  player: 0x8fc8bd,
  playerAccent: 0xa898c0,
  enemy: 0xc98a95,
  enemyAccent: 0x9a6b76,
  boss: 0xd8c88e,
  bossAccent: 0xac9c66,
  projectile: 0xd8c88e,
  checkpoint: 0x3a3a54,
  checkpointLit: 0x9dc4c4,
  confetti: [0xa898c0, 0x8fc8bd, 0xc98a95, 0xd8c88e],
  uiText: '#e8e8ee',
  uiDim: '#b0b4c4',
  uiCard: 0x1a1830,
  uiAccent: '#9dc4c4',
  hurt: 0xc98a95,
  // Calm mode keeps outlines soft and low-contrast — a muted slate, never harsh black.
  ink: 0x2a3040,
  shine: 0xf0f2f6,
};

export function pal(): Palette {
  return settings.calmMode ? CALM : NORMAL;
}
