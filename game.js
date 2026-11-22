// ===== Game: listens only to 'weave' / 'unravel' events from main.js =====
import { input, $ } from "./main.js";

// ===== Game states (tune here) =====
const STATES = {
  FREEZE:  { img: "freezecentered.PNG",    color: "#93c5fd", min: 2000, max: 4000 },
  BUILD:   { img: "makedresscentered.PNG", color: "#fd6161", min: 4000, max: 6000, need: 2 },
  UNRAVEL: { img: "unravelcentered.PNG",   color: "rgb(191, 145, 247)", min: 4000, max: 6000, need: 2 },
};
const BANNER_IMGS = ["titlecentered.PNG", "gameovercentered.PNG", ...Object.values(STATES).map((s) => s.img)];
BANNER_IMGS.forEach((src) => { new Image().src = src; }); // 미리 불러두기 (바뀔 때 깜빡임 방지)
const GRACE_MS = 700; // reaction time right after a state change (mistakes forgiven)

let state = null, stateStart = 0, stateEnd = 0, doneInState = 0;
let dress = 0, rounds = 0, alive = false, timer = null;
let buildN = 0, unravelN = 0; // 판에 보여줄 이번 게임의 짜기/풀기 횟수
function showBanner(img, sub, color) {
  $("bannerImg").src = img;
  $("bannerSub").innerHTML = sub;
  $("timeBar").style.background = color;
}

const MAX_ROWS = 20; // 이만큼 짜면 그림 완성
const START_ROWS = Math.round(MAX_ROWS / 4);

function updateStats() {
  $("dress").textContent = dress;
  $("rounds").textContent = rounds;
  $("buildNum").textContent = buildN;
  $("unravelNum").textContent = unravelN;
  // 짠 만큼 위에서부터 보여줌 (나머지 아래쪽은 잘라서 숨김)
  const shown = Math.min(dress, MAX_ROWS) / MAX_ROWS * 100;
  $("tapImg").style.clipPath = `inset(0 0 ${100 - shown}% 0)`;
}
function pickNext() {
  const keys = Object.keys(STATES).filter((k) => k !== state); // no same state twice in a row
  return keys[Math.floor(Math.random() * keys.length)];
}

// ===== 상태별 손 GIF =====
const HAND_GIFS = {
  BUILD:   "leftrighthands.GIF",  // 짜기: 좌우
  UNRAVEL: "updownhands.GIF",     // 풀기: 위아래
  FREEZE:  null,                  // Freeze: 손 숨김
};
// 미리 불러두기 (처음 바뀔 때 깜빡임 방지)
Object.values(HAND_GIFS).forEach((src) => { if (src) new Image().src = src; });

function setHands(stateName) {
  const el = $("hands");
  const gif = HAND_GIFS[stateName];
  if (!gif) { el.style.visibility = "hidden"; return; }
  el.style.visibility = "visible";
  if (!el.src.endsWith(gif)) el.src = gif;
}
// ===== 난이도: 처음 5초는 원래 속도, 그 뒤로 상태가 점점 짧아짐 =====
const RAMP_START_MS = 5000;  // 처음 5초는 원래 속도
const MIN_SPEED = 0.45;      // 게임 끝날 때쯤 상태 길이 = 원래의 45%
function durationScale() {
  const t = performance.now() - gameStart;
  if (t < RAMP_START_MS) return 1;
  const p = Math.min(1, (t - RAMP_START_MS) / (TOTAL_MS - RAMP_START_MS)); // 0 → 1
  return 1 - (1 - MIN_SPEED) * p;
}
function enterState(next) {
  state = next;
  const s = STATES[state];
  const dur = (s.min + Math.random() * (s.max - s.min)) * durationScale();
  stateStart = performance.now();
  stateEnd = stateStart + dur;
  doneInState = 0;
  showBanner(s.img, "", s.color);
  setHands(state);
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
    showBanner("gameovercentered.PNG", `${reason} · Rounds survived: ${rounds}`, "#f87171");
}
// ===== Candle timer: 1:30 버티면 승리 =====
const TOTAL_MS = 20 * 1000;
const CANDLE_GIFS = ["candle1.GIF", "candle2.GIF", "candle3.GIF", "candle4.GIF"]; // full -> almost out
const CANDLE_OUT = "candle5.gif";
// GIF마다 촛불 바닥 위치가 달라서, 바닥을 맞추려고 아래로 내리는 양 (%)
const CANDLE_DROP = { "candle1.GIF": 1, "candle2.GIF": 0, "candle3.GIF": 11, "candle4.GIF": 14, "candle5.gif": 10 };
[...CANDLE_GIFS, CANDLE_OUT].forEach((src) => { new Image().src = src; }); // 미리 불러두기
let gameStart = 0, candleStage = -1;

function setCandle(src) {
  const el = $("candle");
  if (!el.src.endsWith(src)) el.src = src;
  el.style.transform = `translateX(-50%) translateY(${CANDLE_DROP[src]}%)`;
}

function updateCandle() {
  const elapsed = performance.now() - gameStart;
  const remaining = Math.max(0, TOTAL_MS - elapsed);
  const n = CANDLE_GIFS.length;
  const stage = Math.min(n - 1, Math.floor(elapsed / (TOTAL_MS / n)));
  if (stage !== candleStage) { candleStage = stage; setCandle(CANDLE_GIFS[stage]); }
  const secs = Math.ceil(remaining / 1000);
  $("time").textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  if (remaining <= 0) win();
}

function win() {
  alive = false;
  clearTimeout(timer);
  setCandle(CANDLE_OUT);
  $("timeBar").style.width = "0";
  showBanner("titlecentered.PNG", `You survived the night! Dress: ${dress} rows`, "#fcd34d");
}
function startGame() {
  dress = START_ROWS; rounds = 0; state = null; alive = true;
  gameStart = performance.now(); candleStage = -1;
  updateStats();
  enterState("BUILD");
}

function onAction(type) {
  if (!alive) return;
  const inGrace = performance.now() - stateStart < GRACE_MS;
  if (state === "FREEZE") {
    if (!inGrace) die(type === "weave" ? "You built during Freeze!" : "You unraveled during Freeze!");
    return;
  }
  if (state === "BUILD") {
    if (type === "weave") { dress++; doneInState++; buildN++; }
    else if (!inGrace) return die("The suitors caught you unraveling!");
  }
  if (state === "UNRAVEL") {
    if (type === "unravel") { dress = Math.max(0, dress - 1); doneInState++; unravelN++; }
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
    $("bannerSub").textContent = s.need ? `${Math.min(doneInState, s.need)} / ${s.need}` : "";
    updateCandle(); // 맨 마지막에 (이길 때 배너를 덮어쓰지 않게)
  }
  requestAnimationFrame(tickUI);
}
tickUI();