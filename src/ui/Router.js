/**
 * Router.js — Simple hash-based SPA router.
 *
 * Routes:
 *   #/          → Lobby (create / join game)
 *   #/game      → Active game view
 *   #/settings  → Settings panel
 *
 * @module Router
 */

const routes = {};
let currentView = null;
let currentParams = null;

/**
 * Register a route handler.
 * @param {string}   path     Route pattern, e.g. '/' or '/game'
 * @param {Function} handler  Called with (params) when route matches
 */
export function register(path, handler) {
  routes[path] = handler;
}

/** Navigate to a route with optional parameters and search query. */
export function navigate(path, params = {}) {
  if (path.startsWith('/')) {
    const hash = path === '/' ? '' : path;
    // Preserve any existing search (query) params in the URL so that
    // ?room=XXXX survives navigation to /game (P2P multiplayer).
    // For lobby (path='/'), strip search params entirely so the user
    // can quit by navigating to the plain home URL.
    const search = window.location.search;
    let url;
    if (path === '/' || !search) {
      url = `#${hash}`;
    } else {
      url = `${search}#${hash}`;
    }
    history.replaceState(null, '', url);
  }
  currentParams = params;
  resolve();
}

/** Resolve the current hash and invoke the matching route handler. */
function resolve() {
  const hash = window.location.hash.slice(1) || '/';

  // Extract path and query params.
  const [pathPart, qs] = hash.split('?');
  const path = pathPart || '/';

  const params = { ...currentParams };
  if (qs) {
    for (const pair of qs.split('&')) {
      const [k, v] = pair.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  }

  // Also merge query params from the browser's location.search.
  // This handles direct URLs like /?room=XXXX (without hash prefix).
  if (window.location.search) {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of sp.entries()) {
      // Hash-based params take priority over search params.
      if (!(k in params)) {
        params[k] = v;
      }
    }
  }

  const handler = routes[path];
  if (handler) {
    if (currentView && currentView.destroy) {
      currentView.destroy();
    }
    currentView = handler(params);
  }
}

/** Start the router. */
export function start() {
  window.addEventListener('hashchange', resolve);
  resolve();
}

/** Get the currently active view (if any). */
export function getCurrentView() {
  return currentView;
}
