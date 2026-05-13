// =========================================
// ROUTER — Lightweight path-based router
// =========================================

import state from './state.js';

const routes = new Map();

export function on(path, handler) {
  routes.set(path, handler);
}

export function navigate(path) {
  window.history.pushState({}, '', path);
  dispatch();
}

function dispatch() {
  const path = window.location.pathname || '/';
  
  // Match exact or parameterised
  let handler = routes.get(path);
  
  if (!handler) {
    for (const [pattern, fn] of routes) {
      if (pattern !== '/' && path.startsWith(pattern + '/')) {
        const param = path.slice(pattern.length + 1);
        handler = () => fn(param);
        break;
      }
    }
  }

  if (handler) handler(path);
  else if (routes.has('/')) routes.get('/')();
}

export function init() {
  window.addEventListener('popstate', dispatch);
  dispatch();
}

export function currentRoute() {
  return window.location.pathname || '/';
}
