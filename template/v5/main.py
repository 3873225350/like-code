#!/usr/bin/env python3
"""
Main entry point for the terminal Snake game.
Orchestrates the game loop and coordinates between core, renderer, and config modules.
"""

import curses
from core import Game, GameState, Direction
from renderer import Renderer
from config import (
    BOARD_WIDTH,
    BOARD_HEIGHT,
    INITIAL_SPEED,
    SPEED_INCREMENT,
    MIN_SPEED,
    FOOD_TO_WIN,
)


def main(stdscr):
    """Main game loop."""
    # Initialize renderer and game
    renderer = Renderer(stdscr, BOARD_WIDTH, BOARD_HEIGHT)
    game = Game(BOARD_WIDTH, BOARD_HEIGHT)

    # Current game speed (delay in milliseconds)
    current_speed = INITIAL_SPEED

    # Game loop
    while True:
        # Get input with timeout based on current speed
        input_key = renderer.get_input(current_speed)

        # Check for quit signal
        if input_key == 'q':
            break

        # Change direction if valid input
        if input_key == 'UP':
            game.change_direction(Direction.UP)
        elif input_key == 'DOWN':
            game.change_direction(Direction.DOWN)
        elif input_key == 'LEFT':
            game.change_direction(Direction.LEFT)
        elif input_key == 'RIGHT':
            game.change_direction(Direction.RIGHT)

        # Update game state
        game.update()

        # Render frame
        renderer.draw(game.snake, game.food, game.score)

        # Check game over condition
        if game.state == GameState.GAME_OVER:
            renderer.show_game_over(game.score)
            renderer.get_input(-1)  # Wait for keypress
            break

        # Check win condition
        if game.state == GameState.WIN or game.score >= FOOD_TO_WIN:
            renderer.show_win(game.score)
            renderer.get_input(-1)  # Wait for keypress
            break

        # Adjust speed based on score (game gets faster)
        if game.score > 0:
            new_speed = INITIAL_SPEED - (game.score * SPEED_INCREMENT)
            current_speed = max(new_speed, MIN_SPEED)


if __name__ == "__main__":
    curses.wrapper(main)