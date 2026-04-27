# Snake Game

A classic Snake game implementation built with HTML, CSS, and JavaScript.

## Game Description

Snake is a classic arcade game where players control a snake that grows longer each time it eats food. The objective is to eat as much food as possible without the snake colliding with the walls or its own tail.

## How to Run

Simply open the `index.html` file in any modern web browser:

```bash
# Using a local server (recommended)
python -m http.server 8000
# Then open http://localhost:8000 in your browser
```

Or simply double-click `index.html` to open it directly in your browser.

## Controls

- **Arrow Keys** or **WASD**: Move the snake in different directions
- **Space**: Pause/Resume the game
- **R**: Restart the game after game over

## Basic Architecture

The game follows a simple MVC-like architecture:

- **Model** (`snake.js`): Game state, snake position, food location, collision detection
- **View** (`game.js`): Rendering the game canvas, drawing snake and food
- **Controller** (`index.js`): Handling user input and game loop

### Key Files

| File | Description |
|------|-------------|
| `index.html` | Main HTML file with game canvas |
| `snake.js` | Snake logic and movement |
| `style.css` | Game styling |

## Game Rules

1. Use arrow keys to control the snake's direction
2. Eat the red food to grow and earn points
3. Avoid hitting walls and your own tail
4. The game speeds up as you grow longer
5. Press R to restart after game over