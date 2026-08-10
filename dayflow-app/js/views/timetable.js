import { el, todayISO, addDays, formatDateLong, formatTime, minutesToTime, timeToMinutes } from '../utils.js';
import * as store from '../store.js';
import { openTaskModal } from '../components/taskModal.js';
import { rescheduleAll } from '../notifications.js';
import { navigate } from '../router.js';

let selectedDate = todayISO();

export function renderTimetable(root, params = {}) {
  if (params.date) selectedDate = params.date;
  const settings = store.getSettings();
  const tasks = store.getTasksForDate(selectedDate);
  const conflicts = store.getConflicts(selectedDate);

  root.appendChild(el('div', { class: 'between mt-8' }, [
    el('h2', {}, 'Timetable'),
    el('button', { class: 'btn btn-primary', onclick: () => openTaskModal({ defaultDate: selectedDate, onSaved: () => navigate('timetable') }) }, '+ Add task'),
  ]));

  root.appendChild(el('div', { class: 'card mt-16' }, [
    el('div', { class: 'between' }, [
      el('button', { class: 'btn-icon', onclick: () => { selectedDate = addDays(selectedDate, -1); navigate('timetable'); } }, '←'),
      el('div', { style: 'text-align:center' }, [
        el('div', { style: 'font-weight:700' }, formatDateLong(selectedDate)),
        selectedDate !== todayISO() ? el('button', { class: 'btn btn-ghost btn-sm mt-8', onclick: () => { selectedDate = todayISO(); navigate('timetable'); } }, 'Jump to today') : el('div', { class: 'muted', style: 'font-size:12px' }, 'Today'),
      ]),
      el('button', { class: 'btn-icon', onclick: () => { selectedDate = addDays(selectedDate, 1); navigate('timetable'); } }, '→'),
    ]),
  ]));

  if (conflicts.length) {
    root.appendChild(el('div', { class: 'conflict-banner mt-16' }, `⚠️ ${conflicts.map(([a, b]) => `“${a.title}” overlaps “${b.title}”`).join('; ')}.`));
  }

  const card = el('div', { class: 'card mt-16' });
  if (!tasks.length) {
    card.appendChild(el('div', { class: 'empty-state' }, [el('span', { class: 'emoji' }, '🗓️'), el('div', {}, 'No activities scheduled for this day.')]));
  } else {
    const list = el('div', {}, []);
    tasks.forEach((task) => list.appendChild(taskRow(task, selectedDate, settings)));
    card.appendChild(list);
    wireDragAndDrop(card);
  }
  root.appendChild(card);
}

function taskRow(task, iso, settings) {
  const done = store.isCompletedOn(task, iso);
  const cat = store.getCategory(task.category);
  const row = el('div', {
    class: 'timeline-item timetable-item',
    draggable: 'true',
    'data-task-id': task.id,
    'data-start': task.startTime,
  }, [
    el('div', { class: 'timeline-time' }, `${formatTime(task.startTime, settings.timeFormat)}${task.endTime ? '–' + formatTime(task.endTime, settings.timeFormat) : ''}`),
    el('div', { class: 'checkbox' + (done ? ' checked' : ''), onclick: () => { store.toggleTaskCompletion(task.id, iso); navigate('timetable'); } }, done ? '✓' : ''),
    el('div', { class: 'timeline-body' }, [
      el('div', { class: `timeline-title${done ? ' done' : ''}` }, task.title),
      el('div', { class: 'timeline-meta' }, [
        el('span', { class: `priority-dot priority-${task.priority}` }),
        el('span', { class: 'cat-badge', style: `background:${cat.color}22;color:${cat.color}` }, `${cat.icon} ${cat.name}`),
        task.repeat?.type && task.repeat.type !== 'none' ? el('span', {}, '🔁') : null,
        task.location ? el('span', {}, `📍 ${task.location}`) : null,
      ]),
    ]),
    el('div', { class: 'timeline-actions' }, [
      el('button', { class: 'btn-icon', style: 'width:30px;height:30px', title: 'Edit', onclick: () => openTaskModal({ task, onSaved: () => navigate('timetable') }) }, '✎'),
      el('button', { class: 'btn-icon', style: 'width:30px;height:30px', title: 'Duplicate', onclick: () => { store.duplicateTask(task.id); rescheduleAll(); navigate('timetable'); } }, '⧉'),
      el('button', { class: 'btn-icon', style: 'width:30px;height:30px', title: 'Delete', onclick: () => { if (confirm('Delete this task?')) { store.deleteTask(task.id); rescheduleAll(); navigate('timetable'); } } }, '🗑'),
    ]),
  ]);
  return row;
}

function wireDragAndDrop(container) {
  let dragged = null;
  container.querySelectorAll('.timetable-item').forEach((item) => {
    item.addEventListener('dragstart', () => { dragged = item; item.classList.add('dragging'); });
    item.addEventListener('dragend', () => { item.classList.remove('dragging'); container.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target')); });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target'));
      if (item !== dragged) item.classList.add('drop-target');
    });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!dragged || dragged === item) return;
      const targetTime = item.dataset.start;
      const taskId = dragged.dataset.taskId;
      // Swap start times between dragged task and drop target's slot.
      const draggedTime = dragged.dataset.start;
      store.updateTask(taskId, { startTime: targetTime });
      store.updateTask(item.dataset.taskId, { startTime: draggedTime });
      rescheduleAll();
      navigate('timetable');
    });
  });
}
