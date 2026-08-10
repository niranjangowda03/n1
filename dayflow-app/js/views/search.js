import { el, formatDateLong, formatTime } from '../utils.js';
import * as store from '../store.js';
import { openTaskModal } from '../components/taskModal.js';
import { navigate } from '../router.js';

export function renderSearch(root) {
  let query = '';
  const results = el('div', { class: 'mt-16' });

  root.appendChild(el('h2', { class: 'mt-8' }, 'Search'));
  root.appendChild(el('div', { class: 'card mt-16' }, [
    el('div', { class: 'search-bar' }, [
      '🔎',
      el('input', { type: 'text', placeholder: 'Search tasks, notes, and reminders…', autofocus: true, oninput: (e) => { query = e.target.value; paint(); } }),
    ]),
  ]));
  root.appendChild(results);

  function paint() {
    results.innerHTML = '';
    if (!query.trim()) {
      results.appendChild(el('div', { class: 'empty-state' }, [el('span', { class: 'emoji' }, '🔎'), el('div', {}, 'Start typing to search across everything.')]));
      return;
    }
    const { tasks, notes } = store.globalSearch(query);
    if (!tasks.length && !notes.length) {
      results.appendChild(el('div', { class: 'empty-state' }, [el('span', { class: 'emoji' }, '🤷'), el('div', {}, `No matches for “${query}”.`)]));
      return;
    }
    if (tasks.length) {
      const card = el('div', { class: 'card' }, [el('div', { class: 'section-title' }, `Tasks & reminders (${tasks.length})`)]);
      tasks.forEach((t) => {
        const cat = store.getCategory(t.category);
        card.appendChild(el('div', { class: 'timeline-item', onclick: () => openTaskModal({ task: t, onSaved: () => navigate('search') }) }, [
          el('div', { class: 'timeline-time' }, formatDateLong(t.date).split(',')[0].slice(0, 3) + ' ' + formatTime(t.startTime, store.getSettings().timeFormat)),
          el('div', { class: 'timeline-body' }, [
            el('div', { class: 'timeline-title' }, t.title),
            el('div', { class: 'timeline-meta' }, [el('span', { class: 'cat-badge', style: `background:${cat.color}22;color:${cat.color}` }, `${cat.icon} ${cat.name}`)]),
          ]),
        ]));
      });
      results.appendChild(card);
    }
    if (notes.length) {
      const card = el('div', { class: 'card mt-16' }, [el('div', { class: 'section-title' }, `Notes (${notes.length})`)]);
      notes.forEach((n) => card.appendChild(el('div', { class: 'row', style: 'padding:8px 0;font-size:13.5px' }, [`📝 ${n.title}`])));
      results.appendChild(card);
    }
  }

  paint();
}
