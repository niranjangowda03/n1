import { el, todayISO, parseISODate, toISODate, addDays, dayOfWeek, MONTH_NAMES, WEEKDAY_SHORT, formatTime, formatDateLong } from '../utils.js';
import * as store from '../store.js';
import { openTaskModal } from '../components/taskModal.js';
import { navigate } from '../router.js';

let mode = 'month'; // day | week | month
let anchor = todayISO(); // reference date for the current view

export function renderCalendar(root, params = {}) {
  if (params.date) anchor = params.date;
  if (params.mode) mode = params.mode;

  root.appendChild(el('div', { class: 'between mt-8' }, [
    el('h2', {}, 'Calendar'),
    el('button', { class: 'btn btn-primary', onclick: () => openTaskModal({ defaultDate: anchor, onSaved: () => navigate('calendar') }) }, '+ Add task'),
  ]));

  root.appendChild(el('div', { class: 'card mt-16' }, [
    el('div', { class: 'cal-header' }, [
      el('div', { class: 'row' }, [
        el('button', { class: 'btn-icon', onclick: () => { shiftAnchor(-1); navigate('calendar'); } }, '←'),
        el('div', { style: 'font-weight:700;min-width:150px;text-align:center' }, headerLabel()),
        el('button', { class: 'btn-icon', onclick: () => { shiftAnchor(1); navigate('calendar'); } }, '→'),
      ]),
      el('div', { class: 'cal-tabs' }, ['day', 'week', 'month'].map((m) =>
        el('button', { class: `cal-tab${mode === m ? ' active' : ''}`, onclick: () => { mode = m; navigate('calendar'); } }, m[0].toUpperCase() + m.slice(1))
      )),
    ]),
    mode === 'month' ? monthView() : mode === 'week' ? weekView() : dayView(),
  ]));
}

function shiftAnchor(dir) {
  if (mode === 'day') anchor = addDays(anchor, dir);
  else if (mode === 'week') anchor = addDays(anchor, dir * 7);
  else {
    const d = parseISODate(anchor);
    d.setMonth(d.getMonth() + dir);
    anchor = toISODate(d);
  }
}

function headerLabel() {
  const d = parseISODate(anchor);
  if (mode === 'month') return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  if (mode === 'day') return formatDateLong(anchor);
  const start = weekStart(anchor);
  const end = addDays(start, 6);
  return `${MONTH_NAMES[parseISODate(start).getMonth()].slice(0, 3)} ${parseISODate(start).getDate()} – ${MONTH_NAMES[parseISODate(end).getMonth()].slice(0, 3)} ${parseISODate(end).getDate()}`;
}

function weekStart(iso, startDay = store.getSettings().startDay ?? 1) {
  const dow = dayOfWeek(iso);
  const diff = (dow - startDay + 7) % 7;
  return addDays(iso, -diff);
}

function monthView() {
  const d = parseISODate(anchor);
  const year = d.getFullYear(), month = d.getMonth();
  const firstOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const gridStart = weekStart(firstOfMonth);
  const wrap = el('div', {}, []);
  const dowRow = el('div', { class: 'month-grid' }, WEEKDAY_SHORT.map((_, i) => el('div', { class: 'month-dow' }, WEEKDAY_SHORT[(i + (store.getSettings().startDay || 1)) % 7])));
  wrap.appendChild(dowRow);

  const grid = el('div', { class: 'month-grid mt-8' });
  let cursor = gridStart;
  for (let i = 0; i < 42; i++) {
    const inMonth = parseISODate(cursor).getMonth() === month;
    const occ = store.getOccurrences(cursor, cursor);
    const cats = [...new Set(occ.map((o) => o.task.category))].slice(0, 4);
    const cellIso = cursor;
    grid.appendChild(el('div', {
      class: `month-cell${inMonth ? '' : ' outside'}${cellIso === todayISO() ? ' today' : ''}${cellIso === anchor && mode === 'month' ? '' : ''}`,
      onclick: () => { anchor = cellIso; mode = 'day'; navigate('calendar'); },
    }, [
      el('div', { class: 'date-num' }, String(parseISODate(cellIso).getDate())),
      el('div', { class: 'month-dots' }, cats.map((c) => el('span', { class: 'dot', style: `background:${store.getCategory(c).color}` }))),
    ]));
    cursor = addDays(cursor, 1);
  }
  wrap.appendChild(grid);
  return wrap;
}

function weekView() {
  const start = weekStart(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const wrap = el('div', {}, []);
  const head = el('div', { class: 'week-grid' }, [el('div', {}), ...days.map((d) => el('div', { class: `week-day-head${d === todayISO() ? ' today' : ''}` }, [WEEKDAY_SHORT[dayOfWeek(d)], el('div', {}, String(parseISODate(d).getDate()))]))]);
  wrap.appendChild(head);
  const body = el('div', { class: 'week-grid mt-8' });
  body.appendChild(el('div', {}));
  days.forEach((d) => {
    const tasks = store.getTasksForDate(d);
    body.appendChild(el('div', { style: 'display:flex;flex-direction:column;gap:4px;cursor:pointer', onclick: () => { anchor = d; mode = 'day'; navigate('calendar'); } },
      tasks.slice(0, 4).map((t) => {
        const cat = store.getCategory(t.category);
        return el('div', { style: `background:${cat.color}22;color:${cat.color};border-radius:6px;padding:3px 6px;font-size:10.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis` }, t.title);
      }).concat(tasks.length > 4 ? [el('div', { class: 'muted', style: 'font-size:10px' }, `+${tasks.length - 4} more`)] : [])
    ));
  });
  wrap.appendChild(body);
  return wrap;
}

function dayView() {
  const tasks = store.getTasksForDate(anchor);
  const settings = store.getSettings();
  const wrap = el('div', { class: 'mt-8' }, []);
  wrap.appendChild(el('div', { class: 'between' }, [
    el('div', { style: 'font-weight:700' }, formatDateLong(anchor)),
    el('button', { class: 'btn btn-ghost btn-sm', onclick: () => navigate(`timetable?date=${anchor}`) }, 'Open in timetable'),
  ]));
  if (!tasks.length) {
    wrap.appendChild(el('div', { class: 'empty-state' }, [el('span', { class: 'emoji' }, '📭'), el('div', {}, 'Nothing on this day yet.'), el('button', { class: 'btn btn-primary btn-sm mt-16', onclick: () => openTaskModal({ defaultDate: anchor, onSaved: () => navigate('calendar') }) }, '+ Add task')]));
    return wrap;
  }
  const timeline = el('div', { class: 'timeline mt-8' });
  tasks.forEach((task) => {
    const cat = store.getCategory(task.category);
    const done = store.isCompletedOn(task, anchor);
    timeline.appendChild(el('div', { class: 'timeline-item', onclick: () => openTaskModal({ task, onSaved: () => navigate('calendar') }) }, [
      el('div', { class: 'timeline-time' }, formatTime(task.startTime, settings.timeFormat)),
      el('div', { class: 'timeline-dot-col' }, [el('div', { class: `timeline-dot${done ? ' done' : ''}` })]),
      el('div', { class: 'timeline-body' }, [
        el('div', { class: `timeline-title${done ? ' done' : ''}` }, task.title),
        el('div', { class: 'timeline-meta' }, [el('span', { class: 'cat-badge', style: `background:${cat.color}22;color:${cat.color}` }, `${cat.icon} ${cat.name}`)]),
      ]),
    ]));
  });
  wrap.appendChild(timeline);
  return wrap;
}
