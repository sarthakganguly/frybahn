// =========================================
// STATE MODULE — Central app state
// =========================================

const state = {
  games: [],
  filtered: [],
  activeCategory: 'all',
  searchQuery: '',
  sortBy: 'popular',
  focusedCard: null,
  currentGame: null,
};

const listeners = new Map();

function get(key) {
  return state[key];
}

function set(key, value) {
  const prev = state[key];
  state[key] = value;
  if (listeners.has(key)) {
    listeners.get(key).forEach(fn => fn(value, prev));
  }
}

function on(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key).delete(fn);
}

function getAll() {
  return { ...state };
}

export default { get, set, on, getAll };
