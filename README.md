# GymBoy

A phone-first fitness app: sign in, answer a short questionnaire, land on a Home that shows your body today, scan your InBody result for an AI-written visual report, and log every workout set by set (by voice if you like).

Plain HTML, CSS and JavaScript on the front end (no build step). The AI call and account checks run in two small serverless functions in `api/`, so your keys never reach the browser.

## What it does

**Account and profile**
- **Sign in / create account** – email + password and Google, through Supabase. Until Supabase is connected the app runs in **demo mode**: a local account on this device, with everything below working.
- **Onboarding questionnaire** – 5 short steps (about you, goal, training, daily life and food, a health check with consent). 18+ only. Drives the advice in your reports. Editable later in Settings → Edit profile.
- **Home** – the landing page: your weight, height and BMI, a 30-day weight trend, progress toward your goal weight, a one-tap **Log weight**, your latest scan with its score, and your next workout.

**Scan reports (AI)**
- **Scan tab** – take a photo or choose images of an InBody result (printout or app screenshots). Images are shrunk and stripped of location data on the phone, then sent to `/api/analyze-scan`.
- **Report** – score ring, your key numbers on healthy-range gauges, a body map of muscle and fat by segment, left/right balance, change since your last scan, what stands out, where to focus, and a plan. Everything is drawn from structured data (`ai/scan-report.schema.json`), so reports always look the same.
- **Safety** – the server re-checks the AI's output in code: statuses and trend maths recomputed, arithmetic checked, profile flags (pregnancy, eating-disorder history, under 18, heart condition…) switch calorie guidance off, personal data scrubbed. Wellness guidance only, never a diagnosis.
- Without an Anthropic key the app shows a clearly marked **sample report**.

**Workouts**
- **Choose the day** – Push, Pull, Legs, HIIT, **Mobility & Flow**, Chest + Triceps, Back + Biceps and more, or **Custom**.
- **HIIT** – timed sets (seconds, optional weight and reps) and an **interval timer** (Tabata, 40/20… or your own) that fills in your sets as rounds finish.
- **Mobility & Flow** – 33 mobility drills, ground/animal-flow moves and yoga-style poses, logged by time (and reps if you like, no weight). Nine ready-made **guided flows** (Morning Reset, Hips Open, Spine & Shoulders, Pre-Lift Warm-up, Animal Flow Basics, Ground Flow Circuit, Sun Salutation, Warrior Strength, Cool-down). Pick one and the app walks you through each move with a timer, a cue, left/right sides, and an optional spoken "next move"; you can pause, skip, or open a move's how-to without losing your place. The time you actually moved for is logged to your workout.
- **How to do every exercise** – tap **ⓘ** on any exercise (on the card, in the picker, or in the ⋯ menu) for numbered steps, key cues, common mistakes, an easier and a harder version, and a suggested dose. **Watch a demo** opens a YouTube search for that exercise (a search never goes stale, unlike a saved video link). You can add your own **note and video link** to any exercise; they're saved on your device and included in backups.
- **Quick log by voice or typing** – tap the lime mic button, then say or type a set: *"bench press sixty kilos eight reps"*, *"ten reps"*, *"burpees forty seconds"*. The mic button needs HTTPS; the text box works anywhere (and your phone keyboard's mic can dictate into it). No audio is stored.
- **Log sets** – weight, reps, tick when done; last time's numbers shown as suggestions; rest timer; notes; screen stays awake.
- **History**, **Progress** (best set and trend per exercise, PRs), repeat any workout, **backup / restore**, kg / lb.
- **Demo data** – Settings → *Load 40-day demo data* adds a dummy lifter's workouts **and weigh-ins** (tagged, removable) so every screen has something to show.
- Works **offline** once loaded and can be **installed** on the home screen.

## Run it on your computer

```bash
cd GYMBOY
npm install        # first time only (installs the Anthropic SDK used by the server function)
node dev-server.js
```

It prints `http://localhost:8080` and a Wi-Fi address for your phone. `dev-server.js` also runs the `/api` functions, the same files Vercel runs in production, and reads settings from a `.env` file if there is one.

With no keys it runs in **demo mode** (local account, sample report). To try the real thing locally, copy `.env.example` to `.env` and fill it in.

## Turn on real accounts and AI

You need two accounts. Neither is possible for me to create or fill in for you; the app only reads the keys from environment variables.

### 1. Supabase (accounts + database)
1. Create a project at <https://supabase.com>.
2. **SQL editor → New query**, paste [`supabase/schema.sql`](supabase/schema.sql) and run it. This creates `profiles` and `scans` with row-level security, so each user can only read and change their own rows.
3. **Authentication → Providers**: email is on by default; enable **Google** if you want that button (needs a Google OAuth client). **Authentication → URL configuration**: add your site's address as the Site URL and a redirect URL.
4. **Project settings → API**: copy the **Project URL** and the **anon public** key.

### 2. Anthropic (the AI)
Create an API key at <https://console.anthropic.com>. The default model is `claude-opus-5-5`; `claude-sonnet-5-5` costs less. Try both on your own sample scans before choosing (see `ai/scan-report-prompt.md`, section 5).

### 3. Deploy on Vercel
1. Push this folder to a Git repository and import it in Vercel. Framework preset **Other**, no build command.
2. **Settings → Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your Anthropic key |
   | `SUPABASE_URL` | the Project URL |
   | `SUPABASE_ANON_KEY` | the anon public key |

3. Deploy, then open the **production** URL (`yourname.vercel.app`) on your phone. HTTPS gives you the mic button and home-screen install.

`vercel.json` already gives the analysis function 60 seconds, which a two-image scan with the large model can use. On the Hobby plan, request bodies are limited to about 4.5 MB, which the app respects by shrinking photos before upload.

With Supabase configured, every `/api/analyze-scan` call must carry a signed-in user's token, so strangers can't spend your AI budget.

## Project layout

```
GYMBOY/
├── index.html, manifest.webmanifest, sw.js   app shell, install info, offline cache (bump CACHE when files change)
├── dev-server.js              local dev server (static files + /api functions + .env)
├── vercel.json, package.json, .env.example
├── api/
│   ├── analyze-scan.js    POST: images + profile -> checked scan report (calls Claude)
│   └── config.js          GET: public settings (Supabase URL + anon key, whether AI is on)
├── lib/
│   ├── scan-validate.js   the deterministic safety net around the AI's output
│   └── prompt.js          loads the system prompt and schema from ai/
├── ai/
│   ├── scan-report-prompt.md       the system prompt (single source of truth), questionnaire fields, test plan
│   ├── scan-report.schema.json     the report format
│   └── example-output.json         a realistic example (used as the demo sample report)
├── supabase/schema.sql    database tables and row-level security
├── css/styles.css
├── js/
│   ├── data.js, store.js, ui.js, demo.js, voice.js   exercise library, workout storage, UI toolkit, demo data, quick-log parser
│   ├── howto-strength.js, howto-move.js   written instructions for every exercise  ← edit to improve the wording
│   ├── howto.js           lookup, safe links, demo-link builder and the How-to sheet
│   ├── flow-data.js       the guided flows as plain data  ← edit to add or change flows
│   ├── flows.js           flow picker, detail and the guided player
│   ├── profile-utils.js   age, BMI, units, goal progress, gauge maths (pure, tested)
│   ├── backend.js         accounts, profile and scan storage: local mode or Supabase, one interface
│   ├── screens-account.js welcome + onboarding
│   ├── screens-home.js    the new Home
│   ├── screens-scan.js    camera/library, image prep, analysis, past reports
│   ├── report-view.js     draws a report from its data
│   ├── sample-report.js   GENERATED from ai/example-output.json (node tools/sync-sample.js)
│   └── app.js             shell, router, workouts
├── tests/                 node test suites
├── tools/sync-sample.js
└── icons/
```

## Tests

```bash
npm test
```

Nine suites (about 180 checks): the voice parser, the how-to and flow content (every exercise has instructions, every flow move exists), the report schema and example, the output checker, the analysis function (using the real Anthropic SDK against a fake server, so the exact request is inspected), profile maths, the sample report staying in sync, and the Supabase code path (using the real Supabase client against a fake server).

What they **cannot** prove: that Claude reads a real InBody sheet correctly, or that a live Supabase project behaves as expected. Run a handful of real scans first (`ai/scan-report-prompt.md`, section 5).

## Known limits

- The how-to wording is written in plain language as general guidance. Have a coach or physio review it before launch, especially the mobility and yoga-style moves.
- Demo links are YouTube searches, so the first result isn't chosen by you. For hand-picked videos, add a `video` link per exercise later, or let people paste their own.
- Scan photos are not stored (v1): a report keeps the extracted numbers and text, not the original image.
- Deleting your data removes the profile and reports; removing the sign-in account itself needs a server-side admin call that isn't built yet.
- No password-reset screen yet.
- No per-user rate limit on scans yet (the auth check stops anonymous use, not a signed-in user scanning repeatedly).
- InBody only. Other brands return "not an InBody result".
- Privacy text in the app is a short draft and needs proper review before launch.

> **Where your data lives in demo mode:** in that browser, for that exact web address. A different address is a separate, empty copy. Use Settings → Export backup now and then.
