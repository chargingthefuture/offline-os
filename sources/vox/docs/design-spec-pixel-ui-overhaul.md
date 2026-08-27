# VOX — Pixel UI Overhaul Design Spec

**Branch:** `design/pixel-ui-overhaul`  
**Status:** Implemented — see "As-built" at the end for how the spec mapped onto the Phaser codebase.  

---

## Problem

The current UI renders as blurry on most displays. CSS and canvas scaling apply anti-aliasing by default, softening every sprite, panel, and text element. The fix is not just aesthetic — crispness is part of the game's identity as a punchy, cathartic action platformer.

---

## Direction: Dan the Man — Pixelated & Modern

Target aesthetic: crisp NES-era HUD language with modern composition. Every element has **hard edges**, **no anti-aliasing**, and **bold black outlines**. Think Dan the Man (Halfbrick Studios) — chunky pixel sprites, flat colour, comic-style impact text, segmented meters.

---

## Global Rendering Rules

Apply these to **every HTML element and canvas surface** in the game:

```css
* {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: none;
}
```

For the Phaser/canvas renderer, set in game config:

```ts
const config: Phaser.Types.Core.GameConfig = {
  // ...
  render: {
    antialias: false,
    antialiasGL: false,
    pixelArt: true,       // sets image-rendering: pixelated on the canvas
    roundPixels: true,    // prevents sub-pixel sprite positioning
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};
```

---

## Typography

**Font:** [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P)  
Load non-blocking in `index.html`:

```html
<link rel="stylesheet" media="print" onload="this.media='all'"
  href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap">
```

Apply globally:

```css
body, canvas, .hud, .menu {
  font-family: 'Press Start 2P', monospace;
}
```

**Never** use system fonts or smooth sans-serifs on any game UI element.

---

## Colour Palette

| Token | Hex | Usage |
|---|---|---|
| `--bg-deep` | `#0D0B1E` | Primary background, panel fill |
| `--bg-surface` | `#120F2B` | Ground tiles, secondary surface |
| `--purple` | `#9B5DE5` | Player accent, VOICE meter fill, platforms |
| `--cyan` | `#00F5D4` | Panel borders, subtitle text, hero outline glow |
| `--red` | `#FF3355` | HP hearts, enemy accents, impact FX |
| `--gold` | `#FFD60A` | Score display, villain suit |
| `--black` | `#000000` | All outlines (2–4 px) |
| `--muted` | `#2A2A4A` | Empty meter segments |

---

## CSS Pixel-Art Sprite Technique

All sprites and logos in the mockup are rendered with **CSS `box-shadow` matrices** — no image files required. The technique: a single 1 × 1 px (or N × N px) `div` with a `box-shadow` list encoding each pixel.

```ts
// Convert a string matrix to a box-shadow value
const pixelShadow = (
  matrix: string[],
  color: string,
  size: number  // px per pixel cell
): string => {
  const shadows: string[] = [];
  matrix.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== ' ') {
        shadows.push(`${x * size}px ${y * size}px 0 ${color}`);
      }
    }
  });
  return shadows.join(', ') || '0 0 0 transparent';
};

// Multi-colour variant (map characters → colours)
const pixelShadowMulti = (
  matrix: string[],
  colorMap: Record<string, string>,
  size: number
): string => {
  const shadows: string[] = [];
  matrix.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c !== ' ' && colorMap[c]) {
        shadows.push(`${x * size}px ${y * size}px 0 ${colorMap[c]}`);
      }
    }
  });
  return shadows.join(', ') || '0 0 0 transparent';
};
```

Usage:

```tsx
const shadow = pixelShadow(LOGO_MATRIX, '#9B5DE5', 12);
// render as a 12×12 base div; actual sprite size = matrix cols × 12, matrix rows × 12
<div style={{ width: 12, height: 12, boxShadow: shadow }} />
```

Wrap with a sized container to clip/position correctly:

```tsx
<div style={{ width: matrixCols * size, height: matrixRows * size }}>
  <div style={{ width: size, height: size, boxShadow: shadow }} />
</div>
```

---

## Panel Style

UI panels use a **double-border** approach — outer black, inner colour — with a hard pixel drop-shadow (no blur):

```css
.vox-panel {
  background: #0D0B1E;
  border: 3px solid #000;
  border-radius: 0;                   /* NO border-radius — ever */
  box-shadow:
    inset 0 0 0 3px #0D0B1E,
    inset 0 0 0 5px #9B5DE5,          /* inner colour ring */
    4px 4px 0 0 #000;                 /* hard pixel drop-shadow */
}

/* Gold variant (score panel) */
.vox-panel-gold {
  box-shadow:
    inset 0 0 0 3px #0D0B1E,
    inset 0 0 0 5px #FFD60A,
    4px 4px 0 0 #000;
}
```

---

## Pixel Outline (sprites & icons)

Use CSS `drop-shadow` filter chains to produce a hard pixel outline — no blur radius:

```css
.pixel-outline {
  filter:
    drop-shadow(3px  0px 0px #000)
    drop-shadow(-3px 0px 0px #000)
    drop-shadow(0px  3px 0px #000)
    drop-shadow(0px -3px 0px #000);
}

/* Cyan glow variant — hero sprite */
.pixel-outline-cyan {
  filter:
    drop-shadow(4px  0px 0px #00F5D4)
    drop-shadow(-4px 0px 0px #00F5D4)
    drop-shadow(0px  4px 0px #00F5D4)
    drop-shadow(0px -4px 0px #00F5D4);
}
```

---

## Scanlines Overlay

Overlay on every full-screen scene:

```css
.scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 999;
  background: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.15) 3px
  );
}
```

---

## Buttons (menus)

```css
.vox-btn {
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  text-transform: uppercase;
  background: #0D0B1E;
  color: #fff;
  border: 3px solid #00F5D4;
  box-shadow: 0 0 0 2px #000;
  border-radius: 0;
  padding: 16px 32px;
  min-width: 240px;
  cursor: pointer;
  transition: none;                   /* NO smooth transitions */
}

.vox-btn:hover {
  transform: translateY(2px);         /* 2px snap — no easing */
  background: #9B5DE5;
  color: #000;
  border-color: #000;
  box-shadow: 0 0 0 2px #00F5D4;
}
```

---

## Screen: Title Screen

### Layout (1280 × 720)

```
┌─────────────────────────────────────────┐
│  [scanlines overlay]                    │
│                                         │
│         [VOX LOGO — pixel shadow]       │
│         TAKE YOUR VOICE BACK            │
│                                         │
│         [ START GAME ]                  │
│         [ CONTINUE  ]                   │
│         [ OPTIONS   ]                   │
│                                         │
│  [pixel city skyline silhouette — bg]   │
│▓▓▓▓▓▓▓▓▓▓▓▓▓ [ground] ▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│ v1.0                    © 2025 CTF      │
└─────────────────────────────────────────┘
         ↑ hero sprite walks l → r
```

### VOX Logo

Pixel matrix at **12 px/cell**, colour `#9B5DE5`, with a cyan drop-shadow offset `(8px, 8px)`:

```ts
const LOGO_MATRIX = [
  "XXXXX   XXXXX    OOOOOOO    XXXXX   XXXXX",
  "XXXXX   XXXXX  OOO     OOO   XXXXX XXXXX ",
  " XXXXX XXXXX   OOO     OOO    XXXXXXXX   ",
  "  XXXXXXXXX    OOO     OOO     XXXXXX    ",
  "   XXXXXXX     OOO     OOO    XXXXXXXX   ",
  "    XXXXX      OOO     OOO   XXXXX XXXXX ",
  "     XXX         OOOOOOO    XXXXX   XXXXX"
];
// Render with pixelShadow(LOGO_MATRIX, '#9B5DE5', 12)
```

Logo container filter:

```css
.logo-glow {
  filter:
    drop-shadow(4px  0px 0px #000)
    drop-shadow(-4px 0px 0px #000)
    drop-shadow(0px  4px 0px #000)
    drop-shadow(0px -4px 0px #000)
    drop-shadow(8px  8px 0px #00F5D4);
}
```

### Walking Character Animation

Hero sprite (4 px/cell) walks across the ground line continuously:

```css
@keyframes walkRight {
  0%   { transform: translateX(-100px); }
  100% { transform: translateX(1380px); }
}
.walk-anim {
  animation: walkRight 15s linear infinite;
}
```

Sprite colour map: `C` = `#00F5D4` (body), `P` = `#9B5DE5` (torso), `B` = `#000` (eyes).

---

## Screen: In-Game HUD

### Layout (1280 × 720)

```
┌──────────────────┬────────────┬──────────────────────┐
│ HP ♥♥♥♡♡          │  WORLD 3-2  │    SCORE: 047320     │
│ VOICE ▓▓▓▓▓▓▓░░░  │             │                      │
├──────────────────┴─────────────┴──────────────────────┤
│                                                        │
│      [floating platform — cyan]                        │
│                   [VILLAIN]  ★FLAT!★                   │
│  [floating platform — purple]                          │
│ [HERO]                                                 │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│ [ATK] [DASH] [WAVE]      ┌SPECTERATI INCOMING!┐        │
└──────────────────────────┴────────────────────┘────────┘
```

### HP Meter

5 × pixel-art hearts (4 px/cell). 3 filled (`#FF3355`), 2 empty (`#444`).

```ts
const HEART_FULL = [
  " XX XX ",
  "XXXXXXX",
  "XXXXXXX",
  " XXXXX ",
  "  XXX  ",
  "   X   "
];
const HEART_EMPTY = [
  " XX XX ",
  "X  X  X",
  "X     X",
  " X   X ",
  "  X X  ",
  "   X   "
];
```

### VOICE Meter

10-segment bar. 7 lit (`#9B5DE5` + `box-shadow: 0 0 10px #00F5D4`), 3 empty (`#2A2A4A`).  
Each segment: `16px × 24px`, `1px solid #000` border. No border-radius.

### Impact FX ("FLAT!")

Angular starburst (8 px/cell, `#FF3355`) + rotated text:

```css
.impact-text {
  font-family: 'Press Start 2P', monospace;
  font-size: 2rem;
  color: #FF3355;
  text-shadow: 4px 4px 0 #000;
  -webkit-text-stroke: 2px #000;
  transform: rotate(-12deg);
}
```

### Ability Slots

```css
.ability-slot {
  width: 64px;
  height: 64px;
  background: #0D0B1E;
  border: 4px solid #000;
  box-shadow: 4px 4px 0 #000;
  position: relative;
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
}
/* Inner highlight ring */
.ability-slot::after {
  content: '';
  position: absolute;
  inset: 4px;
  border: 2px solid #00F5D4;
}
/* Cooldown overlay */
.ability-slot.cooling::before {
  content: attr(data-timer);
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.6);
  color: #FF3355;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### Notification Bar

White speech bubble, black 4 px border, `step-end` blink only (no fades):

```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
.blink { animation: blink 1s step-end infinite; }
```

---

## Phaser Implementation Notes

1. **`pixelArt: true` in Phaser config** — single most impactful fix for the blurry canvas.
2. **`roundPixels: true`** — prevents sprites rendering at fractional pixel positions.
3. **`Scale.FIT` + `CENTER_BOTH`** — letterboxes cleanly without upscaling blur.
4. **No in-code `setScale()`** — export assets at the native display resolution; scale at the texture atlas level, not at runtime.
5. **Bitmap fonts over WebFont for canvas text** — for score, HP numbers, and any text drawn on the Phaser canvas, use a bitmap font sheet (Press Start 2P has one available). Place in `public/fonts/`. WebFont text on canvas goes through the browser renderer and can sub-pixel.
6. **DOM HUD overlay** — keep HP, VOICE, score, and ability slots as a DOM div layered over the canvas (`UIScene` approach already in the repo). DOM text at `pixelated` rendering is crisper than canvas text at any scale factor.

---

## Implementation Checklist

- [ ] `antialias: false`, `pixelArt: true`, `roundPixels: true` in Phaser config
- [ ] `image-rendering: pixelated; -webkit-font-smoothing: none` on `canvas` + all HUD DOM elements
- [ ] Press Start 2P loaded non-blocking in `index.html`
- [ ] `border-radius: 0` on all HUD panels and buttons
- [ ] `transition: none` on all interactive HUD elements — snap, don't slide
- [ ] Scanlines overlay added to `UIScene` and `TitleScene`
- [ ] Bitmap font sheet for any text drawn directly on the Phaser canvas
- [ ] HUD buttons use 2 px `translateY` snap on hover (no easing)
- [ ] VOICE meter segments use hard-stop colours, no gradient
- [ ] All sprite textures exported at 1× — no runtime upscaling

---

## As-built (implementation notes)

The spec was written against a React/DOM mockup; VOX is a Phaser-3 canvas game with firm
offline and accessibility constraints. Here is how it mapped, and the deliberate deviations:

- **Rendering:** `pixelArt: true` + `roundPixels: true` + `antialias/antialiasGL: false` in the
  Phaser config; `image-rendering: pixelated` on the canvas and `-webkit-font-smoothing: none`
  globally. This is the crispness fix.
- **Palette:** the spec palette (indigo/purple/cyan/red/gold, black ink) is now the game's
  `NORMAL` palette in `src/systems/palette.ts`. Everything reads from `pal()`, so the recolour
  propagates to every sprite, backdrop, and HUD element at once.
- **Font — self-hosted, not CDN:** the game is offline-first (service worker precache), so
  Press Start 2P is bundled via `@fontsource/press-start-2p` instead of the Google Fonts CDN
  link in the spec. The boot waits on `document.fonts.load` (2.5 s timeout fallback) so Phaser
  bakes text with the pixel font, and the woff/woff2 files are added to the Workbox precache.
- **Font scope:** Press Start 2P is applied to **chrome** — logo, subtitle, menu, overlay
  headings, buttons, HUD labels, meters. **Prose stays monospace** (payoff cards, world-clear
  runbook, captions, content note, control rows) so full sentences stay legible — this also
  protects the readability pillar. (Deviates from "never use system fonts on any UI element.")
- **CSS techniques → canvas:** box-shadow pixel sprites, `drawPixelMatrix`; double-border
  panels, `drawPixelPanel`; segmented meters, `drawSegmentMeter`; hearts from the spec
  matrices — all in `src/systems/uikit.ts`, drawn on Phaser `Graphics`. The VOX logo is the
  spec `LOGO_MATRIX` rendered as pixel cells with a black outline + cyan drop-shadow.
- **Accessibility preserved:** calm mode gets a desaturated variant of the new palette (same
  hues, softer), and **scanlines are gated off** under calm mode or reduced motion. Hovers
  snap (no easing), per the spec.
- **Not done in this pass:** the ~1,400 lines of procedural sprite/backdrop art in
  `textures.ts`/`backdrops.ts` are recoloured and rendered crisp, but not hand-redrawn as
  true low-res pixel art — that is a much larger art pass, tracked separately. Bitmap-font
  atlas for canvas text was not needed: the self-hosted webfont + `pixelArt` sampling is crisp
  enough at the game's fixed resolution.
