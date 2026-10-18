# SY0-701 Exam Simulator

A static, client-side web app for practicing the CompTIA Security+ (SY0-701)
exam structure. No backend, no build step — just HTML/CSS/vanilla JS ES
modules, served as static files.

## Features

- Standardized SY0-701 structure: 5 domains, 28 objectives, official domain
  weights (`js/data/objectives.js`).
- Filter questions by whole domain, individual objectives, or a range within
  a domain (e.g. type `1.1-1.3` to select those objectives and exclude `1.4`).
- Take an exam on a single domain, several domains, or a custom cross-domain
  mix of objectives.
- Two built-in question sets: a small sample set across all five domains, and
  an exam-style set of 49 scenario questions (incl. PBQs) for objectives
  2.1–2.3 (`js/data/domain2Set.js`), switchable in the "Question sets" panel.
- Combine multiple question sets (the built-in sets plus any number of
  uploaded sets) into one pool for a single exam session.
- Upload your own LLM-generated question sets as JSON, with schema
  validation and an in-app prompt template for generating compatible files
  (Instructions tab).
- Timed or untimed mode, question/answer shuffling, a "standard full exam"
  preset (90 questions / 90 minutes, official domain weighting), a question
  palette (jump/mark for review), per-domain score breakdown, and a
  "retake missed questions" flow.
- Performance-based questions (PBQs), not just multiple choice: matching,
  ordering/sequencing, fill-in-the-blank, hotspot (click the correct zone of
  an abstract diagram), and simulation (configure a table of settings, e.g.
  firewall rules) — see `js/promptTemplate.js` / the Instructions tab for the
  schema of each type.
- Ordering PBQs can be reordered by dragging (mouse, or the ⠿ handle on
  touch screens) or with the ▲/▼ buttons.
- Optional PBQ partial credit: each correct part of a PBQ (pair, step,
  blank, zone, row) earns its share of the question's point. CompTIA does not
  publish its PBQ scoring rules or its raw-to-scaled conversion, so the
  100–900 score shown is a clearly labeled linear estimate.
- Setup filters and exam options persist in `localStorage` across reloads,
  an in-progress exam can be resumed after a reload or closed tab, and
  results can be exported as JSON or CSV. The CSV separator follows the
  browser's regional format (`;` where the decimal mark is a comma, e.g.
  Russian), so Excel opens it in proper columns.

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

## Deploying

The app is fully static — deploy the repository as-is to GitHub Pages,
Netlify, Vercel, S3, or any static host. There is no server-side component;
`dist/exam-sim.html` can also be hosted on its own.

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
