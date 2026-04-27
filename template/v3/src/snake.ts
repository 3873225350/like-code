export interface Point {
  x: number;
  y: number;
}

export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export type Snake = Point[];

export function createSnake(centerX: number, centerY: number, length: number): Snake {
  const snake: Snake = [];
  for (let i = 0; i < length; i++) {
    snake.push({ x: centerX - i, y: centerY });
  }
  return snake;
}

export function moveSnake(snake: Snake, direction: Direction, grow: boolean): Snake {
  const head = snake[0];
  let newHead: Point;

  switch (direction) {
    case "UP":
      newHead = { x: head.x, y: head.y - 1 };
      break;
    case "DOWN":
      newHead = { x: head.x, y: head.y + 1 };
      break;
    case "LEFT":
      newHead = { x: head.x - 1, y: head.y };
      break;
    case "RIGHT":
      newHead = { x: head.x + 1, y: head.y };
      break;
  }

  if (grow) {
    return [newHead, ...snake];
  } else {
    return [newHead, ...snake.slice(0, -1)];
  }
}

export function checkWallCollision(head: Point, width: number, height: number): boolean {
  return head.x < 0 || head.x >= width || head.y < 0 || head.y >= height;
}

export function checkSelfCollision(snake: Snake): boolean {
  const head = snake[0];
  for (let i = 1; i < snake.length; i++) {
    if (snake[i].x === head.x && snake[i].y === head.y) {
      return true;
    }
  }
  return false;
}