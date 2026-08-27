// Player input: keyboard, touch, and gamepad. The game reads a steer/boost sample
// each frame and asks whether a one-shot action (restart / mute) fired. On-screen
// touch buttons are laid out by the game (so they match what gets drawn); this
// module only hit-tests pointers against those rectangles. Gamepads (for example an
// 8BitDo Pro 2) are polled once per frame via poll(), which the game calls before it
// reads the sample.

const STICK_DEADZONE = 0.3; // ignore small resting drift on the left stick

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pointers = new Map(); // pointerId -> {x, y}
    this.buttons = { left: null, right: null, boost: null, restart: null, mute: null, home: null };
    this.usingTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this._restart = false;
    this._muteToggle = false;
    this._menu = false; // "back to the level menu" one-shot

    // Cached gamepad state, refreshed each frame by poll().
    this._padSteer = 0;
    this._padBoost = false;
    this._padPrev = {}; // last pressed-state per named button, for rising-edge detection
    this._padIndex = null;
    this._nav = 0;      // menu focus move this frame: -1 up/prev, +1 down/next
    this._confirm = false; // menu "activate the focused item" one-shot

    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));

    window.addEventListener('gamepadconnected', (e) => {
      // Latch onto the first pad we see; the browser only surfaces it after a button
      // press, so this fires the moment the controller is actually used.
      if (this._padIndex === null) this._padIndex = e.gamepad.index;
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (this._padIndex === e.gamepad.index) {
        this._padIndex = null;
        this._padSteer = 0;
        this._padBoost = false;
        this._padPrev = {};
      }
    });

    canvas.addEventListener('pointerdown', (e) => this._onPointer(e, true));
    canvas.addEventListener('pointermove', (e) => this._onPointer(e, null));
    canvas.addEventListener('pointerup', (e) => this._onPointer(e, false));
    canvas.addEventListener('pointercancel', (e) => this._onPointer(e, false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Read the active gamepad once per frame. Fills the steer/boost cache that sample()
  // merges in, and raises the restart/mute one-shots on a button's rising edge.
  poll() {
    const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    let pad = this._padIndex !== null ? pads[this._padIndex] : null;
    if (!pad) {
      // Fall back to the first connected pad — covers browsers that populate the array
      // without ever firing gamepadconnected.
      for (const p of pads) { if (p) { pad = p; this._padIndex = p.index; break; } }
    }
    if (!pad) {
      this._padSteer = 0;
      this._padBoost = false;
      return;
    }

    const axis = pad.axes && pad.axes.length > 0 ? pad.axes[0] : 0;
    const pressed = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);

    // Steer: left stick X (with a deadzone) or the D-pad. Standard mapping puts the
    // D-pad on buttons 14 (left) and 15 (right).
    let steer = Math.abs(axis) > STICK_DEADZONE ? axis : 0;
    if (pressed(14)) steer -= 1;
    if (pressed(15)) steer += 1;
    this._padSteer = Math.max(-1, Math.min(1, steer));

    // Boost: forgiving — A, the shoulders, or the triggers. B is left out because it
    // is the "back to the menu" button (see below).
    this._padBoost = pressed(0) || pressed(4) || pressed(5) || pressed(6) || pressed(7);

    // One-shots on rising edge. Start (9) restarts; Select/Back (8) toggles mute;
    // B (1) backs out to the level menu.
    if (this._padEdge('restart', pressed(9))) this._restart = true;
    if (this._padEdge('mute', pressed(8))) this._muteToggle = true;
    if (this._padEdge('menu', pressed(1))) this._menu = true;

    // Menu navigation: D-pad or either stick moves the focus, A (0) confirms.
    // These raise one-shots the game reads while on the menu / win screen; during
    // play they are simply consumed and ignored. The vertical axis is axes[1].
    const axisY = pad.axes && pad.axes.length > 1 ? pad.axes[1] : 0;
    const navPrev = pressed(12) || pressed(14) || axis < -STICK_DEADZONE || axisY < -STICK_DEADZONE;
    const navNext = pressed(13) || pressed(15) || axis > STICK_DEADZONE || axisY > STICK_DEADZONE;
    if (this._padEdge('navPrev', navPrev)) this._nav = -1;
    if (this._padEdge('navNext', navNext)) this._nav = 1;
    if (this._padEdge('confirm', pressed(0))) this._confirm = true;
  }

  _padEdge(name, isDown) {
    const was = this._padPrev[name];
    this._padPrev[name] = isDown;
    return isDown && !was;
  }

  _onKey(e, down) {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'a', 'd', 'w', 'r', 'm', 'escape'].includes(k)) {
      e.preventDefault();
    }
    if (down && k === 'r') this._restart = true;
    if (down && k === 'm') this._muteToggle = true;
    if (down && k === 'escape') this._menu = true; // back to the level menu
    if (down) this.keys.add(k);
    else this.keys.delete(k);
  }

  _onPointer(e, down) {
    e.preventDefault();
    this.usingTouch = this.usingTouch || e.pointerType === 'touch';
    const r = this.canvas.getBoundingClientRect();
    const pt = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (down === true) {
      this.pointers.set(e.pointerId, pt);
      if (this._hit(this.buttons.restart, pt)) this._restart = true;
      if (this._hit(this.buttons.mute, pt)) this._muteToggle = true;
      if (this._hit(this.buttons.home, pt)) this._menu = true;
    } else if (down === false) {
      this.pointers.delete(e.pointerId);
    } else if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, pt);
    }
  }

  _hit(rect, pt) {
    return rect && pt.x >= rect.x && pt.x <= rect.x + rect.w && pt.y >= rect.y && pt.y <= rect.y + rect.h;
  }

  _anyPointerIn(rect) {
    if (!rect) return false;
    for (const pt of this.pointers.values()) if (this._hit(rect, pt)) return true;
    return false;
  }

  // Rectangles for the on-screen buttons, in CSS pixels, supplied by the game each frame.
  setButtons(buttons) {
    this.buttons = buttons;
  }

  // Returns { steer: -1..1, boost: bool }.
  sample() {
    let steer = 0;
    const k = this.keys;
    if (k.has('arrowleft') || k.has('a')) steer -= 1;
    if (k.has('arrowright') || k.has('d')) steer += 1;
    if (this._anyPointerIn(this.buttons.left)) steer -= 1;
    if (this._anyPointerIn(this.buttons.right)) steer += 1;

    let boost = k.has(' ') || k.has('arrowup') || k.has('w');
    if (this._anyPointerIn(this.buttons.boost)) boost = true;

    // Fold in the gamepad state gathered by the last poll().
    steer += this._padSteer;
    if (this._padBoost) boost = true;

    return { steer: Math.max(-1, Math.min(1, steer)), boost };
  }

  consumeRestart() {
    const r = this._restart;
    this._restart = false;
    return r;
  }

  consumeMuteToggle() {
    const m = this._muteToggle;
    this._muteToggle = false;
    return m;
  }

  // True once when the player asked to go back to the level menu (home button,
  // Escape, or the gamepad's B button).
  consumeMenu() {
    const m = this._menu;
    this._menu = false;
    return m;
  }

  // -1 (up/prev) / 0 / +1 (down/next) — a single focus step from the gamepad.
  consumeNav() {
    const n = this._nav;
    this._nav = 0;
    return n;
  }

  // True once when the gamepad's confirm button (A) was pressed.
  consumeConfirm() {
    const c = this._confirm;
    this._confirm = false;
    return c;
  }
}
