"""
贪吃蛇坦克大战 - 游戏主循环模块
负责游戏初始化、事件处理、状态更新、碰撞检测和主循环
"""

import pygame
import random
import sys

# 导入其他模块
from parts.snake import Snake
from parts.tank import Tank, Bullet
from parts.food import Food
from parts.renderer import Renderer
from parts.effects import SoundManager, ParticleEffect

# 全局常量
WINDOW_WIDTH = 800
WINDOW_HEIGHT = 600
GRID_SIZE = 20
CELL_WIDTH = WINDOW_WIDTH // GRID_SIZE   # 40
CELL_HEIGHT = WINDOW_HEIGHT // GRID_SIZE  # 30
FPS = 10

# 颜色定义
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GREEN = (0, 255, 0)
DARK_GREEN = (0, 180, 0)
RED = (255, 0, 0)
YELLOW = (255, 255, 0)
BLUE = (0, 100, 255)
ORANGE = (255, 165, 0)
GRAY = (128, 128, 128)
PURPLE = (160, 32, 240)


class Game:
    """游戏主类"""

    def __init__(self):
        """初始化游戏"""
        # pygame初始化
        pygame.init()
        pygame.mixer.init()

        # 创建窗口
        self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        pygame.display.set_caption("贪吃蛇坦克大战")
        self.clock = pygame.time.Clock()

        # 初始化游戏状态
        self.reset_game()

    def reset_game(self):
        """重置游戏状态"""
        # 创建蛇
        self.snake = Snake()

        # 创建食物
        self.food = Food.spawn(self.snake.body, [])

        # 创建敌方坦克列表 (初始2个)
        self.tanks = []
        self.spawn_tanks(2)

        # 子弹列表
        self.bullets = []

        # 粒子效果列表
        self.particles = []

        # 分数
        self.score = 0

        # 游戏状态
        self.game_over = False

        # 护盾状态
        self.shield_active = False
        self.shield_timer = 0

        # 速度加成状态
        self.speed_active = False
        self.speed_timer = 0

        # 射击冷却（防止连续射击）
        self.shoot_cooldown = 0

    def spawn_tanks(self, count):
        """生成指定数量的坦克"""
        for _ in range(count):
            tank = Tank()
            # 确保坦克不与蛇重叠
            while tank.pos in self.snake.body:
                tank = Tank()
            self.tanks.append(tank)

    def get_tank_count(self):
        """根据分数计算坦克数量：初始2个，每100分+1个"""
        base_count = 2
        bonus = self.score // 100
        return base_count + bonus

    def handle_events(self):
        """处理键盘事件"""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False

            if event.type == pygame.KEYDOWN:
                # 方向键控制蛇移动
                if event.key == pygame.K_UP:
                    self.snake.change_direction((0, -1))
                elif event.key == pygame.K_DOWN:
                    self.snake.change_direction((0, 1))
                elif event.key == pygame.K_LEFT:
                    self.snake.change_direction((-1, 0))
                elif event.key == pygame.K_RIGHT:
                    self.snake.change_direction((1, 0))

                # 空格键射击
                elif event.key == pygame.K_SPACE:
                    if not self.game_over and self.shoot_cooldown <= 0:
                        self.player_shoot()
                        self.shoot_cooldown = 3  # 冷却3帧

                # R键重新开始
                elif event.key == pygame.K_r:
                    self.reset_game()

        return True

    def player_shoot(self):
        """玩家发射子弹"""
        head_pos = self.snake.head_pos()
        direction = self.snake.direction
        bullet = Bullet(head_pos, direction, owner='player')
        self.bullets.append(bullet)
        SoundManager.play_shoot()

    def update(self):
        """更新游戏状态"""
        if self.game_over:
            return

        # 更新射击冷却
        if self.shoot_cooldown > 0:
            self.shoot_cooldown -= 1

        # 更新护盾计时器
        if self.shield_active:
            self.shield_timer -= 1
            if self.shield_timer <= 0:
                self.shield_active = False

        # 更新速度加成计时器
        if self.speed_active:
            self.speed_timer -= 1
            if self.speed_timer <= 0:
                self.speed_active = False

        # 更新蛇
        self.snake.move()

        # 检查蛇是否撞墙或撞到自己
        if self.snake.check_wall_collision() or self.snake.check_self_collision():
            self.trigger_game_over()
            return

        # 更新坦克
        snake_head = self.snake.head_pos()
        for tank in self.tanks:
            tank.update(snake_head)
            # 坦克射击
            bullet = tank.shoot(snake_head)
            if bullet:
                self.bullets.append(bullet)
                SoundManager.play_shoot()

        # 更新子弹
        for bullet in self.bullets[:]:
            bullet.update()
            if bullet.is_out_of_bounds():
                self.bullets.remove(bullet)

        # 更新粒子效果
        ParticleEffect.update_and_draw(self.screen, self.particles)

        # 碰撞检测
        self.check_collisions()

        # 检查是否需要补充坦克
        expected_tank_count = self.get_tank_count()
        if len(self.tanks) < expected_tank_count:
            self.spawn_tanks(expected_tank_count - len(self.tanks))

        # 检查是否需要刷新食物
        if self.food is None:
            self.food = Food.spawn(self.snake.body, [t.pos for t in self.tanks])

    def check_collisions(self):
        """碰撞检测"""
        head_pos = self.snake.head_pos()

        # 1. 蛇吃食物
        if self.food and head_pos == self.food.pos:
            self.snake.grow()
            self.score += 10
            SoundManager.play_eat()

            # 处理特殊食物效果
            if self.food.type == 'speed':
                self.speed_active = True
                self.speed_timer = 100  # 持续100帧
            elif self.food.type == 'shield':
                self.shield_active = True
                self.shield_timer = 200  # 持续200帧

            # 刷新食物
            self.food = Food.spawn(self.snake.body, [t.pos for t in self.tanks])

        # 2. 玩家子弹击中坦克
        for bullet in self.bullets[:]:
            if bullet.owner != 'player':
                continue

            for tank in self.tanks[:]:
                if bullet.pos == tank.pos:
                    # 坦克被击中，销毁
                    self.tanks.remove(tank)
                    if bullet in self.bullets:
                        self.bullets.remove(bullet)
                    self.score += 50
                    SoundManager.play_explosion()

                    # 创建爆炸粒子效果
                    particles = ParticleEffect.create_explosion(tank.pos)
                    self.particles.extend(particles)
                    break

        # 3. 玩家子弹出界（已在update中处理）

        # 4. 敌方子弹击中蛇
        for bullet in self.bullets[:]:
            if bullet.owner != 'enemy':
                continue

            if bullet.pos == head_pos:
                # 敌方子弹击中蛇头
                self.bullets.remove(bullet)

                if self.shield_active:
                    # 有护盾，消耗护盾而不死亡
                    self.shield_active = False
                    self.shield_timer = 0
                    SoundManager.play_explosion()
                    # 创建小爆炸效果
                    particles = ParticleEffect.create_explosion(head_pos)
                    self.particles.extend(particles)
                else:
                    # 没有护盾，游戏结束
                    self.trigger_game_over()
                    return

    def trigger_game_over(self):
        """触发游戏结束"""
        self.game_over = True
        SoundManager.play_game_over()

    def run(self):
        """主游戏循环"""
        running = True

        while running:
            # 处理事件
            running = self.handle_events()

            # 根据速度加成调整FPS
            if self.speed_active:
                current_fps = 20  # 速度加成期间FPS翻倍
            else:
                current_fps = FPS

            # 更新游戏状态
            self.update()

            # 渲染
            self.screen.fill(BLACK)

            # 绘制网格
            Renderer.draw_grid(self.screen)

            # 绘制食物
            if self.food:
                Renderer.draw_food(self.screen, self.food)

            # 绘制蛇
            Renderer.draw_snake(self.screen, self.snake)

            # 绘制坦克
            Renderer.draw_tanks(self.screen, self.tanks)

            # 绘制子弹
            Renderer.draw_bullets(self.screen, self.bullets)

            # 绘制粒子效果
            ParticleEffect.update_and_draw(self.screen, self.particles)

            # 绘制HUD
            Renderer.draw_hud(self.screen, self.score, self.shield_active, self.speed_active)

            # 游戏结束画面
            if self.game_over:
                Renderer.draw_game_over(self.screen, self.score)

            # 更新显示
            pygame.display.flip()

            # 控制帧率
            self.clock.tick(current_fps)

        pygame.quit()
        sys.exit()


def main():
    """入口函数"""
    game = Game()
    game.run()


if __name__ == "__main__":
    main()