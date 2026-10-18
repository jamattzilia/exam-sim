import { DOMAINS, OBJECTIVE_INDEX, EXAM_INFO, domainOfObjective } from "./data/objectives.js";

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Combine questions from every selected set, tagging each with its origin set name,
// then keep only questions whose objective code is in `selectedObjectiveIds`.
// `_key` is unique across sets: question ids are only unique within one file, and
// generated sets commonly reuse ids like "q1", so answers must not be keyed by `id`.
export function buildPool(selectedSets, selectedObjectiveIds) {
  const objSet = new Set(selectedObjectiveIds);
  const pool = [];
  for (const set of selectedSets) {
    for (const q of set.questions) {
      if (objSet.has(q.domain)) {
        pool.push({ ...q, _setName: set.setName, _setId: set.id, _key: `${set.id}::${q.id}` });
      }
    }
  }
  return pool;
}

export function poolStatsByObjective(pool) {
  const stats = {};
  for (const objId of Object.keys(OBJECTIVE_INDEX)) stats[objId] = 0;
  for (const q of pool) stats[q.domain] = (stats[q.domain] || 0) + 1;
  return stats;
}

// Splits `total` across the domains present in the pool in proportion to their
// official SY0-701 weights (largest-remainder rounding). A domain with fewer
// questions than its share is capped and the surplus is re-split among the rest.
export function weightedDomainCounts(availableByDomain, total) {
  const alloc = {};
  for (const id of Object.keys(availableByDomain)) alloc[id] = 0;
  let remaining = Math.min(total, Object.values(availableByDomain).reduce((s, n) => s + n, 0));
  let active = DOMAINS.filter((d) => availableByDomain[d.id] > 0);

  while (remaining > 0 && active.length > 0) {
    const totalWeight = active.reduce((s, d) => s + d.weight, 0);
    const shares = active.map((d) => {
      const exact = (remaining * d.weight) / totalWeight;
      const room = availableByDomain[d.id] - alloc[d.id];
      const given = Math.min(Math.floor(exact), room);
      alloc[d.id] += given;
      return { id: d.id, given, rem: exact - Math.floor(exact) };
    });
    let left = remaining - shares.reduce((s, x) => s + x.given, 0);
    for (const sh of shares.sort((a, b) => b.rem - a.rem)) {
      if (left === 0) break;
      if (alloc[sh.id] < availableByDomain[sh.id]) {
        alloc[sh.id]++;
        left--;
      }
    }
    remaining = left;
    active = active.filter((d) => alloc[d.id] < availableByDomain[d.id]);
  }
  return alloc;
}

// Like pickQuestions, but first splits the count across domains by official
// exam weight (12/22/18/28/20%), then balances objectives within each domain.
export function pickQuestionsWeighted(pool, count, { shuffleQuestions = true } = {}) {
  if (count >= pool.length) return shuffleQuestions ? shuffle(pool) : pool.slice();
  const byDomain = {};
  for (const q of pool) (byDomain[domainOfObjective(q.domain)] ||= []).push(q);
  const available = Object.fromEntries(Object.entries(byDomain).map(([id, qs]) => [id, qs.length]));
  const alloc = weightedDomainCounts(available, count);
  const picked = Object.entries(byDomain).flatMap(([id, qs]) => pickQuestions(qs, alloc[id] || 0, { shuffleQuestions: false }));
  return shuffleQuestions ? shuffle(picked) : picked;
}

// Selects `count` questions from `pool`, distributed as evenly as possible across
// objectives present in the pool (so one over-represented objective doesn't dominate),
// then trims/shuffles to the exact count.
export function pickQuestions(pool, count, { shuffleQuestions = true } = {}) {
  if (count >= pool.length) return shuffleQuestions ? shuffle(pool) : pool.slice();

  const byObjective = {};
  for (const q of pool) {
    (byObjective[q.domain] = byObjective[q.domain] || []).push(q);
  }
  for (const key of Object.keys(byObjective)) byObjective[key] = shuffle(byObjective[key]);

  const objectives = Object.keys(byObjective);
  const picked = [];
  let round = 0;
  while (picked.length < count) {
    let addedThisRound = false;
    for (const objId of objectives) {
      if (picked.length >= count) break;
      const bucket = byObjective[objId];
      if (bucket[round]) {
        picked.push(bucket[round]);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
    round++;
  }
  return shuffleQuestions ? shuffle(picked) : picked;
}

// Adds per-type "display" ordering (the shuffled arrangement shown to the test-taker,
// mapped back to original indices so answers stay comparable to the authored data).
export function prepareSessionQuestions(questions, { shuffleOptions = true } = {}) {
  return questions.map((q) => {
    switch (q.type) {
      case "matching": {
        const displayTargets = shuffleOptions ? shuffle(q.targets.map((_, i) => i)) : q.targets.map((_, i) => i);
        return { ...q, displayTargets };
      }
      case "ordering": {
        let displayOrder = shuffle(q.items.map((_, i) => i));
        if (q.items.length > 1 && displayOrder.every((v, i) => v === i)) {
          [displayOrder[0], displayOrder[1]] = [displayOrder[1], displayOrder[0]];
        }
        return { ...q, displayOrder };
      }
      case "fill_blank":
      case "hotspot":
      case "simulation":
        return { ...q };
      default: {
        // single / multiple choice
        if (!shuffleOptions) return { ...q, displayOptions: q.options.map((_, i) => i) };
        return { ...q, displayOptions: shuffle(q.options.map((_, i) => i)) };
      }
    }
  });
}

// Returns a blank/default response shape for a question, used to seed a session's
// answers before the test-taker interacts with it.
export function blankResponse(question) {
  switch (question.type) {
    case "matching":
      return question.prompts.map(() => null);
    case "ordering":
      return question.displayOrder ? [...question.displayOrder] : question.items.map((_, i) => i);
    case "fill_blank":
      return question.blanks.map(() => "");
    case "simulation":
      return question.rows.map(() => null);
    case "hotspot":
      return [];
    default:
      return [];
  }
}

// Whether the response contains any input. Ordering always holds *some* arrangement;
// it counts as answered once moved away from the shuffled start, which is never
// fully correct, so a correct answer always requires reordering.
export function hasAnyAnswer(question, response) {
  if (response == null) return false;
  switch (question.type) {
    case "ordering":
      return response.length === question.items.length && response.join() !== (question.displayOrder || []).join();
    case "matching":
      return response.some((v) => v !== null && v !== undefined);
    case "fill_blank":
      return response.some((v) => (v || "").trim().length > 0);
    case "simulation":
      return response.some((v) => v !== null && v !== undefined && v !== "");
    default:
      return Array.isArray(response) && response.length > 0;
  }
}

export function blankMatches(blank, value) {
  const val = (value || "").trim().toLowerCase();
  return blank.accepted.some((a) => a.trim().toLowerCase() === val);
}

export function rowMatches(row, value) {
  if (row.fieldType === "checkbox") return Boolean(value) === Boolean(row.answer);
  if (row.fieldType === "text") return typeof value === "string" && value.trim().toLowerCase() === String(row.answer).trim().toLowerCase();
  return value === row.answer;
}

function sameSet(a, b) {
  return [...new Set(a)].sort().join(",") === [...new Set(b || [])].sort().join(",");
}

export function isCorrect(question, response) {
  const r = Array.isArray(response) ? response : [];
  switch (question.type) {
    case "matching":
      return r.length === question.answer.length && question.answer.every((correctIdx, i) => r[i] === correctIdx);
    case "ordering":
      return r.length === question.items.length && r.every((origIdx, i) => origIdx === i);
    case "fill_blank":
      return r.length === question.blanks.length && question.blanks.every((b, i) => blankMatches(b, r[i]));
    case "simulation":
      return r.length === question.rows.length && question.rows.every((row, i) => rowMatches(row, r[i]));
    default:
      // single / multiple choice and hotspot: the selected set must equal the answer set
      return sameSet(question.answer, r);
  }
}

// Share (0..1) of a question's parts answered correctly. Multiple choice stays
// all-or-nothing; each PBQ part (pair, position, blank, zone, row) earns its share.
// Wrongly selected hotspot zones cancel out correct ones, so "click everything" earns 0.
export function partialScore(question, response) {
  if (isCorrect(question, response)) return 1;
  const r = Array.isArray(response) ? response : [];
  const share = (hits, parts) => (parts > 0 ? Math.max(0, hits) / parts : 0);
  switch (question.type) {
    case "matching":
      return share(question.answer.filter((a, i) => r[i] === a).length, question.answer.length);
    case "ordering":
      return r.length === question.items.length ? share(r.filter((v, i) => v === i).length, r.length) : 0;
    case "fill_blank":
      return share(question.blanks.filter((b, i) => blankMatches(b, r[i])).length, question.blanks.length);
    case "hotspot": {
      const answer = new Set(question.answer);
      const picked = [...new Set(r)];
      const hits = picked.filter((z) => answer.has(z)).length;
      return share(hits - (picked.length - hits), answer.size);
    }
    case "simulation":
      // length guard: a missing value would otherwise "match" an unchecked checkbox
      return r.length === question.rows.length ? share(question.rows.filter((row, i) => rowMatches(row, r[i])).length, r.length) : 0;
    default:
      return 0;
  }
}

const round2 = (n) => Math.round(n * 100) / 100;

// Each question is worth one point. With `partialCredit`, PBQs earn a fraction of
// their point per correct part; otherwise every question is all-or-nothing.
export function scoreSession(questions, answersByKey, { partialCredit = false } = {}) {
  const perObjective = {};
  const perDomain = {};
  for (const d of DOMAINS) perDomain[d.id] = { correct: 0, points: 0, total: 0, name: d.name };
  for (const objId of Object.keys(OBJECTIVE_INDEX)) {
    perObjective[objId] = { correct: 0, points: 0, total: 0, title: OBJECTIVE_INDEX[objId].title };
  }

  let correctCount = 0;
  let points = 0;
  const details = [];

  for (const q of questions) {
    const selected = answersByKey[q._key] ?? blankResponse(q);
    const correct = isCorrect(q, selected);
    const earned = partialCredit ? partialScore(q, selected) : correct ? 1 : 0;
    if (correct) correctCount++;
    points += earned;

    const buckets = [perObjective[q.domain], perDomain[OBJECTIVE_INDEX[q.domain]?.domainId]].filter(Boolean);
    for (const b of buckets) {
      b.total++;
      b.points = round2(b.points + earned);
      if (correct) b.correct++;
    }

    details.push({ question: q, selected, correct, points: round2(earned) });
  }

  const total = questions.length;
  const ratio = total ? points / total : 0;
  const [lo, hi] = EXAM_INFO.scaledScoreRange;
  const scaled = Math.round(lo + ratio * (hi - lo));

  return {
    correctCount,
    points: round2(points),
    total,
    percent: Math.round(ratio * 1000) / 10,
    scaled,
    passed: scaled >= EXAM_INFO.passingScaledScore,
    partialCredit,
    perDomain,
    perObjective,
    details,
  };
}

// Share of points this linear model needs for the passing scaled score (750 → 81.25%).
export function passingPercent() {
  const [lo, hi] = EXAM_INFO.scaledScoreRange;
  return Math.round(((EXAM_INFO.passingScaledScore - lo) / (hi - lo)) * 1000) / 10;
}
