import random

# --- 全局常量 (与 SPEC.md 中 config 保持一致) ---
GRID_SIZE = 20
CELL_WIDTH = 40   # 800 / 20
CELL_HEIGHT = 30  # 600 / 20


class Snake:
    """贪吃蛇坦克大战 - 玩家蛇类

    蛇身由 grid 坐标列表 body 表示，索引 0 为蛇头。
    方向用 (dx, dy) 元组: 上(0,-1), 下(0,1), 左(-1,0), 右(1,0)。
    """

    def __init__(self):
        # 初始位置在地图中央附近，蛇头朝右
        self.body = [(CELL_WIDTH // 2, CELL_HEIGHT // 2)]
        self.direction = (1, 0)        # 初始向右
        self.grow_flag = False         # 吃到食物后置 True
        self.alive = True              # 存活状态
        self.shield = False            # 护盾状态 (抵挡一次子弹)
        self.speed_boost = False       # 加速状态
        self.speed_timer = 0           # 加速剩余帧数

    # ------------------------------------------------------------------
    # 移动
    # ------------------------------------------------------------------
    def move(self):
        """蛇头按 direction 前进一格，蛇身跟随；grow_flag 为 True 时蛇尾不删除。"""
        head_gx, head_gy = self.body[0]
        dx, dy = self.direction
        new_head = (head_gx + dx, head_gy + dy)

        self.body.insert(0, new_head)

        if self.grow_flag:
            # 增长模式：不删除蛇尾
            self.grow_flag = False
        else:
            # 正常模式：删除蛇尾
            self.body.pop()

    # ------------------------------------------------------------------
    # 增长
    # ------------------------------------------------------------------
    def grow(self):
        """标记下次 move 时蛇身增长一节。"""
        self.grow_flag = True

    # ------------------------------------------------------------------
    # 方向控制
    # ------------------------------------------------------------------
    def change_direction(self, new_dir):
        """改变蛇的移动方向。

        不允许 180 度反向（例如正在向右走不能直接向左）。
        只有蛇身长度 > 1 时才进行反向检查。
        """
        dx, dy = self.direction
        ndx, ndy = new_dir

        # 蛇身长度大于 1 时，禁止 180 度掉头
        if len(self.body) > 1:
            if (ndx, ndy) == (-dx, -dy):
                return

        self.direction = (ndx, ndy)

    # ------------------------------------------------------------------
    # 碰撞检测
    # ------------------------------------------------------------------
    def check_self_collision(self):
        """检查蛇头是否与蛇身（索引 1 之后）重叠。

        Returns:
            True  - 蛇头撞到了自己的身体
            False - 没有碰撞
        """
        head = self.body[0]
        return head in self.body[1:]

    def check_wall_collision(self):
        """检查蛇头是否超出地图边界。

        地图范围: x ∈ [0, CELL_WIDTH-1], y ∈ [0, CELL_HEIGHT-1]

        Returns:
            True  - 蛇头撞墙
            False - 在地图内
        """
        head_gx, head_gy = self.body[0]
        if head_gx < 0 or head_gx >= CELL_WIDTH:
            return True
        if head_gy < 0 or head_gy >= CELL_HEIGHT:
            return True
        return False

    # ------------------------------------------------------------------
    # 属性
    # ------------------------------------------------------------------
    @property
    def head_pos(self):
        """返回蛇头 grid 坐标 (gx, gy)。"""
        return self.body[0]

    # ------------------------------------------------------------------
    # 道具系统
    # ------------------------------------------------------------------
    def activate_shield(self):
        """激活护盾，可抵挡一次敌方子弹。"""
        self.shield = True

    def activate_speed(self):
        """激活加速，持续 50 帧。"""
        self.speed_boost = True
        self.speed_timer = 50

    def update_powerups(self):
        """每帧调用，对 speed_timer 进行倒计时；归零时取消加速状态。"""
        if self.speed_timer > 0:
            self.speed_timer -= 1
            if self.speed_timer == 0:
                self.speed_boost = False
