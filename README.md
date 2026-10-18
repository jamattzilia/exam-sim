# SY0-701 Exam Simulator

A static, client-side web app for practicing the CompTIA Security+ (SY0-701)
exam structure. No backend, no build step — just HTML/CSS/vanilla JS ES
modules, served as static files.

## Features

**Exam structure and filters**
- Standardized SY0-701 structure: 5 domains, 28 objectives, official domain
  weights (`js/data/objectives.js`).
- Filter by whole domain, individual objectives, or a range within a domain
  (e.g. `1.1-1.3` selects those objectives and excludes `1.4`).
- Optional official domain weighting (12/22/18/28/20%) when picking questions,
  and a "standard full exam" preset (90 questions / 90 minutes).

**Question sets**
- Two built-in sets: a small sample across all five domains, and 49
  exam-style questions (incl. PBQs) for objectives 2.1–2.3.
- Upload LLM-generated sets as JSON, validated on import; the Instructions
  tab has the full format and a ready-to-paste prompt.
- Combine sets into one pool (duplicate questions across sets are used once),
  save the combination as a new set, rename sets, and export any set in the
  upload format.

**Question types**
- Multiple choice (single and "Select N") plus five performance-based types:
  matching, ordering (drag or ▲/▼), fill-in-the-blank, hotspot (click a zone
  of an abstract diagram) and simulation (configure a table of settings).
- Optional PBQ partial credit per correct part. CompTIA doesn't publish its
  PBQ scoring or raw-to-scaled conversion, so the 100–900 score is a clearly
  labeled linear estimate.

**Taking the exam**
- Exam mode (results at the end) or practice mode (check each answer and see
  the explanation right away).
- Like the real exam: PBQs first, a review screen listing answered /
  unanswered / marked questions before submitting, and timer warnings at 10
  and 5 minutes.
- Question palette, mark for review, keyboard shortcuts (1–9, ←/→, M, C).
- An in-progress exam survives a reload or closed tab; only one tab can run
  an exam at a time.

**After the exam**
- Per-domain breakdown, full review with explanations, retake missed
  questions, export results as JSON or CSV (separator follows the regional
  format, so Excel opens it in columns).
- Progress tab: attempt history, weakest objectives with one-click practice,
  and spaced repetition of missed questions (review again after 1, 3, 7 and
  21 days).

**Interface**
- English and Russian interface (questions stay in English, like the exam),
  light / dark / system theme, works on phones.
- Everything is stored in the browser's `localStorage`; no account, no server.

## Running locally

**Easiest — no server needed:** download `dist/exam-sim.html` and double-click
it. It is the whole app in one file (styles, scripts and the built-in question
sets inlined), so it works straight from disk, offline.

**From the sources** (`index.html` + `js/`): the app uses ES modules, which
browsers refuse to load from `file://`, so serve the folder over HTTP:

```bash
node scripts/serve.mjs        # Node.js, no dependencies → http://localhost:8000
# or
python3 -m http.server 8000   # on Windows: py -m http.server 8000
```

On Windows, `python3` is often only a Microsoft Store stub that exits
immediately without starting anything; use `node scripts/serve.mjs`, `py`, or
right-click `index.html` → "Open with Live Server" in VS Code.

## Development

```bash
npm install          # installs @playwright/test
npm run build        # regenerates dist/exam-sim.html from index.html, css/, js/
npm test             # Playwright end-to-end tests (needs Chromium: npx playwright install chromium)
```

`dist/exam-sim.html` is committed; rebuild it after changing the sources (a
test fails if it is out of date).

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request: it checks
that `dist/exam-sim.html` matches the sources and runs the whole Playwright
suite in Chromium. On failure the HTML report is attached to the run.

## Deploying

The app is fully static — any static host works (GitHub Pages, Netlify,
Vercel, S3…), and `dist/exam-sim.html` can also be hosted on its own.

**GitHub Pages** is set up in `.github/workflows/pages.yml`: after CI passes
on a push to the default branch, the site is published automatically. It
needs a one-time switch in the repository: **Settings → Pages → Build and
deployment → Source: GitHub Actions**. Until then that workflow fails (CI is
unaffected). The site URL is shown in the Pages settings and on each deploy
run; the single-file version is at `<site URL>/dist/exam-sim.html`.

## Uploading your own question sets

See the **Instructions & Upload Format** tab in the app for the full JSON
schema and a ready-to-paste LLM prompt that generates compatible files. In
short, a set is:

```json
{
  "setName": "My set",
  "questions": [
    {
      "domain": "2.4",
      "type": "single",
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "answer": [1],
      "explanation": "..."
    }
  ]
}
```

`type` also supports five PBQ formats — `matching`, `ordering`, `fill_blank`,
`hotspot`, and `simulation` — each with its own fields (documented in full in
the app's Instructions tab). `domain` must be one of the 28 official
objective codes (`1.1`–`5.6`).
Uploaded sets are validated on import and stored in the browser's
`localStorage`, so they persist across reloads on the same device/browser
but are not shared between devices.

## Disclaimer

This is an unofficial, educational practice tool. It is not affiliated with,
endorsed by, or sourced from CompTIA. All bundled sample questions are
original content written to test the same objectives as the real exam.
