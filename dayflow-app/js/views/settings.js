import { el } from '../utils.js';
import * as store from '../store.js';
import { db } from '../db.js';
import { requestPermission, getPermissionState, rescheduleAll } from '../notifications.js';
import { applyTheme } from '../theme.js';
import { navigate } from '../router.js';

export function renderSettings(root) {
  const settings = store.getSettings();

  root.appendChild(el('h2', { class: 'mt-8' }, 'Settings'));

  // General
  root.appendChild(sectionCard('General', [
    textRow('Your name', settings.name, (v) => store.updateSettings({ name: v })),
    selectRow('Start of week', settings.startDay, [[0, 'Sunday'], [1, 'Monday']], (v) => store.updateSettings({ startDay: Number(v) })),
    selectRow('Time format', settings.timeFormat, [['12h', '12-hour'], ['24h', '24-hour']], (v) => { store.updateSettings({ timeFormat: v }); navigate('settings'); }),
    selectRow('Date format', settings.dateFormat, [['DD/MM/YYYY', 'DD/MM/YYYY'], ['MM/DD/YYYY', 'MM/DD/YYYY'], ['YYYY-MM-DD', 'YYYY-MM-DD']], (v) => store.updateSettings({ dateFormat: v })),
    timeRow('Usual wake time', settings.wakeTime, (v) => store.updateSettings({ wakeTime: v })),
    timeRow('Usual sleep time', settings.sleepTime, (v) => store.updateSettings({ sleepTime: v })),
  ]));

  // Notifications
  const notif = settings.notifications;
  root.appendChild(sectionCard('Notifications', [
    toggleRow('Enable notifications', 'Turn all reminders on or off', notif.enabled, (v) => { store.updateSettings({ notifications: { ...notif, enabled: v } }); rescheduleAll(); }),
    row(el('div', {}, [el('div', { class: 'label' }, 'Browser permission'), el('div', { class: 'desc' }, `Status: ${getPermissionState()}`)]),
      getPermissionState() !== 'granted' ? el('button', { class: 'btn btn-soft btn-sm', onclick: async () => { await requestPermission(); navigate('settings'); } }, 'Enable') : el('span', { class: 'muted', style: 'font-size:12.5px' }, '✓ Granted')),
    selectRow('Default reminder', notif.defaultReminder, [[0, 'At task time'], [5, '5 min before'], [10, '10 min before'], [15, '15 min before'], [30, '30 min before'], [60, '1 hour before']], (v) => store.updateSettings({ notifications: { ...notif, defaultReminder: Number(v) } })),
    toggleRow('Sound', 'Play a sound with each alert', notif.sound, (v) => store.updateSettings({ notifications: { ...notif, sound: v } })),
    toggleRow('Vibration', 'Vibrate on supported devices', notif.vibration, (v) => store.updateSettings({ notifications: { ...notif, vibration: v } })),
    toggleRow('Quiet hours', 'Suppress alerts during a time window', notif.quietHoursEnabled, (v) => { store.updateSettings({ notifications: { ...notif, quietHoursEnabled: v } }); navigate('settings'); }),
    notif.quietHoursEnabled ? row(el('div', { class: 'label' }, 'Quiet window'), el('div', { class: 'row' }, [
      el('input', { type: 'time', value: notif.quietStart, oninput: (e) => store.updateSettings({ notifications: { ...notif, quietStart: e.target.value } }) }),
      el('span', {}, '–'),
      el('input', { type: 'time', value: notif.quietEnd, oninput: (e) => store.updateSettings({ notifications: { ...notif, quietEnd: e.target.value } }) }),
    ])) : null,
  ]));

  // Appearance
  root.appendChild(sectionCard('Appearance', [
    row(el('div', { class: 'label' }, 'Theme'), el('div', { class: 'pill-group' }, [
      themePill('light', settings.theme, '☀️ Light'),
      themePill('dark', settings.theme, '🌙 Dark'),
      themePill('system', settings.theme, '🖥️ System'),
    ])),
  ]));

  // Categories
  root.appendChild(categoriesCard());

  // Data
  root.appendChild(sectionCard('Data', [
    row(el('div', {}, [el('div', { class: 'label' }, 'Export data'), el('div', { class: 'desc' }, 'Download all tasks, notes, and settings as JSON')]),
      el('button', { class: 'btn btn-soft btn-sm', onclick: exportData }, 'Export')),
    row(el('div', {}, [el('div', { class: 'label' }, 'Import / restore'), el('div', { class: 'desc' }, 'Load a previously exported backup file')]),
      el('label', { class: 'btn btn-ghost btn-sm', style: 'cursor:pointer' }, ['Import', el('input', { type: 'file', accept: 'application/json', class: 'hidden', onchange: importData })])),
    row(el('div', {}, [el('div', { class: 'label', style: 'color:var(--danger)' }, 'Erase all data'), el('div', { class: 'desc' }, 'Permanently delete every task, note, and setting')]),
      el('button', { class: 'btn btn-danger btn-sm', onclick: () => { if (confirm('This deletes everything and cannot be undone. Continue?')) { store.wipeData(); navigate('settings'); } } }, 'Erase')),
  ]));

  // Privacy
  const pin = settings.pinLock;
  root.appendChild(sectionCard('Privacy', [
    toggleRow('App lock (PIN)', 'Require a 4-digit PIN to open DayFlow. Biometric unlock uses this same PIN as a fallback where supported by the device.', pin.enabled, (v) => {
      if (v) {
        const code = prompt('Set a 4-digit PIN:');
        if (!code || !/^\d{4}$/.test(code)) { alert('PIN must be exactly 4 digits.'); navigate('settings'); return; }
        store.updateSettings({ pinLock: { enabled: true, pin: code } });
      } else {
        store.updateSettings({ pinLock: { enabled: false, pin: '' } });
      }
      navigate('settings');
    }),
  ]));

  root.appendChild(el('div', { class: 'muted', style: 'text-align:center;font-size:12px;margin-top:18px' }, 'DayFlow · all data stays on this device'));
}

function sectionCard(title, rows) {
  return el('div', { class: 'card mt-16' }, [el('div', { class: 'section-title' }, title), ...rows.filter(Boolean)]);
}

function row(left, right) { return el('div', { class: 'settings-row' }, [left, right]); }

function textRow(label, value, onChange) {
  return row(el('div', { class: 'label' }, label), el('input', { type: 'text', value, style: 'width:180px;border:1px solid var(--border);border-radius:8px;padding:6px 10px;background:var(--bg);color:var(--ink)', oninput: (e) => onChange(e.target.value) }));
}

function timeRow(label, value, onChange) {
  return row(el('div', { class: 'label' }, label), el('input', { type: 'time', value, oninput: (e) => onChange(e.target.value) }));
}

function selectRow(label, value, options, onChange) {
  return row(el('div', { class: 'label' }, label), el('select', { onchange: (e) => onChange(e.target.value), style: 'border:1px solid var(--border);border-radius:8px;padding:6px 10px;background:var(--bg);color:var(--ink)' },
    options.map(([v, l]) => el('option', { value: v, selected: String(v) === String(value) }, l))));
}

function toggleRow(label, desc, checked, onChange) {
  return row(
    el('div', {}, [el('div', { class: 'label' }, label), desc ? el('div', { class: 'desc' }, desc) : null]),
    el('label', { class: 'switch' }, [el('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked) }), el('span', { class: 'track' })])
  );
}

function themePill(value, current, label) {
  return el('button', { class: `pill${current === value ? ' selected' : ''}`, onclick: () => { store.updateSettings({ theme: value }); applyTheme(value); navigate('settings'); } }, label);
}

function categoriesCard() {
  const cats = store.getCategories();
  const card = el('div', { class: 'card mt-16' }, [
    el('div', { class: 'section-title' }, 'Categories'),
    el('div', { class: 'pill-group' }, cats.map((c) => el('div', { class: 'pill', style: 'cursor:default' }, [
      el('span', { class: 'dot', style: `background:${c.color}` }),
      `${c.icon} ${c.name}`,
      el('button', { class: 'btn-icon', style: 'width:18px;height:18px;font-size:10px;margin-left:6px;background:transparent', onclick: () => { if (confirm(`Remove category "${c.name}"? Tasks keep it, but it won't be selectable for new ones.`)) { store.deleteCategory(c.id); navigate('settings'); } } }, '✕'),
    ]))),
  ]);
  const addRow = el('div', { class: 'row mt-16', style: 'gap:8px' }, [
    el('input', { type: 'text', id: 'new-cat-name', placeholder: 'New category name', style: 'flex:1;border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:var(--bg);color:var(--ink)' }),
    el('input', { type: 'text', id: 'new-cat-icon', placeholder: '🏷️', style: 'width:56px;border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:var(--bg);color:var(--ink);text-align:center' }),
    el('button', { class: 'btn btn-soft btn-sm', onclick: () => {
      const name = document.getElementById('new-cat-name').value.trim();
      const icon = document.getElementById('new-cat-icon').value.trim() || '🏷️';
      if (!name) return;
      store.createCategory({ name, icon, color: randomColor() });
      navigate('settings');
    } }, 'Add'),
  ]);
  card.appendChild(addRow);
  return card;
}

function randomColor() {
  const palette = ['#3454D1', '#6C4CD1', '#2FBF71', '#FF8A3D', '#E5484D', '#D14C8D', '#C08A2E', '#2596B8'];
  return palette[Math.floor(Math.random() * palette.length)];
}

function exportData() {
  const data = store.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dayflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      store.importData(data);
      rescheduleAll();
      alert('Backup restored.');
      navigate('settings');
    } catch (err) {
      alert('That file could not be read as a DayFlow backup.');
    }
  };
  reader.readAsText(file);
}
