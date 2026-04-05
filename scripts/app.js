// =========================================
// APP.JS — Main entry point
// =========================================

import state from './state.js';
import { loadGames, filterAndSort } from './gameLoader.js';
import { renderGrid, renderNavCategories, updateResultsCount, initKeyboardNav } from './ui.js';
import { debounce, qs, escapeHtml } from './utils.js';
import * as router from './router.js';

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

  // NEW: Hide the background from screen readers
  qs('#app').setAttribute('aria-hidden', 'true');

  qs('#overlay-close').focus();
}

export function closeGame() {
  const overlay = qs('#game-overlay');
  if (!overlay.classList.contains('open')) return;

  const iframe  = qs('#game-iframe');
  overlay.classList.remove('open');
  document.body.style.overflow = '';

  // NEW: Reveal the background to screen readers again
  qs('#app').removeAttribute('aria-hidden');

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

// A CSS selector for everything that can receive keyboard focus
const FOCUSABLE_SELECTORS = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), iframe';

function handleFocusTrap(e) {
  const overlay = qs('#game-overlay');
  
  // Exit immediately if the overlay isn't open, or if the key pressed wasn't Tab
  if (!overlay.classList.contains('open') || e.key !== 'Tab') return;

  // Find all focusable elements inside the modal
  const focusableElements = Array.from(overlay.querySelectorAll(FOCUSABLE_SELECTORS));
  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  // Shift + Tab (Going backwards)
  if (e.shiftKey) {
    if (document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    }
  } 
  // Standard Tab (Going forwards)
  else {
    if (document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
}

// ── INIT ─────────────────────────────────

async function init() {
  // Bind overlay close
  qs('#overlay-close').addEventListener('click', () => router.navigate('/'));
  qs('#game-overlay').addEventListener('click', e => {
    if (e.target === qs('#game-overlay')) router.navigate('/');
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

  // Bind the focus trap
  document.addEventListener('keydown', handleFocusTrap);

  // Load games
  try {
    const games = await loadGames();
    renderNavCategories(games);
    renderGrid(qs('#game-grid'), games);
    updateResultsCount(games.length);

    // --- NEW ROUTER SETUP ---
    // Route 1: The Root (closes the game)
    router.on('/', () => {
      closeGame();
    });

    // Route 2: Deep Link to a Game
    router.on('/play', (slug) => {
      const gameList = state.get('games');
      const game = gameList.find(g => g.slug === slug);
      
      if (game) {
        openGame(game);
      } else {
        // Fallback if game slug doesn't exist
        router.navigate('/'); 
      }
    });

    // Start listening to URL changes
    router.init();
    // ------------------------

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
