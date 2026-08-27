// Per-world parallax backdrops. Each world gets a distinct layered scene — far skyline,
// mid buildings, near props — themed to the harassment tactic it dramatizes. Everything
// reads colors from the palette so calm mode restyles the backdrops too, and nothing
// strobes or flashes (accessibility). Layers use scrollFactor for cheap parallax.

import Phaser from 'phaser';
import { pal, type Palette } from './palette';

const GROUND_Y = 500;
const WORLD_H = 540;

/** Sky wash + a grounded band, shared by every world. */
function skyWash(scene: Phaser.Scene, w: number): Palette {
  const p = pal();
  scene.add.rectangle(w / 2, WORLD_H / 2, w, WORLD_H, p.sky).setDepth(-20).setScrollFactor(0);
  scene.add.rectangle(w / 2, WORLD_H - 150, w, 300, p.skyBottom).setDepth(-19).setScrollFactor(0);
  return p;
}

/** A graphics layer preconfigured with depth + horizontal parallax. */
function layer(scene: Phaser.Scene, depth: number, scroll: number): Phaser.GameObjects.Graphics {
  return scene.add.graphics().setDepth(depth).setScrollFactor(scroll, 1);
}

// --- World 1: crowded night street (kept inline in World1Scene) ------------------

// --- World 2: an office of whispers ---------------------------------------------
export function buildOfficeBackdrop(scene: Phaser.Scene, w: number): void {
  const p = skyWash(scene, w);

  // Far office tower — a grid of cold lit windows
  const far = layer(scene, -18, 0.25);
  for (let x = -40; x < w * 1.2; x += 180) {
    const h = 220 + ((x * 31) % 120);
    far.fillStyle(p.ground, 0.8);
    far.fillRect(x, GROUND_Y - h, 150, h);
    far.fillStyle(p.projectile, 0.28);
    for (let wy = GROUND_Y - h + 16; wy < GROUND_Y - 30; wy += 30) {
      for (let wx = x + 14; wx < x + 136; wx += 26) {
        if ((wx + wy) % 4 !== 0) far.fillRect(wx, wy, 9, 12);
      }
    }
  }

  // Mid cubicle partitions and filing cabinets
  const mid = layer(scene, -14, 0.55);
  for (let x = -30; x < w * 1.3; x += 150) {
    mid.fillStyle(p.platform, 0.95);
    mid.fillRect(x, GROUND_Y - 120, 110, 120); // partition
    mid.fillStyle(p.enemyAccent, 0.7);
    mid.fillRect(x + 120, GROUND_Y - 80, 26, 80); // filing cabinet
    mid.fillStyle(p.ground, 0.9);
    for (let d = 0; d < 4; d++) mid.fillRect(x + 123, GROUND_Y - 74 + d * 18, 20, 3);
  }

  // Near desks with glowing monitors
  const near = layer(scene, -6, 0.9);
  for (let x = 120; x < w; x += 320) {
    near.fillStyle(p.ground, 1);
    near.fillRect(x, GROUND_Y - 34, 90, 34); // desk
    near.fillStyle(p.enemy, 1);
    near.fillRect(x + 30, GROUND_Y - 60, 30, 26); // monitor
    near.fillStyle(p.projectile, 0.5);
    near.fillRect(x + 34, GROUND_Y - 56, 22, 18); // screen glow
  }

  // Drifting whisper bubbles high up (static, gentle)
  const whisp = layer(scene, -16, 0.4);
  for (let x = 80; x < w; x += 240) {
    const y = 120 + ((x * 17) % 90);
    whisp.fillStyle(p.playerAccent, 0.14);
    whisp.fillRoundedRect(x, y, 40, 22, 8);
    whisp.fillTriangle(x + 8, y + 20, x + 18, y + 20, x + 8, y + 30);
  }
}

// --- World 3: a precinct and road at night --------------------------------------
export function buildPrecinctBackdrop(scene: Phaser.Scene, w: number): void {
  const p = skyWash(scene, w);

  // Far city block silhouettes with a steady searchlight cone (no flashing)
  const far = layer(scene, -18, 0.25);
  for (let x = -40; x < w * 1.2; x += 160) {
    const h = 120 + ((x * 41) % 140);
    far.fillStyle(p.ground, 0.75);
    far.fillRect(x, GROUND_Y - h, 130, h);
  }
  far.fillStyle(p.projectile, 0.08);
  far.fillTriangle(300, 40, 240, GROUND_Y - 120, 420, GROUND_Y - 120);

  // Mid precinct building with barred windows
  const mid = layer(scene, -14, 0.55);
  for (let x = -20; x < w * 1.3; x += 260) {
    mid.fillStyle(p.platform, 0.95);
    mid.fillRect(x, GROUND_Y - 150, 200, 150);
    mid.fillStyle(p.enemyAccent, 0.85);
    for (let wx = x + 20; wx < x + 180; wx += 52) {
      mid.fillRect(wx, GROUND_Y - 120, 34, 26);
      mid.fillStyle(p.ground, 1);
      for (let b = 0; b < 4; b++) mid.fillRect(wx + 4 + b * 8, GROUND_Y - 120, 2, 26); // bars
      mid.fillStyle(p.enemyAccent, 0.85);
    }
  }

  // Near road: lane markings + traffic cones
  const near = layer(scene, -6, 0.95);
  near.fillStyle(p.projectile, 0.6);
  for (let x = 40; x < w; x += 90) near.fillRect(x, GROUND_Y - 6, 40, 4); // dashes
  for (let x = 200; x < w; x += 460) {
    near.fillStyle(p.projectile, 0.9);
    near.fillTriangle(x, GROUND_Y - 8, x + 16, GROUND_Y - 8, x + 8, GROUND_Y - 34); // cone
    near.fillStyle(p.playerAccent, 0.85);
    near.fillRect(x + 2, GROUND_Y - 22, 12, 4);
  }
}

// --- World 4: a watched cul-de-sac at night -------------------------------------
export function buildCuldesacBackdrop(scene: Phaser.Scene, w: number): void {
  const p = skyWash(scene, w);

  // A big steady moon
  scene.add.circle(180, 120, 46, p.playerAccent, 0.16).setDepth(-19).setScrollFactor(0.1, 1);
  scene.add.circle(180, 120, 34, p.playerAccent, 0.22).setDepth(-19).setScrollFactor(0.1, 1);

  // Far tree line / rooftops
  const far = layer(scene, -18, 0.3);
  for (let x = -40; x < w * 1.2; x += 120) {
    const h = 70 + ((x * 29) % 60);
    far.fillStyle(p.ground, 0.7);
    far.fillTriangle(x, GROUND_Y - 40, x + 60, GROUND_Y - 40 - h, x + 120, GROUND_Y - 40); // gable rooftops
  }

  // Mid houses with the occasional lit window (someone's always watching)
  const mid = layer(scene, -14, 0.55);
  for (let x = -30; x < w * 1.3; x += 230) {
    mid.fillStyle(p.platform, 0.95);
    mid.fillRect(x, GROUND_Y - 110, 170, 110);
    mid.fillStyle(p.ground, 1);
    mid.fillTriangle(x - 8, GROUND_Y - 110, x + 178, GROUND_Y - 110, x + 85, GROUND_Y - 150); // roof
    mid.fillStyle(p.projectile, 0.45);
    if ((x / 230) % 2 === 0) mid.fillRect(x + 30, GROUND_Y - 80, 20, 22); // one lit window
    mid.fillStyle(p.enemyAccent, 0.6);
    mid.fillRect(x + 110, GROUND_Y - 80, 20, 22); // one dark window
  }

  // Near picket fence + a parked car silhouette
  const near = layer(scene, -6, 0.95);
  near.fillStyle(p.enemyAccent, 0.85);
  for (let x = 0; x < w; x += 22) {
    near.fillRect(x, GROUND_Y - 26, 6, 26);
    near.fillTriangle(x, GROUND_Y - 26, x + 6, GROUND_Y - 26, x + 3, GROUND_Y - 32);
  }
  near.fillRect(0, GROUND_Y - 16, w, 4); // fence rail
  for (let x = 340; x < w; x += 620) {
    near.fillStyle(p.ground, 1);
    near.fillRoundedRect(x, GROUND_Y - 40, 90, 30, 6); // car body
    near.fillRoundedRect(x + 16, GROUND_Y - 54, 54, 18, 6); // cabin
    near.fillStyle(p.ink, 1);
    near.fillCircle(x + 22, GROUND_Y - 10, 8);
    near.fillCircle(x + 70, GROUND_Y - 10, 8);
  }
}

// --- World 5: a cold clinic in a void -------------------------------------------
export function buildClinicBackdrop(scene: Phaser.Scene, w: number): void {
  const p = skyWash(scene, w);

  // Far void with faint floating orbs (pills/cells)
  const far = layer(scene, -18, 0.2);
  for (let x = 60; x < w; x += 150) {
    const y = 90 + ((x * 23) % 160);
    far.fillStyle(p.enemy, 0.12);
    far.fillCircle(x, y, 16 + ((x * 7) % 10));
  }

  // Mid clinic wall panels with a steady EKG trace
  const mid = layer(scene, -14, 0.5);
  mid.fillStyle(p.platform, 0.9);
  mid.fillRect(0, GROUND_Y - 170, w, 60); // wall band
  mid.lineStyle(2, p.ground, 0.7);
  for (let x = 0; x < w; x += 120) mid.strokeRect(x, GROUND_Y - 170, 120, 60); // tiles
  // EKG line
  mid.lineStyle(2.5, p.checkpointLit, 0.7);
  mid.beginPath();
  mid.moveTo(0, GROUND_Y - 140);
  for (let x = 0; x < w; x += 80) {
    mid.lineTo(x + 30, GROUND_Y - 140);
    mid.lineTo(x + 40, GROUND_Y - 164);
    mid.lineTo(x + 50, GROUND_Y - 120);
    mid.lineTo(x + 60, GROUND_Y - 140);
    mid.lineTo(x + 80, GROUND_Y - 140);
  }
  mid.strokePath();

  // Near clinic cots and IV stands
  const near = layer(scene, -6, 0.9);
  for (let x = 120; x < w; x += 340) {
    near.fillStyle(p.playerAccent, 0.85);
    near.fillRoundedRect(x, GROUND_Y - 30, 80, 14, 4); // cot
    near.fillStyle(p.enemyAccent, 1);
    near.fillRect(x + 84, GROUND_Y - 70, 3, 70); // IV pole
    near.fillStyle(p.checkpointLit, 0.7);
    near.fillRoundedRect(x + 80, GROUND_Y - 70, 12, 10, 2); // IV bag
  }
}

// --- World 6: a server-room / DMV of dead ends ----------------------------------
export function buildServerBackdrop(scene: Phaser.Scene, w: number): void {
  const p = skyWash(scene, w);

  // Far racks of steady blinking lights (no strobe — static dots)
  const far = layer(scene, -18, 0.25);
  for (let x = -20; x < w * 1.2; x += 90) {
    far.fillStyle(p.ground, 0.85);
    far.fillRect(x, GROUND_Y - 200, 74, 200); // rack
    for (let ry = GROUND_Y - 190; ry < GROUND_Y - 20; ry += 22) {
      far.fillStyle(p.checkpointLit, 0.5);
      far.fillRect(x + 8, ry, 5, 5);
      far.fillStyle(p.projectile, 0.45);
      far.fillRect(x + 18, ry, 5, 5);
      far.fillStyle(p.hurt, 0.4);
      far.fillRect(x + 28, ry, 5, 5);
    }
  }

  // Mid tangled cables and a "take a number" sign
  const mid = layer(scene, -14, 0.55);
  mid.lineStyle(3, p.enemyAccent, 0.6);
  for (let x = 0; x < w; x += 60) {
    mid.beginPath();
    mid.moveTo(x, GROUND_Y - 150);
    mid.lineTo(x + 30, GROUND_Y - 120);
    mid.lineTo(x + 60, GROUND_Y - 150);
    mid.strokePath();
  }
  for (let x = 200; x < w; x += 520) {
    mid.fillStyle(p.platform, 1);
    mid.fillRect(x, GROUND_Y - 150, 60, 40);
    mid.fillStyle(p.projectile, 0.6);
    mid.fillRect(x + 8, GROUND_Y - 142, 44, 24); // sign face
  }

  // Near queue barriers (endless line)
  const near = layer(scene, -6, 0.95);
  for (let x = 60; x < w; x += 120) {
    near.fillStyle(p.enemyAccent, 1);
    near.fillRect(x, GROUND_Y - 40, 4, 40); // post
    near.fillCircle(x + 2, GROUND_Y - 42, 4);
    near.fillStyle(p.projectile, 0.7);
    near.fillRect(x + 4, GROUND_Y - 34, 116, 3); // retractable belt
  }
}

// --- World 7: a lodge party that is a trap --------------------------------------
export function buildLodgeBackdrop(scene: Phaser.Scene, w: number): void {
  const p = skyWash(scene, w);

  // Far warm lodge wall with mounted masks (friendly faces that aren't)
  const far = layer(scene, -18, 0.3);
  far.fillStyle(p.ground, 0.85);
  far.fillRect(0, GROUND_Y - 220, w, 160); // paneled wall
  for (let x = 40; x < w; x += 130) {
    far.fillStyle(p.enemy, 0.6);
    far.fillCircle(x, GROUND_Y - 150, 16); // mask
    far.fillStyle(p.playerAccent, 0.4);
    far.fillCircle(x - 6, GROUND_Y - 153, 3);
    far.fillCircle(x + 6, GROUND_Y - 153, 3);
  }

  // Mid hanging bunting/string lights (steady glow)
  const mid = layer(scene, -14, 0.55);
  mid.lineStyle(2, p.enemyAccent, 0.7);
  mid.beginPath();
  mid.moveTo(0, 90);
  for (let x = 0; x < w; x += 120) mid.lineTo(x + 60, 130);
  mid.strokePath();
  for (let x = 30; x < w; x += 60) {
    mid.fillStyle(x % 120 === 30 ? p.projectile : p.checkpointLit, 0.7);
    mid.fillCircle(x, 118, 5); // bulb
  }

  // Near banquet tables set for a welcome that's really a lure
  const near = layer(scene, -6, 0.95);
  for (let x = 100; x < w; x += 300) {
    near.fillStyle(p.platform, 1);
    near.fillRoundedRect(x, GROUND_Y - 40, 120, 16, 4); // table
    near.fillStyle(p.playerAccent, 0.85);
    near.fillRect(x + 10, GROUND_Y - 40, 100, 4); // cloth highlight
    near.fillStyle(p.projectile, 0.8);
    near.fillCircle(x + 30, GROUND_Y - 48, 4); // candle
    near.fillCircle(x + 90, GROUND_Y - 48, 4);
  }
}
