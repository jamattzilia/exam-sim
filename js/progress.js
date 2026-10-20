// Progress tracking: attempt history and spaced repetition (Leitner boxes).
// Pure functions over plain data; persistence lives in storage.js.

const DAY_MS = 24 * 60 * 60 * 1000;

// Days until a question in each box is due again. A miss sends it back to box 0
// (due immediately); each fully correct answer moves it up one box.
export const REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 21];
const TOP_BOX = REVIEW_INTERVAL_DAYS.length - 1;
export const MAX_ATTEMPTS = 200;

// outcomes: [{ key, correct }] for questions the user actually answered.
export function updateStats(stats, outcomes, now) {
  const next = { ...stats };
  for (const { key, correct } of outcomes) {
    const prev = next[key] || { box: 0, seen: 0, right: 0 };
    next[key] = {
      box: correct ? Math.min(prev.box + 1, TOP_BOX) : 0,
      seen: prev.seen + 1,
      right: prev.right + (correct ? 1 : 0),
      lastSeen: now,
    };
  }
  return next;
}

export function isDue(entry, now) {
  return Boolean(entry) && now - entry.lastSeen >= REVIEW_INTERVAL_DAYS[entry.box] * DAY_MS;
}

export const isMissed = (entry) => Boolean(entry) && entry.box === 0;

export function attemptRecord(result, { mode, now }) {
  const perObjective = {};
  for (const [id, o] of Object.entries(result.perObjective)) {
    if (o.total > 0) perObjective[id] = { points: o.points, total: o.total };
  }
  return {
    finishedAt: now,
    mode,
    total: result.total,
    points: result.points,
    percent: result.percent,
    scaled: result.scaled,
    passed: result.passed,
    perObjective,
  };
}

export function addAttempt(history, attempt) {
  return [...history, attempt].slice(-MAX_ATTEMPTS);
}

// Accuracy per objective across all attempts, weakest first.
export function objectiveAccuracy(history) {
  const totals = {};
  for (const attempt of history) {
    for (const [id, o] of Object.entries(attempt.perObjective || {})) {
      const t = (totals[id] ||= { id, points: 0, total: 0 });
      t.points += o.points;
      t.total += o.total;
    }
  }
  return Object.values(totals)
    .map((t) => ({ ...t, percent: Math.round((t.points / t.total) * 100) }))
    .sort((a, b) => a.percent - b.percent || b.total - a.total || a.id.localeCompare(b.id, undefined, { numeric: true }));
}
