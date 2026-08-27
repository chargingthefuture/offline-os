// Procedural sound — every tone is generated with the Web Audio API, so there are
// no audio files to load, ship, or cache. It must be started from a user gesture
// (browsers, and iOS in particular, block sound until the player interacts).
//
// The mute setting is saved in the browser so it sticks between runs.

let ctx = null;
let master = null;      // everything routes through here; muting sets it to 0
let musicGain = null;   // background music bus, sits under the sound effects
let musicStep = 0;      // position in the arpeggio
let musicTimer = null;  // the setTimeout that steps the sequence
let started = false;
let muted = readMuted();

// Background music: a gentle A-minor arpeggio with a soft octave shimmer and a
// slow sawtooth bass, ported from Glowline's procedural synthwave. No audio
// files — every note is a Web Audio oscillator, stepped by a light timer.
const MUSIC_SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0]; // A3 C4 D4 E4 G4 A4
const MUSIC_BASS = [110.0, 130.81, 146.83, 98.0];                  // A2 C3 D3 G2

function readMuted() {
  try { return localStorage.getItem('glowline2.muted') === '1'; } catch (_) { return false; }
}

function now() { return ctx.currentTime; }

// iOS treats Web Audio as "ambient" by default, so the ringer/mute switch can
// silence an installed app entirely. Asking for the "playback" session (where
// supported) makes the game play through the switch.
function claimPlayback() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch (_) { /* not supported — keep the default */ }
}

export function start() {
  claimPlayback();
  if (started) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.85;
  master.connect(ctx.destination);

  // Background music bus, kept a little quieter than the effects.
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.5;
  musicGain.connect(master);

  started = true;
  if (ctx.state === 'suspended') ctx.resume();

  // Kick off the arpeggio loop.
  musicStep = 0;
  musicTick();
}

// One step of the background music, scheduled slightly ahead and re-armed on a
// timer so the loop keeps running for as long as the game is open.
function musicTick() {
  if (!ctx) return;
  clearTimeout(musicTimer);
  const t = now() + 0.06;
  const beat = 0.5; // seconds per arpeggio step
  const s = musicStep;

  // Arpeggio, dropping an octave for the second half of each 12-step phrase.
  const note = MUSIC_SCALE[s % MUSIC_SCALE.length] * (s % 12 < 6 ? 1 : 0.5);
  tone(note, t, 0.45, 'triangle', 0.12, musicGain);
  // A soft higher shimmer every other step.
  if (s % 2 === 0) tone(note * 2, t, 0.6, 'sine', 0.05, musicGain);
  // A slow bass note every four steps.
  if (s % 4 === 0) tone(MUSIC_BASS[(s / 4) % MUSIC_BASS.length], t, 1.4, 'sawtooth', 0.10, musicGain);

  musicStep++;
  musicTimer = setTimeout(musicTick, beat * 1000);
}

export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('glowline2.muted', m ? '1' : '0'); } catch (_) {}
  if (master) master.gain.value = m ? 0 : 0.85;
  return muted;
}
export function toggleMute() { return setMuted(!muted); }
export function isMuted() { return muted; }

// One short tone with a quick attack and exponential fall.
function tone(freq, t, dur, type, peak, dest) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest || master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// ---- effects (all no-ops until start() runs) ----

export function boost() {
  if (!ctx) return;
  const t = now() + 0.01;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(660, t + 0.25);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.35);
}

export function finish() {
  if (!ctx) return;
  const t = now() + 0.01;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.09, 0.4, 'triangle', 0.12));
}

export function respawn() {
  if (!ctx) return;
  const t = now() + 0.01;
  tone(440, t, 0.14, 'sine', 0.08);
  tone(294, t + 0.08, 0.18, 'sine', 0.08);
}

export function blip() {
  if (!ctx) return;
  tone(660, now() + 0.01, 0.09, 'square', 0.07);
}
