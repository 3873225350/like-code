"""
贪吃蛇游戏核心逻辑 (snake_core.py)
"""

import random
import time
from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Tuple


class Direction(Enum):
    """蛇移动方向"""
    UP = (0, -1)
    DOWN = (0, 1)
    LEFT = (-1, 0)
    RIGHT = (1, 0)


@dataclass
class Position:
    """位置坐标"""
    x: int
    y: int

    def __add__(self, other: 'Position') -> 'Position':
        return Position(self.x + other.x, self.y + other.y)

    def __eq__(self, other) -> bool:
        if isinstance(other, Position):
            return self.x == other.x and self.y == other.y
        return False


@dataclass
class Snake:
    """蛇数据结构"""
    positions: List[Position] = field(default_factory=list)
    direction: Direction = Direction.RIGHT
    grow_pending: int = 0

    def __post_init__(self):
        if not self.positions:
            self.positions = [Position(5, 5), Position(4, 5), Position(3, 5)]

    @property
    def head(self) -> Position:
        return self.positions[0]

    @property
    def length(self) -> int:
        return len(self.positions)

    def move(self) -> Position:
        """移动蛇，返回蛇头新位置"""
        new_head = Position(self.head.x + self.direction.value[0],
                            self.head.y + self.direction.value[1])

        self.positions.insert(0, new_head)

        if self.grow_pending > 0:
            self.grow_pending -= 1
        else:
            self.positions.pop()

        return new_head

    def grow(self, amount: int = 1):
        """增加蛇长度"""
        self.grow_pending += amount

    def set_direction(self, new_dir: Direction):
        """设置方向（防止180度掉头）"""
        opposite_dirs = {
            Direction.UP: Direction.DOWN,
            Direction.DOWN: Direction.UP,
            Direction.LEFT: Direction.RIGHT,
            Direction.RIGHT: Direction.LEFT
        }
        if new_dir != opposite_dirs.get(self.direction):
            self.direction = new_dir


@dataclass
class Food:
    """食物"""
    position: Position
    value: int = 1


@dataclass
class GameState:
    """游戏状态"""
    snake: Snake = field(default_factory=Snake)
    food: Optional[Food] = None
    score: int = 0
    game_over: bool = False
    width: int = 20
    height: int = 15

    def generate_food(self):
        """在随机位置生成食物"""
        while True:
            pos = Position(
                random.randint(1, self.width),
                random.randint(1, self.height)
            )
            if pos not in self.snake.positions:
                self.food = Food(position=pos)
                break


class SnakeGame:
    """贪吃蛇游戏核心类"""

    def __init__(self, width: int = 20, height: int = 15, tick_interval: float = 0.1):
        self.width = width
        self.height = height
        self.tick_interval = tick_interval
        self.state = GameState(width=width, height=height)
        self.state.snake = Snake()
        self.state.generate_food()
        self.running = False

    def handle_input(self, key: str):
        """处理键盘输入"""
        key_map = {
            'w': Direction.UP, 'W': Direction.UP,
            's': Direction.DOWN, 'S': Direction.DOWN,
            'a': Direction.LEFT, 'A': Direction.LEFT,
            'd': Direction.RIGHT, 'D': Direction.RIGHT,
            'KEY_UP': Direction.UP,
            'KEY_DOWN': Direction.DOWN,
            'KEY_LEFT': Direction.LEFT,
            'KEY_RIGHT': Direction.RIGHT
        }
        if key in key_map:
            self.state.snake.set_direction(key_map[key])

    def check_collision(self, pos: Position) -> bool:
        """检测碰撞（撞墙或撞自己）"""
        snake = self.state.snake

        if pos.x <= 0 or pos.x > self.width or pos.y <= 0 or pos.y > self.height:
            return True

        if pos in snake.positions[1:]:
            return True

        return False

    def update(self) -> bool:
        """更新游戏状态，每帧调用一次"""
        if self.state.game_over:
            return False

        snake = self.state.snake
        new_head = snake.move()

        if self.check_collision(new_head):
            self.state.game_over = True
            return False

        if self.state.food and new_head == self.state.food.position:
            snake.grow()
            self.state.score += self.state.food.value
            self.state.generate_food()

        return True

    def start(self):
        """启动游戏主循环"""
        self.running = True

    def stop(self):
        """停止游戏"""
        self.running = False

    def reset(self):
        """重置游戏"""
        self.state = GameState(width=self.width, height=self.height)
        self.state.snake = Snake()
        self.state.generate_food()


def create_game(width: int = 20, height: int = 15, tick_interval: float = 0.1) -> SnakeGame:
    """工厂函数：创建游戏实例"""
    return SnakeGame(width=width, height=height, tick_interval=tick_interval)


if __name__ == "__main__":
    print("贪吃蛇游戏核心模块 - 请使用 snake_game.py 运行游戏")