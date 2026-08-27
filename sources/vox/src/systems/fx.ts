// Shared visual-polish helpers — the code-only "juice" layer. Everything here is gated by
// the calm-mode / reduced-motion settings so it never adds screen shake, flashing, or
// motion that the safety pillars rule out. Text shadows and static postFX (vignette/bloom)
// are readability/depth, not motion, so they stay on except where calm mode wants softer.

import Phaser from 'phaser';
import { pal } from './palette';
import { motionReduced } from './settings';

/** A hard pixel drop-shadow so text reads on busy backgrounds — offset, no blur (the pixel
 * aesthetic wants crisp edges, not soft halos). The `blur` arg is kept for call-site
 * compatibility but ignored; shadows are always hard now. */
export function textShadow(t: Phaser.GameObjects.Text, _blur = 0): Phaser.GameObjects.Text {
  return t.setShadow(2, 2, '#000000', 0, false, true);
}

/** Heavier treatment for big headings: hard black outline + hard offset shadow. */
export function headingStyle(t: Phaser.GameObjects.Text): Phaser.GameObjects.Text {
  t.setStroke('#000000', 4);
  return t.setShadow(3, 3, '#000000', 0, false, true);
}

/** Static camera post-processing: a gentle vignette only. Bloom is intentionally gone — it
 * blooms bright edges into a soft glow, which fights the crisp pixel look. WebGL only. */
export function addSceneFX(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  if (scene.renderer.type !== Phaser.WEBGL || !cam.postFX) return;
  try {
    cam.postFX.addVignette(0.5, 0.5, 0.95, 0.28);
  } catch {
    /* postFX unavailable on this renderer — skip silently */
  }
}

/** A brief zoom punch for big moments (boss down). Skipped when motion is reduced. */
export function cameraPunch(scene: Phaser.Scene, baseZoom: number, amount = 0.07, dur = 240): void {
  if (motionReduced()) return;
  scene.tweens.add({
    targets: scene.cameras.main,
    zoom: baseZoom * (1 + amount),
    duration: dur / 2,
    yoyo: true,
    ease: 'Quad.easeOut',
  });
}

/** An expanding, fading ring at (x, y) — the impact pop on a solid hit. */
export function impactRing(scene: Phaser.Scene, x: number, y: number, big = false): void {
  const img = scene.add.image(x, y, 'vox-hitring').setDepth(19).setBlendMode(Phaser.BlendModes.ADD);
  img.setScale(0.3).setAlpha(0.9);
  scene.tweens.add({
    targets: img,
    scale: big ? 1.5 : 0.95,
    alpha: 0,
    duration: big ? 300 : 220,
    ease: 'Cubic.easeOut',
    onComplete: () => img.destroy(),
  });
}

/** Build a small reusable spark emitter (impacts). Call once per scene. */
export function makeSparks(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
  const e = scene.add.particles(0, 0, 'vox-spark', {
    speed: { min: 60, max: 220 },
    lifespan: { min: 180, max: 380 },
    scale: { start: 0.9, end: 0 },
    alpha: { start: 1, end: 0 },
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
  });
  return e.setDepth(18);
}

/** Build a soft dust emitter (landing/run). */
export function makeDust(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
  const e = scene.add.particles(0, 0, 'vox-dust', {
    speed: { min: 20, max: 70 },
    angle: { min: 200, max: 340 },
    lifespan: { min: 260, max: 460 },
    scale: { start: 0.7, end: 0 },
    alpha: { start: 0.5, end: 0 },
    tint: pal().uiCard,
    gravityY: -40,
    emitting: false,
  });
  return e.setDepth(3);
}
