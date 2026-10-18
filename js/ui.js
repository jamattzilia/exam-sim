import { DOMAINS, OBJECTIVE_INDEX, EXAM_INFO, allObjectiveIds } from "./data/objectives.js";
import { SAMPLE_SET } from "./data/sampleQuestions.js";
import { DOMAIN2_21_23_SET } from "./data/domain2Set.js";
import {
  loadUploadedSets,
  addUploadedSet,
  removeUploadedSet,
  renameUploadedSet,
  loadSettings,
  saveSettings,
  loadSession,
  saveSession,
  clearSession,
  SESSION_KEY,
  loadLanguage,
  saveLanguage,
  loadTheme,
  saveTheme,
  loadHistory,
  saveHistory,
  loadStats,
  saveStats,
  clearProgress,
} from "./storage.js";
import { updateStats, isDue, isMissed, attemptRecord, addAttempt, objectiveAccuracy } from "./progress.js";
import { validateQuestionSet, BLANK_TOKEN } from "./validation.js";
import { confirmDialog, alertDialog, promptDialog, dismissAllDialogs, showToast } from "./dialog.js";
import { t, setLanguage, getLanguage, defaultLanguage, translatePage } from "./i18n.js";
import {
  buildPool,
  poolStatsByObjective,
  pickQuestions,
  pickQuestionsWeighted,
  prepareSessionQuestions,
  scoreSession,
  blankResponse,
  hasAnyAnswer,
  blankMatches,
  rowMatches,
  passingPercent,
  isCorrect,
  partialScore,
  shuffle,
  dedupeQuestions,
  stripRuntimeFields,
} from "./examEngine.js";
import { UPLOAD_FORMAT_DOC, UPLOAD_FORMAT_EXAMPLE } from "./promptTemplate.js";

// Sets bundled with the app. The first one is enabled by default; the others can be
// switched on in the "Question sets" panel and are available on every device.
const BUILTIN_SETS = [
  { id: "builtin", setName: SAMPLE_SET.setName, questions: SAMPLE_SET.questions, builtin: true },
  { id: "builtin-d2-2.1-2.3", setName: DOMAIN2_21_23_SET.setName, questions: DOMAIN2_21_23_SET.questions, builtin: true },
];

const state = {
  sets: [], // { id, setName, questions, builtin? }
  enabledSetIds: new Set(["builtin"]),
  selectedObjectives: new Set(allObjectiveIds()),
  // exam session: { questions, answers:{[_key]: response}, marked:Set, index, timerEnabled, endsAt }
  session: null,
  lastResult: null, // kept so the results page can be re-rendered in another language
  reviewing: false, // the pre-submit review screen is showing
};

// Module-level so a timer can never outlive the session that started it.
let timerId = null;

// Only one tab may run the exam: the saved session records its owner tab and a
// heartbeat, so another tab can tell a live exam from one left behind by a closed tab.
const TAB_ID = Math.random().toString(36).slice(2);
const HEARTBEAT_MS = 3000;
const STALE_AFTER_MS = 10000;
let heartbeatId = null;

function el(sel, root = document) {
  return root.querySelector(sel);
}
function elAll(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}
function ce(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

function allSets() {
  return [...BUILTIN_SETS, ...state.sets];
}
function enabledSets() {
  return allSets().filter((s) => state.enabledSetIds.has(s.id));
}

// The exam pool: enabled sets, filtered by objective, with cross-set duplicates removed.
function examPool(objectiveIds = [...state.selectedObjectives]) {
  return dedupeQuestions(buildPool(enabledSets(), objectiveIds));
}

function showPage(id) {
  elAll(".page").forEach((p) => p.classList.toggle("active", p.id === id));
  elAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.page === id));
  if (id === "page-progress") renderProgress();
}

// ---------------------------------------------------------------- Setup page

function renderSetsPanel() {
  const container = el("#sets-list");
  container.innerHTML = "";
  for (const set of allSets()) {
    const count = set.questions.length;
    const checked = state.enabledSetIds.has(set.id);
    const row = ce("div", { class: "set-row" }, [
      ce("label", { class: "set-check" }, [
        ce("input", {
          type: "checkbox",
          ...(checked ? { checked: "checked" } : {}),
          onchange: (e) => {
            if (e.target.checked) state.enabledSetIds.add(set.id);
            else state.enabledSetIds.delete(set.id);
            refreshPoolCount();
          },
        }),
        ce("span", {}, `${set.setName}`),
        ce("span", { class: "badge" }, t("set.count", { n: count })),
        set.builtin ? ce("span", { class: "badge badge-muted" }, t("set.builtin")) : null,
      ]),
      ce("div", { class: "set-actions" }, [
        !set.builtin ? ce("button", { class: "btn-link", onclick: () => renameSet(set) }, t("set.rename")) : null,
        ce("button", { class: "btn-link", onclick: () => exportSet(set) }, t("set.export")),
        !set.builtin
          ? ce("button", {
              class: "btn-link danger",
              onclick: async () => {
                if (!(await confirmDialog(t("set.removeConfirm", { name: set.setName }), { confirmText: t("set.remove"), danger: true }))) return;
                removeUploadedSet(set.id);
                state.sets = loadUploadedSets();
                state.enabledSetIds.delete(set.id);
                renderSetsPanel();
                refreshPoolCount();
              },
            }, t("set.remove"))
          : null,
      ]),
    ]);
    container.appendChild(row);
  }
}

function renderDomainFilters() {
  const container = el("#domain-filters");
  container.innerHTML = "";
  for (const domain of DOMAINS) {
    const objIds = domain.objectives.map((o) => o.id);
    const allChecked = objIds.every((id) => state.selectedObjectives.has(id));
    const someChecked = objIds.some((id) => state.selectedObjectives.has(id));

    const card = ce("div", { class: "domain-card" });
    const header = ce("div", { class: "domain-header" }, [
      ce("label", { class: "domain-check" }, [
        ce("input", {
          type: "checkbox",
          ...(allChecked ? { checked: "checked" } : {}),
          onchange: (e) => {
            objIds.forEach((id) => (e.target.checked ? state.selectedObjectives.add(id) : state.selectedObjectives.delete(id)));
            renderDomainFilters();
            refreshPoolCount();
          },
        }),
        ce("strong", {}, `${domain.id} ${domain.name}`),
        ce("span", { class: "badge" }, `${domain.weight}%`),
      ]),
    ]);
    if (someChecked && !allChecked) header.querySelector(".domain-check").appendChild(ce("span", { class: "partial-note" }, t("domain.partial")));
    card.appendChild(header);

    const objList = ce("div", { class: "objective-list" });
    for (const obj of domain.objectives) {
      const checked = state.selectedObjectives.has(obj.id);
      objList.appendChild(
        ce("label", { class: "objective-row" }, [
          ce("input", {
            type: "checkbox",
            ...(checked ? { checked: "checked" } : {}),
            onchange: (e) => {
              if (e.target.checked) state.selectedObjectives.add(obj.id);
              else state.selectedObjectives.delete(obj.id);
              renderDomainFilters();
              refreshPoolCount();
            },
          }),
          ce("span", { class: "obj-code" }, obj.id),
          ce("span", { class: "obj-title" }, obj.title),
          ce("span", { class: "badge badge-muted count-badge", "data-obj": obj.id }, ""),
        ])
      );
    }
    card.appendChild(objList);

    const applyFromInput = (input) => {
      applyRange(domain, input.value);
      renderDomainFilters();
      refreshPoolCount();
    };
    const rangeRow = ce("div", { class: "range-row" }, [
      ce("input", {
        type: "text",
        placeholder: t("range.placeholder", { from: objIds[0], to: objIds[Math.max(0, objIds.length - 2)] }),
        class: "range-input",
        onkeydown: (e) => {
          if (e.key === "Enter") applyFromInput(e.target);
        },
      }),
      ce("button", { class: "btn-link", onclick: (e) => applyFromInput(e.target.previousElementSibling) }, t("range.apply")),
      ce("button", { class: "btn-link", onclick: () => { objIds.forEach((id) => state.selectedObjectives.add(id)); renderDomainFilters(); refreshPoolCount(); } }, t("range.all")),
      ce("button", { class: "btn-link", onclick: () => { objIds.forEach((id) => state.selectedObjectives.delete(id)); renderDomainFilters(); refreshPoolCount(); } }, t("range.none")),
    ]);
    card.appendChild(rangeRow);

    container.appendChild(card);
  }
  updateObjectiveCounts();
}

// Parses things like "1.1-1.3" or "1.1,1.3" or "1.1-1.2,1.4" scoped to one domain,
// selecting exactly the matched objectives within that domain and deselecting the rest.
function applyRange(domain, text) {
  const objIds = domain.objectives.map((o) => o.id);
  objIds.forEach((id) => state.selectedObjectives.delete(id));
  const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
  const matched = new Set();
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+\.\d+)\s*[-–—]\s*(\d+\.\d+)$/);
    if (rangeMatch) {
      const [, startId, endId] = rangeMatch;
      const startIdx = objIds.indexOf(startId);
      const endIdx = objIds.indexOf(endId);
      if (startIdx !== -1 && endIdx !== -1) {
        const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        for (let i = lo; i <= hi; i++) matched.add(objIds[i]);
        continue;
      }
    }
    if (objIds.includes(part)) matched.add(part);
  }
  matched.forEach((id) => state.selectedObjectives.add(id));
}

async function renameSet(set) {
  const name = (await promptDialog(t("set.renamePrompt"), { value: set.setName }))?.trim();
  if (!name || name === set.setName) return;
  if (!renameUploadedSet(set.id, name)) return alertDialog(t("upload.storageFull"));
  state.sets = loadUploadedSets();
  renderSetsPanel();
}

const slug = (name) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "question-set";

// Same format as uploads, so an exported set can be edited and uploaded again.
function setAsUploadFormat(setName, questions, description = "") {
  return { setName, examVersion: "SY0-701", description, questions: questions.map(stripRuntimeFields) };
}

function exportSet(set) {
  const data = setAsUploadFormat(set.setName, set.questions, set.description || "");
  downloadFile(`${slug(set.setName)}.json`, JSON.stringify(data, null, 2), "application/json");
}

// Saves every enabled set (all objectives, duplicates removed) as one new uploaded set.
async function saveCombinedSet() {
  const sets = enabledSets();
  if (sets.length < 2) return alertDialog(t("set.needTwo"));
  const { questions } = dedupeQuestions(buildPool(sets, allObjectiveIds()));
  const name = (await promptDialog(t("set.saveCombinedPrompt", { n: questions.length }), { value: t("set.combinedName") }))?.trim();
  if (!name) return;
  // Ids are only unique within a set, so prefix the ones that collide.
  const ids = new Map();
  for (const q of questions) ids.set(q.id, (ids.get(q.id) || 0) + 1);
  const renamed = questions.map((q) => (ids.get(q.id) > 1 ? { ...q, id: `${q._setId}-${q.id}` } : q));
  const newSet = { id: `up-${Date.now()}`, ...setAsUploadFormat(name, renamed, `Combined from: ${sets.map((s) => s.setName).join(", ")}`) };
  if (!addUploadedSet(newSet)) return alertDialog(t("upload.storageFull"));
  state.sets = loadUploadedSets();
  state.enabledSetIds = new Set([newSet.id]);
  renderSetsPanel();
  refreshPoolCount();
}

function updateObjectiveCounts() {
  const pool = examPool(allObjectiveIds()).questions;
  const stats = poolStatsByObjective(pool);
  elAll(".count-badge").forEach((badge) => {
    const objId = badge.dataset.obj;
    badge.textContent = t("set.count", { n: stats[objId] || 0 });
  });
}

function refreshPoolCount() {
  updateObjectiveCounts();
  const { questions: pool, removed } = examPool();
  el("#sets-dupes").textContent = removed > 0 ? t("set.duplicates", { n: removed }) : "";
  el("#save-combined-btn").hidden = enabledSets().length < 2;
  el("#pool-count").textContent = pool.length;
  const maxInput = el("#num-questions");
  maxInput.max = Math.max(pool.length, 1);
  if (Number(maxInput.value) > pool.length && pool.length > 0) maxInput.value = pool.length;
  el("#start-exam-btn").disabled = pool.length === 0;
  el("#pool-warning").style.display = pool.length === 0 ? "block" : "none";
  persistSettings();
}

// ------------------------------------------------------------- Persistence

// Remembers the setup screen (which sets/objectives are checked, exam options)
// across reloads, since re-picking the same filters every time is tedious.
function persistSettings() {
  saveSettings({
    enabledSetIds: [...state.enabledSetIds],
    selectedObjectives: [...state.selectedObjectives],
    numQuestions: Number(el("#num-questions").value) || 20,
    timerEnabled: el("#timer-toggle").checked,
    timerMinutes: Number(el("#timer-minutes").value) || 90,
    shuffleQuestions: el("#shuffle-questions").checked,
    shuffleOptions: el("#shuffle-options").checked,
    weighted: el("#weighted-toggle").checked,
    partialCredit: el("#partial-toggle").checked,
    mode: el("#mode-select").value,
    pbqFirst: el("#pbq-first").checked,
  });
}

function applySavedSettings(saved) {
  if (!saved) return;
  if (Array.isArray(saved.enabledSetIds)) {
    const validIds = new Set(allSets().map((s) => s.id));
    const restored = new Set(saved.enabledSetIds.filter((id) => validIds.has(id)));
    state.enabledSetIds = restored.size > 0 ? restored : new Set(["builtin"]);
  }
  if (Array.isArray(saved.selectedObjectives)) {
    state.selectedObjectives = new Set(saved.selectedObjectives.filter((id) => OBJECTIVE_INDEX[id]));
  }
  if (typeof saved.numQuestions === "number" && saved.numQuestions > 0) el("#num-questions").value = saved.numQuestions;
  if (typeof saved.timerEnabled === "boolean") el("#timer-toggle").checked = saved.timerEnabled;
  if (typeof saved.timerMinutes === "number" && saved.timerMinutes > 0) el("#timer-minutes").value = saved.timerMinutes;
  if (typeof saved.shuffleQuestions === "boolean") el("#shuffle-questions").checked = saved.shuffleQuestions;
  if (typeof saved.shuffleOptions === "boolean") el("#shuffle-options").checked = saved.shuffleOptions;
  if (typeof saved.weighted === "boolean") el("#weighted-toggle").checked = saved.weighted;
  if (typeof saved.partialCredit === "boolean") el("#partial-toggle").checked = saved.partialCredit;
  if (saved.mode === "exam" || saved.mode === "practice") el("#mode-select").value = saved.mode;
  if (typeof saved.pbqFirst === "boolean") el("#pbq-first").checked = saved.pbqFirst;
}

function applyStandardPreset() {
  allObjectiveIds().forEach((id) => state.selectedObjectives.add(id));
  const total = Math.min(EXAM_INFO.fullExamQuestions, examPool(allObjectiveIds()).questions.length);
  el("#num-questions").value = total;
  el("#timer-minutes").value = EXAM_INFO.fullExamMinutes;
  el("#timer-toggle").checked = true;
  el("#weighted-toggle").checked = true;
  renderDomainFilters();
  refreshPoolCount();
}

// ------------------------------------------------------------------- Upload

function handleFileUpload(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let raw;
    try {
      raw = JSON.parse(reader.result);
    } catch (e) {
      showUploadResult({ valid: false, errors: [t("upload.parseError", { msg: e.message })], warnings: [] });
      return;
    }
    showUploadResult(validateQuestionSet(raw, file.name.replace(/\.json$/i, "")));
  };
  reader.readAsText(file);
}

function showUploadResult(result) {
  const box = el("#upload-result");
  box.innerHTML = "";
  box.style.display = "block";
  const parsedCount = result.set ? result.set.questions.length : 0;

  if (result.valid) {
    box.appendChild(ce("div", { class: "upload-ok" }, t("upload.ok", { n: parsedCount })));
  } else if (parsedCount > 0) {
    box.appendChild(
      ce("div", { class: "upload-warn" }, t("upload.partial", { n: parsedCount, e: result.errors.length }))
    );
  } else {
    box.appendChild(ce("div", { class: "upload-error" }, t("upload.failed")));
  }

  if (result.errors.length) {
    const list = ce("ul", { class: "error-list" });
    result.errors.slice(0, 15).forEach((e) => list.appendChild(ce("li", {}, e)));
    if (result.errors.length > 15) list.appendChild(ce("li", {}, t("upload.more", { n: result.errors.length - 15 })));
    box.appendChild(list);
  }
  if (result.warnings.length) {
    const list = ce("ul", { class: "warn-list" });
    result.warnings.forEach((w) => list.appendChild(ce("li", {}, w)));
    box.appendChild(list);
  }

  if (parsedCount > 0) {
    box.appendChild(
      ce("button", {
        class: "btn primary small",
        onclick: () => {
          const newSet = { id: `up-${Date.now()}`, setName: result.set.setName, description: result.set.description, questions: result.set.questions };
          if (!addUploadedSet(newSet)) {
            alertDialog(t("upload.storageFull"));
            return;
          }
          state.sets = loadUploadedSets();
          state.enabledSetIds.add(newSet.id);
          renderSetsPanel();
          refreshPoolCount();
          box.style.display = "none";
        },
      }, t("upload.import", { n: parsedCount }))
    );
  }
}

// -------------------------------------------------------------- Instructions

function renderInstructions() {
  el("#instructions-text").textContent = UPLOAD_FORMAT_DOC;
}

function downloadExample() {
  const blob = new Blob([JSON.stringify(UPLOAD_FORMAT_EXAMPLE, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sy0-701-example-set.json";
  a.click();
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------------- Exam

async function startExam() {
  if (!(await confirmTakeOverOtherTab())) return;
  const pool = examPool().questions;
  if (pool.length === 0) return;

  const numQuestions = Math.max(1, Math.min(Number(el("#num-questions").value) || pool.length, pool.length));
  const shuffleQuestions = el("#shuffle-questions").checked;
  const shuffleOptions = el("#shuffle-options").checked;
  const timerEnabled = el("#timer-toggle").checked;
  const timerMinutes = Math.max(1, Number(el("#timer-minutes").value) || 90);
  const pick = el("#weighted-toggle").checked ? pickQuestionsWeighted : pickQuestions;

  let chosen = pick(pool, numQuestions, { shuffleQuestions });
  if (el("#pbq-first").checked) chosen = [...chosen.filter(isPbq), ...chosen.filter((q) => !isPbq(q))];
  beginSession(prepareSessionQuestions(chosen, { shuffleOptions }), timerEnabled ? Date.now() + timerMinutes * 60000 : null);
}

const isPbq = (q) => q.type !== "single" && q.type !== "multiple";

function beginSession(questions, endsAt, { mode = el("#mode-select").value } = {}) {
  stopTimer();
  state.session = {
    questions,
    answers: Object.fromEntries(questions.map((q) => [q._key, blankResponse(q)])),
    marked: new Set(),
    index: 0,
    timerEnabled: endsAt != null,
    partialCredit: el("#partial-toggle").checked,
    mode,
    checked: new Set(),
    endsAt,
    durationMs: endsAt != null ? endsAt - Date.now() : null,
    warned: [],
  };
  enterExam();
}

function enterExam() {
  showPage("page-exam");
  renderExam();
  if (state.session.timerEnabled) startTimer();
  clearInterval(heartbeatId);
  heartbeatId = setInterval(() => persistSession(), HEARTBEAT_MS);
}

// keepSaved: another tab owns the exam now, so its saved copy must not be deleted.
function endSession({ keepSaved = false } = {}) {
  dismissAllDialogs();
  stopTimer();
  clearInterval(heartbeatId);
  heartbeatId = null;
  if (!keepSaved) clearSession();
  state.session = null;
}

// alive=false marks the exam as no longer running in this tab (page is unloading),
// so a reload offers a normal resume instead of "in progress in another tab".
function persistSession({ alive = true } = {}) {
  const s = state.session;
  if (!s) return;
  saveSession({ ...s, marked: [...s.marked], checked: [...s.checked], ownerTab: TAB_ID, heartbeatAt: alive ? Date.now() : 0 });
}

function restoreSession(saved) {
  return { warned: [], ...saved, mode: saved.mode || "exam", marked: new Set(saved.marked || []), checked: new Set(saved.checked || []) };
}

function isRunningInAnotherTab(saved) {
  return Boolean(saved?.ownerTab) && saved.ownerTab !== TAB_ID && Date.now() - (saved.heartbeatAt || 0) < STALE_AFTER_MS;
}

// Starting a new exam overwrites the saved one, so ask before ending a live exam elsewhere.
async function confirmTakeOverOtherTab() {
  if (!isRunningInAnotherTab(loadSession())) return true;
  return confirmDialog(t("tabs.takeOver"), {
    confirmText: t("tabs.startNew"),
    danger: true,
  });
}

// Another tab resumed or started an exam: stop here without touching its saved copy.
function onSessionStorageChange(e) {
  if (e.key !== SESSION_KEY || !state.session) return;
  let saved = null;
  try {
    saved = JSON.parse(e.newValue);
  } catch {
    // unreadable value: treat as removed
  }
  if (!saved) {
    persistSession(); // still running here; restore the copy another tab cleared
    return;
  }
  if (saved.ownerTab === TAB_ID) return;
  endSession({ keepSaved: true });
  showPage("page-setup");
  alertDialog(t("tabs.closedHere"));
}

// Offers to restore an exam that was in progress when the page was reloaded or closed.
async function resumeSavedSession() {
  const saved = loadSession();
  if (!saved || !Array.isArray(saved.questions) || saved.questions.length === 0) return false;
  if (isRunningInAnotherTab(saved)) {
    const move = await confirmDialog(
      t("tabs.moveHere", { i: saved.index + 1, n: saved.questions.length }),
      { confirmText: t("tabs.continueHere"), cancelText: t("tabs.leave") }
    );
    if (!move) return false;
    state.session = restoreSession(saved);
    enterExam();
    return true;
  }
  const expired = saved.endsAt != null && Date.now() >= saved.endsAt;
  const prompt = expired
    ? t("resume.expired")
    : t("resume.ask", { i: saved.index + 1, n: saved.questions.length });
  const ok = await confirmDialog(prompt, {
    confirmText: expired ? t("resume.submit") : t("resume.resume"),
    cancelText: expired ? t("resume.discard") : t("resume.startOver"),
  });
  if (!ok) {
    clearSession();
    return false;
  }
  state.session = restoreSession(saved);
  enterExam();
  return true;
}

function startTimer() {
  stopTimer();
  const session = state.session;
  const tick = () => {
    if (state.session !== session) {
      stopTimer();
      return;
    }
    const msLeft = session.endsAt - Date.now();
    if (msLeft <= 0) {
      el("#exam-timer").textContent = "00:00";
      finishExam();
      return;
    }
    const totalSec = Math.floor(msLeft / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const sec = String(totalSec % 60).padStart(2, "0");
    el("#exam-timer").textContent = `${m}:${sec}`;
    el("#exam-timer-wrap").classList.toggle("low", msLeft <= 5 * 60000);
    warnAboutTime(session, msLeft);
  };
  tick();
  if (state.session === session) timerId = setInterval(tick, 1000);
}

// One heads-up per threshold, and only if the exam was longer than that to begin with.
const TIME_WARNINGS_MIN = [10, 5];
function warnAboutTime(session, msLeft) {
  for (const minutes of TIME_WARNINGS_MIN) {
    const ms = minutes * 60000;
    if (msLeft > ms || session.warned.includes(minutes) || (session.durationMs ?? Infinity) <= ms) continue;
    session.warned.push(...TIME_WARNINGS_MIN.filter((m) => m >= minutes && !session.warned.includes(m)));
    showToast(t("timer.warning", { n: minutes }));
    persistSession();
    break;
  }
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

const typeLabel = (type) => t(`type.${type}`);
// Exports are data files, so their type column stays in English regardless of the UI language.
const EXPORT_TYPE_LABELS = {
  single: "Multiple choice",
  multiple: "Multiple choice (select all that apply)",
  matching: "Performance-based: Matching",
  ordering: "Performance-based: Ordering",
  fill_blank: "Performance-based: Fill in the blank",
  hotspot: "Performance-based: Hotspot",
  simulation: "Performance-based: Simulation",
};

function renderExam() {
  const s = state.session;
  const q = s.questions[s.index];
  if (!(q._key in s.answers)) s.answers[q._key] = blankResponse(q);

  el("#exam-progress").textContent = t("exam.progress", { i: s.index + 1, n: s.questions.length });
  el("#exam-timer-wrap").style.display = s.timerEnabled ? "inline-block" : "none";
  state.reviewing = false;
  el("#question-view").hidden = false;
  el("#review-screen").hidden = true;
  el("#question-domain").textContent = `${q.domain} — ${OBJECTIVE_INDEX[q.domain]?.title || ""} · ${typeLabel(q.type)}`;

  const optionsBox = el("#options-box");
  optionsBox.innerHTML = "";
  el("#question-text").style.display = q.type === "fill_blank" ? "none" : "block";
  el("#question-text").textContent = q.question;

  const renderer = QUESTION_RENDERERS[q.type] || QUESTION_RENDERERS.choice;
  renderer(q, s, optionsBox);

  // Practice mode: once checked, the answer is locked and feedback shown underneath.
  const practice = s.mode === "practice";
  const checked = practice && s.checked.has(q._key);
  if (checked) {
    optionsBox.classList.add("locked");
    optionsBox.querySelectorAll("input, select, button").forEach((c) => (c.disabled = true));
    optionsBox.appendChild(renderFeedback(q, s));
  } else {
    optionsBox.classList.remove("locked");
  }
  el("#check-btn").style.display = practice && !checked ? "inline-block" : "none";

  el("#mark-review-btn").classList.toggle("active", s.marked.has(q._key));
  el("#prev-btn").disabled = s.index === 0;
  el("#next-btn").style.display = s.index === s.questions.length - 1 ? "none" : "inline-block";
  el("#finish-btn").style.display = s.index === s.questions.length - 1 ? "inline-block" : "none";

  sessionChanged();
}

function questionResult(q, response, partialCredit) {
  const given = hasAnyAnswer(q, response) ? response : [];
  const correct = isCorrect(q, given);
  const points = partialCredit ? partialScore(q, given) : correct ? 1 : 0;
  const status = correct ? "correct" : points > 0 ? "partial" : "incorrect";
  return { given, correct, points, status };
}

function statusLabel({ status, points }) {
  if (status === "correct") return t("status.correct");
  if (status === "partial") return t("status.partial", { p: Math.round(points * 100) });
  return t("status.incorrect");
}

function renderFeedback(q, s) {
  const result = questionResult(q, s.answers[q._key], s.partialCredit !== false);
  const renderBody = REVIEW_BODY_RENDERERS[q.type] || REVIEW_BODY_RENDERERS.choice;
  return ce("div", { class: `review-item feedback ${result.status}` }, [
    ce("div", { class: "review-head" }, [ce("strong", {}, statusLabel(result))]),
    renderBody(q, result.given),
    q.explanation ? ce("div", { class: "review-explanation" }, q.explanation) : null,
  ]);
}

// The real exam ends with a review screen listing every question's status.
function showReviewScreen() {
  const s = state.session;
  if (!s) return;
  state.reviewing = true;
  el("#question-view").hidden = true;
  el("#review-screen").hidden = false;
  const statuses = s.questions.map((q) => ({ answered: isAnswered(s, q), marked: s.marked.has(q._key) }));
  el("#review-screen-counts").textContent = t("reviewScreen.counts", {
    a: statuses.filter((x) => x.answered).length,
    u: statuses.filter((x) => !x.answered).length,
    m: statuses.filter((x) => x.marked).length,
  });
  const grid = el("#review-grid");
  grid.innerHTML = "";
  s.questions.forEach((q, i) => {
    const { answered, marked } = statuses[i];
    grid.appendChild(
      ce("button", {
        type: "button",
        class: `review-cell ${answered ? "answered" : "unanswered"} ${marked ? "marked" : ""}`,
        onclick: () => {
          s.index = i;
          renderExam();
        },
      }, [
        ce("strong", {}, String(i + 1)),
        ce("span", {}, t(answered ? "reviewScreen.answered" : "reviewScreen.unanswered")),
        marked ? ce("span", { class: "review-cell-mark" }, `⚑ ${t("reviewScreen.marked")}`) : null,
      ])
    );
  });
  window.scrollTo(0, 0);
}

function checkCurrentAnswer() {
  const s = state.session;
  if (!s || s.mode !== "practice") return;
  s.checked.add(s.questions[s.index]._key);
  renderExam();
}

function sessionChanged() {
  renderPalette();
  persistSession();
}

// Updates the stored response without re-rendering the question, so text inputs keep focus.
function setAnswer(s, q, response) {
  s.answers[q._key] = response;
  sessionChanged();
}

function isAnswered(s, q) {
  return hasAnyAnswer(q, s.answers[q._key]);
}

const QUESTION_RENDERERS = {
  choice(q, s, box) {
    const multiple = q.type === "multiple";
    const limit = q.answer.length;
    if (multiple) box.appendChild(ce("p", { class: "hint" }, t("q.selectN", { n: limit })));
    const selected = new Set(s.answers[q._key] || []);
    const inputs = [];
    // Like the real exam, a "Select N" question accepts at most N choices.
    const syncLimit = () => {
      if (!multiple) return;
      const full = inputs.filter((i) => i.checked).length >= limit;
      for (const input of inputs) {
        input.disabled = full && !input.checked;
        input.closest(".option-row").classList.toggle("disabled", input.disabled);
      }
    };
    q.displayOptions.forEach((origIdx) => {
      const input = ce("input", {
        type: multiple ? "checkbox" : "radio",
        name: "option",
        ...(selected.has(origIdx) ? { checked: "checked" } : {}),
        onchange: (e) => {
          let sel = new Set(s.answers[q._key] || []);
          if (!multiple) sel = new Set([origIdx]);
          else if (e.target.checked) sel.add(origIdx);
          else sel.delete(origIdx);
          setAnswer(s, q, [...sel]);
          syncLimit();
        },
      });
      inputs.push(input);
      box.appendChild(ce("label", { class: "option-row" }, [input, ce("span", {}, q.options[origIdx])]));
    });
    syncLimit();
  },

  matching(q, s, box) {
    // When every prompt has a different correct match, each option is used once (like
    // dragging a card onto one slot): picking an option already used elsewhere moves it.
    const oneToOne = new Set(q.answer).size === q.answer.length;
    box.appendChild(
      ce("p", { class: "hint" }, `${t("q.matching.hint")} ${t(oneToOne ? "q.matching.once" : "q.matching.reuse")}`)
    );
    const response = s.answers[q._key] || blankResponse(q);
    q.prompts.forEach((promptText, promptIdx) => {
      const select = ce("select", {
        onchange: (e) => {
          const val = e.target.value === "" ? null : Number(e.target.value);
          const next = [...(s.answers[q._key] || blankResponse(q))];
          const movedFrom = oneToOne && val !== null ? next.indexOf(val) : -1;
          if (movedFrom !== -1 && movedFrom !== promptIdx) next[movedFrom] = null;
          next[promptIdx] = val;
          setAnswer(s, q, next);
          if (movedFrom !== -1 && movedFrom !== promptIdx) renderExam();
        },
      }, [ce("option", { value: "" }, t("q.select"))]);
      q.displayTargets.forEach((origIdx) => {
        const opt = ce("option", { value: String(origIdx) }, q.targets[origIdx]);
        if (response[promptIdx] === origIdx) opt.setAttribute("selected", "selected");
        select.appendChild(opt);
      });
      box.appendChild(ce("div", { class: "matching-row" }, [ce("span", { class: "matching-prompt" }, promptText), select]));
    });
  },

  ordering(q, s, box) {
    box.appendChild(ce("p", { class: "hint" }, t("q.ordering.hint")));
    const order = s.answers[q._key] || blankResponse(q);
    const list = ce("div", { class: "order-list" });
    order.forEach((origIdx, pos) => {
      const row = ce("div", { class: "order-item", "data-orig": String(origIdx) }, [
        ce("span", { class: "order-handle", title: t("q.ordering.drag") }, "⠿"),
        ce("span", { class: "order-pos" }, String(pos + 1)),
        ce("span", { class: "order-text" }, q.items[origIdx]),
        ce("div", { class: "order-controls" }, [
          ce("button", {
            class: "btn-link",
            type: "button",
            ...(pos === 0 ? { disabled: "disabled" } : {}),
            onclick: () => {
              const next = [...order];
              [next[pos - 1], next[pos]] = [next[pos], next[pos - 1]];
              setAnswer(s, q, next);
              renderExam();
            },
          }, "▲"),
          ce("button", {
            class: "btn-link",
            type: "button",
            ...(pos === order.length - 1 ? { disabled: "disabled" } : {}),
            onclick: () => {
              const next = [...order];
              [next[pos], next[pos + 1]] = [next[pos + 1], next[pos]];
              setAnswer(s, q, next);
              renderExam();
            },
          }, "▼"),
        ]),
      ]);
      list.appendChild(row);
    });
    enableDragReorder(list, (next) => {
      setAnswer(s, q, next);
      renderExam();
    });
    box.appendChild(list);
  },

  fill_blank(q, s, box) {
    const response = s.answers[q._key] || blankResponse(q);
    const parts = q.question.split(BLANK_TOKEN);
    const para = ce("p", { class: "fill-blank-text" });
    parts.forEach((part, i) => {
      if (part) para.appendChild(document.createTextNode(part));
      if (i < parts.length - 1) {
        para.appendChild(
          ce("input", {
            type: "text",
            class: "blank-input",
            value: response[i] || "",
            oninput: (e) => {
              const next = [...(s.answers[q._key] || blankResponse(q))];
              next[i] = e.target.value;
              setAnswer(s, q, next);
            },
          })
        );
      }
    });
    box.appendChild(para);
  },

  hotspot(q, s, box) {
    box.appendChild(ce("p", { class: "hint" }, t("q.hotspot.hint")));
    const selected = new Set(s.answers[q._key] || []);
    const canvas = ce("div", { class: "hotspot-canvas" });
    q.zones.forEach((zone) => {
      const isSelected = selected.has(zone.id);
      const el2 = ce("button", {
        type: "button",
        class: `hotspot-zone ${isSelected ? "selected" : ""}`,
        style: `left:${zone.x}%; top:${zone.y}%; width:${zone.w}%; height:${zone.h}%;`,
        onclick: () => {
          const sel = new Set(s.answers[q._key] || []);
          if (sel.has(zone.id)) sel.delete(zone.id);
          else sel.add(zone.id);
          setAnswer(s, q, [...sel]);
          renderExam();
        },
      }, zone.label);
      canvas.appendChild(el2);
    });
    box.appendChild(canvas);
  },

  simulation(q, s, box) {
    const response = s.answers[q._key] || blankResponse(q);
    const table = ce("div", { class: "sim-table" });
    q.rows.forEach((row, i) => {
      let field;
      if (row.fieldType === "select") {
        field = ce("select", {
          onchange: (e) => {
            const next = [...(s.answers[q._key] || blankResponse(q))];
            next[i] = e.target.value || null;
            setAnswer(s, q, next);
          },
        }, [ce("option", { value: "" }, t("q.select")), ...row.options.map((opt) => {
          const o = ce("option", { value: opt }, opt);
          if (response[i] === opt) o.setAttribute("selected", "selected");
          return o;
        })]);
      } else if (row.fieldType === "checkbox") {
        field = ce("input", {
          type: "checkbox",
          ...(response[i] ? { checked: "checked" } : {}),
          onchange: (e) => {
            const next = [...(s.answers[q._key] || blankResponse(q))];
            next[i] = e.target.checked;
            setAnswer(s, q, next);
          },
        });
      } else {
        field = ce("input", {
          type: "text",
          value: response[i] || "",
          oninput: (e) => {
            const next = [...(s.answers[q._key] || blankResponse(q))];
            next[i] = e.target.value;
            setAnswer(s, q, next);
          },
        });
      }
      table.appendChild(ce("div", { class: "sim-row" }, [ce("span", { class: "sim-label" }, row.label), field]));
    });
    box.appendChild(table);
  },
};

// Pointer Events rather than HTML5 drag-and-drop, which has no touch support.
// Mouse can drag a row from anywhere; touch only from the ⠿ handle so swiping
// over the list still scrolls the page.
function enableDragReorder(list, onReorder) {
  list.addEventListener("pointerdown", (e) => {
    const item = e.target.closest(".order-item");
    if (!item || e.button !== 0 || e.target.closest("button") || list.closest(".locked")) return;
    if (e.pointerType !== "mouse" && !e.target.closest(".order-handle")) return;
    e.preventDefault();

    const before = [...list.children].map((c) => c.dataset.orig).join();
    item.classList.add("dragging");

    // Listen on window, not with setPointerCapture: moving the captured row in the
    // DOM releases the capture, and the drop would then never be seen.
    const move = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      const next = [...list.children].find((c) => {
        if (c === item) return false;
        const r = c.getBoundingClientRect();
        return ev.clientY < r.top + r.height / 2;
      });
      if (next !== item.nextElementSibling) list.insertBefore(item, next || null);
    };
    const end = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      item.classList.remove("dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      const order = [...list.children].map((c) => Number(c.dataset.orig));
      if (order.join() !== before) onReorder(order);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  });
}

function renderPalette() {
  const s = state.session;
  const box = el("#question-palette");
  box.innerHTML = "";
  s.questions.forEach((q, i) => {
    const answered = isAnswered(s, q);
    const marked = s.marked.has(q._key);
    const checkedStatus = s.checked.has(q._key) ? `checked-${questionResult(q, s.answers[q._key], s.partialCredit !== false).status}` : "";
    const btn = ce("button", {
      class: `palette-btn ${answered ? "answered" : ""} ${marked ? "marked" : ""} ${checkedStatus} ${i === s.index ? "current" : ""}`,
      onclick: () => {
        s.index = i;
        renderExam();
      },
    }, String(i + 1));
    box.appendChild(btn);
  });
}

async function finishExam() {
  const s = state.session;
  if (!s) return;
  const unanswered = s.questions.filter((q) => !isAnswered(s, q)).length;
  const timeLeft = s.endsAt == null || Date.now() < s.endsAt;
  if (unanswered > 0 && timeLeft) {
    const ok = await confirmDialog(t("finish.unanswered", { n: unanswered }), { confirmText: t("finish.submit") });
    // The timer may have expired and submitted this session while the dialog was open.
    if (!ok || state.session !== s) return;
  }
  // Unanswered questions (same rule as the palette and the warning above) are submitted
  // empty: otherwise an untouched ordering question's shuffled default, or a simulation's
  // untouched checkboxes that happen to match "unchecked", would earn partial credit.
  const answers = { ...s.answers };
  for (const q of s.questions) if (!isAnswered(s, q)) answers[q._key] = [];
  const result = scoreSession(s.questions, answers, { partialCredit: s.partialCredit !== false });
  recordProgress(s, result);
  state.lastResult = result;
  endSession();
  showPage("page-results");
  renderResults(result);
}

// ---------------------------------------------------------------- Progress

// Only answered questions feed spaced repetition: a skipped question says nothing
// about whether it is known.
function recordProgress(s, result) {
  const now = Date.now();
  const outcomes = result.details
    .filter((d) => isAnswered(s, d.question))
    .map((d) => ({ key: d.question._key, correct: d.correct }));
  saveStats(updateStats(loadStats(), outcomes, now));
  saveHistory(addAttempt(loadHistory(), attemptRecord(result, { mode: s.mode, now })));
}

// Every question in every set (enabled or not) by key, so review works regardless of filters.
function allQuestionsByKey() {
  return new Map(buildPool(allSets(), allObjectiveIds()).map((q) => [q._key, q]));
}

const MAX_REVIEW = 50;

async function startPractice(questions, emptyMessage) {
  if (questions.length === 0) {
    alertDialog(emptyMessage);
    return;
  }
  if (!(await confirmTakeOverOtherTab())) return;
  const chosen = shuffle(questions).slice(0, MAX_REVIEW);
  beginSession(prepareSessionQuestions(chosen, { shuffleOptions: el("#shuffle-options").checked }), null, { mode: "practice" });
}

function practiceObjective(objId) {
  const fromEnabled = examPool([objId]).questions;
  const pool = fromEnabled.length ? fromEnabled : dedupeQuestions(buildPool(allSets(), [objId])).questions;
  startPractice(pickQuestions(pool, 10), t("progress.noObjective", { id: objId }));
}

function renderProgress() {
  const now = Date.now();
  const stats = loadStats();
  const questions = [...allQuestionsByKey().values()];
  const due = questions.filter((q) => isDue(stats[q._key], now));
  const missed = questions.filter((q) => isMissed(stats[q._key]));

  const actions = el("#review-actions");
  actions.innerHTML = "";
  actions.append(
    ce("button", { class: "btn primary", id: "review-due-btn", onclick: () => startPractice(due, t("progress.nothingDue")) }, t("progress.reviewDue", { n: due.length })),
    ce("button", { class: "btn", id: "review-missed-btn", onclick: () => startPractice(missed, t("progress.noMissed")) }, t("progress.retryMissed", { n: missed.length }))
  );
  if (due.length > MAX_REVIEW) actions.appendChild(ce("span", { class: "hint" }, t("progress.capped", { n: MAX_REVIEW })));

  const history = loadHistory();
  const weak = el("#weak-objectives");
  weak.innerHTML = "";
  const accuracy = objectiveAccuracy(history);
  if (accuracy.length === 0) weak.appendChild(ce("p", { class: "hint" }, t("progress.noAccuracy")));
  for (const row of accuracy) {
    weak.appendChild(
      ce("div", { class: "breakdown-row weak-row" }, [
        ce("span", { class: "bd-label", title: OBJECTIVE_INDEX[row.id]?.title || "" }, `${row.id} ${OBJECTIVE_INDEX[row.id]?.title || ""}`),
        ce("div", { class: "bd-bar-bg" }, [ce("div", { class: "bd-bar", style: `width:${row.percent}%` })]),
        ce("span", { class: "bd-num" }, t("progress.accuracy", { p: row.percent, n: row.total })),
        ce("button", { class: "btn-link", onclick: () => practiceObjective(row.id) }, t("progress.practice")),
      ])
    );
  }

  const list = el("#attempt-history");
  list.innerHTML = "";
  if (history.length === 0) {
    list.appendChild(ce("p", { class: "hint" }, t("progress.noAttempts")));
  } else {
    const table = ce("table", { class: "history-table" }, [
      ce("thead", {}, [ce("tr", {}, ["date", "mode", "score", "scaled", "result"].map((h) => ce("th", {}, t(`progress.col.${h}`))))]),
    ]);
    const body = ce("tbody");
    for (const a of [...history].reverse().slice(0, 30)) {
      body.appendChild(
        ce("tr", {}, [
          ce("td", {}, new Date(a.finishedAt).toLocaleString()),
          ce("td", {}, t(a.mode === "practice" ? "progress.mode.practice" : "progress.mode.exam")),
          ce("td", {}, `${fmtPoints(a.points)} / ${a.total} (${a.percent}%)`),
          ce("td", {}, String(a.scaled)),
          ce("td", { class: a.passed ? "pass-text" : "fail-text" }, t(a.passed ? "progress.pass" : "progress.fail")),
        ])
      );
    }
    table.appendChild(body);
    list.appendChild(table);
  }
}

// ----------------------------------------------------------------- Results

const fmtPoints = (n) => String(Math.round(n * 100) / 100);

function renderResults(result) {
  el("#result-score").textContent = `${fmtPoints(result.points)} / ${result.total} (${result.percent}%)`;
  const note = result.partialCredit && result.points !== result.correctCount ? t("results.partialNote", { n: result.correctCount }) : "";
  el("#result-scaled").textContent = t("results.scaled", {
    scaled: result.scaled,
    max: EXAM_INFO.scaledScoreRange[1],
    pass: EXAM_INFO.passingScaledScore,
    note,
    pct: passingPercent(),
  });
  const passBadge = el("#result-pass");
  passBadge.textContent = t(result.passed ? "results.pass" : "results.fail");
  passBadge.className = `badge-pass ${result.passed ? "pass" : "fail"}`;

  const domainTable = el("#domain-breakdown");
  domainTable.innerHTML = "";
  for (const [domainId, stat] of Object.entries(result.perDomain)) {
    if (stat.total === 0) continue;
    const pct = Math.round((stat.points / stat.total) * 100);
    domainTable.appendChild(
      ce("div", { class: "breakdown-row" }, [
        ce("span", { class: "bd-label" }, `${domainId} ${stat.name}`),
        ce("div", { class: "bd-bar-bg" }, [ce("div", { class: "bd-bar", style: `width:${pct}%` })]),
        ce("span", { class: "bd-num" }, `${fmtPoints(stat.points)}/${stat.total} (${pct}%)`),
      ])
    );
  }

  const reviewBox = el("#review-list");
  reviewBox.innerHTML = "";
  let showOnlyIncorrect = el("#review-filter-incorrect").checked;
  renderReviewDetails(result, showOnlyIncorrect);

  el("#review-filter-incorrect").onchange = (e) => renderReviewDetails(result, e.target.checked);

  el("#retake-missed-btn").onclick = () => retakeMissed(result);
  el("#export-json-btn").onclick = () => exportResultsJSON(result);
  el("#export-csv-btn").onclick = () => exportResultsCSV(result);
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function timestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// Human-readable answer summaries, used by both exports so PBQ types (matching,
// ordering, fill_blank, hotspot, simulation) export as legibly as plain MCQ.
function describeCorrectAnswer(q) {
  switch (q.type) {
    case "matching":
      return q.prompts.map((p, i) => `${p} → ${q.targets[q.answer[i]]}`).join(" | ");
    case "ordering":
      return q.items.join(" → ");
    case "fill_blank":
      return q.blanks.map((b, i) => `Blank ${i + 1}: ${b.accepted[0]}`).join(" | ");
    case "hotspot":
      return q.answer.map((id) => q.zones.find((z) => z.id === id)?.label || id).join(" | ");
    case "simulation":
      return q.rows.map((r) => `${r.label}: ${r.fieldType === "checkbox" ? (r.answer ? "Checked" : "Unchecked") : r.answer}`).join(" | ");
    default:
      return q.answer.map((i) => q.options[i]).join(" | ");
  }
}

function describeYourAnswer(q, selected) {
  switch (q.type) {
    case "matching":
      return q.prompts.map((p, i) => `${p} → ${selected[i] != null ? q.targets[selected[i]] : "(no answer)"}`).join(" | ");
    case "ordering":
      return selected.length === q.items.length ? selected.map((idx) => q.items[idx]).join(" → ") : "(no answer)";
    case "fill_blank":
      return q.blanks.map((b, i) => `Blank ${i + 1}: ${(selected[i] || "").trim() || "(blank)"}`).join(" | ");
    case "hotspot":
      return selected.length ? selected.map((id) => q.zones.find((z) => z.id === id)?.label || id).join(" | ") : "(no answer)";
    case "simulation":
      return q.rows
        .map((r, i) => {
          const val = selected[i];
          if (r.fieldType === "checkbox") return `${r.label}: ${val ? "Checked" : "Unchecked"}`;
          return `${r.label}: ${val || "(no answer)"}`;
        })
        .join(" | ");
    default:
      return selected.length ? selected.map((i) => q.options[i]).join(" | ") : "(no answer)";
  }
}

function exportResultsJSON(result) {
  const payload = {
    examVersion: "SY0-701",
    generatedAt: new Date().toISOString(),
    summary: {
      points: result.points,
      fullyCorrect: result.correctCount,
      total: result.total,
      percent: result.percent,
      partialCredit: result.partialCredit,
      estimatedScaledScore: result.scaled,
      passed: result.passed,
    },
    perDomain: result.perDomain,
    perObjective: result.perObjective,
    questions: result.details.map((d) => ({
      id: d.question.id,
      domain: d.question.domain,
      type: d.question.type,
      question: d.question.question,
      correctAnswer: describeCorrectAnswer(d.question),
      yourAnswer: describeYourAnswer(d.question, d.selected),
      rawCorrectAnswer: d.question.answer ?? null,
      rawYourAnswer: d.selected,
      correct: d.correct,
      points: d.points,
      explanation: d.question.explanation || "",
    })),
  };
  downloadFile(`sy0-701-results-${timestampForFilename()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

// Excel reads CSV with the list separator from the OS regional settings: ";" wherever
// the decimal separator is "," (Russian, German, French...), "," elsewhere. Matching
// it makes a double-click open the file in columns instead of one long column A.
function csvFormat() {
  const parts = new Intl.NumberFormat().formatToParts(1.5);
  const decimal = parts.find((p) => p.type === "decimal")?.value || ".";
  const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, useGrouping: false });
  return { delimiter: decimal === "," ? ";" : ",", number: (n) => number.format(n) };
}

function csvEscape(value, delimiter) {
  const s = String(value ?? "");
  return s.includes(delimiter) || /["\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportResultsCSV(result) {
  const { delimiter, number } = csvFormat();
  const header = ["id", "domain", "objective", "type", "question", "correct_answer", "your_answer", "result", "points", "explanation"];
  const rows = result.details.map((d) => {
    const q = d.question;
    return [
      q.id,
      q.domain,
      OBJECTIVE_INDEX[q.domain]?.title || "",
      EXPORT_TYPE_LABELS[q.type] || q.type,
      q.question,
      describeCorrectAnswer(q),
      describeYourAnswer(q, d.selected),
      d.correct ? "correct" : d.points > 0 ? "partial" : "incorrect",
      number(d.points),
      q.explanation || "",
    ];
  });
  // Summary goes below the table after a blank row, so Excel's sort/filter range
  // (which stops at the first empty row) covers only the questions.
  const summary = [
    ["Score", `${number(result.points)}/${result.total} (${number(result.percent)}%)`],
    ["Estimated scaled score", `${result.scaled}/${EXAM_INFO.scaledScoreRange[1]}`],
  ];
  const csv = [header, ...rows, [], ...summary].map((r) => r.map((v) => csvEscape(v, delimiter)).join(delimiter)).join("\r\n");
  // BOM so Excel detects UTF-8 (otherwise "→" and non-Latin text are garbled).
  downloadFile(`sy0-701-results-${timestampForFilename()}.csv`, "\uFEFF" + csv, "text/csv;charset=utf-8");
}

const REVIEW_BODY_RENDERERS = {
  choice(q, selected) {
    const optList = ce("ul", { class: "review-options" });
    q.options.forEach((optText, idx) => {
      const isCorrectOpt = q.answer.includes(idx);
      const wasSelected = selected.includes(idx);
      let cls = "";
      if (isCorrectOpt) cls = "opt-correct";
      if (wasSelected && !isCorrectOpt) cls = "opt-wrong-selected";
      optList.appendChild(ce("li", { class: cls }, `${wasSelected ? "☑" : "☐"} ${optText}${isCorrectOpt ? ` ${t("review.correctMark")}` : ""}`));
    });
    return optList;
  },

  matching(q, selected) {
    const list = ce("ul", { class: "review-options" });
    q.prompts.forEach((promptText, i) => {
      const correctTarget = q.targets[q.answer[i]];
      const yourTarget = selected[i] != null ? q.targets[selected[i]] : t("review.noAnswer");
      const ok = selected[i] === q.answer[i];
      list.appendChild(
        ce("li", { class: ok ? "opt-correct" : "opt-wrong-selected" }, `${promptText} → ${t("review.yourAnswer")}: ${yourTarget}${ok ? "" : ` ${t("review.correctIs", { x: correctTarget })}`}`)
      );
    });
    return list;
  },

  ordering(q, selected) {
    const list = ce("ol", { class: "review-options" });
    const order = selected.length === q.items.length ? selected : [];
    order.forEach((origIdx, pos) => {
      const ok = origIdx === pos;
      list.appendChild(ce("li", { class: ok ? "opt-correct" : "opt-wrong-selected" }, q.items[origIdx]));
    });
    if (order.length === 0) list.appendChild(ce("li", { class: "opt-wrong-selected" }, t("review.noAnswer")));
    if (!(order.length && order.every((v, i) => v === i))) {
      const correctList = ce("ol", { class: "review-options" });
      q.items.forEach((text) => correctList.appendChild(ce("li", { class: "opt-correct" }, text)));
      return ce("div", {}, [ce("p", { class: "hint" }, t("review.yourOrder")), list, ce("p", { class: "hint" }, t("review.correctOrder")), correctList]);
    }
    return list;
  },

  fill_blank(q, selected) {
    const list = ce("ul", { class: "review-options" });
    q.blanks.forEach((b, i) => {
      const val = (selected[i] || "").trim();
      const ok = blankMatches(b, val);
      list.appendChild(
        ce("li", { class: ok ? "opt-correct" : "opt-wrong-selected" }, `${t("review.blank", { i: i + 1 })}: "${val || t("review.empty")}" ${ok ? "" : t("review.accepted", { list: b.accepted.join(", ") })}`)
      );
    });
    return list;
  },

  hotspot(q, selected) {
    const list = ce("ul", { class: "review-options" });
    q.zones.forEach((zone) => {
      const isCorrectZone = q.answer.includes(zone.id);
      const wasSelected = (selected || []).includes(zone.id);
      let cls = "";
      if (isCorrectZone) cls = "opt-correct";
      if (wasSelected && !isCorrectZone) cls = "opt-wrong-selected";
      list.appendChild(ce("li", { class: cls }, `${wasSelected ? "☑" : "☐"} ${zone.label}${isCorrectZone ? ` ${t("review.correctMark")}` : ""}`));
    });
    return list;
  },

  simulation(q, selected) {
    const list = ce("ul", { class: "review-options" });
    q.rows.forEach((row, i) => {
      const val = selected[i];
      const ok = rowMatches(row, val);
      const isBox = row.fieldType === "checkbox";
      const yourText = isBox ? t(val ? "review.checked" : "review.unchecked") : val || t("review.noAnswer");
      const correctText = isBox ? t(row.answer ? "review.checked" : "review.unchecked") : row.answer;
      list.appendChild(ce("li", { class: ok ? "opt-correct" : "opt-wrong-selected" }, `${row.label}: ${yourText}${ok ? "" : ` ${t("review.correctIs", { x: correctText })}`}`));
    });
    return list;
  },
};

function renderReviewDetails(result, onlyIncorrect) {
  const reviewBox = el("#review-list");
  reviewBox.innerHTML = "";
  result.details
    .filter((d) => !onlyIncorrect || !d.correct)
    .forEach((d) => {
      const q = d.question;
      const status = d.correct ? "correct" : d.points > 0 ? "partial" : "incorrect";
      const item = ce("div", { class: `review-item ${status}` });
      item.appendChild(ce("div", { class: "review-head" }, [
        ce("span", { class: "obj-code" }, q.domain),
        ce("span", {}, typeLabel(q.type)),
        ce("span", {}, statusLabel({ status, points: d.points })),
      ]));
      item.appendChild(ce("div", { class: "review-question" }, q.question));
      const renderBody = REVIEW_BODY_RENDERERS[q.type] || REVIEW_BODY_RENDERERS.choice;
      item.appendChild(renderBody(q, d.selected));
      if (q.explanation) item.appendChild(ce("div", { class: "review-explanation" }, q.explanation));
      reviewBox.appendChild(item);
    });
}

async function retakeMissed(result) {
  if (!(await confirmTakeOverOtherTab())) return;
  const missed = result.details.filter((d) => !d.correct).map((d) => d.question);
  if (missed.length === 0) {
    alertDialog(t("results.noneMissed"));
    return;
  }
  beginSession(prepareSessionQuestions(missed, { shuffleOptions: el("#shuffle-options").checked }), null);
}

// --------------------------------------------------------------------- Init

// Leaving the exam page mid-attempt would otherwise leave the timer running in the
// background and auto-submit later from whatever page the user is on.
async function confirmQuitExam() {
  if (!state.session) return true;
  const s = state.session;
  const ok = await confirmDialog(t("quit.confirm"), {
    confirmText: t("quit.yes"),
    cancelText: t("quit.no"),
    danger: true,
  });
  if (!ok || state.session !== s) return false;
  endSession();
  return true;
}

function wireNav() {
  elAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (await confirmQuitExam()) showPage(btn.dataset.page);
    });
  });
  el("#back-to-setup-btn").addEventListener("click", () => showPage("page-setup"));
}

function wireSetup() {
  el("#preset-standard-btn").addEventListener("click", applyStandardPreset);
  el("#save-combined-btn").addEventListener("click", saveCombinedSet);
  el("#select-all-domains").addEventListener("click", () => {
    allObjectiveIds().forEach((id) => state.selectedObjectives.add(id));
    renderDomainFilters();
    refreshPoolCount();
  });
  el("#select-no-domains").addEventListener("click", () => {
    state.selectedObjectives.clear();
    renderDomainFilters();
    refreshPoolCount();
  });
  el("#num-questions").addEventListener("input", refreshPoolCount);
  el("#start-exam-btn").addEventListener("click", startExam);
  ["#timer-toggle", "#timer-minutes", "#shuffle-questions", "#shuffle-options", "#weighted-toggle", "#partial-toggle", "#mode-select", "#pbq-first"].forEach((sel) => {
    el(sel).addEventListener("change", persistSettings);
  });

  el("#file-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    // Reset so picking the same file again (e.g. after fixing it) fires "change" again.
    e.target.value = "";
    if (file) handleFileUpload(file);
  });
}

function wireExam() {
  el("#prev-btn").addEventListener("click", () => {
    state.session.index = Math.max(0, state.session.index - 1);
    renderExam();
  });
  el("#next-btn").addEventListener("click", () => {
    state.session.index = Math.min(state.session.questions.length - 1, state.session.index + 1);
    renderExam();
  });
  el("#mark-review-btn").addEventListener("click", () => {
    const s = state.session;
    const q = s.questions[s.index];
    if (s.marked.has(q._key)) s.marked.delete(q._key);
    else s.marked.add(q._key);
    renderExam();
  });
  el("#finish-btn").addEventListener("click", showReviewScreen);
  el("#review-return-btn").addEventListener("click", () => renderExam());
  el("#review-submit-btn").addEventListener("click", finishExam);
  el("#check-btn").addEventListener("click", checkCurrentAnswer);
  el("#quit-exam-btn").addEventListener("click", async () => {
    if (await confirmQuitExam()) showPage("page-setup");
  });
}

function wireProgress() {
  el("#clear-progress-btn").addEventListener("click", async () => {
    const ok = await confirmDialog(t("progress.clearConfirm"), {
      confirmText: t("progress.delete"),
      danger: true,
    });
    if (!ok) return;
    clearProgress();
    renderProgress();
  });
}

function wireInstructions() {
  el("#copy-prompt-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(UPLOAD_FORMAT_DOC);
      el("#copy-prompt-btn").textContent = t("instr.copied");
      setTimeout(() => (el("#copy-prompt-btn").textContent = t("instr.copy")), 1500);
    } catch {
      alertDialog(t("instr.copyFailed"));
    }
  });
  el("#download-example-btn").addEventListener("click", downloadExample);
}

// Re-renders everything that has text in it, for a live language switch.
function applyLanguage(lang) {
  setLanguage(lang);
  el("#lang-select").value = getLanguage();
  translatePage();
  renderSetsPanel();
  renderDomainFilters();
  refreshPoolCount();
  if (state.session) (state.reviewing ? showReviewScreen : renderExam)();
  if (state.lastResult) renderResults(state.lastResult);
  if (el("#page-progress").classList.contains("active")) renderProgress();
}

function applyTheme(theme) {
  const valid = theme === "light" || theme === "dark" ? theme : "auto";
  if (valid === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = valid;
  el("#theme-select").value = valid;
}

function wireTheme() {
  applyTheme(loadTheme());
  el("#theme-select").addEventListener("change", (e) => {
    saveTheme(e.target.value);
    applyTheme(e.target.value);
  });
}

// Exam keyboard shortcuts. Ignored while typing, with modifier keys, or when a
// dialog is open (dialogs handle their own keys).
function onExamKey(e) {
  const s = state.session;
  if (!s || state.reviewing || !el("#page-exam").classList.contains("active")) return;
  if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector(".modal-backdrop")) return;
  const target = e.target;
  if (target.matches?.("input[type=text], input[type=number], select, textarea")) return;
  const q = s.questions[s.index];
  const clickIf = (selector) => {
    const button = el(selector);
    if (button && !button.disabled && button.offsetParent !== null) button.click();
  };

  if (/^[1-9]$/.test(e.key)) {
    const n = Number(e.key) - 1;
    const choices = q.type === "hotspot" ? elAll("#options-box .hotspot-zone") : elAll("#options-box .option-row input");
    const choice = choices[n];
    if (choice && !choice.disabled) choice.click();
  } else if (e.key === "ArrowRight") clickIf("#next-btn");
  else if (e.key === "ArrowLeft") clickIf("#prev-btn");
  else if (e.key === "m" || e.key === "M") clickIf("#mark-review-btn");
  else if (e.key === "c" || e.key === "C") clickIf("#check-btn");
  else return;
  e.preventDefault();
}

function wireLanguage() {
  el("#lang-select").addEventListener("change", (e) => {
    saveLanguage(e.target.value);
    applyLanguage(e.target.value);
  });
}

export function initApp() {
  state.sets = loadUploadedSets();
  applySavedSettings(loadSettings());
  wireNav();
  wireSetup();
  wireExam();
  wireInstructions();
  wireProgress();
  wireLanguage();
  wireTheme();
  document.addEventListener("keydown", onExamKey);
  setLanguage(loadLanguage() || defaultLanguage());
  el("#lang-select").value = getLanguage();
  translatePage();
  renderSetsPanel();
  renderDomainFilters();
  renderInstructions();
  refreshPoolCount();
  showPage("page-setup");
  window.addEventListener("storage", onSessionStorageChange);
  window.addEventListener("pagehide", () => persistSession({ alive: false }));
  resumeSavedSession();
}
