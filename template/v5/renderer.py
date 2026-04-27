"""Curses-based terminal renderer for the Snake game."""

import curses
from core import Direction


# Sentinel for quit signal
QUIT = 'q'


class Renderer:
    """Handles all terminal rendering via curses."""

    def __init__(self, stdscr, width, height):
        self._stdscr = stdscr
        self._width = width
        self._height = height
        self._init_curses()

    def _init_curses(self):
        curses.cbreak()
        curses.noecho()
        curses.curs_set(0)
        self._stdscr.keypad(True)
        self._stdscr.nodelay(False)

    def draw(self, snake, food, score):
        """Full frame render: border, snake, food, score."""
        self._stdscr.clear()

        # Draw border
        for x in range(self._width):
            self._stdscr.addch(0, x, '#')
            self._stdscr.addch(self._height - 1, x, '#')
        for y in range(self._height):
            self._stdscr.addch(y, 0, '#')
            self._stdscr.addch(y, self._width - 1, '#')

        # Draw snake body
        for seg in snake.body:
            self._stdscr.addch(seg.y, seg.x, '#')

        # Draw snake head
        head = snake.head
        self._stdscr.addch(head.y, head.x, '@')

        # Draw food
        food_pos = food.position
        if food_pos:
            self._stdscr.addch(food_pos.y, food_pos.x, '*')

        # Draw score
        self._stdscr.addstr(0, self._width + 2, f'Score: {score}')

        self._stdscr.refresh()

    def show_game_over(self, score):
        """Display game over screen."""
        self._stdscr.clear()
        msg = f'GAME OVER! Final Score: {score}'
        self._stdscr.addstr(self._height // 2, (self._width - len(msg)) // 2, msg)
        self._stdscr.addstr(self._height // 2 + 1, (self._width - 14) // 2, 'Press any key to exit')
        self._stdscr.refresh()

    def show_win(self, score):
        """Display win screen."""
        self._stdscr.clear()
        msg = f'YOU WIN! Final Score: {score}'
        self._stdscr.addstr(self._height // 2, (self._width - len(msg)) // 2, msg)
        self._stdscr.addstr(self._height // 2 + 1, (self._width - 14) // 2, 'Press any key to exit')
        self._stdscr.refresh()

    def get_input(self, timeout_ms):
        """Get user input with timeout. Returns direction string, 'q', or None."""
        self._stdscr.timeout(timeout_ms)
        key = self._stdscr.getch()

        if key == -1:
            return None
        if key == ord('q'):
            return QUIT
        if key == curses.KEY_UP:
            return 'UP'
        if key == curses.KEY_DOWN:
            return 'DOWN'
        if key == curses.KEY_LEFT:
            return 'LEFT'
        if key == curses.KEY_RIGHT:
            return 'RIGHT'
        return None
