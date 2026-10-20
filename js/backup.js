// Backup file format and merge rules. Pure functions; storage access lives in ui.js.
import { validateQuestionSet } from "./validation.js";
import { MAX_ATTEMPTS } from "./progress.js";

const KIND = "exam-sim-backup";
const VERSION = 1;

export function buildBackup({ sets, settings, history, stats, flags = {}, language, theme }, now = Date.now()) {
  return { kind: KIND, version: VERSION, exportedAt: new Date(now).toISOString(), data: { sets, settings, history, stats, flags, language, theme } };
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Returns { ok: true, backup, skippedSets } or { ok: false, error }. Every question set
// goes through the same validation as an upload; broken sets are skipped, not imported.
export function parseBackup(raw) {
  if (!isObject(raw) || raw.kind !== KIND || !isObject(raw.data)) return { ok: false, error: "not an exam-sim backup file" };
  if (raw.version !== VERSION) return { ok: false, error: `unsupported backup version ${raw.version}` };
  const d = raw.data;
  const sets = [];
  let skippedSets = 0;
  for (const set of Array.isArray(d.sets) ? d.sets : []) {
    const result = isObject(set) && typeof set.id === "string" ? validateQuestionSet(set, set.setName || set.id) : null;
    if (!result?.valid) {
      skippedSets++;
      continue;
    }
    sets.push({ id: set.id, setName: result.set.setName, description: result.set.description, questions: result.set.questions });
  }
  const history = (Array.isArray(d.history) ? d.history : []).filter((a) => isObject(a) && Number.isFinite(a.finishedAt) && Number.isFinite(a.total));
  const stats = Object.fromEntries(
    Object.entries(isObject(d.stats) ? d.stats : {}).filter(([, e]) => isObject(e) && Number.isInteger(e.box) && Number.isFinite(e.lastSeen))
  );
  const flags = Object.fromEntries(
    Object.entries(isObject(d.flags) ? d.flags : {}).filter(([, f]) => isObject(f) && Number.isFinite(f.flaggedAt))
  );
  return {
    ok: true,
    skippedSets,
    backup: {
      exportedAt: raw.exportedAt,
      sets,
      history,
      stats,
      flags,
      settings: isObject(d.settings) ? d.settings : null,
      language: typeof d.language === "string" ? d.language : null,
      theme: typeof d.theme === "string" ? d.theme : null,
    },
  };
}

// Merges a backup into the current data without losing anything already here:
// sets are added unless the same set id exists, attempts are deduplicated by finish
// time, and for each question the more recently reviewed stats entry wins.
// Preferences (settings, language, theme) come from the backup.
export function mergeBackup(current, backup) {
  const setIds = new Set(current.sets.map((s) => s.id));
  const newSets = backup.sets.filter((s) => !setIds.has(s.id));

  const seenAttempts = new Set(current.history.map((a) => a.finishedAt));
  const newAttempts = backup.history.filter((a) => !seenAttempts.has(a.finishedAt));
  const history = [...current.history, ...newAttempts].sort((a, b) => a.finishedAt - b.finishedAt).slice(-MAX_ATTEMPTS);

  const stats = { ...current.stats };
  for (const [key, entry] of Object.entries(backup.stats)) {
    if (!stats[key] || stats[key].lastSeen < entry.lastSeen) stats[key] = entry;
  }

  return {
    sets: [...current.sets, ...newSets],
    history,
    stats,
    flags: { ...(backup.flags || {}), ...(current.flags || {}) },
    settings: backup.settings ?? current.settings,
    language: backup.language ?? current.language,
    theme: backup.theme ?? current.theme,
    added: { sets: newSets.length, attempts: newAttempts.length },
  };
}
