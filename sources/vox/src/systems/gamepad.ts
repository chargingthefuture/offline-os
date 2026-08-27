// Gamepad support via the browser Gamepad API (standard mapping — Xbox-style pads,
// 8BitDo, DualShock, and the like). Left stick or d-pad moves; bottom face button (A)
// jumps; the other face buttons (B/X/Y) attack; Start doubles as "confirm/dismiss".
//
// Polled once per frame by whichever scenes are active; edge detection lives here so
// isDown/justPressed match the keyboard semantics in input.ts.

export type GamepadAction = 'left' | 'right' | 'jump' | 'attack' | 'start';

const STICK_DEADZONE = 0.4;

let prev = new Set<GamepadAction>();
let curr = new Set<GamepadAction>();
let lastFrame = -1;

/** Sample all connected pads. Deduped per frame — pass the game loop's frame counter. */
export function sampleGamepad(frame: number): void {
  if (frame === lastFrame) return;
  lastFrame = frame;
  prev = curr;
  curr = new Set();
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) {
    if (!pad || !pad.connected) continue;
    const ax = pad.axes[0] ?? 0;
    const b = (i: number): boolean => pad.buttons[i]?.pressed === true;
    if (ax < -STICK_DEADZONE || b(14)) curr.add('left');
    if (ax > STICK_DEADZONE || b(15)) curr.add('right');
    if (b(0)) curr.add('jump'); // bottom face button
    // Attack on any non-jump face button (1/2/3) OR any shoulder/trigger (4-7). Forgiving on
    // purpose: pads vary by mode (X-input, D-input, Switch), so almost anything that isn't the
    // jump button attacks — no one should get stuck hunting for the attack button.
    if (b(1) || b(2) || b(3) || b(4) || b(5) || b(6) || b(7)) curr.add('attack');
    if (b(9)) curr.add('start');
  }
}

export function gpDown(action: GamepadAction): boolean {
  return curr.has(action);
}

export function gpJustPressed(action: GamepadAction): boolean {
  return curr.has(action) && !prev.has(action);
}

/** Any confirm-style press (start / jump / attack) this frame — menus and overlays. */
export function gpConfirmPressed(): boolean {
  return gpJustPressed('start') || gpJustPressed('jump') || gpJustPressed('attack');
}
