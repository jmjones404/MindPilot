# MindPilot

**Automate the humdrum. Amplify the mind.**

A functional, mobile-first personal organization PWA built with React, TypeScript, Vite, Tailwind CSS, native IndexedDB, and Chart.js. It starts empty: there are no fabricated activities, achievements, or personal memories.

## Run locally

Use Node.js 24, matching the GitHub Actions build.

```sh
cd mindpilot
npm ci
npm run dev
```

Open the printed local address under `/MindPilot/`. `package-lock.json` pins the npm dependency graph used by GitHub Actions. The original pnpm lockfile and workspace configuration are retained for existing pnpm users; deployment uses npm.

```sh
npm run build                        # TypeScript check + optimized app + service worker
npm run preview -- --port 4173        # Open http://localhost:4173/MindPilot/
npm test                             # Domain, storage, and service-worker regression tests
npx playwright install chromium
npm run test:e2e                      # Browser integration tests against the production build
```

The development server deliberately does not register a service worker. Build and preview before testing offline access or installation. The browser tests launch the production preview automatically if it is not already running. To use an existing Chrome executable, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its full path. Test records live in isolated browser contexts and never seed the delivered app.

## What works

- **Home:** local greeting and date, top priorities, upcoming activities, completion ring, natural-language capture, and one-tap completion.
- **MindDump:** basic offline extraction, category suggestions, explicit times, today/tonight/tomorrow, weekdays and ISO dates. Every proposal can be edited or deselected before a transactional confirmation.
- **Planner:** daily and weekly views, editable tasks, priority flags, categories, dates, start times, duration, notes, completion, deletion, and rescheduling. Conflicts include events crossing midnight. Keeping an overlap requires explicit acknowledgement.
- **My Rhythm:** recurring routines, preferred activity times, workout exercises/duration, goals, preferences, category management, and routine check-ins. All personal records are visible, editable, and deletable.
- **Progress:** weekly completion counts, daily planned-day percentages, historical weekly charts, and six weeks of routine consistency. Textual figures accompany the canvas chart.
- **PWA:** standalone manifest, PNG and maskable icons, iOS home-screen metadata, offline app shell, update prompt, local storage persistence request, and install instructions.
- **UX:** responsive desktop sidebar and mobile bottom navigation, touch targets, labelled fields, native modal focus handling, keyboard focus indicators, reduced-motion support, and light/dark/system themes.

## Try predictive workout planning

1. Open **My Rhythm → Review template**.
2. Review the explicitly labelled example: Wednesday / Push workout / 7 PM / 55 minutes / bench press, incline dumbbell press, shoulder press, lateral raises, triceps pushdowns.
3. Save the routine if you want it remembered. It is not saved or assumed before this action.
4. In **MindDump**, enter **“I'm stressed. Need the gym tonight.”**
5. On Wednesday, the matching routine is proposed. On another day, select the saved routine to use it once, or edit your routine schedule. The app never treats Wednesday as the current day unless it really is Wednesday locally.
6. Review the source facts, editable suggested sets/reps, local start time, duration, and any conflicts. If the preferred time has already passed, the planner proposes a future quarter-hour with at least 15 minutes of lead time. If tonight cannot fit the routine, it asks for another date.
7. Edit anything, then **Confirm 1 activity**. Success appears only after IndexedDB commits. Reload to see the saved workout.

If there are no workout preferences, the app asks for them and preserves the unsaved thought while you visit My Rhythm. Workouts need a preferred time and exercise list; no personal history is invented. Exercises use a basic, editable three-set, 8–12-repetition template, not personalized training advice. The automated workout test uses a controlled Wednesday at 5 PM and a conflicting dinner to verify this flow reproducibly.

## What is rules-based, and what needs AI

There is **no connected AI model** and no simulated model response. `OfflineAssistant` uses deliberately limited parsing rules. Workout exercise names, day, time, and duration come from explicitly saved routines; sets and repetitions are transparent defaults. An emotion such as “I'm stressed” is not automatically made into a task.

The `AssistantService` interface separates interpretation from storage. A future AI adapter should call a same-origin **server endpoint**, validate its response into the `Interpretation` contract, identify its provider as `ai`, and return proposals through the existing review UI. Keep all provider keys on the server. Send only the context the user has authorized. Fall back to `OfflineAssistant` on disconnection, timeout, or service errors. An interpretation provider must never save tasks itself.

Free-text goals and preferences are visible memory notes. The current interpreter uses structured workout routines and saved category names; it does not claim to understand every preference note. Ambiguous or unsupported date phrases should be corrected in review. English is the current extraction language.

## Storage and statistics

IndexedDB database `mindpilot-local-v1` contains versioned application data. Each mutation reads the latest state and writes it in a single transaction. This prevents lost writes across tabs and provides all-or-nothing saves for multi-task proposals. A BroadcastChannel and focus refresh keep tabs up to date. The UI reports a write failure and retains the user's draft.

Records stay in this browser and origin. They are not uploaded, synced to another device, or encrypted by the app. Clearing browser storage or using temporary/private browsing can remove them. Moving between localhost and a deployed site uses different storage. The “Request persistent storage” button asks the browser to reduce automatic eviction; it does not provide a backup.

Statistics are defined explicitly:

- **Tasks completed this week:** tasks whose completion timestamp falls within the selected local Monday–Sunday week.
- **Daily/weekly completion:** completed tasks divided by tasks assigned to that day/week. Undated tasks use their completion day, or their creation day while unfinished. Completing a late task updates its scheduled-day completion rate while its actual completion is counted on the day it was marked done.
- **Routine consistency:** explicit check-ins divided by scheduled routine occurrences, starting at creation and ending at today. Routine check-ins are separate from completing scheduled tasks. Current recurrence settings determine expected historical days. Future days do not count.
- Editing or deleting a record recalculates the charts. This MVP does not maintain immutable historical snapshots or an audit log.

## Offline and installation

Open the production app once online and allow it to finish loading. Settings will report that the app is ready offline. The service worker precaches same-origin shell assets and serves them offline; IndexedDB provides all saved activities, routines, schedules, and progress. No external fonts, CDNs, or AI requests are needed at runtime. Update checks run when the app registers its worker, regains focus or connectivity, and hourly while visible. A new build waits for the user's **Update** action so unsaved edits are not interrupted.

Each release uses a cache scoped to this app's URL and fingerprinted from the built assets. Installation rejects failed responses and HTML returned instead of JavaScript or CSS, preserving the last working release. Activation removes this app's obsolete shell caches without touching IndexedDB, preferences, or other projects' caches on the same origin.

On **iPhone/iPad**, open the HTTPS app in Safari, use **Share → Add to Home Screen**, then launch the icon. On **Android**, open it in Chrome and use its install prompt or **Install app / Add to Home screen** menu item. The in-app install button appears when the browser exposes an install prompt. Installation is browser-controlled and may not be offered inside embedded browsers. The installed manifest requests `display: standalone`.

Automated checks cover manifest fields and icon availability, service-worker registration, offline reloads, local edits while offline, storage persistence, mobile overflow, and dark mode. Physical iOS/Android home-screen installation and standalone launch still need a real-device acceptance check; browser emulation cannot prove those OS behaviors.

Manual device check:

1. Load the deployed HTTPS app online, create a task, save a routine, and confirm a workout.
2. Install to the home screen; launch from the icon and check standalone appearance.
3. Enable airplane mode, close and reopen the app, and verify all five screens.
4. Complete/edit an activity offline; reopen and confirm the change remains.
5. Reconnect, load a later build, and verify the update prompt preserves drafts until you choose Update.

## Architecture

```text
src/
  components/     Accessible shared controls and task/memory editors
  screens/        Home, MindDump, Planner, My Rhythm, Progress
  services/       AssistantService, offline interpretation, workout proposals
  lib/            IndexedDB transactions, local dates, conflict checks, statistics
  state.tsx       React state, write feedback, cross-tab refresh, themes
  sw.ts           Explicit versioned precache worker and update handling
  types.ts        Data contracts and validation
tests/
  unit/           Date/parser/planner/progress/storage tests
  e2e/            Complete mobile browser workflows and failure injection
```

## Deploy

GitHub Pages serves this project at **https://jmjones404.github.io/MindPilot/**. The case-sensitive Vite base is `/MindPilot/`; generated JavaScript, CSS, icons, the PWA manifest, and the service worker all use that path. Client navigation uses URL hashes and needs no server-side routing.

In the repository's **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. `.github/workflows/deploy.yml` runs `npm ci`, unit tests, `npm run build`, and browser tests on Node 24. Successful pushes to `main` upload only `dist/` and deploy it through the `github-pages` environment. Pull requests run the build and tests without publishing; manual deployment is also available from Actions on `main`.

The deployment uses GitHub's temporary workflow token with `pages: write` and `id-token: write`; no personal access token or API key belongs in the project. Keep `package-lock.json` updated with dependency changes. The environment should allow deployment from `main`.

For another static host, set `base` in `vite.config.ts` to that host's mount path (`/` for an origin root), rebuild, and publish the **contents of `dist/`**. The manifest and worker scope follow the same base. The existing `.openai/hosting.json` is Sites metadata; GitHub Pages does not use it. Never reuse another Site's project ID.

Recommended host caching: revalidate `index.html`, `sw.js`, and the manifest; immutable long-lived caching is safe for the hashed files under `assets/`. Preserve old hashed assets through deployments if the host supports it. The bundled worker supports static hosts that vary responses by Origin. HTTPS (or localhost) is necessary for service workers and installation.

GitHub Pages is public. App records remain local to each browser and origin; moving from another host does not transfer its IndexedDB data. Do not clear browser storage to refresh the app: use its **Update** action, or reload online to check for a new release.

Relevant upstream documentation: [Vite build and deployment](https://vite.dev/guide/static-deploy), [Vite PWA update prompts](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html), [Tailwind with Vite](https://tailwindcss.com/docs/installation/using-vite).

## Future development

Connect a server-backed AI adapter with response validation and consent; add optional export/restore and cross-device sync; improve natural-language dates and languages; snapshot historical routine schedules; and perform a physical-device installation/accessibility audit. External calendars, notifications, wearable data, social features, accounts, and cloud commitments are intentionally outside this MVP.
