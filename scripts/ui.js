// =========================================
// UI MODULE — Renders the game grid UI
// =========================================

import state from './state.js';
import { escapeHtml, formatPlayers, qs, qsa } from './utils.js';
import { groupByCategory, getCategories } from './gameLoader.js';
import { navigate } from './router.js';

// ── RENDER GAME CARD ────────────────────

export function renderCard(game) {
  const card = document.createElement('a');
  card.className = 'game-card';
  card.href = `#/game/${game.slug}`;
  card.setAttribute('aria-label', `View details for ${escapeHtml(game.title)}`);
  card.dataset.slug = game.slug;
  card.dataset.id   = game.id;

  const badgeHtml = game.badge
    ? `<span class="card-badge ${escapeHtml(game.badge)}">${escapeHtml(game.badge)}</span>`
    : '';

  card.innerHTML = `
    <div class="card-thumb">
      <div class="card-thumb-emoji">${escapeHtml(game.emoji)}</div>
      ${badgeHtml}
      <div class="card-play-overlay">
        <div class="card-play-btn">▶</div>
      </div>
    </div>
    <div class="card-body">
      <div class="card-title">${escapeHtml(game.title)}</div>
      <div class="card-meta">
        <span class="card-rating">★ ${game.rating.toFixed(1)}</span>
        <span class="card-players">${formatPlayers(game.players)} players</span>
      </div>
    </div>
  `;

  return card;
}

// ── POPULATE GAME DETAIL ────────────────

export function populateGameDetail(game) {
  const visual = qs('#detail-visual');
  const title = qs('#detail-title');
  const rating = qs('#detail-rating');
  const players = qs('#detail-players');
  const license = qs('#detail-license');
  const playBtn = qs('#detail-play-btn');
  const description = qs('#detail-description');
  const sourceLink = qs('#detail-source-link');
  const sourceWrap = qs('#detail-source-wrap');

  if (game.thumbnail) {
    visual.innerHTML = `<img src="${escapeHtml(game.thumbnail)}" alt="${escapeHtml(game.title)}">`;
  } else {
    visual.innerHTML = `<span class="emoji">${escapeHtml(game.emoji)}</span>`;
  }

  title.textContent = game.title;
  rating.textContent = `★ ${game.rating.toFixed(1)}`;
  players.textContent = `${formatPlayers(game.players)} players`;
  license.textContent = game.license || 'MIT';
  playBtn.href = `#/play/${game.slug}`;
  description.textContent = game.description;

  if (game.source) {
    sourceWrap.style.display = 'block';
    sourceLink.href = game.source;
  } else {
    sourceWrap.style.display = 'none';
  }
}

// ── RENDER CATEGORY ROW ─────────────────

export function renderCategorySection(categoryName, games) {
  const section = document.createElement('section');
  section.className = 'category-section';
  section.dataset.category = categoryName;

  const label = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);

  section.innerHTML = `
    <div class="category-header">
      <h2 class="category-title">${escapeHtml(label)}</h2>
      <div class="category-line"></div>
      <span class="category-count">${games.length} game${games.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="scroll-row stagger-children" role="list"></div>
  `;

  const row = section.querySelector('.scroll-row');
  games.forEach(g => row.appendChild(renderCard(g)));

  return section;
}

// ── RENDER GRID ─────────────────────────

export function renderGrid(container, filtered) {
  container.innerHTML = '';

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-emoji">🔍</div>
        <div class="empty-title">No games found</div>
        <div class="empty-sub">Try a different search or category</div>
      </div>`;
    return;
  }

  const activeCategory = state.get('activeCategory');

  if (activeCategory === 'all') {
    const grouped = groupByCategory(filtered);
    for (const [cat, games] of Object.entries(grouped)) {
      container.appendChild(renderCategorySection(cat, games));
    }
  } else {
    container.appendChild(renderCategorySection(activeCategory, filtered));
  }
}

// ── RENDER NAV CATEGORIES ───────────────

export function renderNavCategories(games) {
  const nav = qs('.nav-categories');
  if (!nav) return;

  const cats = getCategories(games);
  nav.innerHTML = '';

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'nav-cat-btn';
    btn.textContent = cat === 'all' ? 'All Games' : cat.charAt(0).toUpperCase() + cat.slice(1);
    btn.dataset.cat  = cat;
    if (cat === state.get('activeCategory')) btn.classList.add('active');

    btn.addEventListener('click', () => {
      navigate(`/category/${cat}`);
    });

    nav.appendChild(btn);
  });
}

// ── RESULTS COUNT ────────────────────────

export function updateResultsCount(n) {
  const el = qs('.results-count');
  if (el) el.textContent = `${n} game${n !== 1 ? 's' : ''}`;
}

// ── KEYBOARD NAVIGATION ─────────────────

let focusedCardIndex = -1;

export function initKeyboardNav() {
  document.addEventListener('keydown', handleKeyNav);
}

function getAllCards() {
  return qsa('.game-card');
}

function handleKeyNav(e) {
  const overlay = qs('#game-overlay');
  const detailOverlay = qs('#game-detail-overlay');

  if (overlay?.classList.contains('open')) {
    if (e.key === 'Escape') {
      const game = state.get('currentGame');
      if (game) navigate(`/game/${game.slug}`);
      else navigate('/');
    }
    return;
  }

  if (detailOverlay?.classList.contains('open')) {
    if (e.key === 'Escape') {
      navigate('/');
    }
    return;
  }

  const cards = getAllCards();
  if (!cards.length) return;

  const current = document.activeElement;
  const isCard = current?.classList.contains('game-card');

  if (!isCard && ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
    focusedCardIndex = 0;
    cards[0]?.focus();
    e.preventDefault();
    return;
  }

  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault();
      focusedCardIndex = Math.min(focusedCardIndex + 1, cards.length - 1);
      cards[focusedCardIndex]?.focus();
      cards[focusedCardIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      break;

    case 'ArrowLeft':
      e.preventDefault();
      focusedCardIndex = Math.max(focusedCardIndex - 1, 0);
      cards[focusedCardIndex]?.focus();
      cards[focusedCardIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      break;

    case 'ArrowDown':
      e.preventDefault();
      moveVertically(cards, current, 1);
      break;

    case 'ArrowUp':
      e.preventDefault();
      moveVertically(cards, current, -1);
      break;

    case '/':
      e.preventDefault();
      qs('.search-input')?.focus();
      break;
  }
}

function moveVertically(cards, current, direction) {
  const rect = current.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  
  let bestMatch = null;
  let minDistance = Infinity;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (card === current) continue;

    const r = card.getBoundingClientRect();
    const cX = r.left + r.width / 2;
    
    // Check if it's in the correct direction (above/below)
    const isCorrectDirection = direction > 0 
      ? r.top > rect.top + rect.height / 2 
      : r.bottom < rect.bottom - rect.height / 2;

    if (isCorrectDirection) {
      const distance = Math.abs(cX - centerX) + Math.abs(r.top - rect.top) * 2; // Weight vertical distance
      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = i;
      }
    }
  }

  if (bestMatch !== null) {
    focusedCardIndex = bestMatch;
    cards[focusedCardIndex].focus();
    cards[focusedCardIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    // If no match in current direction, maybe we are at the end/start
    // Do nothing or jump to next/prev section if you prefer, but this is safer for grids
  }
}
