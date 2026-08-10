import { el, todayISO, addDays, WEEKDAY_SHORT, dayOfWeek, parseISODate } from '../utils.js';
import * as store from '../store.js';

export function renderStats(root) {
  const today = todayISO();
  const weekStart = addDays(today, -6);
  const monthStart = addDays(today, -29);

  const weekStats = store.getRangeStats(weekStart, today);
  const monthStats = store.getRangeStats(monthStart, today);
  const todayStats = store.getRangeStats(today, today);
  const streak = store.getStreak();

  // most productive day of week & time-of-day, derived from completed occurrences
  const dowCounts = new Array(7).fill(0);
  const hourCounts = {};
  for (const task of store.getAllTasks()) {
    for (const d of task.completedDates) {
      dowCounts[dayOfWeek(d)]++;
      const hour = parseInt((task.startTime || '00:00').split(':')[0], 10);
      const bucket = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
      hourCounts[bucket] = (hourCounts[bucket] || 0) + 1;
    }
  }
  const bestDowIdx = dowCounts.indexOf(Math.max(...dowCounts));
  const bestDow = Math.max(...dowCounts) > 0 ? WEEKDAY_SHORT[bestDowIdx] : '—';
  const bestTime = Object.keys(hourCounts).length ? Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0] : '—';

  let longestStreak = computeLongestStreak();

  root.appendChild(el('h2', { class: 'mt-8' }, 'Statistics'));

  root.appendChild(el('div', { class: 'card mt-16' }, [
    el('div', { class: 'section-title' }, 'Overview'),
    el('div', { class: 'stats-grid' }, [
      statTile(`${todayStats.completed}/${todayStats.total}`, 'Completed today'),
      statTile(`${weekStats.percent}%`, 'This week'),
      statTile(`${monthStats.percent}%`, 'This month'),
      statTile(String(streak), 'Current streak 🔥'),
      statTile(String(longestStreak), 'Longest streak'),
    ]),
  ]));

  root.appendChild(el('div', { class: 'card mt-16' }, [
    el('div', { class: 'section-title' }, 'Last 7 days'),
    weekBarChart(weekStart, today),
  ]));

  root.appendChild(el('div', { class: 'card mt-16' }, [
    el('div', { class: 'section-title' }, 'Patterns'),
    el('div', { class: 'stats-grid' }, [
      statTile(bestDow, 'Most productive day'),
      statTile(bestTime, 'Most productive time'),
    ]),
  ]));
}

function statTile(num, label) {
  return el('div', { class: 'stat-chip' }, [el('div', { class: 'num' }, num), el('div', { class: 'lbl' }, label)]);
}

function weekBarChart(startIso, endIso) {
  const chart = el('div', { class: 'bar-chart' });
  let cursor = startIso;
  while (cursor <= endIso) {
    const p = store.getDayProgress(cursor);
    const heightPct = Math.max(4, p.percent);
    chart.appendChild(el('div', { class: 'bar-col' }, [
      el('div', { class: 'bar', style: `height:${heightPct}%` }),
      el('div', { class: 'bar-label' }, WEEKDAY_SHORT[dayOfWeek(cursor)]),
    ]));
    cursor = addDays(cursor, 1);
  }
  return chart;
}

function computeLongestStreak() {
  let longest = 0, current = 0;
  let cursor = addDays(todayISO(), -180);
  const end = todayISO();
  while (cursor <= end) {
    const p = store.getDayProgress(cursor);
    if (p.total > 0 && p.percent === 100) { current++; longest = Math.max(longest, current); }
    else if (p.total > 0) { current = 0; }
    cursor = addDays(cursor, 1);
  }
  return longest;
}
