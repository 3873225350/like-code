"""
贪吃蛇游戏 - UI模块
负责界面渲染、输入处理和计分显示
"""

import os
import sys
import select

# 游戏区域大小
WIDTH = 20
HEIGHT = 20

# 字符定义
CHAR_BORDER = '#'
CHAR_SNAKE_HEAD = '@'
CHAR_SNAKE_BODY = 'o'
CHAR_FOOD = '*'
CHAR_EMPTY = ' '


def clear_screen():
    """清屏"""
    os.system('cls' if os.name == 'nt' else 'clear')


def render_game(snake, food, score, game_over=False):
    """
    渲染游戏界面

    Args:
        snake: 蛇的位置列表 [(x, y), ...]
        food: 食物位置 (x, y)
        score: 当前分数
        game_over: 是否游戏结束
    """
    clear_screen()

    # 创建游戏区域
    board = [[CHAR_EMPTY for _ in range(WIDTH)] for _ in range(HEIGHT)]

    # 绘制边界
    for x in range(WIDTH):
        board[0][x] = CHAR_BORDER
        board[HEIGHT - 1][x] = CHAR_BORDER
    for y in range(HEIGHT):
        board[y][0] = CHAR_BORDER
        board[y][WIDTH - 1] = CHAR_BORDER

    # 放置食物
    fx, fy = food
    board[fy][fx] = CHAR_FOOD

    # 放置蛇身
    for i, (sx, sy) in enumerate(snake):
        if i == 0:
            board[sy][sx] = CHAR_SNAKE_HEAD
        else:
            board[sy][sx] = CHAR_SNAKE_BODY

    # 打印游戏界面
    print("=" * (WIDTH + 2))
    print(f"  贪吃蛇 - 分数: {score}")
    print("=" * (WIDTH + 2))

    for row in board:
        print('|' + ''.join(row) + '|')

    print("=" * (WIDTH + 2))
    print("操作: WASD 或 方向键 | Q退出")

    if game_over:
        print_game_over(score)


def print_game_over(score):
    """打印游戏结束界面"""
    print("")
    print("*" * (WIDTH + 2))
    print(f"      游戏结束!")
    print(f"      最终分数: {score}")
    print("*" * (WIDTH + 2))
    print("按 R 重新开始 或 Q 退出")


def get_input(timeout=0.1):
    """
    获取键盘输入（非阻塞）

    Args:
        timeout: 超时时间（秒）

    Returns:
        按键字符，或 None（无输入）
    """
    if sys.platform == 'win32':
        # Windows平台
        import msvcrt
        if msvcrt.kbhit():
            return msvcrt.getch().decode('utf-8')
    else:
        # Unix/Linux平台
        if select.select([sys.stdin], [], [], timeout)[0]:
            return sys.stdin.read(1)
    return None


def parse_direction(key):
    """
    解析方向键输入

    Args:
        key: 按键字符

    Returns:
        方向 (dx, dy) 或 None
    """
    # WASD
    direction_map = {
        'w': (0, -1),   # 上
        'W': (0, -1),
        's': (0, 1),    # 下
        'S': (0, 1),
        'a': (-1, 0),  # 左
        'A': (-1, 0),
        'd': (1, 0),    # 右
        'D': (1, 0),
    }

    if key in direction_map:
        return direction_map[key]

    # 方向键（方向键在终端中是转义序列）
    escape_map = {
        '\x1b[A': (0, -1),  # 上
        '\x1b[B': (0, 1),   # 下
        '\x1b[D': (-1, 0),  # 左
        '\x1b[C': (1, 0),   # 右
    }

    return escape_map.get(key)


def show_start_screen():
    """显示开始界面"""
    clear_screen()
    print("")
    print("=" * (WIDTH + 2))
    print("       贪吃蛇游戏")
    print("=" * (WIDTH + 2))
    print("")
    print(f"  游戏区域: {WIDTH}x{HEIGHT}")
    print("  规则:")
    print("    # = 边界")
    print("    @ = 蛇头")
    print("    o = 蛇身")
    print("    * = 食物")
    print("")
    print("=" * (WIDTH + 2))
    print("按任意键开始游戏...")
    print("WASD 或 方向键移动 | Q退出")


if __name__ == "__main__":
    # 测试UI模块
    show_start_screen()
    input()

    # 测试渲染
    test_snake = [(5, 5), (4, 5), (3, 5)]
    test_food = (10, 10)
    render_game(test_snake, test_food, 0)

    print("\nUI模块测试完成")
