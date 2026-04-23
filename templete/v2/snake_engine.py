"""
Snake Game Engine
A simple Python implementation of the classic Snake game logic.
"""

import random
from enum import Enum
from typing import List, Tuple, Optional


class Direction(Enum):
    """Game directions."""
    UP = (0, -1)
    DOWN = (0, 1)
    LEFT = (-1, 0)
    RIGHT = (1, 0)


class Game:
    """
    Snake game engine.

    Attributes:
        width: Game board width (number of cells)
        height: Game board height (number of cells)
    """

    def __init__(self, width: int = 20, height: int = 20):
        """
        Initialize the game.

        Args:
            width: Width of the game board (default 20)
            height: Height of the game board (default 20)
        """
        self.width = width
        self.height = height

        # Snake: list of (x, y) positions, head is at index 0
        self.snake: List[Tuple[int, int]] = [(width // 2, height // 2)]

        # Current direction (default moving right)
        self.direction: Direction = Direction.RIGHT

        # Next direction (for input buffering, prevents 180-degree turns)
        self.next_direction: Direction = Direction.RIGHT

        # Food position
        self.food: Optional[Tuple[int, int]] = None

        # Game state
        self.game_over: bool = False
        self.score: int = 0

        # Generate initial food
        self._generate_food()

    def set_direction(self, direction: Direction) -> None:
        """
        Set the snake's direction.

        Args:
            direction: New direction to move
        """
        # Prevent 180-degree turns (can't go opposite of current direction)
        opposite_directions = {
            Direction.UP: Direction.DOWN,
            Direction.DOWN: Direction.UP,
            Direction.LEFT: Direction.RIGHT,
            Direction.RIGHT: Direction.LEFT,
        }

        if direction != opposite_directions.get(self.direction):
            self.next_direction = direction

    def update(self) -> None:
        """
        Update game state by one tick.
        Moves the snake, checks collisions, and handles eating food.
        """
        if self.game_over:
            return

        # Apply buffered direction
        self.direction = self.next_direction

        # Calculate new head position
        head_x, head_y = self.snake[0]
        dx, dy = self.direction.value
        new_head = (head_x + dx, head_y + dy)

        # Check wall collision
        if not self._is_within_bounds(new_head):
            self.game_over = True
            return

        # Check self collision
        if new_head in self.snake:
            self.game_over = True
            return

        # Move snake: add new head
        self.snake.insert(0, new_head)

        # Check if food eaten
        if new_head == self.food:
            self.score += 1
            self._generate_food()
        else:
            # Remove tail if no food eaten
            self.snake.pop()

    def get_render_data(self) -> dict:
        """
        Get data needed for rendering.

        Returns:
            Dictionary containing:
                - snake: List of (x, y) positions
                - food: (x, y) position of food
                - width: Board width
                - height: Board height
                - game_over: Boolean indicating if game is over
                - score: Current score
        """
        return {
            "snake": self.snake.copy(),
            "food": self.food,
            "width": self.width,
            "height": self.height,
            "game_over": self.game_over,
            "score": self.score,
        }

    def _is_within_bounds(self, position: Tuple[int, int]) -> bool:
        """Check if position is within game board bounds."""
        x, y = position
        return 0 <= x < self.width and 0 <= y < self.height

    def _generate_food(self) -> None:
        """Generate food at a random empty position."""
        # Find all empty cells
        empty_cells = []
        for x in range(self.width):
            for y in range(self.height):
                if (x, y) not in self.snake:
                    empty_cells.append((x, y))

        if empty_cells:
            self.food = random.choice(empty_cells)
        else:
            # Win condition: snake fills the entire board
            self.game_over = True

    def reset(self) -> None:
        """Reset the game to initial state."""
        self.snake = [(self.width // 2, self.height // 2)]
        self.direction = Direction.RIGHT
        self.next_direction = Direction.RIGHT
        self.game_over = False
        self.score = 0
        self._generate_food()


# mm21 done