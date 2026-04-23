#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简单的贪吃蛇游戏 - 使用 curses 库实现 TUI 界面
由 g47 (glm-4.7) 编写核心逻辑
"""

import curses
import random
import time
from enum import Enum
from typing import List, Tuple


class Direction(Enum):
    UP = (-1, 0)
    DOWN = (1, 0)
    LEFT = (0, -1)
    RIGHT = (0, 1)


class SnakeGame:
    def __init__(self, stdscr):
        self.stdscr = stdscr
        self.height = 20
        self.width = 40
        self.snake: List[Tuple[int, int]] = []
        self.food: Tuple[int, int] = (0, 0)
        self.direction = Direction.RIGHT
        self.score = 0
        self.game_over = False
        self.init_game()

    def init_game(self):
        curses.curs_set(0)
        self.stdscr.nodelay(1)
        self.stdscr.timeout(150)
        start_y = self.height // 2
        start_x = self.width // 2
        self.snake = [
            (start_y, start_x),
            (start_y, start_x - 1),
            (start_y, start_x - 2)
        ]
        self.direction = Direction.RIGHT
        self.score = 0
        self.game_over = False
        self.spawn_food()

    def spawn_food(self):
        while True:
            food_y = random.randint(1, self.height - 2)
            food_x = random.randint(1, self.width - 2)
            if (food_y, food_x) not in self.snake:
                self.food = (food_y, food_x)
                break

    def change_direction(self, new_direction: Direction):
        if (new_direction == Direction.UP and self.direction != Direction.DOWN) or \
           (new_direction == Direction.DOWN and self.direction != Direction.UP) or \
           (new_direction == Direction.LEFT and self.direction != Direction.RIGHT) or \
           (new_direction == Direction.RIGHT and self.direction != Direction.LEFT):
            self.direction = new_direction

    def move_snake(self):
        if self.game_over:
            return
        head_y, head_x = self.snake[0]
        dy, dx = self.direction.value
        new_head = (head_y + dy, head_x + dx)
        if self.check_collision(new_head):
            self.game_over = True
            return
        self.snake.insert(0, new_head)
        if new_head == self.food:
            self.score += 10
            self.spawn_food()
        else:
            self.snake.pop()

    def check_collision(self, pos: Tuple[int, int]) -> bool:
        y, x = pos
        if y <= 0 or y >= self.height - 1 or x <= 0 or x >= self.width - 1:
            return True
        if pos in self.snake:
            return True
        return False

    def draw(self):
        self.stdscr.clear()
        # 边框
        for i in range(self.width):
            self.stdscr.addch(0, i, '-')
            self.stdscr.addch(self.height - 1, i, '-')
        for i in range(self.height):
            self.stdscr.addch(i, 0, '|')
            self.stdscr.addch(i, self.width - 1, '|')
        # 蛇
        for y, x in self.snake:
            try:
                self.stdscr.addch(y, x, '#')
            except curses.error:
                pass
        # 食物
        try:
            self.stdscr.addch(self.food[0], self.food[1], '*')
        except curses.error:
            pass
        # 分数
        self.stdscr.addstr(0, 2, f' Score: {self.score} ')
        # 游戏结束
        if self.game_over:
            msg = ' Game Over! r=restart q=quit '
            try:
                self.stdscr.addstr(self.height // 2, (self.width - len(msg)) // 2, msg)
            except curses.error:
                pass
        # 操作提示
        try:
            self.stdscr.addstr(self.height - 1, 2, ' Arrows/WASD | q=quit r=restart ')
        except curses.error:
            pass
        self.stdscr.refresh()

    def handle_input(self):
        try:
            key = self.stdscr.getch()
            if key in (ord('q'), ord('Q')):
                return False
            if key in (ord('r'), ord('R')):
                self.init_game()
                return True
            if key == curses.KEY_UP or key in (ord('w'), ord('W')):
                self.change_direction(Direction.UP)
            elif key == curses.KEY_DOWN or key in (ord('s'), ord('S')):
                self.change_direction(Direction.DOWN)
            elif key == curses.KEY_LEFT or key in (ord('a'), ord('A')):
                self.change_direction(Direction.LEFT)
            elif key == curses.KEY_RIGHT or key in (ord('d'), ord('D')):
                self.change_direction(Direction.RIGHT)
        except curses.error:
            pass
        return True

    def run(self):
        while True:
            if not self.handle_input():
                break
            self.move_snake()
            self.draw()
            time.sleep(0.05)


def main(stdscr):
    game = SnakeGame(stdscr)
    game.run()


if __name__ == '__main__':
    try:
        curses.wrapper(main)
    except KeyboardInterrupt:
        print('\nGame exited')
