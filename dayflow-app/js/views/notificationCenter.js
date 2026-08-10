import { el, todayISO, formatTime } from '../utils.js';
import * as store from '../store.js';
import { db } from '../db.js';

export function renderNotificationCenter(root) {
  const settings = store.getSettings();
  const log = [...db.getNotificationLog()].reverse();
  const missed = store.getMissedOccurrences();

  root.appendChild(el('h2', { class: 'mt-8' }, 'Notification center'));

  root.appendChild(el('div', { class: 'card mt-16' }, [
    el('div', { class: 'section-title' }, `Upcoming today (${store.getTasksForDate(todayISO()).filter((t) => !store.isCompletedOn(t, todayISO())).length})`),
    ...store.getTasksForDate(todayISO()).filter((t) => !store.isCompletedOn(t, todayISO())).slice(0, 8).map((t) =>
      el('div', { class: 'row', style: 'padding:8px 0;font-size:13.5px;justify-content:space-between' }, [
        el('span', {}, `🔔 ${t.title}`),
        el('span', { class: 'muted' }, formatTime(t.startTime, settings.timeFormat)),
      ])
    ),
  ]));

  if (missed.length) {
    root.appendChild(el('div', { class: 'card mt-16' }, [
      el('div', { class: 'section-title' }, `Missed (${missed.length})`),
      ...missed.slice(0, 8).map(({ task, date }) => el('div', { class: 'row', style: 'padding:8px 0;font-size:13.5px;justify-content:space-between;color:var(--danger)' }, [
        el('span', {}, `⚠️ ${task.title}`),
        el('span', {}, `${date} · ${task.startTime}`),
      ])),
    ]));
  }

  root.appendChild(el('div', { class: 'card mt-16' }, [
    el('div', { class: 'section-title' }, 'Recent notifications'),
    log.length ? el('div', {}, log.slice(0, 30).map((entry) => el('div', { class: 'row', style: 'padding:8px 0;font-size:13.5px;justify-content:space-between' }, [
      el('span', {}, `${entry.status === 'delivered' ? '🔔' : '🔕'} ${entry.title}`),
      el('span', { class: 'muted' }, new Date(entry.firedAt).toLocaleString()),
    ]))) : el('div', { class: 'empty-state' }, [el('span', { class: 'emoji' }, '🔔'), el('div', {}, 'No notifications delivered yet.')]),
  ]));
}
