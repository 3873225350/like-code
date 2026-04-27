# 贪吃蛇坦克大战 - 设计规范

## 游戏概述
玩家控制一条"坦克蛇"，在网格地图上移动、吃食物变长、发射子弹消灭敌方坦克。

## 技术栈
- Python 3 + pygame
- 单文件游戏: `game.py` (所有代码在一个文件中，方便运行)
- 不要使用 __pycache__ 或复杂的包结构

## 游戏规则
1. 玩家用方向键控制蛇的移动（上下左右）
2. 按空格键发射子弹（子弹沿蛇头方向飞行）
3. 地图上随机出现食物，吃到食物蛇身变长 +10分
4. 敌方坦克随机生成，会移动并朝玩家方向射击
5. 玩家子弹击中坦克: 坦克销毁 +50分
6. 游戏结束条件: 蛇撞墙、蛇撞到自己、蛇被敌方子弹击中
7. 按 R 键重新开始

## 全局常量 (config)
```python
WINDOW_WIDTH = 800
WINDOW_HEIGHT = 600
GRID_SIZE = 20  # 每格像素
CELL_WIDTH = WINDOW_WIDTH // GRID_SIZE   # 40
CELL_HEIGHT = WINDOW_HEIGHT // GRID_SIZE  # 30
FPS = 10

# 颜色
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
```

## 模块分工

### 1. 游戏主循环 (main loop) - 由 g5 负责
在这个文件框架中编写 `main()` 函数和主游戏循环:
- pygame 初始化
- 创建 snake, tank 列表, food, bullets 列表
- 主循环: 处理事件 -> 更新状态 -> 渲染
- 游戏结束检测和重新开始逻辑
- 每一帧调用 snake.update(), 每个tank.update(), 碰撞检测

### 2. Snake 类 - 由 g51 负责
```python
class Snake:
    def __init__(self):
        self.body = [(CELL_WIDTH//2, CELL_HEIGHT//2)]  # 初始位置
        self.direction = (1, 0)  # 初始向右
        self.grow_flag = False
    
    def move(self):
        # 移动蛇身和蛇头
    
    def grow(self):
        # 吃到食物后增长
    
    def change_direction(self, new_dir):
        # 不允许反向(不能从右直接转左)
    
    def check_self_collision(self):
        # 检查是否撞到自己
    
    def check_wall_collision(self):
        # 检查是否撞墙
    
    def head_pos(self):
        # 返回蛇头位置 (grid坐标)
```

### 3. Tank 和 Bullet 类 - 由 g47 负责
```python
class Bullet:
    def __init__(self, pos, direction, owner='player'):
        self.pos = pos  # (grid_x, grid_y)
        self.direction = direction
        self.owner = owner  # 'player' or 'enemy'
    
    def update(self):
        # 子弹移动一格
    
    def is_out_of_bounds(self):
        # 检查是否出界

class Tank:
    def __init__(self):
        # 在地图边缘随机生成
        self.pos = (random_pos)
        self.direction = random.choice([(0,1),(0,-1),(1,0),(-1,0)])
        self.move_timer = 0
        self.shoot_timer = 0
    
    def update(self, snake_head_pos):
        # AI: 随机移动 + 偶尔朝玩家方向射击
    
    def shoot(self, snake_head_pos):
        # 生成子弹朝玩家方向
```

### 4. Food 和 PowerUp 系统 - 由 mm21 负责
```python
class Food:
    def __init__(self):
        self.pos = (random_pos)
        self.type = 'normal'  # 'normal', 'speed', 'shield'
    
    @staticmethod
    def spawn(snake_body, tanks_list):
        # 随机生成食物，不与蛇身和坦克重叠
        # 10%概率生成特殊食物
        # speed食物: 金色, 吃到后临时加速
        # shield食物: 蓝色, 吃到后获得护盾(抵挡一次子弹)
```

### 5. 渲染系统 - 由 mm27 负责
```python
class Renderer:
    @staticmethod
    def draw_grid(screen):
        # 绘制网格线
    
    @staticmethod
    def draw_snake(screen, snake):
        # 蛇身绿色，蛇头深绿色，画眼睛
    
    @staticmethod
    def draw_tanks(screen, tanks):
        # 坦克用方块+炮管表示
    
    @staticmethod
    def draw_bullets(screen, bullets):
        # 玩家子弹黄色, 敌方子弹红色
    
    @staticmethod
    def draw_food(screen, food):
        # 普通食物红色, 速度食物金色, 护盾食物蓝色
    
    @staticmethod
    def draw_hud(screen, score, shield_active, speed_active):
        # 顶部信息栏: 分数、护盾状态、速度状态
    
    @staticmethod
    def draw_game_over(screen, score):
        # 游戏结束画面
```

### 6. 音效和粒子效果 - 由 mm25 负责
```python
class SoundManager:
    # 如果没有pygame.mixer则静默
    @staticmethod
    def play_eat(): pass  # 吃食物音效
    @staticmethod
    def play_shoot(): pass  # 射击音效
    @staticmethod
    def play_explosion(): pass  # 爆炸音效
    @staticmethod
    def play_game_over(): pass  # 游戏结束音效

class ParticleEffect:
    # 简单的粒子系统用于爆炸效果
    @staticmethod
    def create_explosion(pos):
        # 返回粒子列表
    @staticmethod
    def update_and_draw(screen, particles):
        # 更新并绘制粒子
```

### 7. 完整集成和最终测试 - 由 d4f 负责
- 将所有模块整合到 `game.py`
- 确保能正常运行
- 修复任何bug
- 最终测试

## 文件结构
```
snake_tank_battle/
├── SPEC.md          # 本设计规范(已完成)
├── parts/
│   ├── main_loop.py     # g5: 主循环
│   ├── snake.py         # g51: Snake类
│   ├── tank.py          # g47: Tank和Bullet类  
│   ├── food.py          # mm21: Food和PowerUp系统
│   ├── renderer.py      # mm27: 渲染系统
│   └── effects.py       # mm25: 音效和粒子效果
└── game.py              # d4f: 最终整合的单文件游戏
```
