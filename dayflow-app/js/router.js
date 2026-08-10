// router.js — tiny hash router. Views are plain functions that render into #view-root.

const routes = {};
let currentRoute = 'dashboard';
let mountEl = null;

export function registerRoute(name, renderFn) { routes[name] = renderFn; }

export function initRouter(el) {
  mountEl = el;
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1) || 'dashboard'));
  navigate(location.hash.slice(1) || 'dashboard');
}

export function navigate(route, params = {}) {
  const [name] = route.split('?');
  if (!routes[name]) { currentRoute = 'dashboard'; location.hash = '#dashboard'; return; }
  currentRoute = name;
  if (location.hash.slice(1) !== route) location.hash = `#${route}`;
  render(params);
}

export function getCurrentRoute() { return currentRoute; }

export function render(params = {}) {
  if (!mountEl || !routes[currentRoute]) return;
  mountEl.innerHTML = '';
  routes[currentRoute](mountEl, params);
}
