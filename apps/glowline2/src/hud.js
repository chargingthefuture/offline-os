// The DOM overlays: title/level-select and the win screen. Also the one shared time
// formatter used by both the overlays and the in-game HUD.

export function formatTime(seconds) {
  if (seconds == null || !isFinite(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  const ss = s.toFixed(2).padStart(5, '0');
  return `${m}:${ss}`;
}

export class Hud {
  constructor(handlers) {
    this.handlers = handlers;
    this.menu = document.getElementById('menu');
    this.win = document.getElementById('win');
    this.levelList = document.getElementById('levelList');
    this.winTitle = document.getElementById('winTitle');
    this.winTimes = document.getElementById('winTimes');

    document.getElementById('btnNext').addEventListener('click', () => handlers.onNext());
    document.getElementById('btnReplay').addEventListener('click', () => handlers.onReplay());
    document.getElementById('btnMenu').addEventListener('click', () => handlers.onMenu());

    // Focus target for gamepad navigation: the list of focusable buttons on the
    // overlay that is currently showing, plus which one is highlighted.
    this._focusEls = [];
    this._focusIdx = 0;
  }

  // Gamepad focus helpers ------------------------------------------------
  // The visible overlay hands its buttons to _setFocus; moveFocus steps through
  // them and activateFocus clicks the highlighted one. This also drives the
  // native :focus, so the same highlight works for keyboard Tab users.
  _setFocus(els) {
    for (const el of this._focusEls) el.classList.remove('gp-focus');
    this._focusEls = els.filter(Boolean);
    this._focusIdx = 0;
    if (this._focusEls.length) this._applyFocus();
  }

  _applyFocus() {
    this._focusEls.forEach((el, i) => el.classList.toggle('gp-focus', i === this._focusIdx));
    const el = this._focusEls[this._focusIdx];
    if (el) el.focus({ preventScroll: true });
  }

  moveFocus(delta) {
    const n = this._focusEls.length;
    if (!n) return;
    this._focusIdx = (this._focusIdx + delta + n) % n;
    this._applyFocus();
  }

  activateFocus() {
    const el = this._focusEls[this._focusIdx];
    if (el) el.click();
  }

  showMenu(levels, bests) {
    this.win.classList.add('hidden');
    this.menu.classList.remove('hidden');
    this.levelList.innerHTML = '';
    levels.forEach((lvl, i) => {
      const card = document.createElement('button');
      card.className = 'level-card';
      const best = bests[i] != null ? `best ${formatTime(bests[i])}` : 'not yet run';
      card.innerHTML =
        `<span class="idx">LEVEL ${i + 1}</span>` +
        `<span class="name">${lvl.name}</span>` +
        `<span class="meta">par ${formatTime(lvl.par)}</span>` +
        `<span class="best">${best}</span>`;
      card.addEventListener('click', () => this.handlers.onSelectLevel(i));
      this.levelList.appendChild(card);
    });
    this._setFocus([...this.levelList.children]);
  }

  hideMenu() {
    this.menu.classList.add('hidden');
    this._setFocus([]);
  }

  showWin({ time, best, isRecord, par, beatPar, hasNext }) {
    this.win.classList.remove('hidden');
    this.winTitle.textContent = isRecord ? 'New record!' : 'Finished';
    const parRow = par != null
      ? `<div class="${beatPar ? 'record' : ''}"><span class="lbl">${beatPar ? 'under par' : 'par'}</span> ${formatTime(par)}</div>`
      : '';
    this.winTimes.innerHTML =
      `<div><span class="lbl">time</span> ${formatTime(time)}</div>` +
      `<div class="${isRecord ? 'record' : ''}"><span class="lbl">best</span> ${formatTime(best)}</div>` +
      parRow;
    const btnNext = document.getElementById('btnNext');
    btnNext.style.display = hasNext ? '' : 'none';
    this._setFocus([
      hasNext ? btnNext : null,
      document.getElementById('btnReplay'),
      document.getElementById('btnMenu'),
    ]);
  }

  hideWin() {
    this.win.classList.add('hidden');
    this._setFocus([]);
  }
}
