// =========================================
// APP.JS — Main entry point
// =========================================

import state from './state.js';
import { loadGames, filterAndSort } from './gameLoader.js';
import { renderGrid, renderNavCategories, updateResultsCount, initKeyboardNav, populateGameDetail } from './ui.js';
import { debounce, qs, escapeHtml } from './utils.js';
import * as router from './router.js';

// ── GAME DETAIL OVERLAY ──────────────────

export function openGameDetails(game) {
  closeGame(); // Close the game iframe if it's somehow open
  
  state.set('currentGame', game);
  populateGameDetail(game);

  const overlay = qs('#game-detail-overlay');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Dynamic SEO
  state.set('prevTitle', document.title);
  const newTitle = `${game.title} — Play Free on Frybahn`;
  document.title = newTitle;
  
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    state.set('prevDesc', metaDesc.content);
    metaDesc.content = game.description;
  }

  // Social tags
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = newTitle;
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.content = game.description;
  const twTitle = document.querySelector('meta[property="twitter:title"]');
  if (twTitle) twTitle.content = newTitle;
  const twDesc = document.querySelector('meta[property="twitter:description"]');
  if (twDesc) twDesc.content = game.description;
  
  if (game.thumbnail) {
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg) ogImg.content = window.location.origin + game.thumbnail;
    const twImg = document.querySelector('meta[property="twitter:image"]');
    if (twImg) twImg.content = window.location.origin + game.thumbnail;
  }

  qs('#detail-close').focus();
}

export function closeGameDetails() {
  const overlay = qs('#game-detail-overlay');
  if (!overlay?.classList.contains('open')) return;

  overlay.classList.remove('open');
  
  // Only restore scroll if we are not going into "Playing" state
  if (window.location.hash.indexOf('/play/') === -1) {
    document.body.style.overflow = '';
  }

  // Restore SEO
  if (state.get('prevTitle')) {
    const originalTitle = state.get('prevTitle');
    document.title = originalTitle;
    
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', originalTitle);
    document.querySelector('meta[property="twitter:title"]')?.setAttribute('content', originalTitle);
  }
  
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && state.get('prevDesc')) {
    const originalDesc = state.get('prevDesc');
    metaDesc.content = originalDesc;
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', originalDesc);
    document.querySelector('meta[property="twitter:description"]')?.setAttribute('content', originalDesc);
  }

  state.set('currentGame', null);
}

// ── GAME OVERLAY ─────────────────────────

export function openGame(game) {
  if (!game.isPlayable) return;
  
  // Close the detail view if it's open
  qs('#game-detail-overlay').classList.remove('open');
  
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
  
  // Only restore scroll if we are not going into "Detail" state
  if (window.location.hash.indexOf('/game/') === -1) {
    document.body.style.overflow = '';
  }

  // NEW: Reveal the background to screen readers again
  qs('#app').removeAttribute('aria-hidden');

  setTimeout(() => { iframe.src = 'about:blank'; }, 400);
  // Don't set currentGame to null yet if we might be going to /game
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
  const detailOverlay = qs('#game-detail-overlay');
  
  const activeOverlay = overlay?.classList.contains('open') ? overlay : 
                        (detailOverlay?.classList.contains('open') ? detailOverlay : null);

  if (!activeOverlay || e.key !== 'Tab') return;

  // Find all focusable elements inside the modal
  const focusableElements = Array.from(activeOverlay.querySelectorAll(FOCUSABLE_SELECTORS));
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

// ── CATEGORIES ───────────────────────────

function switchCategory(cat) {
  state.set('activeCategory', cat);
  
  // Update nav buttons active state
  document.querySelectorAll('.nav-cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });

  const result = filterAndSort();
  renderGrid(qs('#game-grid'), result);
  updateResultsCount(result.length);
  
  // Scroll to grid if we are on the home page
  if (window.location.hash === '' || window.location.hash === '#' || window.location.hash.startsWith('#/category/')) {
     qs('#game-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ── INIT ─────────────────────────────────

async function init() {
  // Bind overlay close
  qs('#overlay-close').addEventListener('click', () => {
    const game = state.get('currentGame');
    if (game) router.navigate(`/game/${game.slug}`);
    else router.navigate('/');
  });
  
  qs('#game-overlay').addEventListener('click', e => {
    if (e.target === qs('#game-overlay')) {
      const game = state.get('currentGame');
      if (game) router.navigate(`/game/${game.slug}`);
      else router.navigate('/');
    }
  });

  // Bind detail overlay close
  qs('#detail-close').addEventListener('click', () => router.navigate('/'));
  qs('#game-detail-overlay').addEventListener('click', e => {
    if (e.target === qs('#game-detail-overlay')) router.navigate('/');
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
    // Route 1: The Root (closes the overlays)
    router.on('/', () => {
      closeGame();
      closeGameDetails();
      switchCategory('all');
    });

    // Route 2: Category View
    router.on('/category', (cat) => {
      closeGame();
      closeGameDetails();
      switchCategory(cat);
    });

    // Route 3: Game Detail View
    router.on('/game', (slug) => {
      closeGame();
      const gameList = state.get('games');
      const game = gameList.find(g => g.slug === slug);
      if (game) {
        openGameDetails(game);
      } else {
        router.navigate('/');
      }
    });

    // Route 4: Deep Link to a Game
    router.on('/play', (slug) => {
      closeGameDetails();
      const gameList = state.get('games');
      const game = gameList.find(g => g.slug === slug);
      
      if (game) {
        openGame(game);
      } else {
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
