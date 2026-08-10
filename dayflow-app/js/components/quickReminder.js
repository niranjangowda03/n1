// quickReminder.js — "Call Dad at 8 PM" style fast capture.
// Parses a trailing time phrase out of free text; everything else becomes the title.

import { el, todayISO, uid } from '../utils.js';
import * as store from '../store.js';
import { rescheduleAll } from '../notifications.js';

function parseTimePhrase(text) {
  const re = /\b(at\s+)?(\d{1,2})(:(\d{2}))?\s*(am|pm)?\b\s*$/i;
  const match = text.match(re);
  if (!match) return { title: text.trim(), time: null };
  let [, , hourStr, , minStr, period] = match;
  let hour = parseInt(hourStr, 10);
  const minutes = minStr ? parseInt(minStr, 10) : 0;
  if (period) {
    period = period.toLowerCase();
    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
  } else if (hour <= 7) {
    // Bare small numbers with no am/pm are ambiguous; assume PM (more common for reminders).
    hour += 12;
  }
  const title = text.slice(0, match.index).replace(/\bat\s*$/i, '').trim();
  return { title: title || text.trim(), time: `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` };
}

export function openQuickReminder({ onSaved = () => {} } = {}) {
  const backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } });
  const modal = el('div', { class: 'modal', style: 'max-width:440px' });
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  function close() { backdrop.remove(); }

  let parsed = { title: '', time: '20:00' };

  const input = el('input', {
    type: 'text', placeholder: 'e.g. Call Dad at 8 PM', autofocus: true,
    oninput: (e) => { parsed = parseTimePhrase(e.target.value); preview.textContent = parsed.title ? `“${parsed.title}” today at ${parsed.time}` : ''; },
  });

  const preview = el('div', { class: 'muted', style: 'font-size:13px;margin-top:8px' }, '');

  modal.append(
    el('div', { class: 'modal-header' }, [
      el('h3', { class: 'modal-title' }, '⚡ Quick reminder'),
      el('button', { class: 'btn-icon', onclick: close }, '✕'),
    ]),
    el('div', { class: 'field' }, [el('label', {}, 'Type it, we\u2019ll catch the time'), input]),
    preview,
    el('div', { class: 'row', style: 'justify-content:flex-end;margin-top:20px;gap:10px' }, [
      el('button', { class: 'btn btn-ghost', onclick: close }, 'Cancel'),
      el('button', { class: 'btn btn-primary', onclick: () => {
        if (!input.value.trim()) return;
        const { title, time } = parseTimePhrase(input.value);
        store.createTask({
          title: title || input.value.trim(),
          date: todayISO(),
          startTime: time || '20:00',
          category: 'personal',
          priority: 'medium',
          reminders: [{ id: uid('rem'), type: 'at_time' }],
        });
        rescheduleAll();
        close();
        onSaved();
      } }, 'Add reminder'),
    ])
  );

  setTimeout(() => input.focus(), 50);
}
