"""Snake Game Engine - Simple Core"""

import random


class Game:
    """Snake game core engine.

    Public methods:
        set_direction(direction: str) -> None
        update() -> None
        get_render_data() -> dict
    """

    DIRECTIONS = {"UP": (0, -1), "DOWN": (0, 1), "LEFT": (-1, 0), "RIGHT": (1, 0)}
    DIR_KEYS = set(DIRECTIONS.keys())

    def __init__(self, width: int = 20, height: int = 20):
        self.width = width
        self.height = height
        self.score = 0
        self.game_over = False

        # Snake starts in the middle, length 3, moving right
        cx, cy = width // 2, height // 2
        self.snake = [(cx, cy), (cx - 1, cy), (cx - 2, cy)]
        self.direction = "RIGHT"
        self.next_direction = "RIGHT"

        self.food = None
        self._place_food()

    def set_direction(self, direction: str) -> None:
        """Set snake direction. Ignored if it would cause immediate self-collision."""
        if direction not in self.DIR_KEYS:
            return
        opposite = {"UP": "DOWN", "DOWN": "UP", "LEFT": "RIGHT", "RIGHT": "LEFT"}
        if direction != opposite.get(self.direction):
            self.next_direction = direction

    def _place_food(self) -> None:
        """Place food at a random empty cell."""
        snake_set = set(self.snake)
        empty = [
            (x, y)
            for y in range(self.height)
            for x in range(self.width)
            if (x, y) not in snake_set
        ]
        self.food = random.choice(empty)

    def update(self) -> None:
        """Advance the game by one tick. Call get_render_data() afterwards."""
        if self.game_over:
            return

        self.direction = self.next_direction
        dx, dy = self.DIRECTIONS[self.direction]
        head_x, head_y = self.snake[0]
        new_head = (head_x + dx, head_y + dy)

        # Wall collision
        if not (0 <= new_head[0] < self.width and 0 <= new_head[1] < self.height):
            self.game_over = True
            return

        # Self collision (excluding tail which will move)
        if new_head in self.snake[:-1]:
            self.game_over = True
            return

        self.snake.insert(0, new_head)

        if new_head == self.food:
            self.score += 1
            self._place_food()
        else:
            self.snake.pop()

    def get_render_data(self) -> dict:
        """Return data needed to render the game.

        Returns:
            dict with keys:
                width, height, snake, food, score, game_over
        """
        return {
            "width": self.width,
            "height": self.height,
            "snake": self.snake,
            "food": self.food,
            "score": self.score,
            "game_over": self.game_over,
        }