"""
贪吃蛇游戏 - 主程序
整合snake_core.py和snake_ui.py
"""

import sys
import time
from snake_core import SnakeGame, Direction, Position
from snake_ui import render_game, get_input, parse_direction, show_start_screen, clear_screen

def main():
    """游戏主循环"""
    game = SnakeGame(width=20, height=15, tick_interval=0.1)

    show_start_screen()
    input("按回车开始...")

    game.start()
    last_update = time.time()

    while game.running:
        # 处理输入
        key = get_input(timeout=0.01)
        if key:
            if key in ('q', 'Q'):
                game.stop()
                break
            direction = parse_direction(key)
            if direction:
                dir_map = {
                    (0, -1): Direction.UP,
                    (0, 1): Direction.DOWN,
                    (-1, 0): Direction.LEFT,
                    (1, 0): Direction.RIGHT
                }
                if direction in dir_map:
                    game.handle_input(key)

        # 更新游戏
        now = time.time()
        if now - last_update >= 0.1:
            game.update()
            last_update = now

            # 渲染
            snake_data = [(p.x, p.y) for p in game.state.snake.positions]
            food_pos = (game.state.food.position.x, game.state.food.position.y) if game.state.food else (10, 10)
            render_game(snake_data, food_pos, game.state.score, game.state.game_over)

            if game.state.game_over:
                print("按 R 重新开始 或 Q 退出")
                # 等待用户输入
                while True:
                    key = get_input(timeout=1.0)
                    if key in ('r', 'R'):
                        game.reset()
                        game.start()
                        break
                    elif key in ('q', 'Q'):
                        game.stop()
                        break

    print("游戏结束!")

if __name__ == "__main__":
    main()