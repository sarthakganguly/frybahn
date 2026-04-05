// =========================================
// GAME LOADER — Loads games from JSON
// =========================================

import state from './state.js';

export async function loadGames() {
  const response = await fetch('/data/games.json');
  if (!response.ok) throw new Error('Failed to load games.json');
  const games = await response.json();
  state.set('games', games);
  state.set('filtered', games);
  return games;
}

export function filterAndSort() {
  const games    = state.get('games');
  const category = state.get('activeCategory');
  const query    = state.get('searchQuery').toLowerCase().trim();
  const sortBy   = state.get('sortBy');

  let result = games.filter(g => {
    const matchCat = category === 'all' || g.category === category;
    const matchQ   = !query
      || g.title.toLowerCase().includes(query)
      || g.description.toLowerCase().includes(query)
      || g.category.toLowerCase().includes(query);
    return matchCat && matchQ;
  });

  result.sort((a, b) => {
    if (sortBy === 'popular') return b.players - a.players;
    if (sortBy === 'rating')  return b.rating  - a.rating;
    if (sortBy === 'new')     return b.id.localeCompare(a.id); // newest by id ordering
    return 0;
  });

  state.set('filtered', result);
  return result;
}

export function getCategories(games) {
  const cats = new Set(games.map(g => g.category));
  return ['all', ...Array.from(cats).sort()];
}

export function groupByCategory(games) {
  const groups = {};
  for (const g of games) {
    if (!groups[g.category]) groups[g.category] = [];
    groups[g.category].push(g);
  }
  return groups;
}
