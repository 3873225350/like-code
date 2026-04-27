import { Point } from "./snake";

export interface Food {
  position: Point;
}

export function spawnFood(width: number, height: number, snake: Point[]): Food {
  let x: number;
  let y: number;

  do {
    x = Math.floor(Math.random() * width);
    y = Math.floor(Math.random() * height);
  } while (snake.some(segment => segment.x === x && segment.y === y));

  return { position: { x, y } };
}