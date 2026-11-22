<script>
const TOTAL_MS = 90 * 1000;
const CANDLE_GIFS = ["candle1.gif", "candle2.gif", "candle3.gif", "candle4.gif"]; // full -> almost out
const candle = document.getElementById("candle");
const timeEl = document.getElementById("time");

let startTime, timerId, currentStage = -1;

function startCandle() {
  startTime = Date.now();
  currentStage = -1;
  timerId = setInterval(tick, 100);
  tick();
}

function tick() {
  const elapsed = Date.now() - startTime;
  const remaining = Math.max(0, TOTAL_MS - elapsed);

  // Which of the 4 stages are we in? (0-3, each is 22.5 seconds)
  const stage = Math.min(3, Math.floor(elapsed / (TOTAL_MS / 4)));
  if (stage !== currentStage) {          // only change src when the stage changes,
    currentStage = stage;                // otherwise the GIF restarts every tick
    candle.src = CANDLE_GIFS[stage];
  }

  const secs = Math.ceil(remaining / 1000);
  timeEl.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  if (remaining <= 0) {
    clearInterval(timerId);
    candleBurnedOut();
  }
}

function candleBurnedOut() {
  candle.src = "candle_out.gif"; // optional 5th image for the flame going out
  // trigger your game over logic here
}

function stopCandle() { clearInterval(timerId); } // call this if the player finishes the dress in time

startCandle();
</script>