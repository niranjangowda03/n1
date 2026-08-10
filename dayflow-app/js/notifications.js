// notifications.js — computes "Task Time − Reminder Time = Notification Time"
// for every task/reminder in the near future, and fires either a native
// browser Notification or an in-app toast when that moment arrives.
//
// LIMITATION (documented, not hidden): browser tabs cannot wake themselves
// up once fully closed. Timers below only fire while DayFlow is open in a
// tab (or, on platforms that support it, while installed as a PWA that the
// OS keeps in memory). True "phone is asleep, app is closed" push
// notifications require a server-side push service, listed under Future
// Improvements in the README.

import { db } from './db.js';
import { getAllTasks, isCompletedOn } from './store.js';
import { combineDateTime, timeToMinutes, minutesToTime, todayISO, addDays } from './utils.js';
import { occurrencesInRange } from './recurrence.js';

const scheduled = new Map(); // key -> timeoutId
let toastHost = null;
let permissionState = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

export function initNotifications(hostEl) {
  toastHost = hostEl;
  rescheduleAll();
}

export async function requestPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  const result = await Notification.requestPermission();
  permissionState = result;
  return result;
}

export function getPermissionState() { return permissionState; }

// Reminder offsets in minutes; 'custom' reminders carry an explicit time string.
function reminderTimestamps(task, occurrenceIso) {
  const taskMoment = combineDateTime(occurrenceIso, task.startTime);
  const out = [];
  for (const rem of task.reminders || []) {
    if (rem.type === 'custom' && rem.customTime) {
      out.push({ id: rem.id, when: combineDateTime(occurrenceIso, rem.customTime), label: 'Custom reminder' });
    } else if (rem.type === 'at_time') {
      out.push({ id: rem.id, when: taskMoment, label: 'Starting now' });
    } else if (typeof rem.offsetMinutes === 'number') {
      const when = new Date(taskMoment.getTime() - rem.offsetMinutes * 60000);
      out.push({ id: rem.id, when, label: `${rem.offsetMinutes} min before` });
    }
  }
  return out;
}

function isQuietHours(date, settings) {
  const n = settings.notifications;
  if (!n.quietHoursEnabled) return false;
  const mins = date.getHours() * 60 + date.getMinutes();
  const start = timeToMinutes(n.quietStart);
  const end = timeToMinutes(n.quietEnd);
  if (start === end) return false;
  if (start < end) return mins >= start && mins < end;
  return mins >= start || mins < end; // wraps past midnight
}

export function rescheduleAll() {
  scheduled.forEach((id) => clearTimeout(id));
  scheduled.clear();

  const settings = db.getSettings();
  if (!settings.notifications.enabled) return;

  const tasks = getAllTasks();
  const start = todayISO();
  const end = addDays(start, 3); // look 3 days ahead; re-run on every data change
  const occurrences = occurrencesInRange(tasks, start, end);
  const now = Date.now();
  const HORIZON_MS = 1000 * 60 * 60 * 48; // only actually arm timers within 48h (setTimeout ceiling safety)

  for (const { task, date } of occurrences) {
    if (isCompletedOn(task, date)) continue;
    if ((task.skippedDates || []).includes(date)) continue;
    for (const reminder of reminderTimestamps(task, date)) {
      const delay = reminder.when.getTime() - now;
      if (delay < -60000 || delay > HORIZON_MS) continue; // skip stale/far-future
      const key = `${task.id}__${date}__${reminder.id}`;
      const timeoutId = setTimeout(() => fire(task, date, reminder, settings), Math.max(0, delay));
      scheduled.set(key, timeoutId);
    }
  }
}

function fire(task, date, reminder, settings) {
  const now = new Date();
  if (isQuietHours(now, settings)) {
    logEvent(task, date, reminder, 'suppressed-quiet-hours');
    return;
  }
  const title = `🔔 ${task.title}`;
  const body = reminder.label === 'Starting now'
    ? `Starting now${task.location ? ' · ' + task.location : ''}`
    : `Starts at ${task.startTime}${task.location ? ' · ' + task.location : ''}`;

  if (permissionState === 'granted' && typeof Notification !== 'undefined') {
    try {
      const n = new Notification(title, { body, tag: `${task.id}_${date}`, silent: !settings.notifications.sound });
      n.onclick = () => window.focus();
    } catch (e) {
      showToast(title, body);
    }
  } else {
    showToast(title, body);
  }
  if (settings.notifications.vibration && navigator.vibrate) navigator.vibrate([120, 60, 120]);
  logEvent(task, date, reminder, 'delivered');
}

function logEvent(task, date, reminder, status) {
  const log = db.getNotificationLog();
  log.push({
    id: `${task.id}_${date}_${reminder.id}`,
    taskId: task.id,
    title: task.title,
    date,
    time: task.startTime,
    label: reminder.label,
    status,
    firedAt: new Date().toISOString(),
  });
  db.saveNotificationLog(log);
}

export function showToast(title, body) {
  if (!toastHost) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<div class="toast-title">${title}</div><div class="toast-body">${body}</div>`;
  toastHost.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 6000);
}

export function missedReminderCount() {
  return db.getNotificationLog().filter((e) => e.status === 'delivered').length;
}
