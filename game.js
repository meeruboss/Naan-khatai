const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const missesEl = document.querySelector("#misses");
const startButton = document.querySelector("#startButton");
const leftButton = document.querySelector("#leftButton");
const rightButton = document.querySelector("#rightButton");

const keys = new Set();
const pointerControls = { left: false, right: false };

const game = {
  running: false,
  over: false,
  score: 0,
  misses: 0,
  lastTime: 0,
  spawnTimer: 0,
  windTimer: 0,
  wind: 0,
  cookies: [],
  player: {
    x: canvas.width / 2,
    y: canvas.height - 118,
    width: 108,
    height: 124,
    speed: 520,
    mouthOpen: 0,
  },
};

function resetGame() {
  game.running = true;
  game.over = false;
  game.score = 0;
  game.misses = 0;
  game.lastTime = performance.now();
  game.spawnTimer = 0.55;
  game.windTimer = 0;
  game.wind = 0;
  game.cookies = [];
  game.player.x = canvas.width / 2;
  game.player.mouthOpen = 0;
  startButton.textContent = "Restart";
  syncHud();
}

function syncHud() {
  scoreEl.textContent = game.score;
  missesEl.textContent = game.misses;
}

function difficulty() {
  return Math.min(game.score / 35, 1);
}

function spawnCookie() {
  const d = difficulty();
  const radius = 23 + Math.random() * 8;
  game.cookies.push({
    x: radius + Math.random() * (canvas.width - radius * 2),
    y: -radius,
    radius,
    speed: 145 + d * 185 + Math.random() * 50,
    spin: Math.random() * Math.PI * 2,
    spinSpeed: (Math.random() - 0.5) * 4,
    drift: (Math.random() - 0.5) * 35,
  });
}

function update(delta) {
  if (!game.running) return;

  const player = game.player;
  const moveLeft = keys.has("ArrowLeft") || keys.has("a") || pointerControls.left;
  const moveRight = keys.has("ArrowRight") || keys.has("d") || pointerControls.right;
  const direction = Number(moveRight) - Number(moveLeft);

  player.x += direction * player.speed * delta;
  player.x = clamp(player.x, player.width / 2, canvas.width - player.width / 2);
  player.mouthOpen = Math.max(0, player.mouthOpen - delta * 4);

  game.windTimer -= delta;
  if (game.windTimer <= 0) {
    game.windTimer = 1.4 + Math.random() * 1.8;
    game.wind = (Math.random() - 0.5) * 34;
  }

  game.spawnTimer -= delta;
  if (game.spawnTimer <= 0) {
    spawnCookie();
    game.spawnTimer = Math.max(0.48, 1.05 - difficulty() * 0.36) + Math.random() * 0.2;
  }

  for (let i = game.cookies.length - 1; i >= 0; i -= 1) {
    const cookie = game.cookies[i];
    cookie.y += cookie.speed * delta;
    cookie.x += (cookie.drift + game.wind) * delta;
    cookie.spin += cookie.spinSpeed * delta;

    if (cookie.x < cookie.radius || cookie.x > canvas.width - cookie.radius) {
      cookie.drift *= -1;
      cookie.x = clamp(cookie.x, cookie.radius, canvas.width - cookie.radius);
    }

    if (cookieHitsMouth(cookie)) {
      game.cookies.splice(i, 1);
      game.score += 1;
      player.mouthOpen = 1;
      syncHud();
      continue;
    }

    if (cookie.y - cookie.radius > canvas.height) {
      game.cookies.splice(i, 1);
      game.misses += 1;
      syncHud();
      if (game.misses >= 3) {
        game.running = false;
        game.over = true;
        startButton.textContent = "Try again";
      }
    }
  }
}

function cookieHitsMouth(cookie) {
  const player = game.player;
  const mouthX = player.x;
  const mouthY = player.y + 44;
  const catchWidth = player.width * 0.62;
  const catchHeight = 38;
  return (
    Math.abs(cookie.x - mouthX) < catchWidth / 2 + cookie.radius * 0.45 &&
    Math.abs(cookie.y - mouthY) < catchHeight / 2 + cookie.radius * 0.45
  );
}

function draw() {
  drawScene();
  drawKid();
  game.cookies.forEach(drawCookie);

  if (!game.running) {
    drawOverlay(game.over ? "Game over" : "Catch the naan-khatai");
  }
}

function drawScene() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#8fd4f2");
  sky.addColorStop(0.62, "#f7d797");
  sky.addColorStop(1, "#79ad70");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  drawCloud(150, 90, 1);
  drawCloud(740, 120, 0.8);
  drawCloud(490, 62, 0.58);

  ctx.fillStyle = "#347d58";
  ctx.fillRect(0, canvas.height - 54, canvas.width, 54);

  ctx.fillStyle = "rgba(255, 247, 232, 0.36)";
  for (let x = 18; x < canvas.width; x += 48) {
    ctx.fillRect(x, canvas.height - 36, 24, 5);
  }
}

function drawCloud(x, y, scale) {
  ctx.beginPath();
  ctx.arc(x, y, 34 * scale, 0, Math.PI * 2);
  ctx.arc(x + 42 * scale, y - 12 * scale, 46 * scale, 0, Math.PI * 2);
  ctx.arc(x + 89 * scale, y, 33 * scale, 0, Math.PI * 2);
  ctx.arc(x + 42 * scale, y + 16 * scale, 38 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawCookie(cookie) {
  ctx.save();
  ctx.translate(cookie.x, cookie.y);
  ctx.rotate(cookie.spin);

  const cookieGradient = ctx.createRadialGradient(
    -cookie.radius * 0.25,
    -cookie.radius * 0.25,
    cookie.radius * 0.2,
    0,
    0,
    cookie.radius,
  );
  cookieGradient.addColorStop(0, "#fff0c6");
  cookieGradient.addColorStop(0.68, "#d9b16e");
  cookieGradient.addColorStop(1, "#a56f3e");
  ctx.fillStyle = cookieGradient;
  ctx.beginPath();
  ctx.arc(0, 0, cookie.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(112, 72, 40, 0.45)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, cookie.radius * 0.72, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(112, 72, 40, 0.48)";
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * cookie.radius * 0.42, Math.sin(angle) * cookie.radius * 0.42, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawKid() {
  const p = game.player;
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = "#246a56";
  roundRect(-46, 58, 92, 64, 22);
  ctx.fill();

  ctx.fillStyle = "#f4b572";
  roundRect(-35, -18, 70, 80, 30);
  ctx.fill();

  ctx.fillStyle = "#2b1b16";
  ctx.beginPath();
  ctx.arc(-16, 13, 5, 0, Math.PI * 2);
  ctx.arc(16, 13, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2b1b16";
  ctx.beginPath();
  ctx.ellipse(0, 39, 13 + p.mouthOpen * 10, 6 + p.mouthOpen * 13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#23140f";
  ctx.beginPath();
  ctx.arc(0, -7, 39, Math.PI, Math.PI * 2);
  ctx.quadraticCurveTo(36, -28, 24, -43);
  ctx.quadraticCurveTo(4, -31, -24, -40);
  ctx.quadraticCurveTo(-43, -29, -39, -7);
  ctx.fill();

  ctx.strokeStyle = "#f4b572";
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-42, 73);
  ctx.lineTo(-72, 92);
  ctx.moveTo(42, 73);
  ctx.lineTo(72, 92);
  ctx.stroke();

  ctx.restore();
}

function drawOverlay(title) {
  ctx.fillStyle = "rgba(39, 26, 20, 0.42)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff7e8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 52px Inter, system-ui, sans-serif";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 40);
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText(game.over ? `Final score: ${game.score}` : "Ready?", canvas.width / 2, canvas.height / 2 + 24);
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function frame(now) {
  const delta = Math.min((now - game.lastTime) / 1000 || 0, 0.033);
  game.lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

function bindHoldButton(button, direction) {
  const set = (active) => {
    pointerControls[direction] = active;
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    set(true);
  });
  button.addEventListener("pointerup", () => set(false));
  button.addEventListener("pointercancel", () => set(false));
  button.addEventListener("pointerleave", () => set(false));
}

window.addEventListener("keydown", (event) => {
  keys.add(event.key);
  if (event.key === " " || event.key === "Enter") {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => keys.delete(event.key));
startButton.addEventListener("click", resetGame);
bindHoldButton(leftButton, "left");
bindHoldButton(rightButton, "right");

draw();
requestAnimationFrame(frame);
