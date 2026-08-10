import { el } from '../utils.js';
import * as store from '../store.js';
import { db } from '../db.js';
import { requestPermission } from '../notifications.js';
import { openTaskModal } from './taskModal.js';

const FOCUS_OPTIONS = [
  { id: 'study', label: '📚 Study' },
  { id: 'work', label: '💼 Work' },
  { id: 'fitness', label: '🏋️ Fitness' },
  { id: 'personal', label: '🏠 Personal' },
  { id: 'everything', label: '✨ Everything' },
];

export function runOnboarding(onDone) {
  const chosenFocus = new Set();
  let step = 0;

  const backdrop = el('div', { class: 'onboard-backdrop' });
  document.body.appendChild(backdrop);

  const steps = [welcomeStep, focusStep, notifStep, firstTaskStep];

  function paint() {
    backdrop.innerHTML = '';
    const card = el('div', { class: 'onboard-card' });
    card.appendChild(steps[step]());
    card.appendChild(el('div', { class: 'onboard-dots' }, steps.map((_, i) => el('span', { class: i === step ? 'active' : '' }))));
    backdrop.appendChild(card);
  }

  function next() { step = Math.min(step + 1, steps.length - 1); paint(); }
  function finish() {
    store.updateSettings({ onboardingFocus: [...chosenFocus] });
    db.setOnboarded(true);
    backdrop.remove();
    onDone();
  }

  function welcomeStep() {
    return el('div', {}, [
      el('div', { class: 'onboard-mark' }, 'DF'),
      el('h2', {}, 'Welcome to DayFlow 👋'),
      el('p', { class: 'muted mt-8' }, 'Your day, planned, tracked, and never forgotten. Let\u2019s set a few things up — it takes less than a minute.'),
      el('button', { class: 'btn btn-primary btn-block mt-24', onclick: next }, 'Get started'),
    ]);
  }

  function focusStep() {
    return el('div', {}, [
      el('h2', {}, 'What do you want to organize?'),
      el('p', { class: 'muted mt-8' }, 'Pick as many as you like — this just tailors your default categories.'),
      el('div', { class: 'pill-group', style: 'justify-content:center;margin-top:18px' }, FOCUS_OPTIONS.map((opt) =>
        el('button', {
          class: `pill${chosenFocus.has(opt.id) ? ' selected' : ''}`,
          onclick: (e) => {
            chosenFocus.has(opt.id) ? chosenFocus.delete(opt.id) : chosenFocus.add(opt.id);
            e.target.classList.toggle('selected');
          },
        }, opt.label)
      )),
      el('button', { class: 'btn btn-primary btn-block mt-24', onclick: next }, 'Continue'),
    ]);
  }

  function notifStep() {
    return el('div', {}, [
      el('h2', {}, 'Enable notifications?'),
      el('p', { class: 'muted mt-8' }, 'DayFlow reminds you before things start. You can fine-tune timing per task later.'),
      el('div', { class: 'row', style: 'flex-direction:column;gap:10px;margin-top:20px' }, [
        el('button', { class: 'btn btn-primary btn-block', onclick: async () => { await requestPermission(); next(); } }, 'Enable notifications'),
        el('button', { class: 'btn btn-ghost btn-block', onclick: next }, 'Maybe later'),
      ]),
    ]);
  }

  function firstTaskStep() {
    return el('div', {}, [
      el('h2', {}, 'Create your first task'),
      el('p', { class: 'muted mt-8' }, 'Add something you\u2019ve got planned today — you can always add more from the dashboard.'),
      el('div', { class: 'row', style: 'flex-direction:column;gap:10px;margin-top:20px' }, [
        el('button', { class: 'btn btn-primary btn-block', onclick: () => {
          openTaskModal({ onSaved: finish });
        } }, '+ Add a task'),
        el('button', { class: 'btn btn-ghost btn-block', onclick: finish }, 'Skip for now'),
      ]),
    ]);
  }

  paint();
}
