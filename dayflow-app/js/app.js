import { el } from './utils.js';
import { db } from './db.js';
import * as store from './store.js';
import { applyTheme } from './theme.js';
import { initRouter, registerRoute, navigate, getCurrentRoute } from './router.js';
import { initNotifications, rescheduleAll } from './notifications.js';
import { runOnboarding } from './components/onboarding.js';
import { openTaskModal } from './components/taskModal.js';
import { openQuickReminder } from './components/quickReminder.js';

import { renderDashboard, startClock } from './views/dashboard.js';
import { renderTimetable } from './views/timetable.js';
import { renderCalendar } from './views/calendar.js';
import { renderNotes } from './views/notes.js';
import { renderStats } from './views/stats.js';
import { renderSettings } from './views/settings.js';
import { renderSearch } from './views/search.js';
import { renderNotificationCenter } from './views/notificationCenter.js';

const NAV_ITEMS = [
  { route: 'dashboard', icon: '🏠', label: 'Home' },
  { route: 'calendar', icon: '📅', label: 'Calendar' },
  { route: 'timetable', icon: '🗓️', label: 'Tasks' },
  { route: 'notes', icon: '🗒️', label: 'Notes' },
  { route: 'stats', icon: '📊', label: 'Stats' },
  { route: 'settings', icon: '⚙️', label: 'Settings' },
];

function buildShell() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const sidebar = el('aside', { class: 'sidebar' }, [
    el('div', { class: 'brand' }, [el('div', { class: 'brand-mark' }, 'DF'), el('div', { class: 'brand-name' }, 'DayFlow')]),
    buildNavList('sidebar-nav'),
    el('div', { class: 'sidebar-footer' }, [
      el('button', { class: 'btn btn-primary btn-block', onclick: () => openTaskModal({ onSaved: rerenderCurrent }) }, '+ Add task'),
      el('button', { class: 'btn btn-ghost btn-block mt-8', onclick: () => openQuickReminder({ onSaved: rerenderCurrent }) }, '⚡ Quick reminder'),
      el('button', { class: 'nav-item mt-8', onclick: () => navigate('search') }, [el('span', { class: 'icon' }, '🔎'), 'Search']),
      el('button', { class: 'nav-item', onclick: () => navigate('notifications') }, [el('span', { class: 'icon' }, '🔔'), 'Notification center']),
    ]),
  ]);

  const topbar = el('div', { class: 'topbar' }, [
    el('div', { class: 'brand' }, [el('div', { class: 'brand-mark' }, 'DF'), el('div', { class: 'brand-name' }, 'DayFlow')]),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn-icon', onclick: () => navigate('search') }, '🔎'),
      el('button', { class: 'btn-icon', onclick: () => navigate('notifications') }, '🔔'),
    ]),
  ]);

  const main = el('main', { class: 'main' }, [el('div', { id: 'view-root' })]);
  const bottomNav = buildNavList('bottom-nav', true);
  const toastHost = el('div', { class: 'toast-host', id: 'toast-host' });

  app.append(sidebar, el('div', { style: 'flex:1;min-width:0;display:flex;flex-direction:column' }, [topbar, main]), bottomNav, toastHost);
  return { viewRoot: document.getElementById('view-root'), toastHost };
}

function buildNavList(cls, isBottom = false) {
  return el(isBottom ? 'nav' : 'ul', { class: isBottom ? 'bottom-nav' : 'nav-list' },
    NAV_ITEMS.map((item) => el(isBottom ? 'button' : 'li', {}, [
      el('button', {
        class: `nav-item${getCurrentRoute() === item.route ? ' active' : ''}`,
        onclick: () => navigate(item.route),
        'data-route': item.route,
      }, [el('span', { class: 'icon' }, item.icon), item.label]),
    ]))
  );
}

function refreshNavHighlight() {
  document.querySelectorAll('.nav-item[data-route]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.route === getCurrentRoute());
  });
}

function rerenderCurrent() { navigate(getCurrentRoute()); }

function checkPinLock(onUnlocked) {
  const settings = store.getSettings();
  if (!settings.pinLock?.enabled) { onUnlocked(); return; }
  const overlay = el('div', { class: 'onboard-backdrop' });
  const card = el('div', { class: 'onboard-card' });
  function paint(error) {
    card.innerHTML = '';
    card.append(
      el('div', { class: 'onboard-mark' }, '🔒'),
      el('h2', {}, 'DayFlow is locked'),
      el('p', { class: 'muted mt-8' }, 'Enter your 4-digit PIN to continue.'),
      el('input', { type: 'password', inputmode: 'numeric', maxlength: '4', id: 'pin-input', style: 'text-align:center;letter-spacing:8px;font-size:22px;width:140px;margin:18px auto;display:block;border:1px solid var(--border);border-radius:10px;padding:10px;background:var(--bg);color:var(--ink)' }),
      error ? el('div', { style: 'color:var(--danger);font-size:13px;margin-bottom:10px' }, 'Incorrect PIN.') : null,
      el('button', { class: 'btn btn-primary btn-block', onclick: () => {
        const val = document.getElementById('pin-input').value;
        if (val === settings.pinLock.pin) { overlay.remove(); onUnlocked(); }
        else paint(true);
      } }, 'Unlock')
    );
  }
  paint(false);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function boot() {
  applyTheme(store.getSettings().theme);

  const { viewRoot, toastHost } = buildShell();
  initNotifications(toastHost);

  registerRoute('dashboard', (root) => { renderDashboard(root); startClock(); });
  registerRoute('timetable', (root, params) => renderTimetable(root, params));
  registerRoute('calendar', (root, params) => renderCalendar(root, params));
  registerRoute('notes', (root) => renderNotes(root));
  registerRoute('stats', (root) => renderStats(root));
  registerRoute('settings', (root) => renderSettings(root));
  registerRoute('search', (root) => renderSearch(root));
  registerRoute('notifications', (root) => renderNotificationCenter(root));

  initRouter(viewRoot);
  refreshNavHighlight();
  store.subscribe(refreshNavHighlight);

  window.addEventListener('hashchange', refreshNavHighlight);

  rescheduleAll();
  setInterval(rescheduleAll, 5 * 60 * 1000); // keep the schedule fresh (handles clock changes, DST, new-day rollover)

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkPinLock(() => {
    if (!db.isOnboarded()) {
      runOnboarding(boot);
    } else {
      boot();
    }
  });
});
