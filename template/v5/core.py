"""Core game logic for the Snake game."""

import random
from enum import Enum
from collections import namedtuple
from config import FOOD_TO_WIN


Point = namedtuple('Point', ['x', 'y'])


class Direction(Enum):
    UP = (0, -1)
    DOWN = (0, 1)
    LEFT = (-1, 0)
    RIGHT = (1, 0)


class GameState(Enum):
    PLAYING = 1
    GAME_OVER = 2
    WIN = 3


class Snake:
    """Represents the snake entity."""

    def __init__(self, start_point, length=3):
        self._body = []
        for i in range(length):
            self._body.append(Point(start_point.x - i, start_point.y))

    @property
    def head(self):
        return self._body[0]

    @property
    def body(self):
        return list(self._body)

    def move(self, direction):
        """Move the snake one step in the given direction."""
        dx, dy = direction.value
        new_head = Point(self.head.x + dx, self.head.y + dy)
        self._body.insert(0, new_head)
        self._body.pop()
        return new_head

    def grow(self):
        """Grow the snake by keeping the tail after next move."""
        tail = self._body[-1]
        self._body.append(tail)

    def check_collision(self, bounds):
        """Check if head hits wall or self. bounds = (width, height)."""
        w, h = bounds
        hx, hy = self.head.x, self.head.y
        # Wall collision
        if hx <= 0 or hx >= w - 1 or hy <= 0 or hy >= h - 1:
            return True
        # Self collision (skip head at index 0)
        for seg in self._body[1:]:
            if seg == self.head:
                return True
        return False


class Food:
    """Represents the food item."""

    def __init__(self, bounds, snake_body):
        self._bounds = bounds
        self._position = None
        self.respawn(snake_body)

    @property
    def position(self):
        return self._position

    def respawn(self, snake_body):
        """Place food at a random position not occupied by the snake."""
        w, h = self._bounds
        occupied = set((p.x, p.y) for p in snake_body)
        available = []
        for x in range(1, w - 1):
            for y in range(1, h - 1):
                if (x, y) not in occupied:
                    available.append(Point(x, y))
        self._position = random.choice(available) if available else None


class Game:
    """Orchestrates the core game logic."""

    def __init__(self, width, height):
        self._width = width
        self._height = height
        self._bounds = (width, height)
        start = Point(width // 2, height // 2)
        self._snake = Snake(start)
        self._food = Food(self._bounds, self._snake.body)
        self._direction = Direction.RIGHT
        self._next_direction = Direction.RIGHT
        self._state = GameState.PLAYING
        self._score = 0

    @property
    def snake(self):
        return self._snake

    @property
    def food(self):
        return self._food

    @property
    def score(self):
        return self._score

    @property
    def state(self):
        return self._state

    def change_direction(self, new_dir):
        """Change direction, preventing 180-degree reversal."""
        opposites = {
            Direction.UP: Direction.DOWN,
            Direction.DOWN: Direction.UP,
            Direction.LEFT: Direction.RIGHT,
            Direction.RIGHT: Direction.LEFT,
        }
        if new_dir != opposites.get(self._direction):
            self._next_direction = new_dir

    def update(self):
        """Advance the game by one frame."""
        if self._state != GameState.PLAYING:
            return

        self._direction = self._next_direction
        self._snake.move(self._direction)

        # Check collision
        if self._snake.check_collision(self._bounds):
            self._state = GameState.GAME_OVER
            return

        # Check food
        if self._snake.head == self._food.position:
            self._snake.grow()
            self._score += 1
            if self._score >= FOOD_TO_WIN:
                self._state = GameState.WIN
            else:
                self._food.respawn(self._snake.body)
