import { HandLandmarker, FilesetResolver, DrawingUtils }
  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/vision_bundle.mjs";

// ===== Tuning =====
const SHUTTLE_MIN_WIDTH = 0.2; // Building dress
const MOVE_NOISE = 0.01;        // Ignore small movement
const PULL_DOWN = 0.12;         // Building dress distance
const COOLDOWN_MS = 250; 
const WEAVE_GRACE_MS = 250;        
const PULL_COOLDOWN_MS = 120;
const UNRAVEL_GRACE_MS = 300;
// ===== Input layer =====
export const input = new EventTarget();
const emit = (name) => input.dispatchEvent(new Event(name));

// Key backup
addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") emit("weave");
  if (e.key === "Space") { e.preventDefault(); emit("unravel"); }
});

// For test
let weaves = 0, unravels = 0;
export const $ = (id) => document.getElementById(id);
function flash(text, color) { $("flash").textContent = text; $("flash").style.color = color; }
input.addEventListener("weave",   () => { $("weaveCount").textContent = ++weaves;   flash("Building one line", "#7dd3fc"); });
input.addEventListener("unravel", () => { $("unravelCount").textContent = ++unravels; flash("Unraveling one line!", "#f9a8d4"); });

// ===== Recognition set-up =====
const video = $("video");
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const draw = new DrawingUtils(ctx);

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm"
);
const hands = await HandLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    delegate: "GPU",
  },
  runningMode: "VIDEO",
  numHands: 2,
  minHandDetectionConfidence: 0.4,
  minHandPresenceConfidence: 0.4,
  minTrackingConfidence: 0.3, 
});

const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
video.srcObject = stream;
await new Promise((r) => (video.onloadeddata = r));
$("status").textContent = "✅ All ready — Wave your hand left and right to build the dress, Make a fist and move your fist down to unravel the dress";

// ===== Motions =====
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function isFist(lm) {
  const tips = [8, 12, 16, 20], bases = [5, 9, 13, 17];
  let curled = 0;
  for (let i = 0; i < 4; i++) if (dist(lm[tips[i]], lm[0]) < dist(lm[bases[i]], lm[0])) curled++;
  return curled >= 3;
}

// Building: Left / Right motion
let lastX = null, dir = 0, swingStartX = null, swingPeakX = null, lastWeave = 0;
function detectShuttle(x, now) {
  if (lastX === null) { lastX = swingStartX = swingPeakX = x; return; }
  const d = x - lastX;
  const newDir = Math.abs(d) > MOVE_NOISE ? Math.sign(d) : dir;
  if (newDir !== 0 && dir !== 0 && newDir !== dir) {
    // 방향이 바뀜 → 실제 끝점(peak)까지 간 폭으로 판정
    if (Math.abs(swingPeakX - swingStartX) > SHUTTLE_MIN_WIDTH && now - lastWeave > COOLDOWN_MS) {
      emit("weave");
      lastWeave = now;
    }
    swingStartX = swingPeakX; // 새 스윙은 끝점에서 시작
    swingPeakX = x;
  } else if (dir === 0 || (x - swingPeakX) * dir > 0) {
    swingPeakX = x;           // 같은 방향으로 더 가면 끝점 갱신
  }
  dir = newDir;
  lastX = x;
}

// 풀기: 양손 주먹 상태에서 왼손/오른손 번갈아 아래로 당기기
let pullStartY = [null, null];  // [화면 왼쪽 손, 화면 오른쪽 손]의 기준 높이
let lastPullHand = -1;          // 마지막으로 당긴 손 (-1 = 아직 없음)
let lastPullTime = [0, 0];      // 손마다 따로 쿨다운 (양손 번갈아 빠르게 해도 안 막힘)
let lastBothFists = -Infinity;  // 마지막으로 양손 주먹이 보인 시각
let lastOpenHand = -Infinity;   // 마지막으로 편 손이 보인 시각

function detectAlternatePull(ys, now) {
  for (let i = 0; i < 2; i++) {
    const y = ys[i];
    if (pullStartY[i] === null || y < pullStartY[i]) { pullStartY[i] = y; continue; }
    if (y - pullStartY[i] > PULL_DOWN) {
      pullStartY[i] = y;
      if (now - lastPullTime[i] < PULL_COOLDOWN_MS) continue; // 같은 손 떨림 무시
      lastPullTime[i] = now;
      if (i === lastPullHand) { flash("↔️ Pull by opposite hand!!!", "#fbbf24"); continue; }
      emit("unravel");
      lastPullHand = i;
    }
  }
}
function resetWeave() { lastX = null; dir = 0; swingStartX = null; }
function resetPull()  { pullStartY = [null, null]; }
function resetTracking() { resetWeave(); resetPull(); }

// ===== Main Loop =====
let lastVideoTime = -1;
let lastHandCount = 0;
function loop() {
  const now = performance.now();
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = hands.detectForVideo(video, now);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const all = result.landmarks;
    const fists = all.filter(isFist).length;
    const bothFists = all.length === 2 && fists === 2;
    if (bothFists) lastBothFists = now;
    // 양손 주먹이 잠깐 끊겨도 UNRAVEL_GRACE_MS 동안은 풀기 모드 유지
    const inUnravelMode = now - lastBothFists < UNRAVEL_GRACE_MS;

        // 손 개수가 바뀌면(1↔2) 짜기 추적만 초기화. 손이 잠깐 사라진 건(0) 무시
    if (all.length > 0 && all.length !== lastHandCount) resetWeave();
    if (all.length > 0) lastHandCount = all.length;

    for (const lm of all) {
      draw.drawConnectors(lm, HandLandmarker.HAND_CONNECTIONS, { color: "#7dd3fc", lineWidth: 4 });
      draw.drawLandmarks(lm, { color: "#ffffff", lineWidth: 1, radius: 3 });
    }

    if (all.length === 2 && inUnravelMode) {
      // 양손 주먹 (또는 방금까지 주먹) → 왼손/오른손 번갈아 당기기
      resetWeave();
      // 화면이 좌우반전이라 x가 큰 손이 화면 왼쪽 손
      const [screenLeft, screenRight] = [...all].sort((a, b) => b[0].x - a[0].x);
      detectAlternatePull([screenLeft[0].y, screenRight[0].y], now);
      $("handState").textContent =
        lastPullHand === 0 ? "✊✊ Right Hand!" :
        lastPullHand === 1 ? "✊✊ Left Hand" :
        "✊✊ Make a fist in both hands! (Any hands)";
    } else if (inUnravelMode) {
      // 빠르게 당기다 손을 한 프레임 놓침 → 기준점 그대로 두고 기다림
    } else if (all.length > 0 && fists === 0) {
      // 손 펴면 짜기 (양손이면 평균 위치로)
      lastOpenHand = now;
      $("handState").textContent = all.length === 2 ? "🖐🖐 Both hand (Build)" : "🖐 One hand (Build))";
      resetPull();
      const avgX = all.reduce((s, lm) => s + lm[0].x, 0) / all.length;
      detectShuttle(avgX, now);
    } else if (now - lastOpenHand < WEAVE_GRACE_MS) {
      // 빠르게 흔들다 손을 놓치거나 주먹으로 잘못 보임 → 짜기 기준점 그대로 두고 기다림
    } else if (fists > 0) {
      $("handState").textContent = "✊ Need both hands to make a fist!";
      resetWeave(); resetPull();
    } else {
      $("handState").textContent = "Froze!!";
      resetTracking();
    }
  }
  requestAnimationFrame(loop);
}
loop();