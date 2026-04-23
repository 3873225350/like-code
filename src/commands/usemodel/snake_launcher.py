#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
贪吃蛇游戏启动器 - 由 mm7 (MiniMax-M2.7) 编写
"""

import sys

HELP_INFO = """
========================================
        贪吃蛇 TUI 游戏
========================================

操作说明:
  方向键 / WASD : 控制蛇的移动方向
  q             : 退出游戏
  r             : 重新开始游戏

运行方式:
  python3 snake_game.py
  或
  python3 snake_launcher.py

========================================
"""


def show_help():
    print(HELP_INFO)


def main():
    if len(sys.argv) > 1 and sys.argv[1] in ('--help', '-h'):
        show_help()
        return

    print("正在启动贪吃蛇游戏... (--help 查看帮助)\n")

    try:
        import snake_game
        import curses
        curses.wrapper(snake_game.main)
    except ImportError:
        print("错误：找不到 snake_game.py 文件！")
        print("请确保 snake_game.py 在同一目录下。")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n游戏已退出，感谢游玩！")
        sys.exit(0)


if __name__ == '__main__':
    main()
