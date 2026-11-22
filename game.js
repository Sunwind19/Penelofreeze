// ===== Game: listens only to 'weave' / 'unravel' events from main.js =====
import { input, $ } from "./main.js";

// ===== Game states (tune here) =====
const STATES = {
  FREEZE:  { text: "Freeze!",                   sub: "Don't move!",         color: "#93c5fd", min: 2000, max: 4000 },
  BUILD:   { text: "Suitors are watching you!", sub: "Build the dress!",    color: "#fd6161", min: 4000, max: 6000, need: 2 },
  UNRAVEL: { text: "Quick, unravel the dress!", sub: "Unravel it, quietly!", color: "rgb(191, 145, 247)", min: 4000, max: 6000, need: 2 },
};
const GRACE_MS = 700; // reaction time right after a state change (mistakes forgiven)

let state = null, stateStart = 0, stateEnd = 0, doneInState = 0;
let dress = 0, rounds = 0, alive = false, timer = null;

function showBanner(text, sub, color) {
  $("bannerText").textContent = text;
  $("bannerText").style.color = color;
  $("bannerSub").innerHTML = sub;
  $("timeBar").style.background = color;
}
const MAX_ROWS = 50; // 이만큼 짜면 그림 완성

function updateStats() {
  $("dress").textContent = dress;
  $("rounds").textContent = rounds;
  // 짠 만큼 위에서부터 보여줌 (나머지 아래쪽은 잘라서 숨김)
  const shown = Math.min(dress, MAX_ROWS) / MAX_ROWS * 100;
  $("tapImg").style.clipPath = `inset(0 0 ${100 - shown}% 0)`;
}
function pickNext() {
  const keys = Object.keys(STATES).filter((k) => k !== state); // no same state twice in a row
  return keys[Math.floor(Math.random() * keys.length)];
}

function enterState(next) {
  state = next;
  const s = STATES[state];
  const dur = s.min + Math.random() * (s.max - s.min);
  stateStart = performance.now();
  stateEnd = stateStart + dur;
  doneInState = 0;
  showBanner(s.text, s.sub, s.color);
  clearTimeout(timer);
  timer = setTimeout(endState, dur);
}

function endState() {
  if (!alive) return;
  const s = STATES[state];
  if (s.need && doneInState < s.need) {
    return die(state === "BUILD" ? "The suitors got suspicious… you didn't weave!" : "Morning came… you didn't unravel enough!");
  }
  rounds++;
  updateStats();
  enterState(pickNext());
}

function die(reason) {
  alive = false;
  clearTimeout(timer);
  $("timeBar").style.width = "0";
  showBanner("Game Over", `${reason}<br>Rounds survived: ${rounds} · Press Enter to restart`, "#f87171");
}

function startGame() {
  dress = 0; rounds = 0; state = null; alive = true;
  updateStats();
  enterState(pickNext());
}

function onAction(type) {
  if (!alive) return;
  const inGrace = performance.now() - stateStart < GRACE_MS;
  if (state === "FREEZE") {
    if (!inGrace) die(type === "weave" ? "You built during Freeze!" : "You unraveled during Freeze!");
    return;
  }
  if (state === "BUILD") {
    if (type === "weave") { dress++; doneInState++; }
    else if (!inGrace) return die("The suitors caught you unraveling!");
  }
  if (state === "UNRAVEL") {
    if (type === "unravel") { dress = Math.max(0, dress - 1); doneInState++; }
    // building at night is just ignored
  }
  updateStats();
}

input.addEventListener("weave", () => onAction("weave"));
input.addEventListener("unravel", () => onAction("unravel"));
addEventListener("keydown", (e) => { if (e.key === "Enter" && !alive) startGame(); });

// time bar + progress
function tickUI() {
  if (alive) {
    const s = STATES[state];
    const left = Math.max(0, stateEnd - performance.now());
    $("timeBar").style.width = (left / (stateEnd - stateStart)) * 100 + "%";
    if (s.need) $("bannerSub").textContent = `${s.sub} (${Math.min(doneInState, s.need)}/${s.need})`;
  }
  requestAnimationFrame(tickUI);
}
tickUI();