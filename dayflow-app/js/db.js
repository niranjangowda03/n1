// db.js — thin persistence layer over localStorage.
// Every read/write goes through here so storage can later be swapped
// for IndexedDB or a cloud sync backend without touching the UI code.

const KEYS = {
  tasks: 'dayflow_tasks_v1',
  notes: 'dayflow_notes_v1',
  categories: 'dayflow_categories_v1',
  settings: 'dayflow_settings_v1',
  notificationLog: 'dayflow_notification_log_v1',
  onboarded: 'dayflow_onboarded_v1',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error('DayFlow storage read failed for', key, e);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('DayFlow storage write failed for', key, e);
    return false;
  }
}

export const DEFAULT_CATEGORIES = [
  { id: 'study', name: 'Study', icon: '📚', color: '#3454D1' },
  { id: 'work', name: 'Work', icon: '💼', color: '#6C4CD1' },
  { id: 'personal', name: 'Personal', icon: '🏠', color: '#2FBF71' },
  { id: 'fitness', name: 'Fitness', icon: '🏋️', color: '#FF8A3D' },
  { id: 'health', name: 'Health', icon: '💊', color: '#E5484D' },
  { id: 'family', name: 'Family', icon: '👨‍👩‍👦', color: '#D14C8D' },
  { id: 'shopping', name: 'Shopping', icon: '🛒', color: '#C08A2E' },
  { id: 'travel', name: 'Travel', icon: '✈️', color: '#2596B8' },
  { id: 'other', name: 'Other', icon: '✨', color: '#7A8296' },
];

export const DEFAULT_SETTINGS = {
  name: '',
  startDay: 1, // Monday
  timeFormat: '12h',
  dateFormat: 'DD/MM/YYYY',
  theme: 'system', // 'light' | 'dark' | 'system'
  wakeTime: '07:00',
  sleepTime: '23:00',
  notifications: {
    enabled: true,
    defaultReminder: 15,
    sound: true,
    vibration: true,
    quietHoursEnabled: false,
    quietStart: '22:00',
    quietEnd: '07:00',
  },
  pinLock: { enabled: false, pin: '' },
  onboardingFocus: [],
};

export const db = {
  getTasks: () => read(KEYS.tasks, []),
  saveTasks: (tasks) => write(KEYS.tasks, tasks),

  getNotes: () => read(KEYS.notes, []),
  saveNotes: (notes) => write(KEYS.notes, notes),

  getCategories: () => read(KEYS.categories, DEFAULT_CATEGORIES),
  saveCategories: (cats) => write(KEYS.categories, cats),

  getSettings: () => ({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) }),
  saveSettings: (settings) => write(KEYS.settings, settings),

  getNotificationLog: () => read(KEYS.notificationLog, []),
  saveNotificationLog: (log) => write(KEYS.notificationLog, log.slice(-200)),

  isOnboarded: () => read(KEYS.onboarded, false),
  setOnboarded: (v) => write(KEYS.onboarded, v),

  exportAll: () => ({
    tasks: read(KEYS.tasks, []),
    notes: read(KEYS.notes, []),
    categories: read(KEYS.categories, DEFAULT_CATEGORIES),
    settings: read(KEYS.settings, {}),
    notificationLog: read(KEYS.notificationLog, []),
    exportedAt: new Date().toISOString(),
    version: 1,
  }),

  importAll: (data) => {
    if (!data || typeof data !== 'object') throw new Error('Invalid backup file');
    if (Array.isArray(data.tasks)) write(KEYS.tasks, data.tasks);
    if (Array.isArray(data.notes)) write(KEYS.notes, data.notes);
    if (Array.isArray(data.categories)) write(KEYS.categories, data.categories);
    if (data.settings) write(KEYS.settings, data.settings);
    if (Array.isArray(data.notificationLog)) write(KEYS.notificationLog, data.notificationLog);
  },

  wipeAll: () => Object.values(KEYS).forEach((k) => localStorage.removeItem(k)),
};
