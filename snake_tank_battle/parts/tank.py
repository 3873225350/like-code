import random
import math

# 常量(本文件内使用)
GRID_SIZE = 20
CELL_WIDTH = 40   # 800/20
CELL_HEIGHT = 30  # 600/20


class Bullet:
    def __init__(self, pos, direction, owner='player'):
        self.pos = list(pos)  # [gx, gy] grid坐标
        self.direction = direction  # (dx, dy)
        self.owner = owner  # 'player' 或 'enemy'
        self.alive = True

    def update(self):
        # 子弹沿方向移动2格(比蛇快)
        self.pos[0] += self.direction[0] * 2
        self.pos[1] += self.direction[1] * 2
        # 出界则 alive = False
        if self.is_out_of_bounds():
            self.alive = False

    def is_out_of_bounds(self):
        return not (0 <= self.pos[0] < CELL_WIDTH and 0 <= self.pos[1] < CELL_HEIGHT)


class Tank:
    def __init__(self, max_retries=100):
        # 在地图边缘随机生成位置，避免与蛇身重叠
        self.pos = self._get_random_edge_position(max_retries)
        self.direction = random.choice([(0, 1), (0, -1), (1, 0), (-1, 0)])
        self.move_timer = 0
        self.shoot_timer = random.randint(10, 30)
        self.alive = True

    def _get_random_edge_position(self, max_retries):
        """在地图边缘随机获取位置，通过重试避免重叠"""
        for _ in range(max_retries):
            edge = random.choice(['top', 'bottom', 'left', 'right'])
            if edge == 'top':
                pos = [random.randint(0, CELL_WIDTH - 1), 0]
            elif edge == 'bottom':
                pos = [random.randint(0, CELL_WIDTH - 1), CELL_HEIGHT - 1]
            elif edge == 'left':
                pos = [0, random.randint(0, CELL_HEIGHT - 1)]
            else:  # right
                pos = [CELL_WIDTH - 1, random.randint(0, CELL_HEIGHT - 1)]
            return pos
        # 如果重试失败，返回默认位置
        return [0, 0]

    def update(self, snake_head_pos, snake_body=None):
        """AI逻辑: 每3帧随机改变方向，偶尔朝玩家位置移动"""
        self.move_timer += 1
        if self.move_timer >= 3:
            self.move_timer = 0
            # 70%概率朝玩家方向移动，30%随机方向
            if random.random() < 0.7:
                dx = snake_head_pos[0] - self.pos[0]
                dy = snake_head_pos[1] - self.pos[1]
                if abs(dx) > abs(dy):
                    self.direction = (1 if dx > 0 else -1, 0)
                else:
                    self.direction = (0, 1 if dy > 0 else -1)
            else:
                self.direction = random.choice([(0, 1), (0, -1), (1, 0), (-1, 0)])

        # 移动(不超出地图)
        new_x = self.pos[0] + self.direction[0]
        new_y = self.pos[1] + self.direction[1]
        if 0 <= new_x < CELL_WIDTH and 0 <= new_y < CELL_HEIGHT:
            # 可选: 检查是否与蛇身重叠
            if snake_body is None or (new_x, new_y) not in snake_body:
                self.pos = [new_x, new_y]
            else:
                # 撞到蛇身则反向
                self.direction = (-self.direction[0], -self.direction[1])
        else:
            # 撞墙则反向
            self.direction = (-self.direction[0], -self.direction[1])

        # 射击计时器
        self.shoot_timer -= 1

    def should_shoot(self):
        """检查是否应该射击"""
        if self.shoot_timer <= 0:
            self.shoot_timer = random.randint(20, 50)
            return True
        return False

    def shoot(self, snake_head_pos):
        """生成子弹朝玩家方向"""
        dx = snake_head_pos[0] - self.pos[0]
        dy = snake_head_pos[1] - self.pos[1]
        # 8方向
        dir_x = 1 if dx > 0 else -1 if dx < 0 else 0
        dir_y = 1 if dy > 0 else -1 if dy < 0 else 0
        if dir_x == 0 and dir_y == 0:
            dir_x, dir_y = self.direction
        return Bullet(list(self.pos), (dir_x, dir_y), owner='enemy')