#!/usr/bin/env python3
"""
Curses TUI Snake Game
Uses snake_engine.py for game logic.
Controls: Arrow keys or WASD
Press Q to quit, R to restart after game over
"""

import curses
from snake_engine import Game, Direction


def main(stdscr):
    curses.curs_set(0)
    stdscr.nodelay(True)
    stdscr.keypad(True)

    # Colors
    curses.start_color()
    curses.init_pair(1, curses.COLOR_GREEN, curses.COLOR_BLACK)    # border
    curses.init_pair(2, curses.COLOR_GREEN, curses.COLOR_BLACK)    # snake body
    curses.init_pair(3, curses.COLOR_RED, curses.COLOR_BLACK)      # food
    curses.init_pair(4, curses.COLOR_YELLOW, curses.COLOR_BLACK)   # head indicator

    # Game area dimensions (from engine)
    game = Game(width=20, height=20)
    render_data = game.get_render_data()
    H, W = render_data["height"], render_data["width"]

    # Center the game window
    win_h, win_w = stdscr.getmaxyx()
    off_y = max(0, (win_h - H - 2) // 2)
    off_x = max(0, (win_w - W - 2) // 2)

    while True:
        # Create new game instance
        game = Game(width=W, height=H)
        speed = 120  # ms

        # Draw initial frame
        stdscr.clear()
        stdscr.attron(curses.color_pair(1))
        for x in range(W + 2):
            stdscr.addch(off_y, off_x + x, '#')
            stdscr.addch(off_y + H + 1, off_x + x, '#')
        for y in range(H + 2):
            stdscr.addch(off_y + y, off_x, '#')
            stdscr.addch(off_y + y, off_x + W + 1, '#')
        stdscr.attroff(curses.color_pair(1))
        stdscr.addstr(off_y, off_x + W // 2 - 5, " SNAKE ", curses.A_BOLD | curses.color_pair(1))
        stdscr.addstr(off_y + H + 2, off_x + 2, f"Score: 0")
        stdscr.addstr(off_y + H + 2, off_x + W - 14, "WASD/Arrows to move")
        stdscr.refresh()

        game_over = False

        while not game_over:
            stdscr.timeout(speed)
            try:
                key = stdscr.getch()
            except Exception:
                key = -1

            # Direction input using engine's Direction enum
            if key in (curses.KEY_UP, ord('w'), ord('W')):
                game.set_direction(Direction.UP)
            elif key in (curses.KEY_DOWN, ord('s'), ord('S')):
                game.set_direction(Direction.DOWN)
            elif key in (curses.KEY_LEFT, ord('a'), ord('A')):
                game.set_direction(Direction.LEFT)
            elif key in (curses.KEY_RIGHT, ord('d'), ord('D')):
                game.set_direction(Direction.RIGHT)
            elif key in (ord('q'), ord('Q')):
                return  # Quit

            # Update game using engine
            game.update()
            render_data = game.get_render_data()

            if render_data["game_over"]:
                game_over = True
                break

            # --- Draw ---
            # Clear interior
            for y in range(1, H - 1):
                for x in range(1, W - 1):
                    stdscr.addch(off_y + y, off_x + x, ' ')

            # Border (refresh in place)
            stdscr.attron(curses.color_pair(1))
            for x in range(W + 2):
                stdscr.addch(off_y, off_x + x, '#')
                stdscr.addch(off_y + H + 1, off_x + x, '#')
            for y in range(H + 2):
                stdscr.addch(off_y + y, off_x, '#')
                stdscr.addch(off_y + y, off_x + W + 1, '#')
            stdscr.attroff(curses.color_pair(1))
            stdscr.addstr(off_y, off_x + W // 2 - 5, " SNAKE ", curses.A_BOLD | curses.color_pair(1))

            # Snake body (green) - engine returns (x, y) format
            snake = render_data["snake"]
            stdscr.attron(curses.color_pair(2))
            for x, y in snake[1:]:
                stdscr.addch(off_y + y, off_x + x, 'o')
            stdscr.attroff(curses.color_pair(2))

            # Snake head (yellow for emphasis)
            stdscr.attron(curses.color_pair(4))
            stdscr.addch(off_y + snake[0][1], off_x + snake[0][0], '@')
            stdscr.attroff(curses.color_pair(4))

            # Food (red)
            food = render_data["food"]
            if food:
                stdscr.attron(curses.color_pair(3))
                stdscr.addch(off_y + food[1], off_x + food[0], '*')
                stdscr.attroff(curses.color_pair(3))

            # Score
            score = render_data["score"]
            stdscr.addstr(off_y + H + 2, off_x + 2, f"Score: {score}")
            stdscr.addstr(off_y + H + 2, off_x + W - 14, "WASD/Arrows to move")
            stdscr.refresh()

        # --- Game Over Screen ---
        stdscr.nodelay(False)
        score = render_data["score"]
        msg_go = "GAME OVER"
        msg_sc = f"Final Score: {score}"
        msg_rs = "Press [R] Restart   [Q] Quit"
        stdscr.clear()
        stdscr.attron(curses.A_BOLD)
        stdscr.addstr(off_y + H // 2 - 2, off_x + W // 2 - len(msg_go) // 2, msg_go)
        stdscr.attroff(curses.A_BOLD)
        stdscr.addstr(off_y + H // 2, off_x + W // 2 - len(msg_sc) // 2, msg_sc)
        stdscr.addstr(off_y + H // 2 + 2, off_x + W // 2 - len(msg_rs) // 2, msg_rs)
        stdscr.refresh()

        while True:
            k = stdscr.getch()
            if k in (ord('r'), ord('R')):
                stdscr.nodelay(True)
                break
            if k in (ord('q'), ord('Q')):
                return


if __name__ == "__main__":
    curses.wrapper(main)

# mm25 done