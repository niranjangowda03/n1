// recurrence.js — decides whether a task occurs on a given date.
// Recurring tasks are stored once and "occur" virtually; nothing is duplicated in storage.

import { dayOfWeek, parseISODate } from './utils.js';

// repeat = { type: 'none'|'daily'|'weekdays'|'weekends'|'weekly'|'monthly'|'custom',
//            days: [0-6] (for weekly/custom), interval: number (for custom, in days), until: iso|null }
export function occursOn(task, iso) {
  if (iso < task.date) return false;
  const rule = task.repeat || { type: 'none' };
  if (rule.until && iso > rule.until) return false;

  if (rule.type === 'none' || !rule.type) return iso === task.date;

  const dow = dayOfWeek(iso);
  switch (rule.type) {
    case 'daily':
      return true;
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'weekends':
      return dow === 0 || dow === 6;
    case 'weekly':
      return dow === dayOfWeek(task.date);
    case 'custom-days':
      return (rule.days || []).includes(dow);
    case 'monthly': {
      const start = parseISODate(task.date);
      const cur = parseISODate(iso);
      return start.getDate() === cur.getDate();
    }
    case 'custom-interval': {
      const start = parseISODate(task.date);
      const cur = parseISODate(iso);
      const diffDays = Math.round((cur - start) / 86400000);
      const interval = Math.max(1, rule.interval || 1);
      return diffDays >= 0 && diffDays % interval === 0;
    }
    default:
      return iso === task.date;
  }
}

export function repeatLabel(repeat) {
  if (!repeat || repeat.type === 'none') return 'Does not repeat';
  const labels = {
    daily: 'Every day',
    weekdays: 'Every weekday',
    weekends: 'Every weekend',
    weekly: 'Every week',
    monthly: 'Every month',
    'custom-days': 'Custom days',
    'custom-interval': `Every ${repeat.interval || 1} day(s)`,
  };
  return labels[repeat.type] || 'Custom';
}

// Return every task instance (as {task, date}) touching the [startIso, endIso] window.
export function occurrencesInRange(tasks, startIso, endIso) {
  const out = [];
  for (const task of tasks) {
    let cursor = task.date > startIso ? task.date : startIso;
    // cap the scan so an unbounded daily task from years ago doesn't loop forever
    let guard = 0;
    while (cursor <= endIso && guard < 400) {
      if (occursOn(task, cursor)) out.push({ task, date: cursor });
      cursor = addDaysLocal(cursor);
      guard++;
    }
  }
  return out;
}

function addDaysLocal(iso) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
