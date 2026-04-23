import * as readline from "readline";
import { createSnake, moveSnake, checkWallCollision, checkSelfCollision, Direction } from "./snake";
import { spawnFood } from "./food";

const WIDTH = 20;
const HEIGHT = 15;
const TICK_MS = 150;

let snake = createSnake(Math.floor(WIDTH / 2), Math.floor(HEIGHT / 2), 3);
let direction: Direction = "RIGHT";
let nextDirection: Direction = "RIGHT";
let food = spawnFood(WIDTH, HEIGHT, snake);
let score = 0;
let running = true;

// Raw mode for stdin
process.stdin.setRawMode?.(true);
process.stdin.resume?.();
readline.emitKeypressEvents(process.stdin);

process.stdin.on("keypress", (_str, key) => {
  if (key.name === "q" || (key.ctrl && key.name === "c")) {
    running = false;
    process.exit(0);
  }

  switch (key.name) {
    case "up":
    case "w":
      if (direction !== "DOWN") nextDirection = "UP";
      break;
    case "down":
    case "s":
      if (direction !== "UP") nextDirection = "DOWN";
      break;
    case "left":
    case "a":
      if (direction !== "RIGHT") nextDirection = "LEFT";
      break;
    case "right":
    case "d":
      if (direction !== "LEFT") nextDirection = "RIGHT";
      break;
  }
});

function render(): void {
  process.stdout.write("\x1b[2J\x1b[H");

  let output = "";
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const isHead = snake[0].x === x && snake[0].y === y;
      const isBody = snake.slice(1).some(s => s.x === x && s.y === y);
      const isFood = food.position.x === x && food.position.y === y;

      if (isHead) {
        output += "O";
      } else if (isBody) {
        output += "o";
      } else if (isFood) {
        output += "*";
      } else {
        output += ".";
      }
    }
    output += "\n";
  }
  output += `\nScore: ${score}\n`;
  output += "Use arrow keys or WASD. Press q to quit.\n";
  process.stdout.write(output);
}

function update(): void {
  direction = nextDirection;

  const head = snake[0];
  const ateFood = head.x === food.position.x && head.y === food.position.y;

  if (ateFood) {
    score += 10;
    snake = moveSnake(snake, direction, true);
    food = spawnFood(WIDTH, HEIGHT, snake);
  } else {
    snake = moveSnake(snake, direction, false);
  }

  const newHead = snake[0];

  if (checkWallCollision(newHead, WIDTH, HEIGHT) || checkSelfCollision(snake)) {
    running = false;
    process.stdout.write("\x1b[2J\x1b[H");
    process.stdout.write(`\nGame Over! Final Score: ${score}\n`);
    process.exit(0);
  }
}

function gameLoop(): void {
  if (!running) return;
  update();
  render();
}

// Initial render
render();

setInterval(gameLoop, TICK_MS);