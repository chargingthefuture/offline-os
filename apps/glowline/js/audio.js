// Procedural synthwave — no audio files, so nothing to ship or cache.
// Calm, minor-key arpeggio + soft bass pad (supportive tone per STORY.md),
// plus a few UI sound effects. Must be started from a user gesture (iOS).

let ctx = null;
let master = null;
let musicGain = null;
let started = false;
let muted = false;
let stepTimer = null;

// A-minor / aeolian, gentle.
const SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0]; // A3 C4 D4 E4 G4 A4
const BASS = [110.0, 130.81, 146.83, 98.0];                   // A2 C3 D3 G2
let step = 0;

function now() { return ctx.currentTime; }

function tone(freq, t, dur, type, peak, dest) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest || master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function tick() {
  if (!ctx) return;
  clearTimeout(stepTimer); // keep a single sequencer loop even if re-kicked
  const t = now() + 0.06;
  const beat = 0.5; // seconds per arpeggio step
  // arpeggio
  const note = SCALE[step % SCALE.length] * (step % 12 < 6 ? 1 : 0.5);
  tone(note, t, 0.45, "triangle", 0.12, musicGain);
  // soft higher shimmer every other step
  if (step % 2 === 0) tone(note * 2, t, 0.6, "sine", 0.05, musicGain);
  // bass every 4 steps
  if (step % 4 === 0) tone(BASS[(step / 4) % BASS.length], t, 1.4, "sawtooth", 0.10, musicGain);
  step++;
  stepTimer = setTimeout(tick, beat * 1000);
}

// iOS treats Web Audio as "ambient" by default, so the hardware ringer/mute
// switch silences it and an installed PWA can come up with no sound at all.
// Asking for the "playback" audio session (iOS 16.4+) makes the game play
// through the switch. Guarded because it is not available everywhere.
function claimPlaybackAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
  } catch (_) { /* not supported — fall back to default behavior */ }
}

export function start() {
  claimPlaybackAudio();
  if (started) {
    if (ctx.state === "suspended") ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = muted ? 0 : 0.7;
  musicGain.connect(master);
  started = true;
  // resume() can settle a beat after the gesture on iOS; (re)kick the
  // sequencer once it actually runs so the music is not stuck silent.
  if (ctx.state === "suspended") ctx.resume().then(tick).catch(() => {});
  tick();
}

export function setMuted(m) {
  muted = m;
  if (musicGain) musicGain.gain.value = m ? 0 : 0.7;
  return muted;
}

export function toggleMute() { return setMuted(!muted); }
export function isMuted() { return muted; }

// ---- one-shot UI sfx ----
function sfx(freqs, dur, type, peak) {
  if (!ctx || muted) return;
  const t = now() + 0.01;
  freqs.forEach((f, i) => tone(f, t + i * 0.04, dur, type, peak, master));
}

export const blip = () => sfx([660], 0.08, "square", 0.06);
export const choose = () => sfx([523.25, 659.25, 783.99], 0.18, "triangle", 0.10);
export const success = () => sfx([523.25, 659.25, 783.99, 1046.5], 0.3, "triangle", 0.12);
export const error = () => sfx([196, 155.56], 0.25, "sawtooth", 0.12);
