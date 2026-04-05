// =========================================
// APP.JS — Main entry point
// =========================================

import state from './state.js';
import { loadGames, filterAndSort } from './gameLoader.js';
import { renderGrid, renderNavCategories, updateResultsCount, initKeyboardNav } from './ui.js';
import { debounce, qs, escapeHtml } from './utils.js';

// ── GAME OVERLAY ─────────────────────────

export function openGame(game) {
  if (!game.isPlayable) return;

  state.set('currentGame', game);

  const overlay = qs('#game-overlay');
  const iframe  = qs('#game-iframe');
  const title   = qs('#overlay-game-title');

  title.innerHTML  = `<span>${escapeHtml(game.emoji)}</span> ${escapeHtml(game.title)}`;
  iframe.src       = game.path;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  qs('#overlay-close').focus();
}

export function closeGame() {
  const overlay = qs('#game-overlay');
  const iframe  = qs('#game-iframe');

  overlay.classList.remove('open');
  document.body.style.overflow = '';

  // Delay src clear so transition looks smooth
  setTimeout(() => { iframe.src = 'about:blank'; }, 400);
  state.set('currentGame', null);
}

// ── SEARCH ───────────────────────────────

const handleSearch = debounce((query) => {
  state.set('searchQuery', query);
  const result = filterAndSort();
  renderGrid(qs('#game-grid'), result);
  updateResultsCount(result.length);
}, 200);

// ── SORT ─────────────────────────────────

function setSortBy(sortBy) {
  state.set('sortBy', sortBy);

  qs('[data-sort].active')?.classList.remove('active');
  qs(`[data-sort="${sortBy}"]`)?.classList.add('active');

  const result = filterAndSort();
  renderGrid(qs('#game-grid'), result);
  updateResultsCount(result.length);
}

// ── INIT ─────────────────────────────────

async function init() {
  // Bind overlay close
  qs('#overlay-close').addEventListener('click', closeGame);
  qs('#game-overlay').addEventListener('click', e => {
    if (e.target === qs('#game-overlay')) closeGame();
  });

  // Bind search
  qs('.search-input').addEventListener('input', e => handleSearch(e.target.value));

  // Bind sort buttons
  document.querySelectorAll('[data-sort]').forEach(btn => {
    btn.addEventListener('click', () => setSortBy(btn.dataset.sort));
  });

  // Keyboard nav
  initKeyboardNav();

  // Show keyboard hint on first arrow key press
  const hint = qs('.keyboard-hint');
  const showHint = () => {
    hint?.classList.add('visible');
    setTimeout(() => hint?.classList.remove('visible'), 4000);
    document.removeEventListener('keydown', showHint);
  };
  document.addEventListener('keydown', e => {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) showHint();
  }, { once: true });

  // Load games
  try {
    const games = await loadGames();
    renderNavCategories(games);
    renderGrid(qs('#game-grid'), games);
    updateResultsCount(games.length);
  } catch (err) {
    console.error('Failed to load games:', err);
    qs('#game-grid').innerHTML = `
      <div class="empty-state">
        <div class="empty-emoji">⚠️</div>
        <div class="empty-title">Failed to load games</div>
        <div class="empty-sub">Check the console for details</div>
      </div>`;
  }

  // Hide loading overlay
  const loading = qs('#loading-overlay');
  if (loading) {
    setTimeout(() => loading.classList.add('hidden'), 800);
    setTimeout(() => loading.remove(), 1300);
  }
}

document.addEventListener('DOMContentLoaded', init);
