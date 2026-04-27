"""Game configuration and constants for the Snake game."""

# Board dimensions (playable area, not including border)
BOARD_WIDTH = 20
BOARD_HEIGHT = 20

# Game speed (milliseconds per frame - lower = faster)
INITIAL_SPEED = 150
SPEED_INCREMENT = 5       # speed decrease per food eaten
MIN_SPEED = 60            # fastest possible speed

# Snake
INITIAL_SNAKE_LENGTH = 3

# Scoring
POINTS_PER_FOOD = 10

# Win condition (food eaten to win)
FOOD_TO_WIN = 50

# Display characters
SNAKE_HEAD = '@'
SNAKE_BODY = '#'
FOOD_CHAR = '*'
WALL_CHAR = '#'
EMPTY_CHAR = ' '
