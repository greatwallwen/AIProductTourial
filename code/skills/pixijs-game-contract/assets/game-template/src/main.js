import { Application, Container, Graphics, Text } from "pixi.js";
import gameConfig from "./game-config.js";
import "./style.css";

const stageElement = document.querySelector("#game-stage");
const scoreElement = document.querySelector("#score");
const timerElement = document.querySelector("#timer");
const positionElement = document.querySelector("#position");
const statusElement = document.querySelector("#live-status");
const restartButton = document.querySelector("#restart");

document.title = gameConfig.title;
document.querySelector("#game-title").textContent = gameConfig.title;
document.querySelector("#game-description").textContent = gameConfig.description;
document.querySelector("#health-boundary").textContent = gameConfig.healthBoundary;
for (const control of gameConfig.controls) {
  const item = document.createElement("li");
  item.textContent = control;
  document.querySelector("#controls").append(item);
}

const app = new Application();
await app.init({
  width: 960,
  height: 540,
  antialias: true,
  backgroundColor: 0x0c1b2a,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
});
stageElement.append(app.canvas);
app.canvas.tabIndex = 0;
app.canvas.setAttribute("aria-label", "数据清洁调度游戏画布，使用方向键或 WASD 移动");

const world = new Container();
app.stage.addChild(world);
const grid = new Graphics();
for (let x = 0; x <= 960; x += 60) grid.moveTo(x, 0).lineTo(x, 540);
for (let y = 0; y <= 540; y += 60) grid.moveTo(0, y).lineTo(960, y);
grid.stroke({ color: 0x2b5570, width: 1, alpha: 0.28 });
world.addChild(grid);

const player = new Container();
const playerBody = new Graphics().roundRect(-18, -18, 36, 36, 9).fill(0x63d4ff);
const playerMark = new Text({ text: "巡", style: { fill: 0x052033, fontSize: 18, fontWeight: "700" } });
playerMark.anchor.set(0.5);
player.addChild(playerBody, playerMark);
world.addChild(player);

function makeToken(item, color, radius) {
  const token = new Container();
  token.position.set(item.x, item.y);
  token.addChild(new Graphics().circle(0, 0, radius).fill(color));
  const label = new Text({ text: item.label, style: { fill: 0xffffff, fontSize: 13, fontWeight: "600" } });
  label.anchor.set(0.5, -0.9);
  token.addChild(label);
  world.addChild(token);
  return { ...item, view: token };
}

const tickets = gameConfig.tickets.map((item) => makeToken(item, 0x31c995, 14));
const hazards = gameConfig.hazards.map((item) => makeToken(item, 0xff835c, 18));
const keys = new Set();
let score = 0;
let remainingSeconds = gameConfig.durationSeconds;
let active = true;
let collected = 0;
let hazardCooldown = 0;

function updateHud() {
  scoreElement.textContent = String(score);
  timerElement.textContent = String(Math.max(0, Math.ceil(remainingSeconds)));
  positionElement.textContent = `${Math.round(player.x)}, ${Math.round(player.y)}`;
}

function clampPlayer() {
  player.x = Math.max(24, Math.min(936, player.x));
  player.y = Math.max(24, Math.min(516, player.y));
}

function movePlayer(dx, dy) {
  if (!active) return;
  player.x += dx;
  player.y += dy;
  clampPlayer();
  updateHud();
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function relocateTicket(ticket, index) {
  ticket.view.x = 120 + ((index * 227 + collected * 83) % 720);
  ticket.view.y = 90 + ((index * 131 + collected * 61) % 360);
}

function restartGame() {
  score = 0;
  collected = 0;
  remainingSeconds = gameConfig.durationSeconds;
  active = true;
  hazardCooldown = 0;
  player.position.set(gameConfig.playerStart.x, gameConfig.playerStart.y);
  tickets.forEach((ticket, index) => ticket.view.position.set(ticket.x, ticket.y));
  hazards.forEach((hazard) => hazard.view.position.set(hazard.x, hazard.y));
  statusElement.textContent = "调度开始：回收绿色数据校验工单。";
  updateHud();
  app.canvas.focus();
}

const movement = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
};

function handleKeyDown(event) {
  if (event.code === "KeyR") {
    restartGame();
    event.preventDefault();
    return;
  }
  const direction = movement[event.code];
  if (!direction) return;
  keys.add(event.code);
  movePlayer(direction[0] * 16, direction[1] * 16);
  event.preventDefault();
}

function handleKeyUp(event) {
  keys.delete(event.code);
}

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
restartButton.addEventListener("click", restartGame);

app.ticker.add((ticker) => {
  if (!active) return;
  const seconds = ticker.deltaMS / 1000;
  remainingSeconds -= seconds;
  hazardCooldown = Math.max(0, hazardCooldown - seconds);
  let dx = 0;
  let dy = 0;
  for (const code of keys) {
    const direction = movement[code];
    if (direction) { dx += direction[0]; dy += direction[1]; }
  }
  const magnitude = Math.hypot(dx, dy) || 1;
  movePlayer((dx / magnitude) * gameConfig.speed * seconds, (dy / magnitude) * gameConfig.speed * seconds);

  tickets.forEach((ticket, index) => {
    if (distance(player, ticket.view) < 34) {
      score += gameConfig.scorePerTicket;
      collected += 1;
      statusElement.textContent = `已回收：${ticket.label}，当前 ${score} 分。`;
      relocateTicket(ticket, index);
    }
  });
  if (hazardCooldown === 0) {
    for (const hazard of hazards) {
      if (distance(player, hazard.view) < 40) {
        score = Math.max(0, score - gameConfig.hazardPenalty);
        hazardCooldown = 1;
        statusElement.textContent = `避开“${hazard.label}”：结论必须回到数据证据。`;
        break;
      }
    }
  }
  if (remainingSeconds <= 0) {
    remainingSeconds = 0;
    active = false;
    keys.clear();
    statusElement.textContent = `本轮完成，最终得分 ${score}。按 R 或按钮重新开始。`;
  }
  updateHud();
});

restartGame();

window.addEventListener("pagehide", () => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  app.destroy(true, { children: true });
}, { once: true });
