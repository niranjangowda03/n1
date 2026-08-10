// theme.js — resolves 'light' | 'dark' | 'system' into an actual data-theme attribute.

let mql = null;

export function applyTheme(preference) {
  const root = document.documentElement;
  if (preference === 'system') {
    if (!mql) {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', () => applyTheme('system'));
    }
    root.setAttribute('data-theme', mql.matches ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', preference);
  }
}
