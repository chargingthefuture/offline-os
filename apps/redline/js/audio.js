/* Sound for Redline, made entirely from oscillator beeps so there are no audio
 * files to load — the game stays fully offline. Browsers only allow sound after
 * the player interacts, so the audio engine is created lazily on the first blip
 * and also resumed on the first key/touch/gamepad press (see game.js).
 */
(function () {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    return ctx;
  }

  // One beep: a shaped tone that slides from f0 to f1 over `dur` seconds.
  function tone(f0, f1, dur, type, vol) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.linearRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.5, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const Sfx = {
    resume() {
      const c = ensure();
      if (c && c.state === "suspended") c.resume();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    jump() { tone(320, 620, 0.16, "square", 0.4); },
    ring() { tone(880, 1320, 0.12, "sine", 0.4); },
    spring() { tone(300, 900, 0.22, "triangle", 0.5); },
    roll() { tone(500, 260, 0.18, "sawtooth", 0.3); },
    charge() { tone(180, 520, 0.12, "sawtooth", 0.25); },
    defeat() { tone(660, 120, 0.22, "square", 0.4); },
    hurt() { tone(400, 90, 0.35, "sawtooth", 0.5); },
    goal() {
      tone(523, 523, 0.12, "square", 0.4);
      setTimeout(() => tone(659, 659, 0.12, "square", 0.4), 120);
      setTimeout(() => tone(784, 784, 0.12, "square", 0.4), 240);
      setTimeout(() => tone(1047, 1047, 0.22, "square", 0.4), 360);
    },
    death() {
      tone(400, 380, 0.15, "triangle", 0.4);
      setTimeout(() => tone(300, 120, 0.5, "triangle", 0.4), 160);
    },
    select() { tone(600, 900, 0.08, "square", 0.35); },
  };

  window.Sfx = Sfx;
})();
