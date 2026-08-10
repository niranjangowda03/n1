# DayFlow — Daily Planner & Smart Schedule

A complete, offline-first daily planner: dashboard, timetable, tasks, notes,
quick reminders, recurring activities, day/week/month calendar, progress
tracking, statistics, search, categories, a rule-based planning assistant,
and full notification handling — all running client-side with no account
and no server required.

## Why a web app instead of React Native/Expo

The brief's default stack was React Native + Expo. This build environment
has no network access to `npm install` Expo/React Native packages and no
mobile simulator to run or screenshot the result — building that stack here
would produce code that could never actually be run or verified. A
vanilla JS **Progressive Web App** was used instead because it:

- Needs **zero install step** — every dependency is a `<link>`/CDN font, so it
  runs the moment you open `index.html`, and works completely offline after
  the first load (fonts cached by the browser; see `sw.js`).
- Is genuinely cross-platform: the same code runs on Android, iPhone,
  tablet, and desktop in the browser, and can be **installed to the home
  screen** (Settings → "Add to Home Screen" on iOS/Android, or the install
  icon in Chrome/Edge) so it opens full-screen like a native app.
- Maps cleanly onto everything the brief asked for — local storage,
  local notifications, offline support, responsive layout — without
  needing build tooling this sandbox can't run.

If you do want a true native app later, this codebase's data layer
(`js/db.js`, `js/store.js`) is UI-framework-agnostic and the screens map
1:1 onto React Native equivalents, so porting is mostly a UI rewrite, not a
redesign.

## Running it locally

Browsers block ES module imports over `file://`, so serve the folder over
plain HTTP (no build step, no dependencies to install):

```bash
cd dayflow-app
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

Any static server works equally well, e.g. `npx serve .` (if you have Node
+ npm) or the VS Code "Live Server" extension.

To install as an app: open the site in Chrome/Edge on desktop or Android
and use "Install app" from the address-bar/menu, or "Add to Home Screen"
in Safari on iOS.

## Project structure

```
dayflow-app/
├── index.html              # entry point, loads fonts + styles + app.js
├── manifest.json            # PWA metadata (name, icons, colors)
├── sw.js                    # service worker: caches the shell for offline use
├── icons/icon.svg           # app icon / logo
├── css/styles.css           # design tokens, layout, components (light+dark)
└── js/
    ├── app.js               # boot: shell, nav, routing, PIN-lock gate
    ├── router.js             # tiny hash router
    ├── db.js                 # localStorage read/write, defaults, backup/restore
    ├── store.js               # app state: CRUD, progress, streaks, conflicts, search
    ├── recurrence.js         # repeat-rule evaluation (daily/weekly/custom/etc.)
    ├── notifications.js      # reminder scheduling + native/toast notifications
    ├── theme.js               # light/dark/system theme switching
    ├── utils.js               # date/time formatting, id generation, DOM helper
    ├── components/
    │   ├── taskModal.js       # add/edit task (full field set, reminders, repeat)
    │   ├── quickReminder.js   # "Call Dad at 8 PM" fast capture
    │   ├── onboarding.js      # first-run welcome flow
    │   └── planningAssistant.js # rule-based "plan my day" suggester
    └── views/
        ├── dashboard.js        # Today screen
        ├── timetable.js        # per-day schedule, drag-and-drop, duplicate
        ├── calendar.js         # day / week / month views
        ├── notes.js            # notes CRUD, pin/favorite, search, categories
        ├── stats.js            # productivity statistics
        ├── settings.js         # general/notifications/appearance/data/privacy
        ├── search.js           # global search
        └── notificationCenter.js
```

Nothing here is one giant file — each concern (storage, recurrence rules,
notification timing, each screen) lives in its own module and imports only
what it needs.

## How notifications work

Every reminder is computed as **Task Time − Reminder Time = Notification
Time**. On load, and whenever a task changes, `notifications.js` scans the
next 3 days of occurrences (recurring tasks included) and arms a `setTimeout`
for each still-pending reminder inside a 48-hour window. When a timer fires:

1. If the browser has notification permission, a native `Notification` is
   shown (title = task name, body = start time/location).
2. Otherwise, an in-app toast appears in the corner.
3. The event is logged to a local notification history (visible in the
   Notification Center) so missed/delivered reminders are never silently lost.

Rescheduling runs again automatically every 5 minutes, which is also what
absorbs **device clock changes, DST transitions, and day rollover** without
needing the app to be closed and reopened.

## How data is stored

Everything — tasks, notes, categories, settings, notification history — is
stored in the browser's `localStorage` as JSON, namespaced under
`dayflow_*` keys (see `js/db.js`). Recurring tasks are stored **once**;
occurrences on the calendar are computed on the fly from their repeat rule,
so editing a recurring task's title updates every future occurrence
instantly. Completion is tracked per-occurrence (`completedDates: [iso, ...]`)
so a "study every weekday" task can be done on Monday and still pending on
Tuesday. Settings → Data lets you export the whole dataset to a JSON file
and re-import it later (used as backup/restore, and as the migration path
to a future cloud sync backend).

## Known limitations

- **Background notifications need the tab (or installed app) to still be
  running.** Browsers cannot wake a fully-closed tab on their own; real
  "phone asleep, app closed" push notifications need a server-side push
  service (e.g. Web Push + a backend), which is out of scope for a
  no-account, fully local v1. This is called out directly at the top of
  `notifications.js`.
- Drag-and-drop in the timetable currently **swaps** the times of the two
  tasks you drop onto each other, rather than doing free-form resizing —
  a simpler, less error-prone interaction than true pixel-based resizing.
- The "Daily Planning Assistant" is a deterministic, rule-based scheduler
  (fits fixed commitments, then packs study/gym/custom time into the gaps)
  rather than a language-model-based planner, so it works fully offline
  with no API key or network call.
- Biometric unlock is not implemented; PIN lock is, and is described as the
  fallback biometrics would use, per the original spec's phrasing.

## Future improvements (already designed for)

- Swap `js/db.js` for an API-backed store to add multi-device cloud sync —
  every other module talks to `store.js`, not `localStorage`, directly.
- Server-side Web Push for true background notifications.
- Google Calendar / Google Tasks import-export.
- Habit tracker and Pomodoro timer as new `views/` modules.
- Natural-language task creation ("remind me to call mom every Sunday at 6")
  by extending `quickReminder.js`'s parser.
- Home-screen widgets once wrapped in a native shell (Capacitor/Tauri would
  both work with this codebase largely unchanged).

## Testing performed

Every JS module was syntax-checked (`node --check`) as part of the build.
Because this environment has no network access or browser binary available,
full interactive testing (clicking through onboarding, adding tasks,
watching a live notification fire, etc.) could not be executed here —
please do a quick pass after opening it locally, and use the browser
console to report anything that looks wrong.
