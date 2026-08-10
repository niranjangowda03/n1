// store.js — single source of truth. Everything reads/writes through this
// module; views subscribe and re-render when data changes.

import { db } from './db.js';
import { uid, todayISO, timeToMinutes, addDays } from './utils.js';
import { occursOn, occurrencesInRange } from './recurrence.js';

let tasks = db.getTasks();
let notes = db.getNotes();
let categories = db.getCategories();
let settings = db.getSettings();

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn()); }

// ---------- Tasks ----------
export function getAllTasks() { return tasks; }

export function getTasksForDate(iso) {
  return tasks.filter((t) => occursOn(t, iso)).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

export function getOccurrences(startIso, endIso) {
  return occurrencesInRange(tasks, startIso, endIso);
}

export function createTask(data) {
  const now = new Date().toISOString();
  const task = {
    id: uid('task'),
    title: data.title?.trim() || 'Untitled task',
    description: data.description || '',
    date: data.date || todayISO(),
    startTime: data.startTime || '09:00',
    endTime: data.endTime || '',
    category: data.category || 'other',
    priority: data.priority || 'medium',
    location: data.location || '',
    reminders: data.reminders || [],
    repeat: data.repeat || { type: 'none' },
    completedDates: [],
    skippedDates: [],
    createdAt: now,
    updatedAt: now,
  };
  tasks.push(task);
  persistTasks();
  return task;
}

export function updateTask(id, patch) {
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...patch, updatedAt: new Date().toISOString() };
  persistTasks();
  return tasks[idx];
}

export function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  persistTasks();
}

export function duplicateTask(id) {
  const original = tasks.find((t) => t.id === id);
  if (!original) return null;
  const { id: _drop, completedDates, createdAt, updatedAt, ...rest } = original;
  return createTask({ ...rest, title: `${original.title} (copy)` });
}

export function toggleTaskCompletion(id, iso) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  const has = task.completedDates.includes(iso);
  task.completedDates = has
    ? task.completedDates.filter((d) => d !== iso)
    : [...task.completedDates, iso];
  task.updatedAt = new Date().toISOString();
  persistTasks();
}

export function isCompletedOn(task, iso) {
  return task.completedDates.includes(iso);
}

export function rescheduleOccurrence(id, fromIso, toIso, toTime) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  if (task.repeat?.type && task.repeat.type !== 'none') {
    // Skip the old occurrence, create a standalone task on the new date.
    task.skippedDates = [...(task.skippedDates || []), fromIso];
    persistTasks();
    createTask({ ...task, date: toIso, startTime: toTime || task.startTime, repeat: { type: 'none' } });
  } else {
    updateTask(id, { date: toIso, startTime: toTime || task.startTime });
  }
}

function persistTasks() { db.saveTasks(tasks); emit(); }

// ---------- Missed & conflicts ----------
export function getMissedOccurrences(referenceIso = todayISO()) {
  const nowIso = todayISO();
  const nowMinutes = timeToMinutes(new Date().toTimeString().slice(0, 5));
  const missed = [];
  // scan back 14 days for anything overdue and not completed
  const startIso = addDays(referenceIso, -14);
  for (const { task, date } of occurrencesInRange(tasks, startIso, referenceIso)) {
    if ((task.skippedDates || []).includes(date)) continue;
    if (isCompletedOn(task, date)) continue;
    const isPastDay = date < nowIso;
    const isTodayPastTime = date === nowIso && timeToMinutes(task.startTime) < nowMinutes - 5;
    if (isPastDay || isTodayPastTime) missed.push({ task, date });
  }
  return missed;
}

export function getConflicts(iso) {
  const todays = getTasksForDate(iso).filter((t) => t.endTime);
  const conflicts = [];
  for (let i = 0; i < todays.length; i++) {
    for (let j = i + 1; j < todays.length; j++) {
      const a = todays[i], b = todays[j];
      const aStart = timeToMinutes(a.startTime), aEnd = timeToMinutes(a.endTime);
      const bStart = timeToMinutes(b.startTime), bEnd = timeToMinutes(b.endTime);
      if (aStart < bEnd && bStart < aEnd) conflicts.push([a, b]);
    }
  }
  return conflicts;
}

// ---------- Progress & stats ----------
export function getDayProgress(iso) {
  const items = getTasksForDate(iso);
  const total = items.length;
  const completed = items.filter((t) => isCompletedOn(t, iso)).length;
  return { total, completed, pending: total - completed, percent: total ? Math.round((completed / total) * 100) : 0 };
}

export function getStreak() {
  let streak = 0;
  let cursor = todayISO();
  // A day "counts" if it had at least one task and all tasks on it were completed.
  for (let i = 0; i < 365; i++) {
    const p = getDayProgress(cursor);
    if (p.total === 0) { cursor = addDays(cursor, -1); if (i === 0) continue; else break; }
    if (p.percent === 100) { streak++; cursor = addDays(cursor, -1); }
    else break;
  }
  return streak;
}

export function getRangeStats(startIso, endIso) {
  let total = 0, completed = 0;
  const perDay = {};
  for (const { task, date } of occurrencesInRange(tasks, startIso, endIso)) {
    total++;
    perDay[date] = perDay[date] || { total: 0, completed: 0 };
    perDay[date].total++;
    if (isCompletedOn(task, date)) { completed++; perDay[date].completed++; }
  }
  return { total, completed, percent: total ? Math.round((completed / total) * 100) : 0, perDay };
}

// ---------- Notes ----------
export function getAllNotes() { return notes; }

export function createNote(data) {
  const now = new Date().toISOString();
  const note = {
    id: uid('note'),
    title: data.title?.trim() || 'Untitled note',
    content: data.content || '',
    category: data.category || 'other',
    pinned: !!data.pinned,
    favorite: !!data.favorite,
    createdAt: now,
    updatedAt: now,
  };
  notes.push(note);
  persistNotes();
  return note;
}

export function updateNote(id, patch) {
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  notes[idx] = { ...notes[idx], ...patch, updatedAt: new Date().toISOString() };
  persistNotes();
  return notes[idx];
}

export function deleteNote(id) { notes = notes.filter((n) => n.id !== id); persistNotes(); }

function persistNotes() { db.saveNotes(notes); emit(); }

// ---------- Categories ----------
export function getCategories() { return categories; }
export function getCategory(id) { return categories.find((c) => c.id === id) || categories.find((c) => c.id === 'other'); }

export function createCategory(data) {
  const cat = { id: uid('cat'), name: data.name, icon: data.icon || '🏷️', color: data.color || '#3454D1' };
  categories.push(cat);
  db.saveCategories(categories);
  emit();
  return cat;
}

export function deleteCategory(id) {
  categories = categories.filter((c) => c.id !== id);
  db.saveCategories(categories);
  emit();
}

// ---------- Settings ----------
export function getSettings() { return settings; }
export function updateSettings(patch) {
  settings = { ...settings, ...patch };
  db.saveSettings(settings);
  emit();
  return settings;
}

// ---------- Search ----------
export function globalSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { tasks: [], notes: [] };
  return {
    tasks: tasks.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
    notes: notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)),
  };
}

// ---------- Backup ----------
export function exportData() { return db.exportAll(); }
export function importData(data) {
  db.importAll(data);
  tasks = db.getTasks();
  notes = db.getNotes();
  categories = db.getCategories();
  settings = db.getSettings();
  emit();
}
export function wipeData() {
  db.wipeAll();
  tasks = []; notes = []; categories = db.getCategories(); settings = db.getSettings();
  emit();
}
