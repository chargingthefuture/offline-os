// Action-based input with remappable bindings. Reads the player's custom bindings from
// settings plus the built-in alternates (WASD + X), tracked from raw KeyboardEvent codes
// so rebinding works for any physical key.

import { gpDown, gpJustPressed } from './gamepad';
import { BUILTIN_ALT_BINDINGS, settings, type BindableAction } from './settings';

const GAME_CODES = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

// Virtual (touch-button) input, shared between the on-screen buttons and ActionInput.
const virtualDown = new Set<BindableAction>();
const virtualPressed = new Set<BindableAction>();

export function virtualPress(action: BindableAction): void {
  if (!virtualDown.has(action)) virtualPressed.add(action);
  virtualDown.add(action);
}

export function virtualRelease(action: BindableAction): void {
  virtualDown.delete(action);
}

export class ActionInput {
  private down = new Set<string>();
  private pressed = new Set<string>();

  private onKeyDown = (e: KeyboardEvent): void => {
    if (GAME_CODES.has(e.code)) e.preventDefault();
    if (!e.repeat) this.pressed.add(e.code);
    this.down.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.down.clear();
    this.pressed.clear();
    virtualDown.clear();
    virtualPressed.clear();
  }

  private codes(action: BindableAction): string[] {
    return [settings.bindings[action], ...BUILTIN_ALT_BINDINGS[action]];
  }

  isDown(action: BindableAction): boolean {
    return virtualDown.has(action) || gpDown(action) || this.codes(action).some((c) => this.down.has(c));
  }

  justPressed(action: BindableAction): boolean {
    return (
      virtualPressed.has(action) || gpJustPressed(action) || this.codes(action).some((c) => this.pressed.has(c))
    );
  }

  /** Call at the end of each scene update to clear one-frame presses. */
  endFrame(): void {
    this.pressed.clear();
    virtualPressed.clear();
  }
}

/** Human-readable label for a KeyboardEvent.code. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }[code] ?? code;
  return code;
}
