// =========================================
// PAC-MAN CLASSIC — Pure JS implementation
// =========================================

const canvas  = document.getElementById('canvas');
const ctx     = canvas.getContext('2d');
const msgEl   = document.getElementById('message');
const msgTitle= document.getElementById('msg-title');
const msgSub  = document.getElementById('msg-sub');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');

// ── TILE SIZE & GRID ──
const TILE = 20;

// Map: 0=empty 1=wall 2=dot 3=power-pellet 4=ghost-house
const MAP_TEMPLATE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
  [1,3,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,3,1],
  [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,1,2,1],
  [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
  [1,1,1,1,2,1,1,1,0,0,0,0,0,1,1,1,2,1,1,1,1],
  [1,1,1,1,2,1,0,0,0,4,4,4,0,0,0,1,2,1,1,1,1],
  [1,1,1,1,2,0,0,4,4,4,4,4,4,4,0,0,2,1,1,1,1],
  [0,0,0,0,2,0,0,4,4,0,0,0,4,4,0,0,2,0,0,0,0],
  [1,1,1,1,2,0,0,4,4,4,4,4,4,4,0,0,2,1,1,1,1],
  [1,1,1,1,2,1,0,0,0,0,0,0,0,0,0,1,2,1,1,1,1],
  [1,1,1,1,2,1,0,1,1,1,1,1,1,1,0,1,2,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
  [1,3,2,1,2,2,2,2,2,2,0,2,2,2,2,2,2,1,2,3,1],
  [1,1,2,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,2,1,1],
  [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
  [1,2,1,1,1,1,1,1,2,1,1,1,2,1,1,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const ROWS = MAP_TEMPLATE.length;
const COLS = MAP_TEMPLATE[0].length;

canvas.width  = COLS * TILE;
canvas.height = ROWS * TILE;

// ── GAME STATE ──
let map, dots, powerPellets;
let score, lives, level, gameState;
let pacman, ghosts;
let animFrame, lastTime, stepAcc;
const STEP_MS = 150;

const GHOST_COLORS = ['#FF0000','#FFB8FF','#00FFFF','#FFB852'];
const GHOST_NAMES  = ['Blinky','Pinky','Inky','Clyde'];

// Directions
const DIR = {
  LEFT:  { dx:-1, dy:0 },
  RIGHT: { dx:1,  dy:0 },
  UP:    { dx:0,  dy:-1 },
  DOWN:  { dx:0,  dy:1 },
  NONE:  { dx:0,  dy:0 },
};

function initGame() {
  map = MAP_TEMPLATE.map(row => [...row]);
  dots = 0;
  powerPellets = 0;
  map.forEach(row => row.forEach(v => {
    if (v === 2) dots++;
    if (v === 3) powerPellets++;
  }));

  score = 0;
  lives = 3;
  level = 1;
  gameState = 'waiting'; // waiting | playing | dead | win | gameover

  pacman = {
    x: 10, y: 16,
    dir: DIR.LEFT,
    nextDir: DIR.LEFT,
    mouthAngle: 0,
    mouthDir: 1,
    powerTimer: 0,
  };

  ghosts = [
    { x: 9,  y: 9, dir: DIR.UP,   color: GHOST_COLORS[0], scatter: false, frightened: false, eaten: false, animTick: 0 },
    { x: 10, y: 9, dir: DIR.DOWN, color: GHOST_COLORS[1], scatter: false, frightened: false, eaten: false, animTick: 0 },
    { x: 11, y: 9, dir: DIR.UP,   color: GHOST_COLORS[2], scatter: false, frightened: false, eaten: false, animTick: 0 },
    { x: 10, y: 10,dir: DIR.DOWN, color: GHOST_COLORS[3], scatter: false, frightened: false, eaten: false, animTick: 0 },
  ];

  updateHUD();
}

function resetPositions() {
  pacman.x = 10; pacman.y = 16;
  pacman.dir = DIR.LEFT; pacman.nextDir = DIR.LEFT;

  ghosts[0] = { ...ghosts[0], x: 9,  y: 9, dir: DIR.UP,   frightened: false, eaten: false };
  ghosts[1] = { ...ghosts[1], x: 10, y: 9, dir: DIR.DOWN, frightened: false, eaten: false };
  ghosts[2] = { ...ghosts[2], x: 11, y: 9, dir: DIR.UP,   frightened: false, eaten: false };
  ghosts[3] = { ...ghosts[3], x: 10, y: 10,dir: DIR.DOWN, frightened: false, eaten: false };
}

// ── HUD ──
function updateHUD() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  livesEl.textContent = '❤️'.repeat(Math.max(0, lives));
}

// ── COLLISION ──
function isWall(x, y) {
  if (y < 0 || y >= ROWS) return false;
  const wx = ((x % COLS) + COLS) % COLS; // wrap horizontal
  return map[y][wx] === 1;
}

// ── PACMAN MOVEMENT ──
function movePacman() {
  const nx = pacman.x + pacman.nextDir.dx;
  const ny = pacman.y + pacman.nextDir.dy;
  if (!isWall(nx, ny)) {
    pacman.dir = pacman.nextDir;
  }

  const mx = pacman.x + pacman.dir.dx;
  const my = pacman.y + pacman.dir.dy;

  if (!isWall(mx, my)) {
    pacman.x = ((mx % COLS) + COLS) % COLS;
    pacman.y = my;
  }

  // Eat dots
  const tile = map[pacman.y]?.[pacman.x];
  if (tile === 2) {
    map[pacman.y][pacman.x] = 0;
    score += 10;
    dots--;
  } else if (tile === 3) {
    map[pacman.y][pacman.x] = 0;
    score += 50;
    powerPellets--;
    pacman.powerTimer = 20; // steps
    ghosts.forEach(g => { g.frightened = true; g.eaten = false; });
  }
  updateHUD();
}

// ── GHOST MOVEMENT ──
function moveGhost(ghost) {
  if (ghost.frightened) {
    // Random movement
    const options = [DIR.LEFT, DIR.RIGHT, DIR.UP, DIR.DOWN].filter(d => {
      const nx = ghost.x + d.dx;
      const ny = ghost.y + d.dy;
      return ny >= 0 && ny < ROWS && !isWall(nx, ny);
    });
    if (options.length) ghost.dir = options[Math.floor(Math.random() * options.length)];
  } else {
    // Chase pacman (simplified)
    const dx = pacman.x - ghost.x;
    const dy = pacman.y - ghost.y;
    const candidates = [];

    if (Math.abs(dx) > Math.abs(dy)) {
      candidates.push(dx > 0 ? DIR.RIGHT : DIR.LEFT);
      candidates.push(dy > 0 ? DIR.DOWN  : DIR.UP);
    } else {
      candidates.push(dy > 0 ? DIR.DOWN  : DIR.UP);
      candidates.push(dx > 0 ? DIR.RIGHT : DIR.LEFT);
    }
    // Add remaining dirs as fallback
    [DIR.LEFT,DIR.RIGHT,DIR.UP,DIR.DOWN].forEach(d => {
      if (!candidates.includes(d)) candidates.push(d);
    });

    for (const d of candidates) {
      const nx = ghost.x + d.dx;
      const ny = ghost.y + d.dy;
      if (ny >= 0 && ny < ROWS && !isWall(nx, ny)) {
        ghost.dir = d;
        break;
      }
    }
  }

  const nx = ghost.x + ghost.dir.dx;
  const ny = ghost.y + ghost.dir.dy;
  if (ny >= 0 && ny < ROWS && !isWall(nx, ny)) {
    ghost.x = ((nx % COLS) + COLS) % COLS;
    ghost.y = ny;
  }
}

// ── CHECK COLLISIONS ──
function checkCollisions() {
  for (const ghost of ghosts) {
    if (ghost.eaten) continue;
    if (ghost.x === pacman.x && ghost.y === pacman.y) {
      if (ghost.frightened) {
        ghost.eaten = true;
        ghost.frightened = false;
        score += 200;
        updateHUD();
        // Reset ghost to center
        ghost.x = 10; ghost.y = 9;
      } else {
        pacman.powerTimer = 0;
        lives--;
        updateHUD();
        if (lives <= 0) {
          gameState = 'gameover';
          showMessage('GAME OVER', 'Press SPACE to try again');
        } else {
          gameState = 'dead';
          setTimeout(() => {
            resetPositions();
            gameState = 'playing';
          }, 1200);
        }
        return;
      }
    }
  }

  // Check win
  if (dots === 0 && powerPellets === 0) {
    level++;
    map = MAP_TEMPLATE.map(row => [...row]);
    dots = 0; powerPellets = 0;
    map.forEach(row => row.forEach(v => { if (v === 2) dots++; if (v === 3) powerPellets++; }));
    resetPositions();
    showMessage(`LEVEL ${level}`, 'Get ready!');
    gameState = 'waiting';
    setTimeout(() => { gameState = 'playing'; hideMessage(); }, 2000);
  }
}

// ── POWER TIMER ──
function tickPowerTimer() {
  if (pacman.powerTimer > 0) {
    pacman.powerTimer--;
    if (pacman.powerTimer === 0) {
      ghosts.forEach(g => { g.frightened = false; });
    }
  }
}

// ── DRAW ──
const WALL_COLOR   = '#1a3a8e';
const DOT_COLOR    = '#ffee88';
const PELLET_COLOR = '#ffffff';

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = map[r][c];
      const x = c * TILE, y = r * TILE;

      if (t === 1) {
        ctx.fillStyle = WALL_COLOR;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = '#2a5aae';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      } else if (t === 2) {
        ctx.fillStyle = DOT_COLOR;
        ctx.beginPath();
        ctx.arc(x + TILE/2, y + TILE/2, 2, 0, Math.PI*2);
        ctx.fill();
      } else if (t === 3) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
        ctx.fillStyle = PELLET_COLOR;
        ctx.shadowColor = PELLET_COLOR;
        ctx.shadowBlur = 8 * pulse;
        ctx.beginPath();
        ctx.arc(x + TILE/2, y + TILE/2, 4 + pulse, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  // Pac-Man
  const px = pacman.x * TILE + TILE/2;
  const py = pacman.y * TILE + TILE/2;
  const angle = Math.atan2(pacman.dir.dy, pacman.dir.dx);
  const mouth = 0.25 * Math.abs(Math.sin(pacman.mouthAngle * 0.3));

  ctx.fillStyle = '#ffdd00';
  ctx.shadowColor = '#ffdd00';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.arc(px, py, TILE/2 - 1, angle + mouth, angle + Math.PI*2 - mouth);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Ghosts
  for (const ghost of ghosts) {
    if (ghost.eaten) continue;
    const gx = ghost.x * TILE;
    const gy = ghost.y * TILE;
    const gxc = gx + TILE/2;
    const gyc = gy + TILE/2;

    let color = ghost.color;
    if (ghost.frightened) {
      const flash = pacman.powerTimer < 7 && Math.floor(Date.now() / 200) % 2 === 0;
      color = flash ? '#fff' : '#2244ff';
    }

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;

    // Ghost body
    ctx.beginPath();
    ctx.arc(gxc, gyc - 2, TILE/2 - 2, Math.PI, 0, false);
    ctx.lineTo(gx + TILE - 2, gy + TILE - 2);

    // Wavy bottom
    const segments = 3;
    for (let i = segments; i >= 0; i--) {
      const wx = gx + 2 + (i * (TILE - 4) / segments);
      const wy = gy + TILE - 2 - (i % 2 === 0 ? 4 : 0);
      ctx.lineTo(wx, wy);
    }
    ctx.lineTo(gx + 2, gy + TILE - 2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Eyes
    if (!ghost.frightened) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(gxc - 3, gyc - 3, 3, 3.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(gxc + 3, gyc - 3, 3, 3.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#00f';
      ctx.beginPath(); ctx.arc(gxc - 3 + ghost.dir.dx, gyc - 3 + ghost.dir.dy, 1.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(gxc + 3 + ghost.dir.dx, gyc - 3 + ghost.dir.dy, 1.5, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(gxc - 3, gyc - 1, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(gxc + 3, gyc - 1, 2, 0, Math.PI*2); ctx.fill();
      // sad mouth
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(gxc, gyc + 3, 3, 0, Math.PI, false);
      ctx.stroke();
    }
  }
}

// ── GAME LOOP ──
function gameLoop(timestamp) {
  animFrame = requestAnimationFrame(gameLoop);

  const dt = timestamp - (lastTime || timestamp);
  lastTime = timestamp;

  if (gameState === 'playing') {
    stepAcc += dt;
    if (stepAcc >= STEP_MS) {
      stepAcc -= STEP_MS;
      movePacman();
      ghosts.forEach(moveGhost);
      checkCollisions();
      tickPowerTimer();
      pacman.mouthAngle++;
    }
  }

  draw();
}

// ── INPUT ──
const keyMap = {
  ArrowLeft:  'LEFT', a: 'LEFT',
  ArrowRight: 'RIGHT', d: 'RIGHT',
  ArrowUp:    'UP',   w: 'UP',
  ArrowDown:  'DOWN', s: 'DOWN',
};

document.addEventListener('keydown', e => {
  const d = keyMap[e.key];
  if (d) {
    e.preventDefault();
    pacman.nextDir = DIR[d];
  }
  if (e.key === ' ' || e.key === 'Enter') {
    if (gameState === 'waiting' || gameState === 'gameover') startGame();
  }
});

// Touch swipe
let touchStart = null;
canvas.addEventListener('touchstart', e => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

canvas.addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
    if (gameState === 'waiting' || gameState === 'gameover') startGame();
    return;
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    pacman.nextDir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
  } else {
    pacman.nextDir = dy > 0 ? DIR.DOWN : DIR.UP;
  }
}, { passive: true });

// ── MESSAGE HELPERS ──
function showMessage(title, sub) {
  msgTitle.textContent = title;
  msgSub.textContent   = sub;
  msgEl.classList.remove('hidden');
}

function hideMessage() {
  msgEl.classList.add('hidden');
}

function startGame() {
  if (gameState === 'gameover') initGame();
  gameState = 'playing';
  hideMessage();
}

// ── BOOT ──
initGame();
showMessage('PAC-MAN', 'Press SPACE or tap to start');
stepAcc = 0; lastTime = 0;
animFrame = requestAnimationFrame(gameLoop);
