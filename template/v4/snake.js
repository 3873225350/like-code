const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');

const GRID = 20;
const COLS = canvas.width / GRID;
const ROWS = canvas.height / GRID;

let snake, dir, food, score, gameOver, paused;

function init() {
    snake = [{x: 10, y: 10}];
    dir = {x: 1, y: 0};
    food = spawnFood();
    score = 0;
    gameOver = false;
    paused = false;
    updateScore();
}

function spawnFood() {
    let pos;
    do {
        pos = {x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS)};
    } while (snake.some(s => s.x === pos.x && s.y === pos.y));
    return pos;
}

function updateScore() { scoreEl.textContent = score; }

function draw() {
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#4ade80';
    snake.forEach(s => ctx.fillRect(s.x * GRID + 1, s.y * GRID + 1, GRID - 2, GRID - 2));
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(food.x * GRID + 1, food.y * GRID + 1, GRID - 2, GRID - 2);
    if (gameOver) {
        ctx.fillStyle = '#fff';
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('游戏结束! 按R重新开始', canvas.width/2, canvas.height/2);
    }
    if (paused && !gameOver) {
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('暂停中...', canvas.width/2, canvas.height/2);
    }
}

function update() {
    if (gameOver || paused) return;
    const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
        snake.some(s => s.x === head.x && s.y === head.y)) {
        gameOver = true;
        return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        updateScore();
        food = spawnFood();
    } else {
        snake.pop();
    }
}

document.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (key === 'r') { init(); return; }
    if (key === ' ') { paused = !paused; return; }
    if (paused || gameOver) return;
    if ((key === 'arrowup' || key === 'w') && dir.y !== 1) dir = {x: 0, y: -1};
    if ((key === 'arrowdown' || key === 's') && dir.y !== -1) dir = {x: 0, y: 1};
    if ((key === 'arrowleft' || key === 'a') && dir.x !== 1) dir = {x: -1, y: 0};
    if ((key === 'arrowright' || key === 'd') && dir.x !== -1) dir = {x: 1, y: 0};
});

function loop() {
    update();
    draw();
    setTimeout(loop, 100);
}

init();
loop();