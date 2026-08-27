// Dialogue overlay — ports scripts/dialogue_manager.gd to the DOM.
// Typewriter reveal; tap/click/Space completes the line, then advances.
// say(lines) -> Promise(resolved when all lines shown)
// choose(prompt, options) -> Promise(resolved with the chosen option)

import * as audio from "./audio.js";

const box = document.getElementById("dialogue");
const textEl = document.getElementById("dialogueText");
const hintEl = document.getElementById("dialogueHint");
const choicesEl = document.getElementById("choices");

let revealTimer = null;

// Gamepad hooks. While a line waits for input, `advanceLine` triggers the same
// action as a tap. While a choice prompt is up, `choiceButtons`/`choiceIndex`
// track the highlighted option so a controller can move and activate it. These
// let the gamepad poll in main.js drive the dialogue with no touch or key.
let advanceLine = null;
let choiceButtons = [];
let choiceIndex = -1;

function show() { box.classList.add("visible"); }
function hide() { box.classList.remove("visible"); }

function typewrite(line) {
  return new Promise((resolve) => {
    clearInterval(revealTimer);
    textEl.textContent = "";
    hintEl.style.opacity = "0";
    let i = 0;
    let done = false;
    const speaker = line.split(":")[0];
    box.dataset.speaker = /pulse/i.test(speaker) ? "pulse"
      : /broker/i.test(speaker) ? "broker"
      : /gl-1n3/i.test(speaker) ? "player" : "narrator";

    const finish = () => {
      done = true;
      clearInterval(revealTimer);
      textEl.textContent = line;
      hintEl.style.opacity = "1";
      cleanup();
      resolve();
    };
    // First tap completes the reveal; a later one resolves (we resolve on
    // complete anyway). Shared by pointer, keyboard, and the gamepad.
    const act = () => {
      if (!done) finish();
      else { cleanup(); resolve("advance"); }
    };
    const onInput = (e) => {
      if (e.type === "keydown" && e.code !== "Space" && e.code !== "Enter") return;
      e.preventDefault();
      act();
    };
    function cleanup() {
      box.removeEventListener("pointerdown", onInput);
      window.removeEventListener("keydown", onInput);
      advanceLine = null;
    }
    box.addEventListener("pointerdown", onInput);
    window.addEventListener("keydown", onInput);
    advanceLine = act;

    revealTimer = setInterval(() => {
      i++;
      textEl.textContent = line.slice(0, i);
      if (i % 2 === 0) audio.blip();
      if (i >= line.length) finish();
    }, 22);
  });
}

function waitForAdvance() {
  return new Promise((resolve) => {
    const finish = () => {
      box.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
      advanceLine = null;
      resolve();
    };
    const go = (e) => {
      if (e.type === "keydown" && e.code !== "Space" && e.code !== "Enter") return;
      e.preventDefault();
      finish();
    };
    box.addEventListener("pointerdown", go);
    window.addEventListener("keydown", go);
    advanceLine = finish;
  });
}

export async function say(lines) {
  choicesEl.innerHTML = "";
  show();
  for (const line of lines) {
    await typewrite(line);
    await waitForAdvance();
    audio.blip();
  }
  hide();
}

function highlightChoice(i) {
  if (!choiceButtons.length) return;
  choiceIndex = (i + choiceButtons.length) % choiceButtons.length;
  choiceButtons.forEach((b, n) => b.classList.toggle("selected", n === choiceIndex));
}

export function choose(prompt, options) {
  return new Promise((resolve) => {
    show();
    box.dataset.speaker = "narrator";
    textEl.textContent = prompt;
    hintEl.style.opacity = "0";
    choicesEl.innerHTML = "";
    choiceButtons = [];
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.textContent = opt.label;
      btn.addEventListener("click", () => {
        audio.choose();
        choicesEl.innerHTML = "";
        choiceButtons = [];
        choiceIndex = -1;
        resolve(opt);
      });
      choiceButtons.push(btn);
      choicesEl.appendChild(btn);
    });
    highlightChoice(0); // give the gamepad a starting selection
  });
}

// ---- gamepad entry points (called from main.js's controller poll) ----
// advance(): activate the highlighted choice, or advance the current line.
// Returns true if it did something, so the caller knows the press was used.
export function advance() {
  if (choiceButtons.length) { choiceButtons[choiceIndex].click(); return true; }
  if (advanceLine) { advanceLine(); return true; }
  return false;
}

// moveChoice(dir): move the choice highlight by dir (-1 / +1) when a choice
// prompt is showing. Returns true if a choice prompt handled it.
export function moveChoice(dir) {
  if (!choiceButtons.length) return false;
  highlightChoice(choiceIndex + dir);
  return true;
}

export function hideDialogue() { hide(); }
