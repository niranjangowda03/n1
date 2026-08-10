import { el, todayISO, formatDateLong, greeting, formatTime, nowTimeString } from '../utils.js';
import * as store from '../store.js';
import { openTaskModal } from '../components/taskModal.js';
import { openQuickReminder } from '../components/quickReminder.js';
import { openPlanningAssistant } from '../components/planningAssistant.js';
import { rescheduleAll } from '../notifications.js';
import { navigate } from '../router.js';

export function renderDashboard(root) {
  const iso = todayISO();
  const settings = store.getSettings();
  const tasksToday = store.getTasksForDate(iso);
  const progress = store.getDayProgress(iso);
  const missed = store.getMissedOccurrences(iso);
  const conflicts = store.getConflicts(iso);
  const streak = store.getStreak();
  const upcoming = tasksToday.find((t) => !store.isCompletedOn(t, iso) && t.startTime >= nowTimeString());

  root.appendChild(el('div', { class: 'card' }, [buildHero(settings, progress)]));

  if (missed.length) {
    root.appendChild(missedBanner(missed));
  }
  if (conflicts.length) {
    root.appendChild(el('div', { class: 'conflict-banner' }, `⚠️ ${conflicts.length} overlapping activity pair(s) today — check your timetable.`));
  }

  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'section-title' }, 'Quick actions'),
    el('div', { class: 'quick-actions' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openTaskModal({ onSaved: () => navigate('dashboard') }) }, '+ Task'),
      el('button', { class: 'btn btn-soft', onclick: () => openQuickReminder({ onSaved: () => navigate('dashboard') }) }, '⚡ Reminder'),
      el('button', { class: 'btn btn-soft', onclick: () => { navigate('notes'); document.dispatchEvent(new CustomEvent('dayflow:new-note')); } }, '+ Note'),
      el('button', { class: 'btn btn-ghost', onclick: () => openPlanningAssistant({ onSaved: () => navigate('dashboard') }) }, '🧭 Plan my day'),
    ]),
  ]));

  if (upcoming) {
    root.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'section-title' }, 'Up next'),
      el('div', { class: 'row', style: 'gap:14px' }, [
        el('div', { class: 'row', style: `background:${store.getCategory(upcoming.category).color}22;color:${store.getCategory(upcoming.category).color};width:44px;height:44px;border-radius:12px;justify-content:center;font-size:18px;flex-shrink:0` }, store.getCategory(upcoming.category).icon),
        el('div', {}, [
          el('div', { style: 'font-weight:700;font-size:15.5px' }, upcoming.title),
          el('div', { class: 'muted', style: 'font-size:13px' }, `${formatTime(upcoming.startTime, settings.timeFormat)}${upcoming.location ? ' · ' + upcoming.location : ''}`),
        ]),
      ]),
    ]));
  }

  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'between' }, [
      el('div', { class: 'section-title' }, "Today's schedule"),
      el('button', { class: 'btn btn-ghost btn-sm', onclick: () => navigate('timetable') }, 'View timetable'),
    ]),
    tasksToday.length ? buildTimeline(tasksToday, iso, settings) : el('div', { class: 'empty-state' }, [
      el('span', { class: 'emoji' }, '🌤️'),
      el('div', {}, 'Nothing planned yet today.'),
      el('button', { class: 'btn btn-primary btn-sm mt-16', onclick: () => openTaskModal({ onSaved: () => navigate('dashboard') }) }, '+ Add your first task'),
    ]),
  ]));

  const notes = store.getAllNotes().filter((n) => n.pinned).slice(0, 4);
  if (notes.length) {
    root.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'between' }, [el('div', { class: 'section-title' }, 'Pinned notes'), el('button', { class: 'btn btn-ghost btn-sm', onclick: () => navigate('notes') }, 'All notes')]),
      ...notes.map((n) => el('div', { class: 'row', style: 'padding:8px 0;font-size:13.5px' }, [`📌 ${n.title}`])),
    ]));
  }

  root.appendChild(el('div', { class: 'card', style: 'text-align:center' }, [
    el('div', { class: 'muted', style: 'font-size:13px' }, streak > 0 ? `🔥 ${streak}-day streak — every task completed on time.` : 'Complete every task in a day to start a streak.'),
  ]));
}

function buildHero(settings, progress) {
  const R = 40, C = 2 * Math.PI * R;
  const offset = C - (progress.percent / 100) * C;
  const name = settings.name ? `, ${settings.name}` : '';
  return el('div', { class: 'hero' }, [
    el('div', {}, [
      el('div', { class: 'hero-greeting' }, `${greeting()}${name} 👋`),
      el('div', { class: 'hero-date' }, formatDateLong(todayISO())),
      el('div', { class: 'hero-clock', id: 'live-clock' }, ''),
      el('div', { class: 'stat-row' }, [
        el('div', { class: 'stat-chip' }, [el('div', { class: 'num' }, String(progress.completed)), el('div', { class: 'lbl' }, 'Completed')]),
        el('div', { class: 'stat-chip' }, [el('div', { class: 'num' }, String(progress.pending)), el('div', { class: 'lbl' }, 'Pending')]),
        el('div', { class: 'stat-chip' }, [el('div', { class: 'num' }, `${progress.percent}%`), el('div', { class: 'lbl' }, "Today's progress")]),
      ]),
    ]),
    el('div', { class: 'progress-ring-wrap' }, [
      (() => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 96 96');
        svg.setAttribute('width', '96'); svg.setAttribute('height', '96');
        svg.innerHTML = `
          <circle class="progress-ring-bg" cx="48" cy="48" r="${R}"></circle>
          <circle class="progress-ring-fg" cx="48" cy="48" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${offset}"></circle>`;
        return svg;
      })(),
      el('div', { class: 'progress-ring-label' }, `${progress.percent}%`),
    ]),
  ]);
}

function buildTimeline(tasks, iso, settings) {
  const wrap = el('div', { class: 'timeline' });
  tasks.forEach((task, i) => {
    const done = store.isCompletedOn(task, iso);
    const cat = store.getCategory(task.category);
    wrap.appendChild(el('div', { class: 'timeline-item' }, [
      el('div', { class: 'timeline-time' }, formatTime(task.startTime, settings.timeFormat)),
      el('div', { class: 'timeline-dot-col' }, [
        el('div', { class: `timeline-dot${done ? ' done' : ''}` }),
        i < tasks.length - 1 ? el('div', { class: 'timeline-line' }) : null,
      ]),
      el('div', { class: 'checkbox' + (done ? ' checked' : ''), role: 'checkbox', 'aria-checked': String(done), onclick: () => { store.toggleTaskCompletion(task.id, iso); navigate('dashboard'); } }, done ? '✓' : ''),
      el('div', { class: 'timeline-body' }, [
        el('div', { class: `timeline-title${done ? ' done' : ''}` }, task.title),
        el('div', { class: 'timeline-meta' }, [
          el('span', { class: `priority-dot priority-${task.priority}` }),
          el('span', { class: 'cat-badge', style: `background:${cat.color}22;color:${cat.color}` }, `${cat.icon} ${cat.name}`),
          task.location ? el('span', {}, `📍 ${task.location}`) : null,
        ]),
      ]),
      el('div', { class: 'timeline-actions' }, [
        el('button', { class: 'btn-icon', style: 'width:30px;height:30px', onclick: () => openTaskModal({ task, onSaved: () => navigate('dashboard') }) }, '✎'),
      ]),
    ]));
  });
  return wrap;
}

function missedBanner(missed) {
  const wrap = el('div', { class: 'card' });
  wrap.appendChild(el('div', { class: 'section-title' }, '⚠️ Missed tasks'));
  missed.slice(0, 5).forEach(({ task, date }) => {
    wrap.appendChild(el('div', { class: 'missed-banner' }, [
      el('span', {}, `“${task.title}” — scheduled ${date} at ${task.startTime}`),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn btn-sm btn-ghost', onclick: () => { store.toggleTaskCompletion(task.id, date); navigate('dashboard'); } }, 'Mark done'),
        el('button', { class: 'btn btn-sm btn-ghost', onclick: () => { store.updateTask(task.id, { skippedDates: [...(task.skippedDates || []), date] }); navigate('dashboard'); } }, 'Ignore'),
        el('button', { class: 'btn btn-sm btn-danger', onclick: () => { if (confirm('Delete this task?')) { store.deleteTask(task.id); navigate('dashboard'); } } }, 'Delete'),
      ]),
    ]));
  });
  return wrap;
}

let clockInterval = null;
export function startClock() {
  if (clockInterval) clearInterval(clockInterval);
  const tick = () => {
    const node = document.getElementById('live-clock');
    if (node) node.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  tick();
  clockInterval = setInterval(tick, 1000);
}
