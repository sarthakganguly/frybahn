// =========================================
// ROUTER — Lightweight hash-based router
// =========================================

import state from './state.js';

const routes = new Map();

export function on(path, handler) {
  routes.set(path, handler);
}

export function navigate(path) {
  window.location.hash = path;
}

export function init() {
  function dispatch() {
    const hash = window.location.hash.slice(1) || '/';
    // Match exact or parameterised
    let handler = routes.get(hash);
    if (!handler) {
      for (const [pattern, fn] of routes) {
        if (hash.startsWith(pattern + '/')) {
          const param = hash.slice(pattern.length + 1);
          handler = () => fn(param);
          break;
        }
      }
    }
    if (handler) handler(hash);
    else if (routes.has('/')) routes.get('/')();
  }

  window.addEventListener('hashchange', dispatch);
  dispatch();
}

export function currentRoute() {
  return window.location.hash.slice(1) || '/';
}
