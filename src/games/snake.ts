import { SNAKE_CONFIG } from '@/config/themeConfig';

export type SnakeDirection = 'up' | 'down' | 'left' | 'right';
export type SnakeGameStatus = 'idle' | 'playing' | 'gameover';
export type SnakeStepEvent = 'none' | 'step' | 'eat' | 'gameover';

export interface GridPoint {
  x: number;
  y: number;
}

export interface SnakeState {
  cols: number;
  rows: number;
  snake: GridPoint[];
  direction: SnakeDirection;
  directionQueue: SnakeDirection[];
  food: GridPoint;
  score: number;
  foodsEaten: number;
  highScore: number;
  tps: number;
  status: SnakeGameStatus;
}

export function isOppositeDirection(a: SnakeDirection, b: SnakeDirection): boolean {
  return (
    (a === 'up' && b === 'down') ||
    (a === 'down' && b === 'up') ||
    (a === 'left' && b === 'right') ||
    (a === 'right' && b === 'left')
  );
}

export function computeSnakeTps(foodsEaten: number): number {
  const steps = Math.floor(foodsEaten / SNAKE_CONFIG.foodsPerSpeedStep);
  return Math.min(SNAKE_CONFIG.maxTps, +(SNAKE_CONFIG.baseTps + steps * SNAKE_CONFIG.tpsIncrement).toFixed(2));
}

export function loadSnakeHighScore(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(SNAKE_CONFIG.highScoreStorageKey);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function saveSnakeHighScore(score: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SNAKE_CONFIG.highScoreStorageKey, String(Math.max(0, Math.floor(score))));
  } catch {
    // ignore storage errors
  }
}

export function spawnFood(
  snake: ReadonlyArray<GridPoint>,
  cols: number = SNAKE_CONFIG.cols,
  rows: number = SNAKE_CONFIG.rows,
  rng: () => number = Math.random
): GridPoint {
  const occupied = new Set<number>();
  for (let i = 0; i < snake.length; i++) {
    occupied.add(snake[i].y * cols + snake[i].x);
  }

  const freeCells: GridPoint[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!occupied.has(y * cols + x)) {
        freeCells.push({ x, y });
      }
    }
  }

  if (freeCells.length === 0) {
    return { x: -1, y: -1 };
  }

  const raw = Math.floor(rng() * freeCells.length);
  const idx = Math.max(0, Math.min(freeCells.length - 1, raw));
  return freeCells[idx];
}

export function createInitialSnakeState(
  options?: {
    cols?: number;
    rows?: number;
    status?: SnakeGameStatus;
    highScore?: number;
    rng?: () => number;
  }
): SnakeState {
  const cols = options?.cols ?? SNAKE_CONFIG.cols;
  const rows = options?.rows ?? SNAKE_CONFIG.rows;
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  const snake: GridPoint[] = [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
  const food = spawnFood(snake, cols, rows, options?.rng);
  const highScore = options?.highScore ?? loadSnakeHighScore();

  return {
    cols,
    rows,
    snake,
    direction: 'right',
    directionQueue: [],
    food,
    score: 0,
    foodsEaten: 0,
    highScore,
    tps: SNAKE_CONFIG.baseTps,
    status: options?.status ?? 'idle',
  };
}

export function startSnakeGame(state: SnakeState, rng: () => number = Math.random): SnakeState {
  return createInitialSnakeState({
    cols: state.cols,
    rows: state.rows,
    status: 'playing',
    highScore: state.highScore,
    rng,
  });
}

export function queueSnakeDirection(state: SnakeState, dir: SnakeDirection): boolean {
  if (state.status !== 'playing') return false;
  if (state.directionQueue.length >= SNAKE_CONFIG.maxQueuedDirections) return false;

  const effectivePrev =
    state.directionQueue.length > 0
      ? state.directionQueue[state.directionQueue.length - 1]
      : state.direction;

  if (dir === effectivePrev || isOppositeDirection(dir, effectivePrev)) {
    return false;
  }

  state.directionQueue.push(dir);
  return true;
}

export function stepSnake(state: SnakeState, rng: () => number = Math.random): SnakeStepEvent {
  if (state.status !== 'playing') return 'none';

  if (state.directionQueue.length > 0) {
    const nextDir = state.directionQueue.shift()!;
    if (!isOppositeDirection(nextDir, state.direction)) {
      state.direction = nextDir;
    }
  }

  const head = state.snake[0];
  let nx = head.x;
  let ny = head.y;
  if (state.direction === 'up') ny -= 1;
  else if (state.direction === 'down') ny += 1;
  else if (state.direction === 'left') nx -= 1;
  else if (state.direction === 'right') nx += 1;

  // Wall collision
  if (nx < 0 || nx >= state.cols || ny < 0 || ny >= state.rows) {
    state.status = 'gameover';
    return 'gameover';
  }

  const willEat = nx === state.food.x && ny === state.food.y;
  // Exclude tail cell when moving without growing since the tail vacates on this tick
  const checkLen = willEat ? state.snake.length : state.snake.length - 1;
  for (let i = 0; i < checkLen; i++) {
    if (state.snake[i].x === nx && state.snake[i].y === ny) {
      state.status = 'gameover';
      return 'gameover';
    }
  }

  state.snake.unshift({ x: nx, y: ny });

  if (willEat) {
    state.foodsEaten += 1;
    state.score += SNAKE_CONFIG.pointsPerFood;
    state.tps = computeSnakeTps(state.foodsEaten);
    if (state.score > state.highScore) {
      state.highScore = state.score;
      saveSnakeHighScore(state.highScore);
    }
    state.food = spawnFood(state.snake, state.cols, state.rows, rng);
    if (state.food.x < 0) {
      // Board completely filled -> victory/end cleanly
      state.status = 'gameover';
      return 'gameover';
    }
    return 'eat';
  }

  state.snake.pop();
  return 'step';
}
