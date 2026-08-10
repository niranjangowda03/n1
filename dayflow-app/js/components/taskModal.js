import { el, todayISO, uid } from '../utils.js';
import * as store from '../store.js';
import { repeatLabel } from '../recurrence.js';
import { rescheduleAll } from '../notifications.js';

const REMINDER_PRESETS = [
  { label: 'No reminder', value: null },
  { label: 'At task time', value: 'at_time' },
  { label: '5 min before', value: 5 },
  { label: '10 min before', value: 10 },
  { label: '15 min before', value: 15 },
  { label: '30 min before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '1 day before', value: 1440 },
];

const REPEAT_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'custom-interval', label: 'Custom interval' },
];

export function openTaskModal({ task = null, defaultDate = todayISO(), onSaved = () => {} } = {}) {
  const isEdit = !!task;
  const state = {
    title: task?.title || '',
    description: task?.description || '',
    date: task?.date || defaultDate,
    startTime: task?.startTime || '09:00',
    endTime: task?.endTime || '',
    category: task?.category || store.getCategories()[0].id,
    priority: task?.priority || 'medium',
    location: task?.location || '',
    reminders: task ? [...task.reminders] : [{ id: uid('rem'), offsetMinutes: store.getSettings().notifications.defaultReminder }],
    repeat: task ? { ...task.repeat } : { type: 'none' },
    customInterval: task?.repeat?.interval || 2,
  };

  const backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } });
  const modal = el('div', { class: 'modal' });
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  function close() { backdrop.remove(); }

  function renderPillGroup(options, selectedValue, onPick, dotColor) {
    const group = el('div', { class: 'pill-group' });
    options.forEach((opt) => {
      const value = opt.value ?? opt.id;
      const label = opt.label ?? `${opt.icon} ${opt.name}`;
      const pill = el('button', {
        type: 'button',
        class: `pill${selectedValue === value ? ' selected' : ''}`,
        onclick: () => { onPick(value); paint(); },
      }, [dotColor ? el('span', { class: 'dot', style: `background:${opt.color}` }) : null, label]);
      group.appendChild(pill);
    });
    return group;
  }

  function paint() {
    modal.innerHTML = '';
    const categories = store.getCategories();
    const conflicts = state.date && state.startTime
      ? store.getConflicts(state.date).filter(([a, b]) => true)
      : [];

    modal.appendChild(el('div', { class: 'modal-header' }, [
      el('h3', { class: 'modal-title' }, isEdit ? 'Edit task' : 'Add task'),
      el('button', { class: 'btn-icon', 'aria-label': 'Close', onclick: close }, '✕'),
    ]));

    if (conflicts.length) {
      modal.appendChild(el('div', { class: 'conflict-banner' }, `⚠️ ${conflicts.length} schedule conflict(s) on ${state.date}. You can still save.`));
    }

    // Title
    modal.appendChild(el('div', { class: 'field' }, [
      el('label', {}, 'Task name'),
      el('input', { type: 'text', value: state.title, placeholder: 'e.g. Complete DBMS assignment', oninput: (e) => (state.title = e.target.value) }),
    ]));

    // Date / start / end
    modal.appendChild(el('div', { class: 'field-row' }, [
      el('div', { class: 'field' }, [el('label', {}, 'Date'), el('input', { type: 'date', value: state.date, oninput: (e) => { state.date = e.target.value; paint(); } })]),
      el('div', { class: 'field' }, [el('label', {}, 'Start time'), el('input', { type: 'time', value: state.startTime, oninput: (e) => { state.startTime = e.target.value; paint(); } })]),
      el('div', { class: 'field' }, [el('label', {}, 'End time (optional)'), el('input', { type: 'time', value: state.endTime, oninput: (e) => (state.endTime = e.target.value) })]),
    ]));

    // Description
    modal.appendChild(el('div', { class: 'field' }, [
      el('label', {}, 'Description / notes'),
      el('textarea', { oninput: (e) => (state.description = e.target.value) }, state.description),
    ]));

    // Location
    modal.appendChild(el('div', { class: 'field' }, [
      el('label', {}, 'Location (optional)'),
      el('input', { type: 'text', value: state.location, placeholder: 'e.g. Library, Room 204', oninput: (e) => (state.location = e.target.value) }),
    ]));

    // Category
    modal.appendChild(el('div', { class: 'field' }, [
      el('label', {}, 'Category'),
      renderPillGroup(categories, state.category, (v) => (state.category = v), true),
    ]));

    // Priority
    modal.appendChild(el('div', { class: 'field' }, [
      el('label', {}, 'Priority'),
      renderPillGroup(
        [{ id: 'low', label: '🔵 Low' }, { id: 'medium', label: '🟦 Medium' }, { id: 'high', label: '🟠 High' }, { id: 'urgent', label: '🔴 Urgent' }],
        state.priority,
        (v) => (state.priority = v)
      ),
    ]));

    // Reminders
    const remField = el('div', { class: 'field' });
    remField.appendChild(el('label', {}, 'Reminders'));
    const presetGroup = el('div', { class: 'pill-group' });
    REMINDER_PRESETS.forEach((p) => {
      presetGroup.appendChild(el('button', {
        type: 'button', class: 'pill',
        onclick: () => {
          if (p.value === null) { state.reminders = []; }
          else if (p.value === 'at_time') { state.reminders.push({ id: uid('rem'), type: 'at_time' }); }
          else { state.reminders.push({ id: uid('rem'), offsetMinutes: p.value }); }
          paint();
        },
      }, p.label));
    });
    remField.appendChild(presetGroup);

    const customRow = el('div', { class: 'field-row', style: 'margin-top:8px' }, [
      el('input', { type: 'time', id: 'custom-rem-time' }),
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => {
        const t = modal.querySelector('#custom-rem-time').value;
        if (t) { state.reminders.push({ id: uid('rem'), type: 'custom', customTime: t }); paint(); }
      } }, 'Add custom time'),
    ]);
    remField.appendChild(customRow);

    const chipList = el('div', { class: 'reminder-chip-list' });
    if (!state.reminders.length) {
      chipList.appendChild(el('div', { class: 'muted', style: 'font-size:13px' }, 'No reminders set.'));
    }
    state.reminders.forEach((r) => {
      let label;
      if (r.type === 'at_time') label = 'At task start time';
      else if (r.type === 'custom') label = `Custom: ${r.customTime}`;
      else label = `${r.offsetMinutes} min before`;
      chipList.appendChild(el('div', { class: 'reminder-chip' }, [
        el('span', {}, `🔔 ${label}`),
        el('button', { type: 'button', class: 'btn-icon', style: 'width:24px;height:24px;font-size:11px', onclick: () => { state.reminders = state.reminders.filter((x) => x.id !== r.id); paint(); } }, '✕'),
      ]));
    });
    remField.appendChild(chipList);
    modal.appendChild(remField);

    // Repeat
    const repeatField = el('div', { class: 'field' }, [
      el('label', {}, 'Repeat'),
      el('select', {
        onchange: (e) => { state.repeat = { type: e.target.value, interval: state.customInterval }; paint(); },
      }, REPEAT_OPTIONS.map((o) => el('option', { value: o.value, selected: state.repeat.type === o.value }, o.label))),
    ]);
    if (state.repeat.type === 'custom-interval') {
      repeatField.appendChild(el('div', { class: 'field-row', style: 'margin-top:8px' }, [
        el('div', { class: 'field' }, [
          el('label', {}, 'Repeat every N days'),
          el('input', { type: 'number', min: '1', value: state.customInterval, oninput: (e) => { state.customInterval = Number(e.target.value) || 1; state.repeat.interval = state.customInterval; } }),
        ]),
      ]));
    }
    repeatField.appendChild(el('div', { class: 'muted', style: 'font-size:12.5px;margin-top:4px' }, repeatLabel(state.repeat)));
    modal.appendChild(repeatField);

    // Actions
    const actions = el('div', { class: 'row', style: 'justify-content:flex-end;margin-top:20px;gap:10px' });
    if (isEdit) {
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-danger', onclick: () => {
        if (confirm('Delete this task?')) { store.deleteTask(task.id); rescheduleAll(); close(); onSaved(); }
      } }, 'Delete'));
    }
    actions.appendChild(el('button', { type: 'button', class: 'btn btn-ghost', onclick: close }, 'Cancel'));
    actions.appendChild(el('button', {
      type: 'button', class: 'btn btn-primary',
      onclick: () => {
        if (!state.title.trim()) { alert('Please give the task a name.'); return; }
        const payload = {
          title: state.title, description: state.description, date: state.date,
          startTime: state.startTime, endTime: state.endTime, category: state.category,
          priority: state.priority, location: state.location, reminders: state.reminders,
          repeat: state.repeat,
        };
        if (isEdit) store.updateTask(task.id, payload);
        else store.createTask(payload);
        rescheduleAll();
        close();
        onSaved();
      },
    }, isEdit ? 'Save changes' : 'Add task'));
    modal.appendChild(actions);
  }

  paint();
}
