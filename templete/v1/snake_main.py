#!/usr/bin/env python3
"""Snake Game TUI - Simple curses-based terminal UI."""

import curses
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from snake_engine import Game


def main(stdscr: curses.window) -> None:
    """Main game loop with curses UI."""
    curses.curs_set(0)
    stdscr.nodelay(True)
    stdscr.keypad(True)

    game = Game(width=20, height=20)
    direction_map = {
        curses.KEY_UP: "UP", curses.KEY_DOWN: "DOWN",
        curses.KEY_LEFT: "LEFT", curses.KEY_RIGHT: "RIGHT",
        ord("w"): "UP", ord("s"): "DOWN", ord("a"): "LEFT", ord("d"): "RIGHT",
        ord("W"): "UP", ord("S"): "DOWN", ord("A"): "LEFT", ord("D"): "RIGHT",
    }

    while True:
        stdscr.clear()
        data = game.get_render_data()
        h, w = data["height"], data["width"]

        # Draw border: +---+ (width+2 wide)
        stdscr.addstr(0, 0, "+" + "-" * (w + 2) + "+")
        stdscr.addstr(h + 1, 0, "+" + "-" * (w + 2) + "+")
        for y in range(h):
            stdscr.addstr(y + 1, 0, "|")
            stdscr.addstr(y + 1, w + 1, "|")

        # Draw game area
        snake = data["snake"]
        snake_set = set(snake)
        food = data["food"]

        for y in range(h):
            for x in range(w):
                pos = (x, y)
                if pos == snake[0]:
                    ch = "@"
                elif pos in snake_set:
                    ch = "#"
                elif pos == food:
                    ch = "*"
                else:
                    ch = " "
                stdscr.addstr(y + 1, x + 1, ch)

        # Draw score
        stdscr.addstr(0, 2, f"Score: {data['score']}  Level: {data['level']}")
        stdscr.addstr(h + 2, 0, "WASD/Arrows: Move  |  P: Pause  |  Q: Quit")

        # Draw game over
        if data["game_over"]:
            mid_y = h // 2
            mid_x = (w - 9) // 2
            stdscr.addstr(mid_y, mid_x, "Game Over!")
            stdscr.addstr(mid_y + 1, mid_x - 6, "Press Q to Quit, R to Restart")

        stdscr.refresh()

        if data["game_over"]:
            key = stdscr.getch()
            if key in (ord("q"), ord("Q")):
                break
            if key in (ord("r"), ord("R")):
                game = Game(width=20, height=20)
            continue

        # Handle input
        key = stdscr.getch()
        if key in direction_map:
            game.set_direction(direction_map[key])
        elif key in (ord("p"), ord("P")):
            game.toggle_pause()

        # Update game
        if not data["paused"]:
            game.update()

        # Control speed
        curses.napms(data["speed"])


if __name__ == "__main__":
    curses.wrapper(main)