// Tiny synthesized sound effects — no audio assets. Every cue goes through cue(), which
// respects the sound/calm settings and reports the cue name so the UI can caption it.

import { soundOff, settings } from './settings';

export type CueName =
  | 'hit'
  | 'combo-finish'
  | 'jump'
  | 'hurt'
  | 'defeat'
  | 'checkpoint'
  | 'boss-appear'
  | 'boss-down'
  | 'deflect'
  | 'alarm'
  | 'ui';

/** Caption text per cue, shown when captions are on. */
export const CUE_CAPTIONS: Record<CueName, string> = {
  hit: '*thwack*',
  'combo-finish': '*POW*',
  jump: '*hop*',
  hurt: '*oof*',
  defeat: '*poof — tactic gone*',
  checkpoint: '*checkpoint chime*',
  'boss-appear': '*low rumble*',
  'boss-down': '*triumphant fanfare*',
  deflect: '*fwip — right back at you*',
  alarm: '*ding — name check*',
  ui: '*click*',
};

let ctx: AudioContext | null = null;
let captionListener: ((text: string) => void) | null = null;

export function onCaption(fn: (text: string) => void): void {
  captionListener = fn;
}

function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0): void {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function cue(name: CueName): void {
  if (settings.captions && captionListener) captionListener(CUE_CAPTIONS[name]);
  if (soundOff()) return;
  switch (name) {
    case 'hit':
      tone(220, 0.08, 'square', 0.12);
      break;
    case 'combo-finish':
      tone(180, 0.1, 'square', 0.16);
      tone(360, 0.12, 'square', 0.1, 0.04);
      break;
    case 'jump':
      tone(300, 0.1, 'sine', 0.08);
      break;
    case 'hurt':
      tone(140, 0.16, 'sawtooth', 0.1);
      break;
    case 'defeat':
      tone(520, 0.1, 'triangle', 0.12);
      tone(660, 0.12, 'triangle', 0.1, 0.06);
      break;
    case 'checkpoint':
      tone(440, 0.12, 'sine', 0.1);
      tone(660, 0.16, 'sine', 0.1, 0.1);
      break;
    case 'boss-appear':
      tone(80, 0.5, 'sawtooth', 0.08);
      break;
    case 'boss-down':
      tone(392, 0.14, 'triangle', 0.12);
      tone(523, 0.14, 'triangle', 0.12, 0.12);
      tone(659, 0.22, 'triangle', 0.12, 0.24);
      break;
    case 'deflect':
      tone(700, 0.07, 'square', 0.1);
      tone(900, 0.09, 'square', 0.08, 0.04);
      break;
    case 'alarm':
      tone(880, 0.12, 'sine', 0.1);
      tone(880, 0.12, 'sine', 0.08, 0.18);
      break;
    case 'ui':
      tone(500, 0.05, 'sine', 0.06);
      break;
  }
}
