// planningAssistant.js — a lightweight, fully local heuristic scheduler.
// It is deliberately rule-based (no network/model call) so it works fully
// offline; wiring it to a real language model for freer-form input is listed
// as a Future Improvement in the README.

import { el, todayISO, uid, minutesToTime, timeToMinutes } from '../utils.js';
import * as store from '../store.js';
import { rescheduleAll } from '../notifications.js';

function suggestSchedule({ wake, sleep, busyBlocks, studyHours, gymHours, freeText }) {
  const wakeM = timeToMinutes(wake);
  const sleepM = timeToMinutes(sleep);
  const plan = [];
  plan.push({ time: wake, title: 'Wake up', category: 'personal', duration: 30 });
  plan.push({ time: minutesToTime(wakeM + 30), title: 'Exercise', category: 'fitness', duration: 30 });
  plan.push({ time: minutesToTime(wakeM + 60), title: 'Breakfast', category: 'personal', duration: 30 });

  // sort busy blocks and slot free time around them
  const sorted = [...busyBlocks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  let cursor = wakeM + 90;
  const freeWindows = [];
  for (const block of sorted) {
    const s = timeToMinutes(block.start), e = timeToMinutes(block.end);
    if (s > cursor) freeWindows.push([cursor, s]);
    cursor = Math.max(cursor, e);
    plan.push({ time: block.start, title: block.title, category: block.category || 'work', duration: e - s, fixed: true });
  }
  if (cursor < sleepM) freeWindows.push([cursor, sleepM]);

  const wants = [];
  if (studyHours > 0) wants.push({ title: 'Study', category: 'study', minutes: studyHours * 60 });
  if (gymHours > 0) wants.push({ title: 'Gym', category: 'fitness', minutes: gymHours * 60 });
  if (freeText) wants.push({ title: freeText, category: 'other', minutes: 60 });
  wants.push({ title: 'Rest', category: 'personal', minutes: 30 });
  wants.push({ title: 'Dinner', category: 'personal', minutes: 45 });

  for (const want of wants) {
    const winIdx = freeWindows.findIndex(([s, e]) => e - s >= want.minutes);
    if (winIdx === -1) continue;
    const [s, e] = freeWindows[winIdx];
    plan.push({ time: minutesToTime(s), title: want.title, category: want.category, duration: want.minutes });
    const newStart = s + want.minutes;
    freeWindows[winIdx] = newStart < e ? [newStart, e] : null;
    if (!freeWindows[winIdx]) freeWindows.splice(winIdx, 1);
    else freeWindows[winIdx] = [newStart, e];
  }

  return plan.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

export function openPlanningAssistant({ onSaved = () => {} } = {}) {
  const settings = store.getSettings();
  const backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } });
  const modal = el('div', { class: 'modal', style: 'max-width:560px' });
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  function close() { backdrop.remove(); }

  const form = {
    wake: settings.wakeTime, sleep: settings.sleepTime,
    busyStart: '09:00', busyEnd: '16:00', busyTitle: 'College',
    studyHours: 2, gymHours: 1, freeText: 'Finish assignment',
  };
  let plan = null;

  function paint() {
    modal.innerHTML = '';
    modal.append(
      el('div', { class: 'modal-header' }, [
        el('h3', { class: 'modal-title' }, '🧭 Daily planning assistant'),
        el('button', { class: 'btn-icon', onclick: close }, '✕'),
      ]),
      el('p', { class: 'muted', style: 'font-size:13px;margin-bottom:14px' }, 'Tell DayFlow what\u2019s fixed today and what you need to fit in — it\u2019ll suggest a full schedule you can tweak before saving.'),
      el('div', { class: 'field-row' }, [
        el('div', { class: 'field' }, [el('label', {}, 'Wake up'), el('input', { type: 'time', value: form.wake, oninput: (e) => (form.wake = e.target.value) })]),
        el('div', { class: 'field' }, [el('label', {}, 'Sleep'), el('input', { type: 'time', value: form.sleep, oninput: (e) => (form.sleep = e.target.value) })]),
      ]),
      el('div', { class: 'field' }, [el('label', {}, 'Fixed commitment (e.g. college, work)'), el('input', { type: 'text', value: form.busyTitle, oninput: (e) => (form.busyTitle = e.target.value) })]),
      el('div', { class: 'field-row' }, [
        el('div', { class: 'field' }, [el('label', {}, 'From'), el('input', { type: 'time', value: form.busyStart, oninput: (e) => (form.busyStart = e.target.value) })]),
        el('div', { class: 'field' }, [el('label', {}, 'To'), el('input', { type: 'time', value: form.busyEnd, oninput: (e) => (form.busyEnd = e.target.value) })]),
      ]),
      el('div', { class: 'field-row' }, [
        el('div', { class: 'field' }, [el('label', {}, 'Study hours needed'), el('input', { type: 'number', min: '0', step: '0.5', value: form.studyHours, oninput: (e) => (form.studyHours = Number(e.target.value)) })]),
        el('div', { class: 'field' }, [el('label', {}, 'Gym hours needed'), el('input', { type: 'number', min: '0', step: '0.5', value: form.gymHours, oninput: (e) => (form.gymHours = Number(e.target.value)) })]),
      ]),
      el('div', { class: 'field' }, [el('label', {}, 'Anything else to fit in?'), el('input', { type: 'text', value: form.freeText, oninput: (e) => (form.freeText = e.target.value) })]),
      el('button', { class: 'btn btn-soft btn-block', onclick: () => {
        plan = suggestSchedule({
          wake: form.wake, sleep: form.sleep,
          busyBlocks: [{ start: form.busyStart, end: form.busyEnd, title: form.busyTitle, category: 'work' }],
          studyHours: form.studyHours, gymHours: form.gymHours, freeText: form.freeText,
        });
        paint();
      } }, '✨ Suggest a schedule'),
    );

    if (plan) {
      const list = el('div', { class: 'timeline mt-16' });
      plan.forEach((p) => {
        list.appendChild(el('div', { class: 'timeline-item' }, [
          el('div', { class: 'timeline-time' }, p.time),
          el('div', { class: 'timeline-dot-col' }, [el('div', { class: 'timeline-dot' })]),
          el('div', { class: 'timeline-body' }, [el('div', { class: 'timeline-title' }, p.title)]),
        ]));
      });
      modal.appendChild(list);
      modal.appendChild(el('div', { class: 'row', style: 'justify-content:flex-end;margin-top:16px;gap:10px' }, [
        el('button', { class: 'btn btn-ghost', onclick: close }, 'Discard'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          plan.forEach((p) => {
            store.createTask({
              title: p.title, date: todayISO(), startTime: p.time, category: p.category,
              priority: 'medium', reminders: [{ id: uid('rem'), offsetMinutes: 10 }],
            });
          });
          rescheduleAll();
          close();
          onSaved();
        } }, 'Save this plan to today'),
      ]));
    }
  }

  paint();
}
