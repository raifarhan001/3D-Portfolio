import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

/**
 * Transpiles src/config/themeConfig.ts and src/games/snake.ts cleanly into a temporary
 * ESM directory so Node can execute the exact production TypeScript source without duplication.
 */
async function loadSnakeModule() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snake-test-'));
  const configSrc = fs
    .readFileSync(path.resolve(process.cwd(), 'src/config/themeConfig.ts'), 'utf8')
    .replace("import { IDENTITY_CONFIG } from '@/config/identityConfig';", "export const IDENTITY_CONFIG = {};");
  const snakeSrc = fs
    .readFileSync(path.resolve(process.cwd(), 'src/games/snake.ts'), 'utf8')
    .replaceAll("'@/config/themeConfig'", "'./themeConfig.mjs'");

  const transpileOpts = {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  };

  fs.writeFileSync(
    path.join(tmpDir, 'themeConfig.mjs'),
    ts.transpileModule(configSrc, transpileOpts).outputText,
    'utf8'
  );
  fs.writeFileSync(
    path.join(tmpDir, 'snake.mjs'),
    ts.transpileModule(snakeSrc, transpileOpts).outputText,
    'utf8'
  );

  const mod = await import(pathToFileURL(path.join(tmpDir, 'snake.mjs')).href);
  return {
    mod,
    cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
  };
}

async function runTests() {
  const { mod, cleanup } = await loadSnakeModule();
  try {
    const {
      createInitialSnakeState,
      queueSnakeDirection,
      stepSnake,
      spawnFood,
      computeSnakeTps,
    } = mod;

    // 1. Initial state & basic movement
    const s1 = createInitialSnakeState({ status: 'playing', highScore: 0 });
    assert.equal(s1.cols, 20);
    assert.equal(s1.rows, 18);
    assert.equal(s1.snake.length, 3);
    assert.equal(s1.direction, 'right');
    assert.equal(s1.tps, 8);
    const startHead = { ...s1.snake[0] };
    // Ensure food is not right in front during step check
    s1.food = { x: 0, y: 0 };
    const evStep = stepSnake(s1);
    assert.equal(evStep, 'step');
    assert.deepEqual(s1.snake[0], { x: startHead.x + 1, y: startHead.y });
    assert.equal(s1.snake.length, 3);
    console.log('✓ Basic movement verified');

    // 2. Growth, score & highScore update
    s1.food = { x: s1.snake[0].x + 1, y: s1.snake[0].y };
    const evEat = stepSnake(s1);
    assert.equal(evEat, 'eat');
    assert.equal(s1.snake.length, 4);
    assert.equal(s1.foodsEaten, 1);
    assert.equal(s1.score, 10);
    assert.equal(s1.highScore, 10);
    console.log('✓ Growth and scoring (+10 per food) verified');

    // 3. No reversal & max 2 queued directions
    const s2 = createInitialSnakeState({ status: 'playing', highScore: 0 });
    s2.food = { x: 0, y: 0 };
    assert.equal(queueSnakeDirection(s2, 'left'), false, 'Must reject direct 180 reversal');
    assert.equal(queueSnakeDirection(s2, 'up'), true, 'Valid perpendicular turn 1');
    assert.equal(queueSnakeDirection(s2, 'down'), false, 'Must reject reversal relative to queued up');
    assert.equal(queueSnakeDirection(s2, 'left'), true, 'Valid quick 2-turn combo');
    assert.equal(queueSnakeDirection(s2, 'down'), false, 'Queue full at max 2');
    stepSnake(s2);
    assert.equal(s2.direction, 'up');
    stepSnake(s2);
    assert.equal(s2.direction, 'left');
    console.log('✓ Anti-reversal & 2-turn queue verified');

    // 4. Wall collisions (all 4 boundaries)
    const wallCases = [
      { head: { x: 19, y: 5 }, dir: 'right', name: 'east' },
      { head: { x: 0, y: 5 }, dir: 'left', name: 'west' },
      { head: { x: 5, y: 0 }, dir: 'up', name: 'north' },
      { head: { x: 5, y: 17 }, dir: 'down', name: 'south' },
    ];
    for (const wc of wallCases) {
      const ws = createInitialSnakeState({ status: 'playing', highScore: 0 });
      ws.snake = [wc.head, { x: 10, y: 10 }, { x: 11, y: 10 }];
      ws.direction = wc.dir;
      ws.food = { x: 2, y: 2 };
      const res = stepSnake(ws);
      assert.equal(res, 'gameover', `Expected gameover hitting ${wc.name} wall`);
      assert.equal(ws.status, 'gameover');
    }
    console.log('✓ Wall collisions verified on all 4 edges');

    // 5. Self collision
    const sSelf = createInitialSnakeState({ status: 'playing', highScore: 0 });
    sSelf.snake = [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 6, y: 6 },
      { x: 5, y: 6 },
      { x: 4, y: 6 },
      { x: 4, y: 5 },
      { x: 4, y: 4 },
    ];
    sSelf.direction = 'left'; // next cell (4,5) is occupied by non-tail segment index 5
    sSelf.food = { x: 0, y: 0 };
    const evSelf = stepSnake(sSelf);
    assert.equal(evSelf, 'gameover', 'Expected self collision gameover');
    assert.equal(sSelf.status, 'gameover');
    console.log('✓ Self collision verified');

    // 6. Food never spawns on the snake across 5,000 random spawns
    const packedSnake = [];
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < 20; x++) {
        // Leave sparse 25 free cells scattered through the board to stress-test spawn
        if ((y * 20 + x) % 15 !== 0) {
          packedSnake.push({ x, y });
        }
      }
    }
    const occupiedKeys = new Set(packedSnake.map((p) => `${p.x},${p.y}`));
    for (let i = 0; i < 5000; i++) {
      const targetSnake = i < 2500 ? packedSnake : [
        { x: 3, y: 4 },
        { x: 4, y: 4 },
        { x: 5, y: 4 },
        { x: 5, y: 5 },
      ];
      const targetKeys =
        i < 2500 ? occupiedKeys : new Set(targetSnake.map((p) => `${p.x},${p.y}`));
      const f = spawnFood(targetSnake, 20, 18);
      assert(f.x >= 0 && f.x < 20 && f.y >= 0 && f.y < 18, `Out of bounds food: ${JSON.stringify(f)}`);
      assert(!targetKeys.has(`${f.x},${f.y}`), `Food spawned on snake at spawn #${i}: ${JSON.stringify(f)}`);
    }
    console.log('✓ 5,000 random food spawns verified (0 overlaps with snake)');

    // 7. Speed progression (start 8, +0.4 per 5 foods, max 16)
    assert.equal(computeSnakeTps(0), 8);
    assert.equal(computeSnakeTps(4), 8);
    assert.equal(computeSnakeTps(5), 8.4);
    assert.equal(computeSnakeTps(10), 8.8);
    assert.equal(computeSnakeTps(50), 12);
    assert.equal(computeSnakeTps(100), 16);
    assert.equal(computeSnakeTps(250), 16);
    console.log('✓ Speed progression (8 -> +0.4/5 foods -> max 16 TPS) verified');

    console.log('ALL SNAKE UNIT TESTS PASSED!');
  } finally {
    cleanup();
  }
}

runTests().catch((err) => {
  console.error('SNAKE TEST FAILED:', err);
  process.exit(1);
});
