const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const missesEl = document.querySelector("#misses");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startButton = document.querySelector("#startButton");

const sounds = {
  crunch: new Audio("assets/audio/crunch.mp3"),
  startEnd: new Audio("assets/audio/start-end.m4a"),
};

sounds.crunch.preload = "auto";
sounds.startEnd.preload = "auto";
sounds.crunch.volume = 0.82;
sounds.startEnd.volume = 0.86;

const CONFIG = {
  groundHeight: 76,
  cookieMinSpeed: 118,
  cookieMaxBoost: 118,
  cookieBaseInterval: 1.45,
  cookieFastInterval: 0.9,
  playerBaseSpeed: 410,
  playerBoost: 150,
};

const keys = new Set();
const pointer = { active: false, direction: 0 };

const state = {
  mode: "ready",
  width: canvas.width,
  height: canvas.height,
  dpr: 1,
  time: 0,
  lastTime: 0,
  score: 0,
  best: Number(localStorage.getItem("naanKhataiBest") || 0),
  misses: 0,
  spawnTimer: 0,
  shake: 0,
  player: {
    x: 240,
    y: 600,
    width: 58,
    height: 96,
    mouth: 0,
    look: 0,
    stride: 0,
  },
  cookies: [],
  crumbs: [],
};

function difficulty() {
  return Math.min(state.score / 36, 1);
}

function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * state.dpr);
  canvas.height = Math.round(rect.height * state.dpr);
  state.width = rect.width;
  state.height = rect.height;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  state.player.y = state.height - CONFIG.groundHeight - 48;
  state.player.x = clamp(state.player.x, 42, state.width - 42);
}

function resetGame() {
  fitCanvas();
  playSound(sounds.startEnd);
  state.mode = "playing";
  state.time = 0;
  state.lastTime = performance.now();
  state.score = 0;
  state.misses = 0;
  state.spawnTimer = 0.55;
  state.shake = 0;
  state.cookies = [];
  state.crumbs = [];
  state.player.x = state.width / 2;
  state.player.mouth = 0;
  state.player.look = 0;
  overlay.classList.add("hidden");
  startButton.textContent = "Play Again";
  syncHud();
}

function syncHud() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = `Best ${state.best}`;
  missesEl.textContent = `Miss ${state.misses}/3`;
}

function spawnCookie() {
  const d = difficulty();
  const radius = 17 + Math.random() * 5;
  state.cookies.push({
    x: radius + Math.random() * (state.width - radius * 2),
    y: -radius - 8,
    radius,
    speed: CONFIG.cookieMinSpeed + d * CONFIG.cookieMaxBoost + Math.random() * 28,
    drift: (Math.random() - 0.5) * 34,
    spin: Math.random() * Math.PI * 2,
    spinSpeed: (Math.random() - 0.5) * 4,
  });
}

function update(dt) {
  state.time += dt;

  if (state.mode !== "playing") {
    updateCrumbs(dt);
    return;
  }

  const d = difficulty();
  const moveLeft = keys.has("ArrowLeft") || keys.has("a") || pointer.direction < 0;
  const moveRight = keys.has("ArrowRight") || keys.has("d") || pointer.direction > 0;
  const direction = Number(moveRight) - Number(moveLeft);
  const player = state.player;

  player.x += direction * (CONFIG.playerBaseSpeed + d * CONFIG.playerBoost) * dt;
  player.x = clamp(player.x, 42, state.width - 42);
  player.stride += Math.abs(direction) * dt * 15;
  player.mouth = Math.max(0, player.mouth - dt * 4.8);

  player.look += ((player.mouth > 0.05 ? 1 : 0) - player.look) * Math.min(1, dt * 11);

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnCookie();
    state.spawnTimer = lerp(CONFIG.cookieBaseInterval, CONFIG.cookieFastInterval, d) + Math.random() * 0.2;
  }

  for (let i = state.cookies.length - 1; i >= 0; i -= 1) {
    const cookie = state.cookies[i];
    cookie.y += cookie.speed * dt;
    cookie.x += cookie.drift * dt;
    cookie.spin += cookie.spinSpeed * dt;

    if (cookie.x < cookie.radius || cookie.x > state.width - cookie.radius) {
      cookie.drift *= -1;
      cookie.x = clamp(cookie.x, cookie.radius, state.width - cookie.radius);
    }

    if (hitsMouth(cookie)) {
      burstCrumbs(cookie.x, cookie.y);
      state.cookies.splice(i, 1);
      state.score += 1;
      if (state.score > state.best) {
        state.best = state.score;
        localStorage.setItem("naanKhataiBest", String(state.best));
      }
      player.mouth = 1;
      playSound(sounds.crunch, true);
      syncHud();
      continue;
    }

    if (cookie.y - cookie.radius > state.height - CONFIG.groundHeight + 12) {
      state.cookies.splice(i, 1);
      state.misses += 1;
      state.shake = 8;
      burstCrumbs(cookie.x, state.height - CONFIG.groundHeight + 6);
      syncHud();
      if (state.misses >= 3) gameOver();
    }
  }

  updateCrumbs(dt);
  state.shake = Math.max(0, state.shake - dt * 42);
}

function hitsMouth(cookie) {
  const p = state.player;
  const mouthX = p.x + 3;
  const mouthY = p.y - 30 - p.look * 8;
  return (
    Math.abs(cookie.x - mouthX) < 30 + cookie.radius * 0.35 &&
    Math.abs(cookie.y - mouthY) < 24 + cookie.radius * 0.35
  );
}

function burstCrumbs(x, y) {
  for (let i = 0; i < 10; i += 1) {
    state.crumbs.push({
      x,
      y,
      vx: -90 + Math.random() * 180,
      vy: -130 + Math.random() * 130,
      life: 0.4 + Math.random() * 0.2,
      size: 2 + Math.random() * 2.5,
    });
  }
}

function updateCrumbs(dt) {
  for (const crumb of state.crumbs) {
    crumb.x += crumb.vx * dt;
    crumb.y += crumb.vy * dt;
    crumb.vy += 420 * dt;
    crumb.life -= dt;
  }
  state.crumbs = state.crumbs.filter((crumb) => crumb.life > 0);
}

function gameOver() {
  state.mode = "over";
  playSound(sounds.startEnd);
  state.best = Math.max(state.best, state.score);
  localStorage.setItem("naanKhataiBest", String(state.best));
  syncHud();
  overlayTitle.textContent = "Game Over";
  overlayText.textContent = `${state.score} naan-khatai eaten.`;
  overlay.classList.remove("hidden");
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, state.width, state.height);
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawSky();
  drawFence();
  drawCookies();
  drawCrumbs();
  drawKid();
  drawGround();
  ctx.restore();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, "#5fc1ee");
  gradient.addColorStop(0.54, "#a9e0f3");
  gradient.addColorStop(1, "#d7f5dc");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
  for (let i = 0; i < 5; i += 1) {
    const x = ((state.time * 18 + i * 150) % (state.width + 180)) - 120;
    const y = 72 + (i % 3) * 58;
    drawCloud(x, y, 1 + (i % 2) * 0.28);
  }
}

function drawCloud(x, y, scale) {
  ctx.beginPath();
  ctx.ellipse(x, y, 34 * scale, 18 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 28 * scale, y - 8 * scale, 28 * scale, 21 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 58 * scale, y, 36 * scale, 18 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFence() {
  const baseY = state.height - CONFIG.groundHeight - 58;
  ctx.fillStyle = "rgba(72, 119, 72, 0.22)";
  ctx.fillRect(0, baseY + 18, state.width, 40);

  ctx.strokeStyle = "rgba(117, 83, 48, 0.62)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-10, baseY + 34);
  ctx.lineTo(state.width + 10, baseY + 34);
  ctx.moveTo(-10, baseY + 51);
  ctx.lineTo(state.width + 10, baseY + 51);
  ctx.stroke();

  ctx.fillStyle = "#8b5a32";
  for (let x = -8; x < state.width + 20; x += 34) {
    roundRect(x, baseY + 11, 10, 52, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(x + 2, baseY + 16, 2, 39);
    ctx.fillStyle = "#8b5a32";
  }
}

function drawGround() {
  const y = state.height - CONFIG.groundHeight;
  ctx.fillStyle = "#287b46";
  ctx.fillRect(0, y, state.width, CONFIG.groundHeight);
  ctx.fillStyle = "#236d3d";
  for (let x = -20; x < state.width + 30; x += 38) {
    ctx.beginPath();
    ctx.moveTo(x, state.height);
    ctx.lineTo(x + 18, y);
    ctx.lineTo(x + 38, state.height);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(247, 239, 226, 0.72)";
  ctx.fillRect(0, y + 8, state.width, 4);
}

function drawCookies() {
  for (const cookie of state.cookies) drawCookie(cookie);
}

function drawCookie(cookie) {
  ctx.save();
  ctx.translate(cookie.x, cookie.y);
  ctx.rotate(cookie.spin);

  const gradient = ctx.createRadialGradient(-6, -7, 3, 0, 0, cookie.radius);
  gradient.addColorStop(0, "#fff1c9");
  gradient.addColorStop(0.7, "#d9ad68");
  gradient.addColorStop(1, "#9b6335");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, cookie.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(95, 55, 26, 0.42)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, cookie.radius * 0.68, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(92, 54, 28, 0.5)";
  for (let i = 0; i < 5; i += 1) {
    const angle = (Math.PI * 2 * i) / 5;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * cookie.radius * 0.38, Math.sin(angle) * cookie.radius * 0.38, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawCrumbs() {
  for (const crumb of state.crumbs) {
    ctx.globalAlpha = Math.max(0, crumb.life / 0.55);
    ctx.fillStyle = "#e1b06c";
    ctx.beginPath();
    ctx.arc(crumb.x, crumb.y, crumb.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawKid() {
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.beginPath();
  ctx.ellipse(2, 48, 31, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  const legOffset = Math.sin(p.stride) * 7;
  ctx.strokeStyle = "#30445f";
  ctx.lineWidth = 13;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-13, 28);
  ctx.lineTo(-21 - legOffset, 50);
  ctx.moveTo(13, 28);
  ctx.lineTo(21 + legOffset, 50);
  ctx.stroke();

  ctx.fillStyle = "#ffd15a";
  roundRect(-27, -7, 54, 44, 12);
  ctx.fill();
  ctx.fillStyle = "#6fb3e8";
  roundRect(-22, -1, 44, 32, 9);
  ctx.fill();

  ctx.strokeStyle = "#f1b384";
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(-25, 3);
  ctx.lineTo(-39, 17);
  ctx.moveTo(25, 3);
  ctx.lineTo(39, 17);
  ctx.stroke();

  ctx.save();
  ctx.translate(0, -33);
  ctx.rotate(-0.27 * p.look);

  ctx.fillStyle = "#f1b384";
  ctx.beginPath();
  ctx.arc(0, 0, 23, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#191413";
  ctx.beginPath();
  ctx.arc(0, -9, 24, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(247, 239, 226, 0.22)";
  ctx.fillRect(-23, -8, 7, 10);
  ctx.fillRect(16, -8, 7, 10);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-8, 1 - p.look * 3, 4, 0, Math.PI * 2);
  ctx.arc(9, 1 - p.look * 3, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#171717";
  ctx.beginPath();
  ctx.arc(-7, 0 - p.look * 3, 1.8, 0, Math.PI * 2);
  ctx.arc(10, 0 - p.look * 3, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#24140f";
  ctx.beginPath();
  ctx.ellipse(2, 10 - p.look * 7, 7 + p.mouth * 8, 3 + p.mouth * 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function setPointerDirection(event) {
  pointer.active = true;
  pointer.direction = event.clientX < window.innerWidth / 2 ? -1 : 1;
}

function clearPointer() {
  pointer.active = false;
  pointer.direction = 0;
}

function loop(now) {
  const dt = Math.min(0.032, (now - state.lastTime) / 1000 || 0);
  state.lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function playSound(sound, clone = false) {
  const audio = clone ? sound.cloneNode() : sound;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

startButton.addEventListener("click", resetGame);
document.addEventListener("pointerdown", (event) => {
  if (event.target === startButton) return;
  if (state.mode !== "playing") {
    resetGame();
    return;
  }
  event.preventDefault();
  setPointerDirection(event);
});
document.addEventListener("pointermove", (event) => {
  if (pointer.active) setPointerDirection(event);
});
document.addEventListener("pointerup", clearPointer);
document.addEventListener("pointercancel", clearPointer);
window.addEventListener("keydown", (event) => {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    resetGame();
  }
  keys.add(event.key);
});
window.addEventListener("keyup", (event) => keys.delete(event.key));
window.addEventListener("resize", fitCanvas);

fitCanvas();
syncHud();
draw();
requestAnimationFrame(loop);
