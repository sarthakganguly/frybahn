// =========================================
// TETRIS — Pure JS implementation
// =========================================

const canvas     = document.getElementById('canvas');
const ctx        = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx    = nextCanvas.getContext('2d');
const overlay    = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub   = document.getElementById('overlay-sub');
const scoreEl    = document.getElementById('score');
const levelEl    = document.getElementById('level');
const linesEl    = document.getElementById('lines');

// ── CONFIG ──
const COLS  = 10;
const ROWS  = 20;
const BLOCK = 28;

canvas.width  = COLS * BLOCK;
canvas.height = ROWS * BLOCK;

// ── TETROMINOS ──
const PIECES = [
  // I
  { shape: [[1,1,1,1]], color: '#00f0f0' },
  // O
  { shape: [[1,1],[1,1]], color: '#f0f000' },
  // T
  { shape: [[0,1,0],[1,1,1]], color: '#a000f0' },
  // S
  { shape: [[0,1,1],[1,1,0]], color: '#00f000' },
  // Z
  { shape: [[1,1,0],[0,1,1]], color: '#f00000' },
  // J
  { shape: [[1,0,0],[1,1,1]], color: '#0000f0' },
  // L
  { shape: [[0,0,1],[1,1,1]], color: '#f0a000' },
];

// ── STATE ──
let board, score, level, lines;
let current, next, currentX, currentY;
let gameState; // 'idle' | 'playing' | 'paused' | 'over'
let dropInterval, lastDrop, rafId;
let lockDelay = false;

// ── HELPERS ──
function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  return { shape: p.shape.map(r => [...r]), color: p.color };
}

function rotate(matrix) {
  const N = matrix.length, M = matrix[0].length;
  const out = Array.from({ length: M }, () => new Array(N).fill(0));
  for (let r = 0; r < N; r++)
    for (let c = 0; c < M; c++)
      out[c][N - 1 - r] = matrix[r][c];
  return out;
}

function collides(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c, ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function lock() {
  for (let r = 0; r < current.shape.length; r++) {
    for (let c = 0; c < current.shape[r].length; c++) {
      if (!current.shape[r][c]) continue;
      const ny = currentY + r;
      if (ny < 0) { gameOver(); return; }
      board[ny][currentX + c] = current.color;
    }
  }
  clearLines();
  spawnPiece();
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++; // re-check same row index
    }
  }
  if (cleared) {
    const pts = [0, 100, 300, 500, 800][cleared] * level;
    score += pts;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(80, 500 - (level - 1) * 40);
    updateHUD();
  }
}

function spawnPiece() {
  current  = next || randomPiece();
  next     = randomPiece();
  currentX = Math.floor(COLS / 2) - Math.floor(current.shape[0].length / 2);
  currentY = 0;

  if (collides(current.shape, currentX, currentY)) {
    gameOver();
  }

  drawNext();
}

function softDrop() {
  if (!collides(current.shape, currentX, currentY + 1)) {
    currentY++;
  } else {
    lock();
  }
  lastDrop = performance.now();
}

function hardDrop() {
  while (!collides(current.shape, currentX, currentY + 1)) {
    currentY++;
    score += 2;
  }
  lock();
  lastDrop = performance.now();
  updateHUD();
}

// ── HUD ──
function updateHUD() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

// ── DRAW ──
function drawBlock(c, x, y, size, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = c;
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);

  // Shine
  const grad = ctx.createLinearGradient(x*size, y*size, x*size + size, y*size + size);
  grad.addColorStop(0, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = grad;
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  ctx.globalAlpha = 1;
}

function drawBoard() {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * BLOCK, 0); ctx.lineTo(c * BLOCK, canvas.height); ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * BLOCK); ctx.lineTo(canvas.width, r * BLOCK); ctx.stroke();
  }

  // Board
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) drawBlock(board[r][c], c, r, BLOCK);
    }
  }
}

function drawGhost() {
  let gy = currentY;
  while (!collides(current.shape, currentX, gy + 1)) gy++;
  if (gy === currentY) return;
  for (let r = 0; r < current.shape.length; r++) {
    for (let c = 0; c < current.shape[r].length; c++) {
      if (!current.shape[r][c]) continue;
      drawBlock(current.color, currentX + c, gy + r, BLOCK, 0.15);
    }
  }
}

function drawCurrent() {
  for (let r = 0; r < current.shape.length; r++) {
    for (let c = 0; c < current.shape[r].length; c++) {
      if (!current.shape[r][c]) continue;
      drawBlock(current.color, currentX + c, currentY + r, BLOCK);
    }
  }
}

function drawNext() {
  nextCtx.fillStyle = 'transparent';
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!next) return;

  const bs = 16;
  const offsetX = Math.floor((nextCanvas.width  / bs - next.shape[0].length) / 2);
  const offsetY = Math.floor((nextCanvas.height / bs - next.shape.length)    / 2);

  for (let r = 0; r < next.shape.length; r++) {
    for (let c = 0; c < next.shape[r].length; c++) {
      if (!next.shape[r][c]) continue;
      nextCtx.fillStyle = next.color;
      nextCtx.fillRect((offsetX + c) * bs + 1, (offsetY + r) * bs + 1, bs - 2, bs - 2);
    }
  }
}

// ── GAME LOOP ──
function loop(timestamp) {
  rafId = requestAnimationFrame(loop);
  if (gameState !== 'playing') return;

  if (timestamp - lastDrop >= dropInterval) {
    softDrop();
  }

  drawBoard();
  if (current) { drawGhost(); drawCurrent(); }
}

// ── INIT & STATE ──
function initGame() {
  board    = createBoard();
  score    = 0; level = 1; lines = 0;
  dropInterval = 500; lastDrop = performance.now();
  gameState = 'idle';
  next    = randomPiece();
  spawnPiece();
  updateHUD();
}

function startGame() {
  gameState = 'playing';
  lastDrop  = performance.now();
  overlay.classList.add('hidden');
  if (!rafId) rafId = requestAnimationFrame(loop);
}

function gameOver() {
  gameState = 'over';
  overlayTitle.textContent = 'GAME OVER';
  overlaySub.textContent   = `Score: ${score} — Press SPACE to retry`;
  overlay.classList.remove('hidden');
}

function pauseToggle() {
  if (gameState === 'playing') {
    gameState = 'paused';
    overlayTitle.textContent = 'PAUSED';
    overlaySub.textContent   = 'Press P to resume';
    overlay.classList.remove('hidden');
  } else if (gameState === 'paused') {
    gameState = 'playing';
    lastDrop  = performance.now();
    overlay.classList.add('hidden');
  }
}

// ── INPUT ──
document.addEventListener('keydown', e => {
  if (gameState === 'idle' || gameState === 'over') {
    if (e.key === ' ' || e.key === 'Enter') {
      if (gameState === 'over') initGame();
      startGame();
      return;
    }
  }

  if (e.key === 'p' || e.key === 'P') { pauseToggle(); return; }
  if (gameState !== 'playing') return;

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      if (!collides(current.shape, currentX - 1, currentY)) currentX--;
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (!collides(current.shape, currentX + 1, currentY)) currentX++;
      break;
    case 'ArrowDown':
      e.preventDefault();
      softDrop();
      break;
    case 'ArrowUp':
    case 'x': case 'X':
      e.preventDefault();
      {
        const rotated = rotate(current.shape);
        // Wall kick
        for (const kick of [0, -1, 1, -2, 2]) {
          if (!collides(rotated, currentX + kick, currentY)) {
            current.shape = rotated;
            currentX += kick;
            break;
          }
        }
      }
      break;
    case ' ':
      e.preventDefault();
      hardDrop();
      break;
  }
});

// Touch support
let touchStartX, touchStartY, touchStartTime;
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();
}, { passive: true });

canvas.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const dt = Date.now() - touchStartTime;

  if (gameState === 'idle' || gameState === 'over') { startGame(); return; }
  if (gameState !== 'playing') return;

  if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 200) {
    // Tap = rotate
    const rotated = rotate(current.shape);
    if (!collides(rotated, currentX, currentY)) current.shape = rotated;
  } else if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 30 && !collides(current.shape, currentX + 1, currentY)) currentX++;
    if (dx < -30 && !collides(current.shape, currentX - 1, currentY)) currentX--;
  } else {
    if (dy > 30) hardDrop();
  }
}, { passive: true });

// ── BOOT ──
initGame();
rafId = requestAnimationFrame(loop);
