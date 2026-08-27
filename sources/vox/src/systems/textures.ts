// Placeholder programmer art, generated at runtime from the active palette so calm mode
// restyles every sprite. Structured so hand-drawn art can replace these keys later without
// touching gameplay code.

import Phaser from 'phaser';
import { pal } from './palette';
import { settings } from './settings';

const KEYS = [
  'vox-player', // idle frame 0 (also the default static key)
  'vox-player-idle1',
  'vox-player-run0',
  'vox-player-run1',
  'vox-player-run2',
  'vox-player-run3',
  'vox-player-jump',
  'vox-player-fall',
  'vox-player-atk1',
  'vox-player-atk2',
  'vox-player-atk3',
  'vox-player-hurt',
  'vox-crowder',
  'vox-blocker',
  'vox-starer',
  'vox-mimic',
  'vox-boss',
  'vox-wave',
  'vox-block',
  'vox-beacon',
  'vox-beacon-lit',
  'vox-particle',
  'vox-spark',
  'vox-dust',
  'vox-hitring',
  'vox-slanderer',
  'vox-gatekeeper',
  'vox-recorder',
  'vox-accuser',
  'vox-clerk',
  'vox-boss2',
  'vox-bubble',
  'vox-bubble-truth',
  'vox-shadow',
  'vox-detector',
  'vox-loopgen',
  'vox-siren',
  'vox-boss3',
  'vox-holdwave',
  'vox-car',
  'vox-neighbor',
  'vox-antenna',
  'vox-window',
  'vox-flash',
  'vox-drone',
  'vox-lurker',
  'vox-prowler',
  'vox-hummer',
  'vox-door',
  'vox-bark',
  'vox-boss4',
  'vox-ringer',
  'vox-ringwave',
  'vox-doctor',
  'vox-drainer',
  'vox-beamer',
  'vox-striker',
  'vox-boss5',
  'vox-spinner',
  'vox-mailthief',
  'vox-spammer',
  'vox-runaround',
  'vox-clunker',
  'vox-vanisher',
  'vox-locker',
  'vox-call',
  'vox-boss6',
  'vox-pushy',
  'vox-knower',
  'vox-lodge',
  'vox-baiter',
  'vox-proposition',
  'vox-secret',
  'vox-fakefriend',
  'vox-fakefriend-real',
  'vox-family',
  'vox-lure',
  'vox-boss7',
] as const;

let generatedFor: 'normal' | 'calm' | null = null;

export function ensureTextures(scene: Phaser.Scene): void {
  const mode = settings.calmMode ? 'calm' : 'normal';
  if (generatedFor === mode && KEYS.every((k) => scene.textures.exists(k))) return;
  for (const k of KEYS) if (scene.textures.exists(k)) scene.textures.remove(k);
  const p = pal();
  const g = scene.add.graphics();

  const gen = (key: string, w: number, h: number, draw: () => void): void => {
    g.clear();
    draw();
    g.generateTexture(key, w, h);
  };

  // --- hand-inked cartoon helpers ------------------------------------------------
  // Everything is drawn as bold flat shapes with a confident dark outline, so the
  // silhouettes read on their own (colorblind-safe) and survive the calm recolor.
  const INK = 1.6; // base line weight; ~1.5x on screen at the game's zoom

  const fillRR = (x: number, y: number, w: number, h: number, r: number, color: number, a = 1) => {
    g.fillStyle(color, a);
    g.fillRoundedRect(x, y, w, h, r);
  };
  const inkRR = (x: number, y: number, w: number, h: number, r: number, lw = INK) => {
    g.lineStyle(lw, p.ink, 1);
    g.strokeRoundedRect(x, y, w, h, r);
  };
  // A filled+inked rounded rect in one call.
  const rr = (x: number, y: number, w: number, h: number, r: number, color: number, lw = INK) => {
    fillRR(x, y, w, h, r, color);
    inkRR(x, y, w, h, r, lw);
  };
  const fillC = (x: number, y: number, r: number, color: number, a = 1) => {
    g.fillStyle(color, a);
    g.fillCircle(x, y, r);
  };
  const circ = (x: number, y: number, r: number, color: number, lw = INK) => {
    fillC(x, y, r, color);
    g.lineStyle(lw, p.ink, 1);
    g.strokeCircle(x, y, r);
  };

  // VOX — the hero. A cool, unbothered survivor: teal body, a bright forward visor
  // (the reclaimed "voice"), and a small energy chevron on the chest. Drawn facing
  // right; the scene flips X for facing. All frames share this 32x40 footprint so the
  // physics body offset stays valid and animations swap cleanly.
  const drawVox = (o: {
    bob?: number; // vertical breathing offset
    lean?: number; // forward lean in px (attacks/jump)
    legs: 'stand' | 'stepA' | 'pass' | 'stepB' | 'tuck' | 'reach' | 'back';
    backArm: 'side' | 'fwd' | 'swingA' | 'swingB' | 'up' | 'guard' | 'jab' | 'chop' | 'wind';
    frontArm: 'side' | 'fwd' | 'swingA' | 'swingB' | 'up' | 'guard' | 'jab' | 'chop' | 'wind';
    slash?: 1 | 2 | 3; // energy swoosh in front
    hurt?: boolean;
  }) => {
    const bob = o.bob ?? 0;
    const lean = o.lean ?? 0;
    const cx = 16 + lean; // torso center x, nudged by lean

    // Legs (drawn first, behind torso)
    const legTop = 27 + bob;
    const drawLeg = (x: number, footDx: number, len: number) => {
      rr(x, legTop, 5, len, 2, p.player);
      // a dark boot reads as a foot and grounds the silhouette
      g.fillStyle(p.ink, 1);
      g.fillRoundedRect(x + footDx, legTop + len - 3, 7, 4, 2);
    };
    switch (o.legs) {
      case 'stand':
        drawLeg(cx - 6, -1, 11);
        drawLeg(cx + 2, 0, 11);
        break;
      case 'stepA': // running contact: front leg reaching forward
        drawLeg(cx + 4, 1, 9);
        drawLeg(cx - 8, -2, 9);
        break;
      case 'pass': // legs gathered under the body
        drawLeg(cx - 3, -1, 8);
        drawLeg(cx + 1, 1, 12);
        break;
      case 'stepB':
        drawLeg(cx + 6, 1, 9);
        drawLeg(cx - 6, -2, 10);
        break;
      case 'tuck': // jumping up: knees pulled up
        drawLeg(cx - 5, -1, 6);
        drawLeg(cx + 2, 1, 7);
        break;
      case 'reach': // falling: legs reaching for ground
        drawLeg(cx - 6, -1, 12);
        drawLeg(cx + 3, 1, 10);
        break;
      case 'back': // hurt recoil: weight shifted back
        drawLeg(cx - 7, -2, 10);
        drawLeg(cx + 3, 2, 9);
        break;
    }

    // Torso
    rr(cx - 9, 15 + bob, 18, 14, 6, p.player);
    // Chest chevron — the reclaimed voice, always bright
    g.lineStyle(2, p.projectile, 1);
    g.beginPath();
    g.moveTo(cx - 4, 25 + bob);
    g.lineTo(cx, 21 + bob);
    g.lineTo(cx + 4, 25 + bob);
    g.strokePath();

    // Head + visor
    rr(cx - 7, 3 + bob, 14, 13, 6, p.player);
    fillRR(cx - 5, 7 + bob, 12, 4, 2, p.playerAccent); // bright forward visor
    g.lineStyle(1.2, p.ink, 1);
    g.strokeRoundedRect(cx - 5, 7 + bob, 12, 4, 2);
    if (o.hurt) {
      // a small stunned spark by the head — still unbothered, just knocked back
      g.lineStyle(2, p.projectile, 1);
      g.strokeCircle(cx + 11, 5 + bob, 3);
    }

    // Arms (hands are dark "gloves")
    const shoulderY = 17 + bob;
    const drawArm = (pose: string, front: boolean) => {
      const baseX = front ? cx + 6 : cx - 6;
      switch (pose) {
        case 'side':
          rr(baseX - 2, shoulderY, 4, 11, 2, p.player);
          fillC(baseX, shoulderY + 11, 2.4, p.ink);
          break;
        case 'fwd':
        case 'swingA':
          rr(baseX - 1, shoulderY, 4, 9, 2, p.player);
          fillC(baseX + 3, shoulderY + 8, 2.4, p.ink);
          break;
        case 'swingB':
          rr(baseX - 4, shoulderY - 1, 4, 9, 2, p.player);
          fillC(baseX - 3, shoulderY + 7, 2.4, p.ink);
          break;
        case 'up':
          rr(baseX - 1, shoulderY - 8, 4, 11, 2, p.player);
          fillC(baseX + 1, shoulderY - 8, 2.4, p.ink);
          break;
        case 'guard':
          rr(baseX - 2, shoulderY - 2, 5, 7, 2, p.player);
          fillC(baseX + 1, shoulderY - 2, 2.6, p.ink);
          break;
        case 'jab': // straight forward punch
          rr(cx + 6, shoulderY + 1, 11, 4, 2, p.player);
          fillC(cx + 17, shoulderY + 3, 3, p.ink);
          break;
        case 'chop': // arm high, coming down
          rr(cx + 5, shoulderY - 7, 4, 10, 2, p.player);
          fillC(cx + 7, shoulderY - 7, 3, p.ink);
          break;
        case 'wind': // finisher wind-up/extend, big reach
          rr(cx + 5, shoulderY, 13, 5, 2, p.player);
          fillC(cx + 18, shoulderY + 2, 3.2, p.ink);
          break;
      }
    };
    drawArm(o.backArm, false);
    drawArm(o.frontArm, true);

    // Energy swoosh in front for attacks — a bright crescent, bigger on the finisher
    if (o.slash) {
      const sy = 18 + bob;
      g.lineStyle(o.slash === 3 ? 4 : 2.5, p.projectile, o.slash === 3 ? 1 : 0.9);
      g.beginPath();
      if (o.slash === 1) g.arc(cx + 12, sy, 9, -0.9, 0.7, false);
      else if (o.slash === 2) g.arc(cx + 12, sy + 2, 10, -0.5, 1.1, false);
      else g.arc(cx + 11, sy, 15, -1.1, 1.1, false);
      g.strokePath();
    }
  };

  gen('vox-player', 32, 40, () => drawVox({ legs: 'stand', backArm: 'side', frontArm: 'side' }));
  gen('vox-player-idle1', 32, 40, () =>
    drawVox({ bob: 1, legs: 'stand', backArm: 'side', frontArm: 'side' }),
  );
  gen('vox-player-run0', 32, 40, () => drawVox({ legs: 'stepA', backArm: 'swingB', frontArm: 'fwd' }));
  gen('vox-player-run1', 32, 40, () =>
    drawVox({ bob: -1, legs: 'pass', backArm: 'side', frontArm: 'fwd' }),
  );
  gen('vox-player-run2', 32, 40, () => drawVox({ legs: 'stepB', backArm: 'fwd', frontArm: 'swingB' }));
  gen('vox-player-run3', 32, 40, () =>
    drawVox({ bob: -1, legs: 'pass', backArm: 'fwd', frontArm: 'side' }),
  );
  gen('vox-player-jump', 32, 40, () =>
    drawVox({ bob: -1, legs: 'tuck', backArm: 'up', frontArm: 'up' }),
  );
  gen('vox-player-fall', 32, 40, () =>
    drawVox({ bob: 1, legs: 'reach', backArm: 'side', frontArm: 'up' }),
  );
  gen('vox-player-atk1', 32, 40, () =>
    drawVox({ lean: 1, legs: 'stepB', backArm: 'guard', frontArm: 'jab', slash: 1 }),
  );
  gen('vox-player-atk2', 32, 40, () =>
    drawVox({ lean: 1, legs: 'stepA', backArm: 'side', frontArm: 'chop', slash: 2 }),
  );
  gen('vox-player-atk3', 32, 40, () =>
    drawVox({ lean: 2, legs: 'stepB', backArm: 'swingB', frontArm: 'wind', slash: 3 }),
  );
  gen('vox-player-hurt', 32, 40, () =>
    drawVox({ lean: -2, legs: 'back', backArm: 'guard', frontArm: 'guard', hurt: true }),
  );

  // Crowder (#1) — a hunched figure fused to a glowing phone, oblivious and pathetic.
  gen('vox-crowder', 32, 36, () => {
    // little shuffling legs
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(9, 31, 5, 4, 1);
    g.fillRoundedRect(17, 31, 5, 4, 1);
    rr(6, 6, 20, 26, 7, p.enemy); // hunched body
    rr(9, 2, 14, 12, 6, p.enemy); // head, tilted down over the phone
    // downcast eyes (staring at the screen)
    fillC(13, 10, 1.6, p.ink);
    fillC(19, 10, 1.6, p.ink);
    // the ever-present phone, held up, screen glowing
    rr(20, 14, 8, 12, 2, p.enemyAccent);
    fillRR(21, 15, 6, 8, 1, p.playerAccent, 0.95);
    // the arm cradling it
    rr(14, 18, 8, 4, 2, p.enemy);
  });

  // Blocker (#4) — a smug bouncer-wall. Harmless, just endlessly In The Way.
  gen('vox-blocker', 48, 48, () => {
    // stubby feet
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(12, 44, 8, 4, 1);
    g.fillRoundedRect(28, 44, 8, 4, 1);
    rr(3, 4, 42, 41, 7, p.enemy); // the wall of a torso
    // shades: one long smug bar with two lenses
    fillRR(9, 14, 30, 7, 3, p.enemyAccent);
    inkRR(9, 14, 30, 7, 3);
    fillC(17, 17, 2, p.ink);
    fillC(31, 17, 2, p.ink);
    // flat, unbothered mouth
    g.lineStyle(2, p.ink, 1);
    g.lineBetween(18, 27, 30, 27);
    // crossed arms bar — the "you shall not pass"
    rr(6, 31, 36, 8, 3, p.enemyAccent);
  });

  // Starer (#13) — a floating eyeball with an attitude, framed by an angry brow.
  gen('vox-starer', 32, 32, () => {
    circ(16, 17, 13, p.playerAccent); // the white of the eye
    fillC(16, 17, 6.5, p.enemy); // iris
    fillC(16, 17, 3, p.ink); // pupil
    fillC(13.5, 15, 1.6, p.playerAccent); // catchlight
    // heavy angry eyebrow across the top — pure silhouette attitude
    g.fillStyle(p.enemyAccent, 1);
    g.fillTriangle(3, 8, 29, 3, 29, 9);
    g.lineStyle(INK, p.ink, 1);
    g.strokeTriangle(3, 8, 29, 3, 29, 9);
  });

  // Mimic (#48) — copies VOX's silhouette in enemy colors, with a cracked knock-off
  // visor and a lopsided emblem so it always reads as "not you."
  gen('vox-mimic', 32, 40, () => {
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(9, 34, 6, 4, 1);
    g.fillRoundedRect(18, 34, 6, 4, 1);
    rr(7, 15, 18, 15, 6, p.enemy); // torso
    rr(9, 3, 14, 13, 6, p.enemy); // head
    fillRR(11, 7, 12, 4, 2, p.enemyAccent); // knock-off visor
    // a crack across the visor
    g.lineStyle(1.2, p.ink, 1);
    g.lineBetween(15, 7, 17, 11);
    // lopsided emblem
    g.lineStyle(2, p.enemyAccent, 1);
    g.beginPath();
    g.moveTo(11, 25);
    g.lineTo(15, 22);
    g.lineTo(18, 26);
    g.strokePath();
    // arms at sides
    rr(6, 17, 4, 11, 2, p.enemy);
    rr(22, 17, 4, 11, 2, p.enemy);
  });

  // A reusable smug ghost body for the shrinking bosses.
  const drawGhost = (
    w: number,
    h: number,
    body: number,
    face: (cx: number) => void,
  ) => {
    const cx = w / 2;
    g.fillStyle(body, 1);
    g.fillEllipse(cx, h * 0.42, w * 0.9, h * 0.74);
    // wavy skirt tails along the bottom
    const tails = 4;
    const tw = (w * 0.86) / tails;
    const left = w * 0.07;
    for (let i = 0; i < tails; i++) {
      const x0 = left + i * tw;
      g.fillTriangle(x0, h * 0.68, x0 + tw, h * 0.68, x0 + tw / 2, h * 0.95);
    }
    // outline the head dome
    g.lineStyle(2, p.ink, 1);
    g.strokeEllipse(cx, h * 0.42, w * 0.9, h * 0.74);
    face(cx);
  };

  // Specterwave — the boss. A big smug ghost riding a crowd of little heads (the "wave"),
  // absurd rather than looming. Reads well at 55%–100% as it shrinks.
  gen('vox-boss', 96, 112, () => {
    drawGhost(96, 112, p.boss, (cx) => {
      // heavy-lidded, unimpressed eyes
      circ(cx - 14, 40, 8, p.playerAccent);
      circ(cx + 14, 40, 8, p.playerAccent);
      fillC(cx - 14, 42, 3.5, p.ink);
      fillC(cx + 14, 42, 3.5, p.ink);
      g.fillStyle(p.bossAccent, 1); // droopy lids
      g.fillRect(cx - 22, 33, 16, 4);
      g.fillRect(cx + 6, 33, 16, 4);
      // flat unimpressed mouth
      g.lineStyle(3, p.ink, 1);
      g.lineBetween(cx - 12, 60, cx + 12, 60);
      // a little cluster of crowd-heads it surfs on
      g.fillStyle(p.bossAccent, 1);
      for (const dx of [-24, -8, 8, 24]) g.fillCircle(cx + dx, 84, 6);
      g.lineStyle(1.5, p.ink, 1);
      for (const dx of [-24, -8, 8, 24]) g.strokeCircle(cx + dx, 84, 6);
    });
  });

  // The boss's crowd-wave pulse — a low rolling row of little heads. Clearly jumpable.
  gen('vox-wave', 44, 24, () => {
    fillRR(1, 12, 42, 11, 5, p.boss);
    for (let i = 0; i < 4; i++) {
      circ(6 + i * 11, 12, 6, p.bossAccent, 1.5);
    }
    g.lineStyle(INK, p.ink, 1);
    g.strokeRoundedRect(1, 12, 42, 11, 5);
  });

  gen('vox-block', 32, 32, () => {
    g.fillStyle(p.platform, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(p.ground, 1);
    g.fillRect(0, 26, 32, 6); // a solid capped top edge
    g.fillStyle(p.shine, 0.12);
    g.fillRect(0, 0, 32, 4); // faint top highlight
    g.lineStyle(1.5, p.ink, 0.5);
    g.strokeRect(0.75, 0.75, 30.5, 30.5);
  });

  // Beacon — VOX's checkpoint lamppost. Lighting one saves your spot.
  gen('vox-beacon', 20, 56, () => {
    rr(7, 12, 6, 42, 2, p.checkpoint); // post
    circ(10, 9, 8, p.checkpoint); // dark lamp
  });
  gen('vox-beacon-lit', 20, 56, () => {
    rr(7, 12, 6, 42, 2, p.checkpoint);
    fillC(10, 9, 11, p.checkpointLit, 0.3); // glow halo
    circ(10, 9, 8, p.checkpointLit); // lit lamp
    fillC(8, 7, 2, p.shine, 0.9); // shine dot
  });

  gen('vox-particle', 6, 6, () => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 6, 6);
  });

  // A soft round spark for impact bursts (fades to nothing, additive-blended).
  gen('vox-spark', 12, 12, () => {
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(6, 6, 6);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(6, 6, 3.5);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(6, 6, 1.6);
  });

  // A soft puff of dust for landings.
  gen('vox-dust', 14, 14, () => {
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(7, 7, 7);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(7, 7, 3);
  });

  // A bold comic "impact" ring that expands on a solid hit — chunky and cartoon.
  gen('vox-hitring', 40, 40, () => {
    g.lineStyle(4, 0xffffff, 0.95);
    g.strokeCircle(20, 20, 16);
    g.lineStyle(2, 0xffffff, 0.5);
    g.strokeCircle(20, 20, 11);
  });

  // --- World 2: Spectervox ---

  // Slanderer (#2) — a gossip that is almost entirely a flapping mouth and wagging
  // tongue; tiny shifty eyes, hands cupped to whisper.
  gen('vox-slanderer', 32, 36, () => {
    g.fillStyle(p.ink, 1); // little feet
    g.fillRoundedRect(9, 32, 5, 4, 1);
    g.fillRoundedRect(18, 32, 5, 4, 1);
    rr(4, 4, 24, 28, 8, p.enemy); // body/head fused
    // shifty little eyes, glancing sideways
    fillC(20, 12, 2.4, p.playerAccent);
    fillC(11, 12, 2.4, p.playerAccent);
    fillC(21, 12, 1.2, p.ink);
    fillC(12, 12, 1.2, p.ink);
    // the enormous running mouth
    fillRR(8, 19, 18, 11, 5, p.ink);
    fillRR(9, 20, 16, 9, 4, p.hurt, 0.9); // open maw
    fillC(14, 27, 3, p.playerAccent); // wagging tongue tip
    // a cupped whisper-hand
    fillC(28, 21, 3, p.enemy);
    g.lineStyle(1.2, p.ink, 1);
    g.strokeCircle(28, 21, 3);
  });

  // Gatekeeper (#18) — a smug turnstile/booth with a firmly shut service window and a
  // "DENIED" stamp arm cocked overhead. Harmless, endlessly In The Way.
  gen('vox-gatekeeper', 48, 52, () => {
    rr(3, 10, 42, 40, 4, p.enemy); // booth
    // shut service window with slit eyes peering through
    fillRR(11, 20, 26, 12, 2, p.enemyAccent);
    inkRR(11, 20, 26, 12, 2);
    fillC(19, 26, 1.8, p.playerAccent);
    fillC(29, 26, 1.8, p.playerAccent);
    g.lineStyle(2.5, p.ink, 1);
    g.lineBetween(11, 26, 37, 26); // the closed shutter line
    // the stamp arm, raised to deny
    rr(6, 3, 30, 7, 2, p.enemyAccent);
    rr(30, 6, 8, 12, 2, p.enemy); // the stamp head
    // flat unbothered mouth
    g.lineStyle(2, p.ink, 1);
    g.lineBetween(18, 40, 30, 40);
  });

  // Recorder (#30) — a hovering spy-cam that thinks it is subtle: fat lens, blinking
  // red record dot, stubby antenna.
  gen('vox-recorder', 32, 28, () => {
    rr(3, 7, 26, 15, 7, p.enemy); // hovering body
    circ(11, 15, 5, p.enemyAccent); // lens housing
    fillC(11, 15, 2.4, p.ink);
    fillC(10, 14, 0.9, p.playerAccent); // glint
    fillC(23, 12, 2.2, p.hurt); // the "REC" dot
    g.lineStyle(1.5, p.ink, 1);
    g.lineBetween(17, 3, 17, 8); // antenna
    fillC(17, 3, 1.6, p.projectile);
  });

  // Accuser (#31) — mostly a giant jabbing pointer finger, mouth agape mid-accusation.
  gen('vox-accuser', 32, 38, () => {
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(6, 34, 5, 4, 1);
    g.fillRoundedRect(13, 34, 5, 4, 1);
    rr(3, 6, 18, 28, 7, p.enemy); // body
    fillC(9, 13, 2.2, p.playerAccent);
    fillC(15, 13, 2.2, p.playerAccent);
    fillC(9, 13, 1.1, p.ink);
    fillC(15, 13, 1.1, p.ink);
    fillRR(8, 19, 9, 6, 3, p.ink); // shouting mouth
    // the big accusing arm + pointing finger
    rr(16, 16, 10, 5, 2, p.enemy);
    rr(24, 16, 8, 4, 2, p.enemyAccent); // the finger, always out
    fillC(31, 18, 1.4, p.enemyAccent);
  });

  // Clerk (#38) — a check-in desk that stonewalls you: ledger, "next!" bell, a bored
  // face behind the counter.
  gen('vox-clerk', 36, 32, () => {
    // bored head behind the counter
    rr(6, 2, 14, 13, 5, p.enemy);
    fillC(11, 8, 1.8, p.ink);
    fillC(16, 8, 1.8, p.ink);
    g.lineStyle(1.5, p.ink, 1);
    g.lineBetween(10, 12, 16, 12); // flat mouth
    rr(1, 14, 34, 16, 3, p.enemyAccent); // the desk
    fillRR(5, 18, 18, 8, 1, p.playerAccent, 0.95); // ledger
    g.lineStyle(1, p.ink, 0.6);
    g.lineBetween(7, 21, 21, 21);
    g.lineBetween(7, 24, 21, 24);
    // the bell
    fillC(29, 12, 4.5, p.projectile);
    g.lineStyle(1.5, p.ink, 1);
    g.strokeCircle(29, 12, 4.5);
    fillC(29, 6, 1.4, p.projectile);
  });

  // Spectervox — the boss. A smug ghost that is mostly megaphone-mouth, blaring lies.
  gen('vox-boss2', 96, 112, () => {
    drawGhost(96, 112, p.boss, (cx) => {
      circ(cx - 15, 34, 7, p.playerAccent);
      circ(cx + 15, 34, 7, p.playerAccent);
      fillC(cx - 15, 35, 3, p.ink);
      fillC(cx + 15, 35, 3, p.ink);
      // the enormous megaphone mouth
      g.fillStyle(p.bossAccent, 1);
      g.fillTriangle(cx - 6, 54, cx - 6, 70, cx - 22, 62);
      fillC(cx + 4, 62, 16, p.playerAccent);
      fillC(cx + 4, 62, 11, p.bossAccent);
      g.lineStyle(2, p.ink, 1);
      g.strokeCircle(cx + 4, 62, 16);
      // sound blasts coming out
      g.lineStyle(2.5, p.projectile, 0.9);
      g.strokeCircle(cx + 20, 62, 6);
      g.strokeCircle(cx + 26, 62, 10);
    });
  });

  // A lie in transit: a jagged shout-bubble with a red X scribble.
  gen('vox-bubble', 30, 26, () => {
    fillRR(1, 1, 28, 18, 6, p.playerAccent, 0.97);
    g.fillTriangle(6, 17, 14, 17, 6, 24); // tail
    inkRR(1, 1, 28, 18, 6, 1.5);
    g.lineStyle(2.5, p.hurt, 1);
    g.lineBetween(9, 6, 15, 13);
    g.lineBetween(15, 6, 9, 13); // the X of a falsehood
    g.lineStyle(2, p.hurt, 0.8);
    g.lineBetween(18, 9, 24, 9);
  });

  // The same bubble, deflected into a truth (green, tail flipped, a check mark).
  gen('vox-bubble-truth', 30, 26, () => {
    fillRR(1, 1, 28, 18, 6, p.checkpointLit, 0.97);
    g.fillTriangle(16, 17, 24, 17, 24, 24); // tail flipped — it is going back
    inkRR(1, 1, 28, 18, 6, 1.5);
    g.lineStyle(3, p.ink, 1);
    g.lineBetween(8, 10, 12, 14);
    g.lineBetween(12, 14, 22, 5); // a check mark
  });

  // --- World 3: Specterforce ---

  // Shadow (#9) — a puffed-up cap-and-shades cop, all swagger and watchfulness.
  gen('vox-shadow', 32, 40, () => {
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(9, 36, 6, 4, 1);
    g.fillRoundedRect(17, 36, 6, 4, 1);
    rr(4, 15, 24, 22, 6, p.enemy); // barrel chest
    rr(9, 5, 14, 12, 5, p.enemy); // head
    // peaked cap
    fillRR(6, 2, 20, 7, 3, p.enemyAccent);
    fillRR(3, 8, 26, 3, 1, p.enemyAccent); // brim
    inkRR(6, 2, 20, 7, 3, 1.2);
    // mirrored shades — one solid bar
    fillRR(9, 10, 14, 4, 2, p.playerAccent);
    inkRR(9, 10, 14, 4, 2, 1);
    // badge
    fillC(11, 24, 2.6, p.projectile);
    g.lineStyle(1, p.ink, 1);
    g.strokeCircle(11, 24, 2.6);
    // hands on hips / thumbs in belt
    rr(3, 22, 4, 8, 2, p.enemy);
    rr(25, 22, 4, 8, 2, p.enemy);
  });

  // Detector (#39) — a store security archway that beeps at you for existing.
  gen('vox-detector', 48, 64, () => {
    rr(3, 3, 9, 59, 2, p.enemy); // left post
    rr(36, 3, 9, 59, 2, p.enemy); // right post
    rr(3, 3, 42, 9, 2, p.enemy); // top bar
    // beeper light + little sound arcs
    fillC(24, 22, 4.5, p.hurt);
    g.lineStyle(1, p.ink, 1);
    g.strokeCircle(24, 22, 4.5);
    g.lineStyle(2, p.projectile, 0.8);
    g.strokeCircle(24, 22, 9);
    // a smug little readout face on the bar
    fillC(13, 7, 1.4, p.playerAccent);
    fillC(19, 7, 1.4, p.playerAccent);
  });

  // Loop generator (#41) — an "on hold" dial, endlessly spinning, hold button lit.
  gen('vox-loopgen', 48, 48, () => {
    circ(24, 24, 19, p.enemy);
    g.lineStyle(7, p.enemyAccent, 1);
    g.beginPath();
    g.arc(24, 24, 14, -1.2, Math.PI * 1.1, false); // the endless spinner arc
    g.strokePath();
    // arrowhead on the spinner
    g.fillStyle(p.enemyAccent, 1);
    g.fillTriangle(36, 20, 44, 22, 37, 28);
    fillC(24, 24, 6, p.projectile); // hold button, always lit
    g.lineStyle(1.5, p.ink, 1);
    g.strokeCircle(24, 24, 6);
    // pause bars on the button
    g.fillStyle(p.ink, 1);
    g.fillRect(22, 21, 1.6, 6);
    g.fillRect(25, 21, 1.6, 6);
  });

  // Siren (#47) — a light bar on wheels, red/blue (kept steady — no strobe).
  gen('vox-siren', 32, 24, () => {
    g.fillStyle(p.ink, 1);
    g.fillCircle(9, 21, 3.4);
    g.fillCircle(23, 21, 3.4); // wheels
    rr(2, 9, 28, 11, 3, p.enemyAccent); // body
    fillRR(5, 3, 9, 7, 2, p.hurt); // red light
    inkRR(5, 3, 9, 7, 2, 1);
    fillRR(18, 3, 9, 7, 2, p.player); // blue light
    inkRR(18, 3, 9, 7, 2, 1);
  });

  // Specterforce — the boss. A puffed-up riot ghost: peaked cap, mirror shades, big badge.
  gen('vox-boss3', 96, 112, () => {
    drawGhost(96, 112, p.boss, (cx) => {
      // peaked cap across the dome
      g.fillStyle(p.bossAccent, 1);
      g.fillRoundedRect(cx - 30, 6, 60, 14, 5);
      g.fillRoundedRect(cx - 38, 18, 76, 5, 2); // brim
      g.lineStyle(2, p.ink, 1);
      g.strokeRoundedRect(cx - 30, 6, 60, 14, 5);
      // mirror shades — a single wide bar with two lenses
      fillRR(cx - 26, 30, 52, 12, 4, p.playerAccent);
      inkRR(cx - 26, 30, 52, 12, 4, 1.5);
      fillC(cx - 13, 36, 3, p.ink);
      fillC(cx + 13, 36, 3, p.ink);
      // big shiny star badge
      fillC(cx, 62, 8, p.projectile);
      g.lineStyle(2, p.ink, 1);
      g.strokeCircle(cx, 62, 8);
      // stern flat mouth
      g.lineBetween(cx - 12, 78, cx + 12, 78);
    });
  });

  // The "please hold" ripple the boss pushes you back with — dim, bureaucratic, harmless.
  gen('vox-holdwave', 44, 22, () => {
    fillRR(1, 4, 42, 16, 8, p.checkpoint, 0.92);
    inkRR(1, 4, 42, 16, 8, 1.5);
    // pause "II" glyph to read as "hold"
    g.fillStyle(p.projectile, 0.9);
    g.fillRect(17, 8, 3, 8);
    g.fillRect(24, 8, 3, 8);
  });

  // --- World 4: Specterrealm ---

  // Parked car (#3) — a watcher's sedan with a silhouette hunched inside.
  gen('vox-car', 52, 30, () => {
    g.fillStyle(p.ink, 1);
    g.fillCircle(14, 27, 4.5);
    g.fillCircle(38, 27, 4.5); // tyres
    rr(2, 11, 48, 15, 5, p.enemy); // body
    rr(12, 3, 28, 12, 5, p.enemy); // cabin
    fillRR(15, 5, 22, 8, 2, p.playerAccent, 0.5); // windshield
    fillC(26, 9, 3, p.ink); // the watcher inside
    fillC(6, 16, 2, p.projectile); // headlight
    fillC(46, 16, 2, p.hurt); // taillight
  });

  // Neighbor / new-neighbor / peeker (#5, #10) — a nosy figure peering over.
  gen('vox-neighbor', 28, 40, () => {
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(7, 36, 5, 4, 1);
    g.fillRoundedRect(15, 36, 5, 4, 1);
    rr(4, 14, 20, 24, 6, p.enemy); // torso
    circ(14, 8, 7, p.enemyAccent); // head
    fillC(11, 8, 1.6, p.playerAccent);
    fillC(18, 8, 1.6, p.playerAccent);
    fillC(11, 8, 0.8, p.ink);
    fillC(18, 8, 0.8, p.ink);
    g.lineStyle(1.5, p.ink, 1);
    g.lineBetween(11, 12, 17, 12); // pursed disapproving mouth
  });

  // Antenna (#6) — a freshly-installed mast that wasn't there yesterday.
  gen('vox-antenna', 32, 56, () => {
    rr(13, 14, 6, 42, 2, p.enemyAccent); // pole
    g.lineStyle(2.5, p.enemy, 1);
    g.lineBetween(16, 16, 4, 5);
    g.lineBetween(16, 16, 28, 5);
    g.lineBetween(16, 24, 7, 15);
    g.lineBetween(16, 24, 25, 15); // dish arms
    fillC(16, 12, 3.5, p.hurt); // steady red tip
    g.lineStyle(1, p.ink, 1);
    g.strokeCircle(16, 12, 3.5);
  });

  // Strange window-light (#12) — an odd glow behind a curtain, someone home too late.
  gen('vox-window', 34, 34, () => {
    rr(2, 2, 30, 30, 2, p.enemyAccent); // frame
    fillRR(6, 6, 22, 22, 1, p.projectile, 0.85); // the glow
    // a shadow standing in it
    g.fillStyle(p.ink, 0.55);
    g.fillRoundedRect(14, 12, 7, 16, 2);
    g.fillCircle(17, 11, 3.5);
    g.lineStyle(2, p.enemyAccent, 1);
    g.lineBetween(17, 6, 17, 28);
    g.lineBetween(6, 17, 28, 17); // panes
  });

  // Light-flash (#32) — a steady starburst (never a strobe).
  gen('vox-flash', 30, 30, () => {
    g.lineStyle(3, p.projectile, 0.6);
    for (let a = 0; a < 8; a++) {
      const th = (a / 8) * Math.PI * 2;
      g.lineBetween(15 + Math.cos(th) * 8, 15 + Math.sin(th) * 8, 15 + Math.cos(th) * 14, 15 + Math.sin(th) * 14);
    }
    fillC(15, 15, 7, p.projectile, 0.9);
    fillC(15, 15, 3.5, p.playerAccent);
  });

  // Drone (#7) — a quadcopter eye that hovers where you look.
  gen('vox-drone', 32, 20, () => {
    g.fillStyle(p.enemyAccent, 1);
    g.fillRoundedRect(0, 3, 11, 3, 1);
    g.fillRoundedRect(21, 3, 11, 3, 1); // rotor arms
    circ(3, 5, 3.5, p.enemy);
    circ(29, 5, 3.5, p.enemy);
    rr(9, 5, 14, 10, 4, p.enemy); // hull
    fillC(16, 11, 3.5, p.playerAccent); // gimbal lens
    fillC(16, 11, 1.8, p.ink);
    fillC(15, 10, 0.7, p.playerAccent); // glint
  });

  // Lurker (#46) — a trench-coat-and-briefcase figure who is definitely just waiting.
  gen('vox-lurker', 28, 40, () => {
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(9, 37, 10, 3, 1); // shoes
    rr(4, 12, 18, 26, 5, p.enemyAccent); // long coat
    g.fillStyle(p.enemy, 1);
    g.fillTriangle(4, 20, 22, 20, 13, 14); // coat lapels
    circ(13, 8, 6, p.enemy); // head
    fillRR(8, 4, 10, 4, 1, p.enemyAccent); // hat brim
    g.lineStyle(1.4, p.playerAccent, 0.8);
    g.lineBetween(9, 9, 12, 9); // shadowed eyes
    g.lineBetween(15, 9, 18, 9);
    rr(20, 22, 8, 9, 1, p.enemy); // briefcase
    inkRR(20, 22, 8, 9, 1, 1);
  });

  // Prowler (#36) — a shadowy crouched shape with one gleaming eye.
  gen('vox-prowler', 32, 36, () => {
    g.fillStyle(p.enemyAccent, 1);
    g.fillRoundedRect(3, 14, 26, 20, 9); // hunched body
    circ(21, 12, 7, p.enemyAccent); // head, low and forward
    g.fillStyle(p.ink, 0.5);
    g.fillEllipse(14, 24, 22, 10); // it casts a shadow
    fillC(23, 11, 2.4, p.hurt); // one watching eye
    fillC(23, 11, 1, p.playerAccent);
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(6, 33, 5, 3, 1);
    g.fillRoundedRect(16, 33, 5, 3, 1); // paws
  });

  // Hummer (#22) — a utility box that buzzes all night on purpose.
  gen('vox-hummer', 32, 44, () => {
    rr(2, 4, 28, 38, 3, p.enemy); // cabinet
    g.fillStyle(p.enemyAccent, 1);
    g.fillRect(6, 11, 20, 3);
    g.fillRect(6, 17, 20, 3);
    g.fillRect(6, 23, 20, 3); // vents
    fillC(23, 36, 2.6, p.projectile); // status light
    // buzz lines coming off the top
    g.lineStyle(1.5, p.hurt, 0.7);
    g.lineBetween(8, 2, 12, -1);
    g.lineBetween(20, 2, 24, -1);
  });

  // Revolving door (#11) — a turnstile that spins you back out into the street.
  gen('vox-door', 40, 56, () => {
    rr(2, 2, 36, 54, 3, p.enemyAccent); // frame
    fillRR(6, 8, 28, 46, 2, p.enemy); // dim opening
    g.lineStyle(5, p.enemyAccent, 1);
    g.lineBetween(20, 8, 20, 54);
    g.lineBetween(8, 31, 32, 31); // revolving cross
    fillC(20, 31, 3, p.projectile); // hub
    g.lineStyle(1.2, p.ink, 1);
    g.strokeCircle(20, 31, 3);
  });

  // Bark-speaker (#50) — a loud-hailer on a post, endlessly announcing you.
  gen('vox-bark', 32, 28, () => {
    rr(13, 12, 5, 16, 1, p.enemyAccent); // post
    g.fillStyle(p.enemy, 1);
    g.fillTriangle(4, 3, 4, 21, 20, 12); // horn cone
    g.lineStyle(1.5, p.ink, 1);
    g.strokeTriangle(4, 3, 4, 21, 20, 12);
    fillRR(2, 6, 5, 12, 2, p.enemyAccent); // horn back
    // sound blips
    g.lineStyle(2, p.projectile, 0.85);
    g.strokeCircle(22, 12, 4);
    g.strokeCircle(27, 12, 8);
  });

  // Specterrealm — the boss. A ghost that is one enormous surveillance eye.
  gen('vox-boss4', 96, 112, () => {
    drawGhost(96, 112, p.boss, (cx) => {
      // the giant eye
      g.fillStyle(p.playerAccent, 1);
      g.fillEllipse(cx, 46, 58, 42);
      g.lineStyle(2.5, p.ink, 1);
      g.strokeEllipse(cx, 46, 58, 42);
      fillC(cx, 46, 15, p.bossAccent);
      fillC(cx, 46, 7, p.hurt); // red pupil, always watching
      fillC(cx - 4, 42, 2.5, p.playerAccent); // glint
      // little brow that makes it read as menacing, not friendly
      g.lineStyle(4, p.bossAccent, 1);
      g.lineBetween(cx - 26, 24, cx + 26, 30);
    });
  });

  // --- World 5: Specterbane ---

  // Ringer (#8) — a tuning-fork emitter on a stand, humming a note that wears you down.
  gen('vox-ringer', 32, 40, () => {
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(9, 37, 14, 3, 1); // base
    rr(14, 20, 5, 18, 1, p.enemyAccent); // stem
    g.lineStyle(5, p.enemy, 1);
    g.lineBetween(16, 22, 8, 3);
    g.lineBetween(16, 22, 24, 3); // fork tines
    g.lineStyle(1.5, p.ink, 1);
    g.lineBetween(16, 22, 8, 3);
    g.lineBetween(16, 22, 24, 3);
    fillC(16, 22, 3.5, p.projectile); // glowing node
    g.strokeCircle(16, 22, 3.5);
    // hum arcs off the tines
    g.lineStyle(1.5, p.projectile, 0.6);
    g.strokeCircle(8, 3, 4);
    g.strokeCircle(24, 3, 4);
  });

  // Ring-wave (#8 projectile) — a hollow ring rolling out.
  gen('vox-ringwave', 34, 34, () => {
    g.lineStyle(5, p.projectile, 0.9);
    g.strokeCircle(17, 17, 13);
    g.lineStyle(2, p.projectile, 0.4);
    g.strokeCircle(17, 17, 8);
  });

  // False doctor (#21) — a coat, clipboard, and a fake-soothing tilt of the head.
  gen('vox-doctor', 30, 40, () => {
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(8, 37, 5, 3, 1);
    g.fillRoundedRect(16, 37, 5, 3, 1);
    rr(4, 12, 22, 26, 5, p.playerAccent); // white coat (light)
    g.fillStyle(p.enemy, 1);
    g.fillTriangle(9, 12, 21, 12, 15, 22); // lapels
    circ(15, 8, 6, p.enemyAccent); // head
    fillC(12, 8, 1.4, p.ink);
    fillC(18, 8, 1.4, p.ink);
    g.lineStyle(1.4, p.ink, 1);
    g.beginPath();
    g.arc(15, 9, 3.5, 0.15, Math.PI - 0.15, false); // sweet-talking smile
    g.strokePath();
    // stethoscope
    g.lineStyle(1.5, p.hurt, 0.85);
    g.beginPath();
    g.arc(15, 20, 5, 0.2, Math.PI - 0.2, false);
    g.strokePath();
    fillC(20, 22, 1.6, p.hurt);
    rr(18, 24, 8, 9, 1, p.enemy); // clipboard
  });

  // Drainer (#24) — a heavy sagging blob that leeches your energy; droopy, exhausting.
  gen('vox-drainer', 32, 32, () => {
    circ(16, 15, 13, p.enemy);
    g.fillStyle(p.enemy, 1);
    g.fillEllipse(16, 24, 20, 10); // sagging bottom
    g.lineStyle(INK, p.ink, 1);
    g.strokeEllipse(16, 22, 22, 14);
    // half-lidded tired eyes
    fillC(11, 14, 2.4, p.enemyAccent);
    fillC(21, 14, 2.4, p.enemyAccent);
    fillC(11, 15, 1.1, p.ink);
    fillC(21, 15, 1.1, p.ink);
    g.lineStyle(1.5, p.ink, 1);
    g.lineBetween(8, 12, 14, 13); // droopy lids
    g.lineBetween(18, 13, 24, 12);
    // a downturned mouth + drip
    g.beginPath();
    g.arc(16, 22, 4, Math.PI + 0.3, -0.3, false);
    g.strokePath();
    fillC(16, 30, 1.6, p.enemyAccent);
  });

  // Beamer (#28) — a swiveling spotlight that pins you in a harsh interrogating glare.
  gen('vox-beamer', 32, 26, () => {
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(3, 22, 12, 3, 1); // base
    rr(3, 6, 17, 14, 4, p.enemyAccent); // housing
    circ(21, 13, 7, p.projectile); // lamp
    fillC(21, 13, 3, p.playerAccent);
    // beam cone
    g.fillStyle(p.projectile, 0.25);
    g.fillTriangle(27, 9, 27, 17, 32, 13);
  });

  // Striker (#45) — a coiled boxing-glove fist on a spring, poised to jab.
  gen('vox-striker', 32, 36, () => {
    // spring/arm
    g.lineStyle(3, p.ink, 1);
    g.lineBetween(4, 30, 10, 24);
    g.lineBetween(10, 24, 4, 20);
    g.lineBetween(4, 20, 10, 16);
    rr(6, 6, 18, 22, 9, p.enemy); // the glove
    fillC(21, 15, 4, p.enemyAccent); // thumb
    // angry brow eyes on the glove
    fillC(12, 13, 2, p.bossAccent);
    fillC(18, 13, 2, p.bossAccent);
    g.lineStyle(2, p.ink, 1);
    g.lineBetween(9, 9, 14, 12);
    g.lineBetween(21, 9, 16, 12);
  });

  // Specterbane — the boss. A skull-faced ghost wreathed in interrogating beams.
  gen('vox-boss5', 96, 112, () => {
    drawGhost(96, 112, p.boss, (cx) => {
      // hollow burning sockets
      circ(cx - 14, 42, 11, p.bossAccent);
      circ(cx + 14, 42, 11, p.bossAccent);
      fillC(cx - 14, 42, 4.5, p.projectile);
      fillC(cx + 14, 42, 4.5, p.projectile);
      // gritted teeth
      g.fillStyle(p.playerAccent, 1);
      g.fillRoundedRect(cx - 16, 62, 32, 10, 2);
      g.lineStyle(1.5, p.ink, 1);
      for (let i = -2; i <= 2; i++) g.lineBetween(cx + i * 6, 62, cx + i * 6, 72);
      g.strokeRoundedRect(cx - 16, 62, 32, 10, 2);
      // beams radiating out
      g.lineStyle(2, p.projectile, 0.5);
      for (const a of [-2.4, -1.9, -1.2, 1.2, 1.9, 2.4]) {
        g.lineBetween(cx + Math.cos(a) * 30, 46 + Math.sin(a) * 26, cx + Math.cos(a) * 46, 46 + Math.sin(a) * 40);
      }
    });
  });

  // --- World 6: Specterrise ---

  // Spinner (#20) — a form that buffers forever; an eternal loading ring over red tape.
  gen('vox-spinner', 40, 44, () => {
    rr(2, 4, 36, 36, 4, p.enemy); // the form/page
    g.fillStyle(p.enemyAccent, 1);
    g.fillRect(8, 9, 24, 3);
    g.fillRect(8, 34, 24, 3); // form lines
    // the eternal spinner
    g.lineStyle(4, p.enemyAccent, 0.4);
    g.strokeCircle(20, 22, 8);
    g.lineStyle(4, p.projectile, 0.95);
    g.beginPath();
    g.arc(20, 22, 8, -1.4, Math.PI * 0.9, false);
    g.strokePath();
    g.fillStyle(p.projectile, 1);
    g.fillTriangle(27, 18, 31, 20, 26, 24); // arrowhead
  });

  // MailThief (#23) — a hooded figure making off with your envelope, shifty eyes glowing.
  gen('vox-mailthief', 30, 38, () => {
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(7, 35, 5, 3, 1);
    g.fillRoundedRect(15, 35, 5, 3, 1);
    rr(4, 8, 20, 27, 6, p.enemyAccent); // hooded cloak
    g.fillStyle(p.enemy, 1);
    g.fillTriangle(4, 14, 24, 14, 14, 3); // hood peak
    g.fillStyle(p.ink, 1);
    g.fillEllipse(14, 11, 12, 7); // shadowed face
    fillC(11, 11, 1.4, p.hurt); // glowing shifty eyes
    fillC(17, 11, 1.4, p.hurt);
    // your envelope clutched under the arm
    fillRR(18, 22, 11, 8, 1, p.playerAccent, 0.97);
    g.lineStyle(1, p.ink, 0.8);
    g.lineBetween(18, 22, 23.5, 27);
    g.lineBetween(29, 22, 23.5, 27);
  });

  // Spammer (#35) — a phone blowing up with junk calls.
  gen('vox-spammer', 30, 38, () => {
    rr(5, 3, 20, 32, 4, p.enemy); // handset
    fillRR(8, 8, 14, 18, 1, p.playerAccent, 0.92); // screen
    fillC(15, 31, 2, p.enemyAccent); // home button
    // incoming red call banner
    fillRR(8, 11, 14, 5, 1, p.hurt);
    fillC(15, 20, 3, p.hurt); // call glyph
    // ring waves
    g.lineStyle(2, p.projectile, 0.8);
    g.strokeCircle(24, 5, 4);
    g.strokeCircle(24, 5, 8);
  });

  // RunAround (#40) — a darting wisp with a lying arrow that sends you the wrong way.
  gen('vox-runaround', 30, 30, () => {
    circ(15, 15, 11, p.enemy);
    // a misleading arrow
    g.fillStyle(p.projectile, 0.97);
    g.fillTriangle(7, 15, 15, 9, 15, 21);
    g.fillRect(14, 13, 8, 4);
    // shifty little eyes above the arrow
    fillC(12, 8, 1.4, p.playerAccent);
    fillC(18, 8, 1.4, p.playerAccent);
  });

  // Clunker (#42) — a sputtering junk car, backfiring smoke, one headlight out.
  gen('vox-clunker', 52, 30, () => {
    g.fillStyle(p.ink, 1);
    g.fillCircle(14, 27, 4.5);
    g.fillCircle(38, 27, 4.5);
    rr(2, 12, 48, 14, 4, p.enemyAccent);
    rr(12, 4, 26, 11, 4, p.enemyAccent);
    fillRR(15, 6, 20, 7, 1, p.enemy, 0.7); // window
    // backfire smoke puffs
    fillC(1, 10, 3, p.enemyAccent, 0.7);
    fillC(4, 6, 2, p.enemyAccent, 0.5);
    fillC(48, 14, 2, p.hurt); // one working taillight
  });

  // Vanisher (#43) — a parcel flickering out of existence just as you reach it.
  gen('vox-vanisher', 30, 30, () => {
    // dashed ghost outline of where it used to be
    g.lineStyle(1.5, p.enemyAccent, 0.5);
    g.strokeRect(4, 8, 22, 18);
    fillRR(6, 9, 18, 16, 1, p.enemy, 0.6); // half-faded box
    g.lineStyle(1.5, p.enemyAccent, 0.8);
    g.lineBetween(6, 15, 24, 15);
    g.lineBetween(15, 9, 15, 25); // tape cross
    // sparkles of dematerialization
    fillC(24, 7, 2, p.projectile, 0.9);
    fillC(27, 12, 1.2, p.projectile, 0.7);
    fillC(22, 4, 1, p.projectile, 0.6);
  });

  // Locker (#51) — a padlock slapped on your own account.
  gen('vox-locker', 40, 44, () => {
    g.lineStyle(6, p.enemyAccent, 1);
    g.beginPath();
    g.arc(20, 17, 9, Math.PI, 0, false); // shackle
    g.strokePath();
    rr(6, 16, 28, 24, 5, p.enemy); // body
    fillC(20, 26, 3.5, p.projectile); // keyhole
    g.fillStyle(p.projectile, 1);
    g.fillTriangle(18, 28, 22, 28, 21, 35);
    g.lineStyle(1.2, p.ink, 1);
    g.strokeCircle(20, 26, 3.5);
  });

  // Spam-call projectile (#35).
  gen('vox-call', 20, 20, () => {
    circ(10, 10, 8, p.hurt);
    // a little handset glyph
    g.lineStyle(3, p.playerAccent, 0.97);
    g.beginPath();
    g.arc(10, 10, 4, 0.4, Math.PI * 1.1, false);
    g.strokePath();
  });

  // Specterrise — the boss. A server-rack ghost bristling with blinking slots + antennae.
  gen('vox-boss6', 96, 112, () => {
    drawGhost(96, 112, p.boss, (cx) => {
      // antennae
      g.lineStyle(2, p.ink, 1);
      g.lineBetween(cx - 16, 12, cx - 22, 0);
      g.lineBetween(cx + 16, 12, cx + 22, 0);
      fillC(cx - 22, 0, 2.5, p.projectile);
      fillC(cx + 22, 0, 2.5, p.hurt);
      // stacked server slots with lights
      for (let i = 0; i < 3; i++) {
        const y = 32 + i * 14;
        fillRR(cx - 28, y, 56, 10, 2, p.bossAccent);
        inkRR(cx - 28, y, 56, 10, 2, 1.2);
        fillC(cx - 22, y + 5, 2, i === 1 ? p.hurt : p.projectile);
        fillC(cx - 15, y + 5, 2, p.playerAccent);
        g.fillStyle(p.ink, 0.5);
        g.fillRect(cx + 4, y + 3, 18, 4); // vents
      }
      // a flat digital scowl
      g.lineStyle(2.5, p.ink, 1);
      g.lineBetween(cx - 10, 78, cx + 10, 78);
    });
  });

  // --- World 7: The Recruiters ---

  // Pushy newcomer (#14) — arms flung wide for a smothering, unwanted hug.
  gen('vox-pushy', 32, 40, () => {
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(9, 37, 5, 3, 1);
    g.fillRoundedRect(18, 37, 5, 3, 1);
    // outstretched grabbing arms
    rr(0, 15, 9, 4, 2, p.enemy);
    rr(23, 15, 9, 4, 2, p.enemy);
    fillC(2, 17, 2.6, p.enemyAccent); // open hands
    fillC(30, 17, 2.6, p.enemyAccent);
    rr(7, 10, 18, 27, 6, p.enemy); // body
    circ(16, 8, 6, p.enemyAccent); // head
    fillC(13, 8, 1.3, p.ink);
    fillC(19, 8, 1.3, p.ink);
    g.lineStyle(1.5, p.ink, 1);
    g.beginPath();
    g.arc(16, 9, 4, 0.1, Math.PI - 0.1, false); // pushy grin
    g.strokePath();
  });

  // Knower (#15) — a smug all-knowing eye with a raised, condescending brow.
  gen('vox-knower', 32, 28, () => {
    g.fillStyle(p.enemy, 1);
    g.fillEllipse(16, 16, 28, 20);
    g.lineStyle(INK, p.ink, 1);
    g.strokeEllipse(16, 16, 28, 20);
    fillC(16, 16, 7, p.playerAccent);
    fillC(16, 16, 3.2, p.bossAccent);
    fillC(14.5, 14.5, 1.2, p.playerAccent); // glint
    // a raised knowing brow
    g.lineStyle(2.5, p.enemyAccent, 1);
    g.beginPath();
    g.moveTo(4, 6);
    g.lineTo(16, 3);
    g.lineTo(27, 7);
    g.strokePath();
  });

  // Lodge (#19) — a members' hall crowned with an all-seeing eye-in-triangle.
  gen('vox-lodge', 52, 48, () => {
    rr(4, 16, 44, 30, 2, p.enemyAccent); // hall
    // columns
    g.fillStyle(p.ink, 0.25);
    for (const x of [9, 20, 31, 42]) g.fillRect(x, 20, 3, 26);
    g.fillStyle(p.enemyAccent, 1);
    g.fillTriangle(1, 17, 51, 17, 26, 2); // pediment
    g.lineStyle(1.5, p.ink, 1);
    g.strokeTriangle(1, 17, 51, 17, 26, 2);
    // all-seeing eye
    g.lineStyle(1.5, p.projectile, 0.95);
    g.strokeTriangle(26, 20, 19, 33, 33, 33);
    fillC(26, 29, 3, p.projectile);
    fillC(26, 29, 1.3, p.ink);
  });

  // Baiter (#25) — dangles a shiny lure on a rod, all charm.
  gen('vox-baiter', 32, 40, () => {
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(7, 37, 5, 3, 1);
    g.fillRoundedRect(14, 37, 5, 3, 1);
    rr(4, 10, 17, 27, 6, p.enemy); // body
    circ(12, 8, 6, p.enemyAccent); // head
    fillC(10, 8, 1.2, p.ink);
    fillC(15, 8, 1.2, p.ink);
    g.lineStyle(1.4, p.ink, 1);
    g.beginPath();
    g.arc(12, 9, 3, 0.2, Math.PI - 0.2, false); // charming smile
    g.strokePath();
    // the rod + dangling lure
    g.lineStyle(1.5, p.enemyAccent, 1);
    g.lineBetween(18, 16, 30, 6);
    g.lineBetween(30, 6, 30, 12);
    fillC(30, 14, 3, p.projectile); // the shiny lure
    fillC(29, 13, 1, p.shine);
  });

  // Proposition (#26) — a leaning, leering figure crowding your space.
  gen('vox-proposition', 32, 40, () => {
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(10, 37, 6, 3, 1);
    g.fillRoundedRect(18, 37, 6, 3, 1);
    // leaning torso (sheared to one side)
    g.fillStyle(p.enemy, 1);
    g.fillRoundedRect(8, 8, 20, 30, 7);
    g.lineStyle(INK, p.ink, 1);
    g.strokeRoundedRect(8, 8, 20, 30, 7);
    circ(20, 8, 6, p.enemyAccent); // head, tilted forward
    fillC(18, 8, 1.3, p.ink);
    fillC(23, 8, 1.3, p.ink);
    g.lineStyle(1.5, p.hurt, 0.9);
    g.beginPath();
    g.arc(20, 10, 4, 0, Math.PI - 0.4, false); // a leering grin
    g.strokePath();
    // an arm draped out, invading space
    rr(24, 18, 8, 4, 2, p.enemy);
  });

  // Secret-keeper (#33) — a cloaked figure, finger to its lips, hoarding your info.
  gen('vox-secret', 32, 40, () => {
    rr(5, 9, 22, 29, 9, p.enemyAccent); // cloak
    g.fillStyle(p.enemy, 1);
    g.fillTriangle(5, 18, 27, 18, 16, 6); // hood
    g.fillStyle(p.ink, 1);
    g.fillEllipse(16, 12, 12, 8); // shadowed face
    fillC(13, 11, 1.3, p.playerAccent);
    fillC(19, 11, 1.3, p.playerAccent);
    // "shhh" finger over the lips
    g.lineStyle(2.5, p.playerAccent, 0.95);
    g.lineBetween(16, 9, 16, 17);
  });

  // Fake friend (#37) — wears VOX's own teal and visor to seem safe.
  gen('vox-fakefriend', 32, 40, () => {
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(9, 36, 6, 4, 1);
    g.fillRoundedRect(18, 36, 6, 4, 1);
    rr(6, 15, 20, 15, 6, p.player); // friendly teal, just like you
    rr(9, 4, 14, 12, 5, p.player);
    fillRR(11, 8, 12, 4, 2, p.playerAccent); // a copied visor
    // a too-wide, too-eager smile pin
    fillC(16, 25, 3, p.projectile);
    g.lineStyle(1, p.ink, 1);
    g.strokeCircle(16, 25, 3);
    // arms open, welcoming
    rr(4, 17, 4, 9, 2, p.player);
    rr(24, 17, 4, 9, 2, p.player);
  });

  // Fake friend, revealed (#37) — the mask drops to hostile enemy colors and a sharp grin.
  gen('vox-fakefriend-real', 32, 40, () => {
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(9, 36, 6, 4, 1);
    g.fillRoundedRect(18, 36, 6, 4, 1);
    rr(6, 15, 20, 15, 6, p.enemy);
    rr(9, 4, 14, 12, 5, p.enemy);
    fillRR(11, 8, 12, 3, 1, p.hurt); // a hostile glare
    // a jagged sharp grin
    g.fillStyle(p.playerAccent, 1);
    g.fillTriangle(10, 24, 14, 20, 14, 24);
    g.fillTriangle(14, 24, 18, 20, 18, 24);
    g.fillTriangle(18, 24, 22, 20, 22, 24);
    rr(4, 17, 4, 9, 2, p.enemy);
    rr(24, 17, 4, 9, 2, p.enemy);
  });

  // Forced family (#49) — a bulky figure barging in with crossed arms.
  gen('vox-family', 34, 40, () => {
    g.fillStyle(p.ink, 1);
    g.fillRoundedRect(9, 37, 6, 3, 1);
    g.fillRoundedRect(19, 37, 6, 3, 1);
    rr(3, 9, 28, 28, 6, p.enemy); // bulky body
    circ(17, 8, 7, p.enemyAccent); // head
    fillC(14, 8, 1.4, p.ink);
    fillC(20, 8, 1.4, p.ink);
    g.lineStyle(1.5, p.ink, 1);
    g.lineBetween(14, 12, 20, 12); // flat imposing mouth
    // crossed arms bar
    rr(5, 20, 24, 6, 3, p.enemyAccent);
    g.lineStyle(1.5, p.ink, 1);
    g.lineBetween(17, 20, 12, 26);
    g.lineBetween(17, 20, 22, 26);
  });

  // Lure (#25 hazard) — a shiny coin-trap with a hook hidden in the gleam.
  gen('vox-lure', 22, 18, () => {
    circ(11, 10, 7, p.projectile);
    fillC(8, 7, 1.8, p.shine, 0.9); // gleam
    // the hook barb inside
    g.lineStyle(2, p.hurt, 0.95);
    g.beginPath();
    g.arc(11, 9, 3, 0, Math.PI, false);
    g.strokePath();
    g.lineBetween(14, 9, 14, 13);
    g.lineBetween(14, 13, 12, 12);
  });

  // The Recruiters — the final boss. A ghost ringed with swappable masks (its fake faces),
  // a recruiter's pin at the heart. The most elaborate boss silhouette.
  gen('vox-boss7', 100, 112, () => {
    drawGhost(100, 112, p.boss, (cx) => {
      // ring of little masks — all the faces it wears
      const faces: [number, number][] = [
        [cx - 18, 34],
        [cx + 18, 34],
        [cx - 26, 54],
        [cx + 26, 54],
        [cx, 28],
      ];
      for (const [fx, fy] of faces) {
        circ(fx, fy, 7, p.playerAccent);
        fillC(fx - 2, fy, 1.4, p.ink);
        fillC(fx + 2, fy, 1.4, p.ink);
        g.lineStyle(1, p.ink, 1);
        g.beginPath();
        g.arc(fx, fy + 1, 2.5, 0.2, Math.PI - 0.2, false); // each mask smiles
        g.strokePath();
      }
      // the central recruiter's pin
      fillC(cx, 62, 6, p.projectile);
      g.lineStyle(2, p.ink, 1);
      g.strokeCircle(cx, 62, 6);
      // radiating "join us" lines
      g.lineStyle(1.5, p.bossAccent, 0.5);
      for (const a of [-2.4, -0.7, 0.7, 2.4]) {
        g.lineBetween(cx + Math.cos(a) * 40, 46 + Math.sin(a) * 34, cx + Math.cos(a) * 50, 46 + Math.sin(a) * 42);
      }
    });
  });

  g.destroy();
  generatedFor = mode;
}

/**
 * Register VOX's animations. Each frame is its own single-frame texture (see the
 * `vox-player-*` keys above), so an animation is just an ordered list of texture keys.
 * The calm-mode recolor regenerates those textures under the same keys, so the
 * animations stay valid and never need rebuilding. Safe to call every scene create.
 */
export function ensureAnims(scene: Phaser.Scene): void {
  const add = (
    key: string,
    frames: string[],
    frameRate: number,
    repeat: number,
  ): void => {
    if (scene.anims.exists(key)) return;
    scene.anims.create({
      key,
      frames: frames.map((f) => ({ key: f })),
      frameRate,
      repeat,
    });
  };

  add('vox-idle', ['vox-player', 'vox-player-idle1'], 2, -1);
  add('vox-run', ['vox-player-run0', 'vox-player-run1', 'vox-player-run2', 'vox-player-run3'], 12, -1);
  add('vox-jump', ['vox-player-jump'], 1, 0);
  add('vox-fall', ['vox-player-fall'], 1, 0);
  // Attack steps play once; the finisher lingers a beat longer.
  add('vox-atk1', ['vox-player-atk1'], 1, 0);
  add('vox-atk2', ['vox-player-atk2'], 1, 0);
  add('vox-atk3', ['vox-player-atk3'], 1, 0);
  add('vox-hurt', ['vox-player-hurt'], 1, 0);
}
