// Boot + orchestration. Owns the canvas/transform and the RAF loop, runs the
// story engine (ported from main.gd's scene chain), and routes input.

import * as audio from "./audio.js";
import * as dlg from "./dialogue.js";
import { Background, Race, VW, VH } from "./game.js";
import { STORY, ENDINGS } from "./story.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");
const hudName = document.getElementById("hudName");
const hudSub = document.getElementById("hudSub");
const bar = document.getElementById("progressFill");
const toast = document.getElementById("toast");
const titleScreen = document.getElementById("title");
const startBtn = document.getElementById("startBtn");
const endScreen = document.getElementById("end");
const endText = document.getElementById("endText");
const replayBtn = document.getElementById("replayBtn");
const muteBtn = document.getElementById("muteBtn");

const bg = new Background();
let activeRace = null;
let lastT = 0;
let view = { scale: 1, ox: 0, oy: 0 };

// ---- canvas sizing: virtual 720x1280, letterboxed, DPR-aware ----
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + "px"; canvas.style.height = h + "px";
  const scale = Math.min(w / VW, h / VH);
  view = { scale: scale * dpr, ox: (w - VW * scale) / 2 * dpr, oy: (h - VH * scale) / 2 * dpr };
}
window.addEventListener("resize", resize);
resize();

// ---- main loop ----
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
  lastT = t;
  pollGamepad();
  bg.update(dt);
  if (activeRace) activeRace.update(dt);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#06060f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  bg.draw(ctx);
  if (activeRace) activeRace.draw(ctx);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- input routing (only active during a race) ----
let steer = 0, keyL = false, keyR = false;
// Keyboard takes priority; when no key is held, the controller's steer applies.
function applySteer() {
  const key = (keyR ? 1 : 0) - (keyL ? 1 : 0);
  steer = key !== 0 ? key : padSteer;
  if (activeRace) activeRace.setSteer(steer);
}

window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") { keyL = true; applySteer(); }
  if (e.code === "ArrowRight" || e.code === "KeyD") { keyR = true; applySteer(); }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") { keyL = false; applySteer(); }
  if (e.code === "ArrowRight" || e.code === "KeyD") { keyR = false; applySteer(); }
});

// touch: hold left/right half of the screen to steer (player.gd _input)
function pointSteer(clientX) {
  if (!activeRace) return;
  steer = clientX < window.innerWidth / 2 ? -1 : 1;
  activeRace.setSteer(steer);
}
canvas.addEventListener("pointerdown", (e) => pointSteer(e.clientX));
canvas.addEventListener("pointermove", (e) => { if (e.pressure > 0 || e.buttons) pointSteer(e.clientX); });
canvas.addEventListener("pointerup", () => { if (activeRace) { steer = 0; applySteer(); } });
canvas.addEventListener("pointercancel", () => { if (activeRace) { steer = 0; applySteer(); } });

// ---- gamepad ----
// The Gamepad API is poll-based, so we read it once per frame from pollGamepad()
// (called inside the RAF loop). Steering comes from the left stick X-axis or the
// D-pad; the A button starts/replays. Polling only does work when a pad is
// attached, so there is no cost otherwise. iOS Safari exposes this for paired
// Bluetooth / MFi controllers; there is no on-screen virtual pad.
let padConnected = false;
let padSteer = 0;          // -1 / 0 / 1 from the controller, separate from keys
let padActionPrev = false; // edge-detect the A button so a hold fires once
const STICK_DEADZONE = 0.35;

window.addEventListener("gamepadconnected", () => { padConnected = true; });
window.addEventListener("gamepaddisconnected", () => {
  // If no pads remain, stop letting a stale stick value hold the steer.
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  padConnected = Array.from(pads).some(Boolean);
  if (!padConnected && activeRace && padSteer !== 0) { padSteer = 0; applySteer(); }
});

function firstPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p) return p;
  return null;
}

function pollGamepad() {
  if (!padConnected) return;
  const p = firstPad();
  if (!p) return;

  // Steering: left stick X (axis 0) with a deadzone, falling back to the D-pad
  // (buttons 14 = left, 15 = right in the Standard Gamepad mapping).
  const ax = p.axes[0] || 0;
  const dLeft = p.buttons[14] && p.buttons[14].pressed;
  const dRight = p.buttons[15] && p.buttons[15].pressed;
  let s = 0;
  if (dLeft) s = -1; else if (dRight) s = 1;
  else if (ax <= -STICK_DEADZONE) s = -1; else if (ax >= STICK_DEADZONE) s = 1;
  if (s !== padSteer) {
    padSteer = s;
    // A left/right press also moves the highlight on a choice prompt (edge only,
    // so one flick moves one step). moveChoice() is a no-op unless a prompt is up.
    if (s !== 0) dlg.moveChoice(s);
    applySteer();
  }

  // A button (index 0): advance the story. It starts on the title screen,
  // replays on the end screen, and otherwise advances a dialogue line or picks
  // the highlighted choice. Edge-detected so holding it does not retrigger.
  const action = !!(p.buttons[0] && p.buttons[0].pressed);
  if (action && !padActionPrev) {
    if (titleScreen.classList.contains("visible")) begin();
    else if (endScreen.classList.contains("visible")) replay();
    else dlg.advance();
  }
  padActionPrev = action;
}

// ---- toast ----
let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 1100);
}

// ---- race segment ----
// ?fast shortens every race (handy for previewing the story / testing).
const FAST = new URLSearchParams(location.search).has("fast");
async function runRace(cfg) {
  if (FAST) cfg = { ...cfg, seconds: Math.max(2, cfg.seconds / 6) };
  hudName.textContent = cfg.name;
  hudSub.textContent = cfg.subtitle;
  bar.style.width = "0%";
  hud.classList.add("visible");
  bg.setIntensity({ calm: 0.2, hazard: 0.45, fast: 0.7, intense: 1.0 }[cfg.mode] || 0.4);

  activeRace = new Race(cfg, {
    bg,
    onProgress: (p) => { bar.style.width = (p * 100).toFixed(1) + "%"; },
    onHit: () => showToast("GL-1N3: System error!"),
  });
  applySteer();
  await activeRace.start();
  audio.success();
  activeRace = null;
  hud.classList.remove("visible");
  bg.setIntensity(0.15);
}

// ---- story engine (drives main.gd's scene chain) ----
async function runStory() {
  let branch = "pulse";
  for (const beat of STORY) {
    if (beat.say) {
      const lines = typeof beat.say === "function" ? beat.say(branch) : beat.say;
      if (lines && lines.length) await dlg.say(lines); // a branch may skip a beat
    } else if (beat.choice) {
      const opt = await dlg.choose(beat.choice.prompt, beat.choice.options);
      branch = opt.branch;
      dlg.hideDialogue();
      if (opt.line) await dlg.say([opt.line]);
    } else if (beat.race) {
      const cfg = typeof beat.race === "function" ? beat.race(branch) : beat.race;
      if (cfg) await runRace(cfg);
    }
  }
  showEnd(branch);
}

function showEnd(branch) {
  endText.textContent = ENDINGS[branch] || ENDINGS.pulse;
  endScreen.classList.add("visible");
}

// ---- title / start ----
function begin() {
  titleScreen.classList.remove("visible");
  audio.start();           // must be inside the gesture (iOS)
  runStory();
}
startBtn.addEventListener("click", begin);

function replay() {
  endScreen.classList.remove("visible");
  runStory();
}
replayBtn.addEventListener("click", replay);

muteBtn.addEventListener("click", () => {
  const m = audio.toggleMute();
  muteBtn.textContent = m ? "🔇" : "🔊";
  muteBtn.setAttribute("aria-label", m ? "Unmute" : "Mute");
});

// ---- service worker (offline) ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW failed", e));
  });
}

titleScreen.classList.add("visible");
