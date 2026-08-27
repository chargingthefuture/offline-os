/* Redline — an offline, gamepad-friendly speed platformer.
 *
 * Everything is drawn on the canvas in code (no image assets), physics runs on a
 * fixed 60-step-per-second clock so the feel is the same on every device, and
 * all three control schemes (keyboard, gamepad, touch) drive the same actions
 * through js/input.js. See CLAUDE.md for the project rules this follows.
 */
(function () {
  "use strict";

  const TILE = 32;
  const VIEW_W = 640;
  const VIEW_H = 360;
  const MAX_RENDER_SCALE = 3;
  const STEP = 1000 / 60; // fixed timestep in ms

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  function setRenderScale() {
    ctx.setTransform(canvas.width / VIEW_W, 0, 0, canvas.height / VIEW_H, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  // ---- Physics tuning (per fixed step) ----
  const PHYS = {
    ACC: 0.42,
    FRICTION: 0.36,
    DECEL: 0.9,
    AIR_ACC: 0.32,
    TOP: 6.6,
    ROLL_FRICTION: 0.045,
    ROLL_DECEL: 0.35,
    GRAV: 0.52,
    MAX_FALL: 15,
    JUMP: 10.6,
    JUMP_CUT: 4.2,
    SLOPE_WALK: 0.16,
    SLOPE_ROLL: 0.32,
    SPRING: 15.5,
    ENEMY_BOUNCE: 8.5,
    SPINDASH_BASE: 8,
    SPINDASH_MAX: 13,
  };

  // ---- Colours ----
  const C = {
    sky1: "#2b1a55",
    sky2: "#5a2e7a",
    hillFar: "#3d6b3a",
    hillNear: "#2f5230",
    ground: "#6b4a2a",
    groundTop: "#3aa54a",
    groundTopEdge: "#2c7d38",
    dirt: "#5a3d22",
    spike: "#c9ced6",
    spikeDk: "#8b929c",
    ring: "#ffd23c",
    ringDk: "#e0a014",
    hero: "#f02a38",
    heroDk: "#a5121c",
    heroShoe: "#ffffff",
    enemy: "#7a49c0",
    enemyDk: "#4a2a80",
    spring: "#ff5aa0",
    springDk: "#b02c66",
    goal: "#ffd23c",
    text: "#ffffff",
  };

  // ---- Game state ----
  const G = {
    scene: "title", // title | levelselect | play | clear | gameover | win | pause
    sceneLock: 0, // frames to ignore menu buttons right after a scene change
    tap: false, // a bare screen tap this frame (used to advance menus on touch)
    tapX: 0, tapY: 0, // where the tap landed, in canvas coordinates
    menuChoice: 0,
    selectedLevel: 0,
    playMode: "campaign", // campaign | select
    levelIndex: 0,
    lives: 3,
    score: 0,
    rings: 0,
    time: 0, // seconds in the current act
    grid: [],
    cols: 0,
    rows: 0,
    player: null,
    entities: [],
    camX: 0,
    camY: 0,
    anim: 0, // global animation timer
    flash: 0, // white flash timer on hit
    levelName: "",
    best: 0,
  };

  // ---------- Tile helpers ----------
  function tileAt(col, row) {
    if (row < 0 || row >= G.rows || col < 0 || col >= G.cols) return " ";
    return G.grid[row][col];
  }
  const colOf = (x) => Math.floor(x / TILE);
  const rowOf = (y) => Math.floor(y / TILE);
  const isSolidChar = (ch) => ch === "#";

  // ---------- Level loading ----------
  function loadLevel(index) {
    const def = window.LEVELS[index];
    G.levelName = def.name;
    const width = def.rows.reduce((m, r) => Math.max(m, r.length), 0);
    G.grid = def.rows.map((r) => r.padEnd(width, " ").split(""));
    G.rows = G.grid.length;
    G.cols = width;
    G.entities = [];
    G.rings = 0;
    G.time = 0;

    let start = { x: 2 * TILE, y: 2 * TILE };
    for (let r = 0; r < G.rows; r++) {
      for (let c = 0; c < G.cols; c++) {
        const ch = G.grid[r][c];
        const x = c * TILE;
        const y = r * TILE;
        if (ch === "P") {
          start = { x: x + 4, y: y };
          G.grid[r][c] = " ";
        } else if (ch === "o") {
          G.entities.push({ type: "ring", x: x + 8, y: y + 8, w: 16, h: 16, gone: false });
          G.grid[r][c] = " ";
        } else if (ch === "E") {
          G.entities.push({
            type: "enemy", x: x + 4, y: y + 6, w: 24, h: 24,
            vx: 0.9, dir: 1, dead: false,
          });
          G.grid[r][c] = " ";
        } else if (ch === "S") {
          G.entities.push({ type: "spring", x: x + 4, y: y + TILE - 12, w: 24, h: 12 });
          G.grid[r][c] = " ";
        } else if (ch === "^") {
          G.entities.push({ type: "spike", x: x, y: y + TILE - 14, w: TILE, h: 14 });
          G.grid[r][c] = " ";
        } else if (ch === "G") {
          G.entities.push({ type: "goal", x: x, y: y - TILE, w: TILE, h: TILE * 2, hit: false });
          G.grid[r][c] = " ";
        }
      }
    }

    G.player = {
      x: start.x, y: start.y, w: 22, h: 40,
      vx: 0, vy: 0,
      grounded: false, rolling: false, facing: 1,
      onSlope: 0, invuln: 0, dead: false,
      spindash: 0, charging: false, run: 0,
    };
    G.camX = 0;
    G.camY = 0;
  }

  // ---------- Collision ----------
  function collideX(e) {
    e.x += e.vx;
    const top = e.y;
    const bot = e.y + e.h - 1;
    if (e.vx > 0) {
      const col = colOf(e.x + e.w);
      for (let r = rowOf(top); r <= rowOf(bot); r++) {
        if (isSolidChar(tileAt(col, r))) { e.x = col * TILE - e.w; e.vx = 0; e.hitWall = true; break; }
      }
    } else if (e.vx < 0) {
      const col = colOf(e.x);
      for (let r = rowOf(top); r <= rowOf(bot); r++) {
        if (isSolidChar(tileAt(col, r))) { e.x = (col + 1) * TILE; e.vx = 0; e.hitWall = true; break; }
      }
    }
  }

  function collideY(e) {
    e.y += e.vy;
    const left = e.x;
    const right = e.x + e.w - 1;
    if (e.vy > 0) {
      const row = rowOf(e.y + e.h);
      for (let c = colOf(left); c <= colOf(right); c++) {
        if (isSolidChar(tileAt(c, row))) { e.y = row * TILE - e.h; e.vy = 0; e.grounded = true; break; }
      }
    } else if (e.vy < 0) {
      const row = rowOf(e.y);
      for (let c = colOf(left); c <= colOf(right); c++) {
        if (isSolidChar(tileAt(c, row))) { e.y = (row + 1) * TILE; e.vy = 0; break; }
      }
    }
  }

  // Snap the entity onto a 45-degree slope surface under its feet, and report
  // which way the slope tips (for the downhill speed assist).
  function slopeSnap(e) {
    e.onSlope = 0;
    const footX = e.x + e.w / 2;
    const col = colOf(footX);
    const localX = Math.max(0, Math.min(TILE, footX - col * TILE));
    let best = Infinity;
    let bestDir = 0;
    for (let r = rowOf(e.y) - 1; r <= rowOf(e.y + e.h) + 1; r++) {
      const t = tileAt(col, r);
      let surf = null, dir = 0;
      if (t === "/") { surf = (r + 1) * TILE - localX; dir = -1; }
      else if (t === "\\") { surf = r * TILE + localX; dir = 1; }
      if (surf !== null && surf < best) { best = surf; bestDir = dir; }
    }
    if (best === Infinity) return;
    const bottom = e.y + e.h;
    const penDist = TILE + 8;
    const stickDist = e.grounded ? 12 : 2;
    if (bottom >= best - stickDist && bottom <= best + penDist) {
      e.y = best - e.h;
      if (e.vy > 0) e.vy = 0;
      e.grounded = true;
      e.onSlope = bestDir;
    }
  }

  // Is there solid footing (block or slope) just below this point?
  function footingBelow(x, y) {
    const col = colOf(x);
    const row = rowOf(y);
    const ch = tileAt(col, row);
    return isSolidChar(ch) || ch === "/" || ch === "\\";
  }

  // ---------- Player update ----------
  function updatePlayer() {
    const p = G.player;
    const left = Input.held("left");
    const right = Input.held("right");
    const down = Input.held("down");
    const jumpDown = Input.held("jump");
    const jumpPressed = Input.pressed("jump");

    p.hitWall = false;
    const wasGrounded = p.grounded;

    // Spin dash: crouch while still, tap jump to charge, release crouch to fire.
    if (p.grounded && down && Math.abs(p.vx) < 0.6) {
      p.charging = true;
      if (jumpPressed) {
        p.spindash = Math.min(PHYS.SPINDASH_MAX, p.spindash + 2);
        Sfx.charge();
      }
      p.spindash *= 0.985; // charge leaks a little while you hold
    } else if (p.charging) {
      // released crouch -> launch as a roll
      if (p.spindash > 0.5) {
        p.vx = p.facing * (PHYS.SPINDASH_BASE + p.spindash);
        p.rolling = true;
        Sfx.roll();
      }
      p.charging = false;
      p.spindash = 0;
    }

    if (!p.charging) {
      // Horizontal movement.
      if (p.rolling) {
        // rolling: no active acceleration, just friction and slope pull
        if (Math.abs(p.vx) > 0.02) {
          p.vx -= Math.sign(p.vx) * PHYS.ROLL_FRICTION;
        }
        if ((left && p.vx > 0) || (right && p.vx < 0)) {
          p.vx -= Math.sign(p.vx) * PHYS.ROLL_DECEL; // pressing back brakes a roll
        }
        if (p.grounded && Math.abs(p.vx) < 0.6) p.rolling = false;
      } else if (p.grounded) {
        if (left && !right) {
          p.facing = -1;
          p.vx -= p.vx > 0 ? PHYS.DECEL : PHYS.ACC;
        } else if (right && !left) {
          p.facing = 1;
          p.vx += p.vx < 0 ? PHYS.DECEL : PHYS.ACC;
        } else {
          if (Math.abs(p.vx) <= PHYS.FRICTION) p.vx = 0;
          else p.vx -= Math.sign(p.vx) * PHYS.FRICTION;
        }
        // start rolling when crouching at speed
        if (down && Math.abs(p.vx) > 1.2) { p.rolling = true; Sfx.roll(); }
      } else {
        // air control
        if (left && !right) { p.facing = -1; p.vx -= PHYS.AIR_ACC; }
        else if (right && !left) { p.facing = 1; p.vx += PHYS.AIR_ACC; }
      }
    }

    // Slope speed assist (downhill gains, uphill loses).
    if (p.grounded && p.onSlope !== 0) {
      const pull = p.rolling ? PHYS.SLOPE_ROLL : PHYS.SLOPE_WALK;
      p.vx += p.onSlope * pull;
    }

    // Clamp running speed (rolling can exceed the walk cap from slopes/dash).
    const cap = p.rolling ? PHYS.TOP * 1.9 : PHYS.TOP;
    if (p.vx > cap) p.vx = cap;
    if (p.vx < -cap) p.vx = -cap;

    // Jump.
    if (p.grounded && jumpPressed && !p.charging) {
      p.vy = -PHYS.JUMP;
      p.grounded = false;
      Sfx.jump();
    }
    // Variable jump height: releasing early cuts the rise.
    if (!jumpDown && p.vy < -PHYS.JUMP_CUT) p.vy = -PHYS.JUMP_CUT;

    // Gravity.
    p.vy += PHYS.GRAV;
    if (p.vy > PHYS.MAX_FALL) p.vy = PHYS.MAX_FALL;

    // Rolling shrinks the hitbox; keep the feet on the ground when it changes.
    const targetH = p.rolling ? 28 : 40;
    if (targetH !== p.h) {
      p.y += p.h - targetH;
      p.h = targetH;
    }

    // Move + collide (x then y), then settle onto any slope.
    p.grounded = false;
    collideX(p);
    collideY(p);
    slopeSnap(p);

    // Walking off a ledge un-grounds (collideY only grounds when landing).
    if (!p.grounded && wasGrounded && p.vy >= 0) {
      // small coyote: if footing is barely below, treat as grounded
      if (footingBelow(p.x + 4, p.y + p.h + 2) || footingBelow(p.x + p.w - 4, p.y + p.h + 2)) {
        p.grounded = true;
      }
    }

    if (p.invuln > 0) p.invuln--;
    if (G.flash > 0) G.flash--;

    // Running animation speed tracks how fast you move.
    p.run += Math.min(0.6, Math.abs(p.vx) * 0.06 + (p.grounded ? 0.05 : 0));

    // Fell out of the world.
    if (p.y > G.rows * TILE + 80) hurtPlayer(true);
  }

  // ---------- Entities ----------
  function updateEntities() {
    const p = G.player;
    for (const e of G.entities) {
      if (e.type === "enemy") updateEnemy(e);
      if (overlaps(p, e)) handleTouch(e);
    }
    // drop collected/dead entities from the list occasionally to stay light
    if (G.anim % 120 === 0) {
      G.entities = G.entities.filter((e) => !e.remove);
    }
  }

  function updateEnemy(e) {
    if (e.dead) return;
    e.vy = (e.vy || 0) + PHYS.GRAV;
    if (e.vy > PHYS.MAX_FALL) e.vy = PHYS.MAX_FALL;
    e.grounded = false;
    e.vx = e.dir * 0.9;
    collideX(e);
    collideY(e);
    // turn around at a wall or the edge of a platform
    const aheadX = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
    if (e.hitWall || !footingBelow(aheadX, e.y + e.h + 2)) {
      e.dir *= -1;
      e.hitWall = false;
    }
  }

  function handleTouch(e) {
    const p = G.player;
    if (e.type === "ring" && !e.gone) {
      e.gone = true;
      e.remove = true;
      G.rings++;
      G.score += 10;
      Sfx.ring();
    } else if (e.type === "spring") {
      p.vy = -PHYS.SPRING;
      p.grounded = false;
      p.rolling = false;
      Sfx.spring();
    } else if (e.type === "spike") {
      hurtPlayer(false);
    } else if (e.type === "enemy" && !e.dead) {
      const fromAbove = p.vy > 0 && p.y + p.h - p.vy <= e.y + 8;
      const attacking = p.rolling || fromAbove;
      if (attacking) {
        e.dead = true;
        e.remove = true;
        G.score += 100;
        p.vy = -PHYS.ENEMY_BOUNCE; // bounce off the top
        p.grounded = false;
        Sfx.defeat();
      } else {
        hurtPlayer(false);
      }
    } else if (e.type === "goal" && !e.hit) {
      e.hit = true;
      completeAct();
    }
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ---------- Damage / death ----------
  function hurtPlayer(fell) {
    const p = G.player;
    if (p.invuln > 0 && !fell) return;
    if (fell || G.rings === 0) {
      loseLife();
      return;
    }
    // scatter your rings and bounce back
    G.rings = 0;
    p.invuln = 90;
    p.vy = -7;
    p.vx = -p.facing * 4;
    p.rolling = false;
    G.flash = 6;
    Sfx.hurt();
  }

  function loseLife() {
    G.lives--;
    Sfx.death();
    if (G.lives <= 0) {
      setScene("gameover");
    } else {
      // restart the act
      loadLevel(G.levelIndex);
    }
  }

  function completeAct() {
    G.score += Math.max(0, 500 - Math.floor(G.time) * 5); // faster clears score more
    G.score += G.rings * 20;
    Sfx.goal();
    if (G.levelIndex + 1 >= window.LEVELS.length) {
      setScene("win");
    } else {
      setScene("clear");
    }
  }

  // ---------- Camera ----------
  function updateCamera() {
    const p = G.player;
    const targetX = p.x + p.w / 2 - VIEW_W / 2 + p.vx * 12;
    const targetY = p.y + p.h / 2 - VIEW_H / 2;
    G.camX += (targetX - G.camX) * 0.12;
    G.camY += (targetY - G.camY) * 0.1;
    const maxX = Math.max(0, G.cols * TILE - VIEW_W);
    const maxY = Math.max(0, G.rows * TILE - VIEW_H);
    G.camX = Math.max(0, Math.min(maxX, G.camX));
    G.camY = Math.max(0, Math.min(maxY, G.camY));
  }

  // ---------- Rendering ----------
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, C.sky1);
    g.addColorStop(1, C.sky2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // parallax hills
    ctx.fillStyle = C.hillFar;
    const off1 = -(G.camX * 0.3) % 240;
    for (let x = off1 - 240; x < VIEW_W + 240; x += 240) {
      hill(x, VIEW_H - 70, 220, 90);
    }
    ctx.fillStyle = C.hillNear;
    const off2 = -(G.camX * 0.55) % 300;
    for (let x = off2 - 300; x < VIEW_W + 300; x += 300) {
      hill(x, VIEW_H - 40, 300, 130);
    }
  }

  function hill(cx, base, w, h) {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, base);
    ctx.quadraticCurveTo(cx, base - h, cx + w / 2, base);
    ctx.closePath();
    ctx.fill();
  }

  function drawTiles() {
    const startCol = Math.max(0, colOf(G.camX));
    const endCol = Math.min(G.cols - 1, colOf(G.camX + VIEW_W));
    const startRow = Math.max(0, rowOf(G.camY));
    const endRow = Math.min(G.rows - 1, rowOf(G.camY + VIEW_H));
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const ch = G.grid[r][c];
        if (ch === " " || ch === ".") continue;
        const x = Math.floor(c * TILE - G.camX);
        const y = Math.floor(r * TILE - G.camY);
        if (ch === "#") drawBlock(x, y, c, r);
        else if (ch === "/") drawSlope(x, y, "/");
        else if (ch === "\\") drawSlope(x, y, "\\");
      }
    }
  }

  function drawBlock(x, y, c, r) {
    const openAbove = tileAt(c, r - 1) === " " || tileAt(c, r - 1) === "." ||
      tileAt(c, r - 1) === "o";
    ctx.fillStyle = C.dirt;
    ctx.fillRect(x, y, TILE, TILE);
    // speckles
    ctx.fillStyle = C.ground;
    ctx.fillRect(x + 6, y + 12, 4, 4);
    ctx.fillRect(x + 20, y + 22, 5, 5);
    if (openAbove) {
      ctx.fillStyle = C.groundTop;
      ctx.fillRect(x, y, TILE, 8);
      ctx.fillStyle = C.groundTopEdge;
      ctx.fillRect(x, y + 8, TILE, 3);
    }
  }

  function drawSlope(x, y, kind) {
    ctx.fillStyle = C.dirt;
    ctx.beginPath();
    if (kind === "/") {
      ctx.moveTo(x, y + TILE);
      ctx.lineTo(x + TILE, y);
      ctx.lineTo(x + TILE, y + TILE);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + TILE, y + TILE);
      ctx.lineTo(x, y + TILE);
    }
    ctx.closePath();
    ctx.fill();
    // grassy edge along the diagonal
    ctx.strokeStyle = C.groundTop;
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (kind === "/") { ctx.moveTo(x, y + TILE); ctx.lineTo(x + TILE, y); }
    else { ctx.moveTo(x, y); ctx.lineTo(x + TILE, y + TILE); }
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  function drawEntities() {
    for (const e of G.entities) {
      if (e.remove) continue;
      const x = Math.floor(e.x - G.camX);
      const y = Math.floor(e.y - G.camY);
      if (x < -60 || x > VIEW_W + 60) continue;
      if (e.type === "ring") drawRing(x, y);
      else if (e.type === "spring") drawSpring(x, y);
      else if (e.type === "spike") drawSpikes(x, y, e.w);
      else if (e.type === "enemy" && !e.dead) drawEnemy(x, y, e);
      else if (e.type === "goal") drawGoal(x, y);
    }
  }

  function drawRing(x, y) {
    const t = Math.abs(Math.sin(G.anim * 0.08));
    const w = 4 + t * 8; // spin: width pulses
    const cx = x + 8, cy = y + 8;
    ctx.strokeStyle = C.ring;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = C.ringDk;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawSpring(x, y) {
    ctx.fillStyle = C.springDk;
    ctx.fillRect(x, y + 6, 24, 6);
    ctx.fillStyle = C.spring;
    ctx.fillRect(x, y, 24, 7);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 3, y + 1, 18, 2);
  }

  function drawSpikes(x, y, w) {
    ctx.fillStyle = C.spikeDk;
    ctx.fillRect(x, y + 10, w, 4);
    ctx.fillStyle = C.spike;
    for (let i = 0; i < w; i += 8) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + 12);
      ctx.lineTo(x + i + 4, y);
      ctx.lineTo(x + i + 8, y + 12);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawEnemy(x, y, e) {
    const bob = Math.sin(G.anim * 0.1) * 2;
    ctx.fillStyle = C.enemyDk;
    ctx.fillRect(x + 2, y + 20 + bob, 20, 6);
    ctx.fillStyle = C.enemy;
    ctx.beginPath();
    ctx.arc(x + 12, y + 14 + bob, 11, 0, Math.PI * 2);
    ctx.fill();
    // spikes on the shell
    ctx.fillStyle = C.enemyDk;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 12 + i * 7 - 3, y + 6 + bob);
      ctx.lineTo(x + 12 + i * 7, y - 1 + bob);
      ctx.lineTo(x + 12 + i * 7 + 3, y + 6 + bob);
      ctx.closePath();
      ctx.fill();
    }
    // eye
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + (e.dir > 0 ? 15 : 5), y + 11 + bob, 5, 5);
    ctx.fillStyle = "#000";
    ctx.fillRect(x + (e.dir > 0 ? 17 : 7), y + 12 + bob, 2, 3);
  }

  function drawGoal(x, y) {
    ctx.fillStyle = "#cfd6e0";
    ctx.fillRect(x + 14, y, 4, TILE * 2);
    const spin = Math.sin(G.anim * 0.06);
    ctx.save();
    ctx.translate(x + 16, y + 16);
    ctx.scale(spin, 1);
    ctx.fillStyle = C.goal;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.hero;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer() {
    const p = G.player;
    if (p.invuln > 0 && Math.floor(G.anim / 4) % 2 === 0) return; // blink while hurt
    const x = Math.floor(p.x - G.camX);
    const y = Math.floor(p.y - G.camY);

    if (p.rolling || p.charging) {
      // spinning ball
      const cx = x + p.w / 2;
      const cy = y + p.h / 2;
      const rad = p.h / 2;
      ctx.fillStyle = C.heroDk;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.hero;
      ctx.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        const a = p.run * 1.2 + i * (Math.PI * 2 / 3);
        ctx.beginPath();
        ctx.arc(cx, cy, rad - 3, a, a + 1.2);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      return;
    }

    ctx.save();
    ctx.translate(x + p.w / 2, y + p.h / 2);
    if (p.facing < 0) ctx.scale(-1, 1);
    ctx.translate(-p.w / 2, -p.h / 2);

    // legs (simple run cycle)
    const legPhase = Math.sin(p.run);
    ctx.fillStyle = C.heroShoe;
    if (p.grounded) {
      ctx.fillRect(4 + legPhase * 3, p.h - 8, 8, 7);
      ctx.fillRect(12 - legPhase * 3, p.h - 8, 8, 7);
    } else {
      ctx.fillRect(4, p.h - 10, 8, 7);
      ctx.fillRect(12, p.h - 6, 8, 7);
    }

    // body
    ctx.fillStyle = C.hero;
    ctx.beginPath();
    ctx.arc(p.w / 2, 16, 12, 0, Math.PI * 2);
    ctx.fill();
    // quills / swept back hair
    ctx.fillStyle = C.heroDk;
    ctx.beginPath();
    ctx.moveTo(2, 10);
    ctx.lineTo(-8, 16);
    ctx.lineTo(4, 20);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2, 18);
    ctx.lineTo(-6, 26);
    ctx.lineTo(6, 24);
    ctx.closePath();
    ctx.fill();
    // muzzle
    ctx.fillStyle = "#f7c9a0";
    ctx.beginPath();
    ctx.arc(p.w / 2 + 7, 18, 5, 0, Math.PI * 2);
    ctx.fill();
    // eye
    ctx.fillStyle = "#fff";
    ctx.fillRect(p.w / 2 + 2, 11, 7, 8);
    ctx.fillStyle = "#123";
    ctx.fillRect(p.w / 2 + 6, 13, 3, 5);

    ctx.restore();
  }

  // ---------- HUD & overlays ----------
  function drawHud() {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, VIEW_W, 26);
    ctx.textBaseline = "middle";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.fillStyle = C.ring;
    ctx.textAlign = "left";
    ctx.fillText("◎ " + G.rings, 12, 14);
    ctx.fillStyle = C.text;
    ctx.fillText("SCORE " + G.score, 90, 14);
    ctx.fillText("TIME " + formatTime(G.time), 240, 14);
    ctx.textAlign = "right";
    ctx.fillText("LIVES × " + G.lives, VIEW_W - 12, 14);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(G.levelName, 90, 34 - 2 + 4);
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return m + ":" + (ss < 10 ? "0" : "") + ss;
  }

  function centerText(lines) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let y = VIEW_H / 2 - (lines.length - 1) * 18;
    for (const ln of lines) {
      ctx.font = ln.big ? "bold 34px system-ui, sans-serif" : (ln.small ? "14px system-ui, sans-serif" : "bold 18px system-ui, sans-serif");
      ctx.fillStyle = ln.color || C.text;
      ctx.fillText(ln.t, VIEW_W / 2, y);
      y += ln.gap || 36;
    }
    ctx.textAlign = "left";
  }

  // Title-menu item positions (canvas coordinates), shared by drawing and by
  // click/tap hit-testing so a mouse or finger can pick an item directly.
  const TITLE_MENU = { x0: 150, x1: 490, campaignY: 208, selectY: 254, half: 22 };

  function drawTitleMenu() {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = C.hero;
    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.fillText("REDLINE", VIEW_W / 2, 96);
    ctx.fillStyle = C.text;
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText("an offline speed dash", VIEW_W / 2, 140);

    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.fillStyle = G.menuChoice === 0 ? C.ring : C.text;
    ctx.fillText((G.menuChoice === 0 ? "▶ " : "") + "Campaign", VIEW_W / 2, TITLE_MENU.campaignY);
    ctx.fillStyle = G.menuChoice === 1 ? C.ring : C.text;
    ctx.fillText((G.menuChoice === 1 ? "▶ " : "") + "Level Select", VIEW_W / 2, TITLE_MENU.selectY);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText("Click / tap an option, or Up/Down + A / Space / Enter", VIEW_W / 2, 300);
    ctx.fillText("Campaign advances after each clear", VIEW_W / 2, 322);
    ctx.textAlign = "left";
  }

  // Which title item is at this canvas point, or -1.
  function titleItemAt(px, py) {
    if (px < TITLE_MENU.x0 || px > TITLE_MENU.x1) return -1;
    if (Math.abs(py - TITLE_MENU.campaignY) <= TITLE_MENU.half) return 0;
    if (Math.abs(py - TITLE_MENU.selectY) <= TITLE_MENU.half) return 1;
    return -1;
  }

  // Level-select grid geometry, shared by drawing and hit-testing.
  const GRID = { cols: 5, cellW: 104, cellH: 54, startY: 118, halfW: 42, halfH: 18 };
  function gridStartX() { return (VIEW_W - GRID.cols * GRID.cellW) / 2 + GRID.cellW / 2; }
  function levelCellAt(px, py) {
    const startX = gridStartX();
    for (let i = 0; i < window.LEVELS.length; i++) {
      const x = startX + (i % GRID.cols) * GRID.cellW;
      const y = GRID.startY + Math.floor(i / GRID.cols) * GRID.cellH;
      if (px >= x - GRID.halfW && px <= x + GRID.halfW &&
          py >= y - GRID.halfH && py <= y + GRID.halfH) return i;
    }
    return -1;
  }

  function drawLevelSelect() {
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.fillStyle = C.ring;
    ctx.fillText("LEVEL SELECT", VIEW_W / 2, 58);

    const startX = gridStartX();
    ctx.font = "bold 16px system-ui, sans-serif";
    for (let i = 0; i < window.LEVELS.length; i++) {
      const x = startX + (i % GRID.cols) * GRID.cellW;
      const y = GRID.startY + Math.floor(i / GRID.cols) * GRID.cellH;
      const selected = i === G.selectedLevel;
      ctx.fillStyle = selected ? "rgba(255,210,60,0.95)" : "rgba(255,255,255,0.14)";
      ctx.fillRect(x - GRID.halfW, y - GRID.halfH, GRID.halfW * 2, GRID.halfH * 2);
      ctx.strokeStyle = selected ? C.text : "rgba(255,255,255,0.22)";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(x - GRID.halfW, y - GRID.halfH, GRID.halfW * 2, GRID.halfH * 2);
      ctx.fillStyle = selected ? "#20120a" : C.text;
      ctx.fillText("ACT " + (i + 1), x, y);
    }

    ctx.fillStyle = C.text;
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.fillText(window.LEVELS[G.selectedLevel].name, VIEW_W / 2, 292);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText("Click / tap an act, or ◀ ▶ / arrows + A / Space to play", VIEW_W / 2, 322);
    ctx.fillText("⌂ button / Esc / B to go back to the title", VIEW_W / 2, 342);
    ctx.textAlign = "left";
  }

  function continuePrompt() {
    return G.playMode === "select" ? "Press A / Space / Tap to return to Level Select" : "Press A / Space / Tap to continue";
  }

  function render() {
    drawBackground();
    drawTiles();
    drawEntities();
    if (G.scene === "play" || G.scene === "pause") drawPlayer();

    if (G.flash > 0) {
      ctx.fillStyle = "rgba(255,255,255," + (G.flash / 10) + ")";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    if (G.scene === "play" || G.scene === "pause") drawHud();

    if (G.scene === "title") {
      drawTitleMenu();
    } else if (G.scene === "levelselect") {
      drawLevelSelect();
    } else if (G.scene === "pause") {
      centerText([
        { t: "PAUSED", big: true, gap: 40 },
        { t: "Start / Enter / tap to resume", small: true, gap: 22 },
        { t: "⌂ button / Esc / B to quit to " + (G.playMode === "select" ? "Level Select" : "title"), small: true },
      ]);
    } else if (G.scene === "clear") {
      centerText([
        { t: "ACT CLEAR!", big: true, color: C.ring, gap: 46 },
        { t: "Score " + G.score, gap: 34 },
        { t: continuePrompt(), small: true },
      ]);
    } else if (G.scene === "gameover") {
      centerText([
        { t: "GAME OVER", big: true, color: C.hero, gap: 46 },
        { t: "Score " + G.score, gap: 34 },
        { t: G.playMode === "select" ? "Press A / Space / Tap to return to Level Select" : "Press A / Space / Tap for title", small: true },
      ]);
    } else if (G.scene === "win") {
      centerText([
        { t: "YOU WIN!", big: true, color: C.ring, gap: 46 },
        { t: "Final score " + G.score, gap: 34 },
        { t: G.playMode === "select" ? "Press A / Space / Tap to return to Level Select" : "Press A / Space / Tap for title", small: true },
      ]);
    }
  }

  // ---------- Scene flow ----------
  function setScene(s) {
    G.scene = s;
    G.sceneLock = 8; // a held button won't leak into the new screen's action
  }

  function startGame() {
    startCampaign();
  }

  function startCampaign() {
    G.lives = 3;
    G.score = 0;
    G.playMode = "campaign";
    G.levelIndex = 0;
    loadLevel(0);
    setScene("play");
  }

  function startSelectedLevel() {
    G.lives = 3;
    G.score = 0;
    G.playMode = "select";
    G.levelIndex = G.selectedLevel;
    loadLevel(G.levelIndex);
    setScene("play");
  }

  function returnToTitle() {
    G.playMode = "campaign";
    G.menuChoice = 0;
    loadLevel(0); // a world to sit behind the title
    setScene("title");
  }

  // "Back" from a level or the pause screen: in Level Select mode step back to
  // the act grid; in Campaign mode go all the way to the title.
  function quitToHome() {
    Sfx.select();
    if (G.playMode === "select") {
      loadLevel(G.selectedLevel);
      setScene("levelselect");
    } else {
      returnToTitle();
    }
  }

  function moveTitleChoice(dir) {
    G.menuChoice = (G.menuChoice + dir + 2) % 2;
    Sfx.select();
  }

  function selectTitleChoice() {
    Sfx.select();
    if (G.menuChoice === 0) {
      startCampaign();
    } else {
      loadLevel(G.selectedLevel);
      setScene("levelselect");
    }
  }

  function moveSelectedLevel(delta) {
    const count = window.LEVELS.length;
    G.selectedLevel = (G.selectedLevel + delta + count) % count;
    loadLevel(G.selectedLevel);
    Sfx.select();
  }

  function step() {
    if (G.sceneLock > 0) G.sceneLock--;
    const menu = G.sceneLock === 0;
    if (G.scene === "play") {
      updatePlayer();
      updateEntities();
      updateCamera();
      G.time += STEP / 1000;
      // Only the dedicated pause control (touch ❚❚ button / Enter / gamepad
      // Start) pauses. A bare screen tap does nothing during play, so the
      // movement and jump buttons never pause the game.
      if (menu && Input.pressed("back")) quitToHome();
      else if (menu && Input.pressed("start")) setScene("pause");
    } else if (G.scene === "pause") {
      if (menu && Input.pressed("back")) quitToHome();
      else if (menu && (Input.pressed("start") || G.tap)) setScene("play");
    } else if (G.scene === "title") {
      if (menu && (Input.pressed("up") || Input.pressed("left"))) moveTitleChoice(-1);
      else if (menu && (Input.pressed("down") || Input.pressed("right"))) moveTitleChoice(1);
      else if (menu && G.tap) {
        // a click/tap on a label picks that option; a tap elsewhere confirms
        // whichever option is highlighted (so "tap to play" still works)
        const hit = titleItemAt(G.tapX, G.tapY);
        if (hit >= 0) G.menuChoice = hit;
        selectTitleChoice();
      } else if (menu && advancePressed()) {
        selectTitleChoice();
      }
    } else if (G.scene === "levelselect") {
      if (menu && Input.pressed("back")) { Sfx.select(); returnToTitle(); }
      else if (menu && Input.pressed("left")) moveSelectedLevel(-1);
      else if (menu && Input.pressed("right")) moveSelectedLevel(1);
      else if (menu && Input.pressed("up")) moveSelectedLevel(-5);
      else if (menu && Input.pressed("down")) moveSelectedLevel(5);
      else if (menu && G.tap) {
        // tap an act cell to play it directly
        const cell = levelCellAt(G.tapX, G.tapY);
        if (cell >= 0) { G.selectedLevel = cell; loadLevel(cell); Sfx.select(); startSelectedLevel(); }
      } else if (menu && advancePressed()) { Sfx.select(); startSelectedLevel(); }
    } else if (G.scene === "clear") {
      if (menu && Input.pressed("back")) {
        quitToHome();
      } else if (menu && (advancePressed() || G.tap)) {
        if (G.playMode === "select") {
          G.selectedLevel = G.levelIndex;
          loadLevel(G.selectedLevel);
          setScene("levelselect");
        } else {
          G.levelIndex++;
          loadLevel(G.levelIndex);
          setScene("play");
        }
      }
    } else if (G.scene === "gameover" || G.scene === "win") {
      if (menu && (advancePressed() || G.tap || Input.pressed("back"))) {
        Sfx.select();
        if (G.playMode === "select") {
          loadLevel(G.selectedLevel);
          setScene("levelselect");
        } else {
          returnToTitle();
        }
      }
    }
    G.tap = false; // consumed once per frame
  }

  function advancePressed() {
    return Input.pressed("jump") || Input.pressed("start");
  }

  // ---------- Main loop (fixed timestep) ----------
  let last = 0;
  let acc = 0;
  function frame(now) {
    if (!last) last = now;
    let dt = now - last;
    last = now;
    if (dt > 250) dt = 250; // avoid a huge catch-up after a tab sleep
    acc += dt;
    Input.poll();
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      step();
      acc -= STEP;
      steps++;
      G.anim++;
    }
    render();
    requestAnimationFrame(frame);
  }

  // ---------- Boot ----------
  // Resume audio + reveal that input works on the first interaction.
  function firstInteraction() {
    Sfx.resume();
  }
  window.addEventListener("keydown", firstInteraction, { once: true });
  window.addEventListener("pointerdown", firstInteraction, { once: true });

  // A click/tap on the play area (not on a control button — those sit on top and
  // get the event first) counts as "advance" on menu screens, and its position
  // lets menus be picked directly with a mouse or finger. During play it is
  // ignored, so tapping the screen never pauses on a phone. offsetX/offsetY are
  // in the canvas's own coordinate space, so this works even when the stage is
  // rotated for portrait.
  canvas.addEventListener("pointerdown", function (e) {
    Sfx.resume();
    G.tap = true;
    const w = canvas.clientWidth || VIEW_W;
    const h = canvas.clientHeight || VIEW_H;
    G.tapX = (e.offsetX / w) * VIEW_W;
    G.tapY = (e.offsetY / h) * VIEW_H;
  });

  // Mute toggle on M.
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyM") Sfx.toggleMute();
  });

  // Fullscreen button.
  const fsBtn = document.getElementById("fullscreen");
  if (fsBtn) {
    fsBtn.addEventListener("click", () => {
      const el = document.getElementById("stage");
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen();
      else if (document.exitFullscreen) document.exitFullscreen();
    });
  }

  // Keep the game landscape and filling the screen. In the browser (not an
  // installed app) iOS ignores the manifest's landscape hint, and rotation lock
  // can keep Safari in portrait — so when the screen is portrait on a touch
  // device we rotate the whole stage 90 degrees. The player turns the phone
  // sideways and sees an upright, full-screen landscape game either way.
  const stage = document.getElementById("stage");
  function layout() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const rotate = touch && vh > vw;
    let W, H;
    if (rotate) {
      stage.style.width = vh + "px";
      stage.style.height = vw + "px";
      stage.style.transform = "translateX(" + vw + "px) rotate(90deg)";
      W = vh; H = vw;
    } else {
      stage.style.width = vw + "px";
      stage.style.height = vh + "px";
      stage.style.transform = "none";
      W = vw; H = vh;
    }
    // Largest 16:9 box that fits inside the stage.
    let cw = W, ch = Math.round((W * 9) / 16);
    if (ch > H) { ch = H; cw = Math.round((H * 16) / 9); }
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_RENDER_SCALE);
    const pixelW = Math.max(VIEW_W, Math.round(cw * dpr));
    const pixelH = Math.max(VIEW_H, Math.round(ch * dpr));
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }
    setRenderScale();
  }
  window.addEventListener("resize", layout);
  window.addEventListener("orientationchange", layout);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", layout);
  layout();

  loadLevel(0); // load so the title screen has a world behind it
  requestAnimationFrame(frame);

  // Debug hook for the smoke test (harmless in normal play).
  window.GAME = {
    get scene() { return G.scene; },
    get rings() { return G.rings; },
    get score() { return G.score; },
    get lives() { return G.lives; },
    get playerX() { return G.player ? G.player.x : 0; },
    get playerY() { return G.player ? G.player.y : 0; },
    get level() { return G.levelIndex; },
    get grounded() { return G.player ? G.player.grounded : false; },
    get playMode() { return G.playMode; },
    get selectedLevel() { return G.selectedLevel; },
    get menuChoice() { return G.menuChoice; },
  };
})();
