import { DOMAINS, OBJECTIVE_INDEX, EXAM_INFO, allObjectiveIds } from "./data/objectives.js";
import { SAMPLE_SET } from "./data/sampleQuestions.js";
import { DOMAIN2_21_23_SET } from "./data/domain2Set.js";
import {
  loadUploadedSets,
  addUploadedSet,
  removeUploadedSet,
  loadSettings,
  saveSettings,
  loadSession,
  saveSession,
  clearSession,
  SESSION_KEY,
  loadHistory,
  saveHistory,
  loadStats,
  saveStats,
  clearProgress,
} from "./storage.js";
import { updateStats, isDue, isMissed, attemptRecord, addAttempt, objectiveAccuracy } from "./progress.js";
import { validateQuestionSet, BLANK_TOKEN } from "./validation.js";
import { confirmDialog, alertDialog, dismissAllDialogs } from "./dialog.js";
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
        ce("span", { class: "badge" }, `${count} q`),
        set.builtin ? ce("span", { class: "badge badge-muted" }, "built-in") : null,
      ]),
      !set.builtin
        ? ce("button", {
            class: "btn-link danger",
            onclick: async () => {
              if (!(await confirmDialog(`Remove set "${set.setName}"?`, { confirmText: "Remove", danger: true }))) return;
              removeUploadedSet(set.id);
              state.sets = loadUploadedSets();
              state.enabledSetIds.delete(set.id);
              renderSetsPanel();
              refreshPoolCount();
            },
          }, "Remove")
        : null,
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
    if (someChecked && !allChecked) header.classList.add("partial");
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
        placeholder: `e.g. ${objIds[0]}-${objIds[Math.max(0, objIds.length - 2)]}`,
        class: "range-input",
        onkeydown: (e) => {
          if (e.key === "Enter") applyFromInput(e.target);
        },
      }),
      ce("button", { class: "btn-link", onclick: (e) => applyFromInput(e.target.previousElementSibling) }, "Apply range"),
      ce("button", { class: "btn-link", onclick: () => { objIds.forEach((id) => state.selectedObjectives.add(id)); renderDomainFilters(); refreshPoolCount(); } }, "All"),
      ce("button", { class: "btn-link", onclick: () => { objIds.forEach((id) => state.selectedObjectives.delete(id)); renderDomainFilters(); refreshPoolCount(); } }, "None"),
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

function updateObjectiveCounts() {
  const pool = buildPool(enabledSets(), allObjectiveIds());
  const stats = poolStatsByObjective(pool);
  elAll(".count-badge").forEach((badge) => {
    const objId = badge.dataset.obj;
    badge.textContent = `${stats[objId] || 0} q`;
  });
}

function refreshPoolCount() {
  updateObjectiveCounts();
  const pool = buildPool(enabledSets(), [...state.selectedObjectives]);
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
}

function applyStandardPreset() {
  allObjectiveIds().forEach((id) => state.selectedObjectives.add(id));
  const total = Math.min(EXAM_INFO.fullExamQuestions, buildPool(enabledSets(), allObjectiveIds()).length);
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
      showUploadResult({ valid: false, errors: [`Could not parse JSON: ${e.message}`], warnings: [] });
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
    box.appendChild(ce("div", { class: "upload-ok" }, `✓ Parsed ${parsedCount} valid question(s).`));
  } else if (parsedCount > 0) {
    box.appendChild(
      ce("div", { class: "upload-warn" }, `⚠ ${parsedCount} question(s) parsed OK, but ${result.errors.length} error(s) found. You can still import the valid subset.`)
    );
  } else {
    box.appendChild(ce("div", { class: "upload-error" }, `✗ Import failed — no valid questions found.`));
  }

  if (result.errors.length) {
    const list = ce("ul", { class: "error-list" });
    result.errors.slice(0, 15).forEach((e) => list.appendChild(ce("li", {}, e)));
    if (result.errors.length > 15) list.appendChild(ce("li", {}, `...and ${result.errors.length - 15} more.`));
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
          const newSet = { id: `up-${Date.now()}`, setName: result.set.setName, questions: result.set.questions };
          if (!addUploadedSet(newSet)) {
            alertDialog("Could not save this set: browser storage is full or disabled. Remove an older set and try again.");
            return;
          }
          state.sets = loadUploadedSets();
          state.enabledSetIds.add(newSet.id);
          renderSetsPanel();
          refreshPoolCount();
          box.style.display = "none";
        },
      }, `Import ${parsedCount} question(s) into a new set`)
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
  const pool = buildPool(enabledSets(), [...state.selectedObjectives]);
  if (pool.length === 0) return;

  const numQuestions = Math.max(1, Math.min(Number(el("#num-questions").value) || pool.length, pool.length));
  const shuffleQuestions = el("#shuffle-questions").checked;
  const shuffleOptions = el("#shuffle-options").checked;
  const timerEnabled = el("#timer-toggle").checked;
  const timerMinutes = Math.max(1, Number(el("#timer-minutes").value) || 90);
  const pick = el("#weighted-toggle").checked ? pickQuestionsWeighted : pickQuestions;

  const chosen = pick(pool, numQuestions, { shuffleQuestions });
  beginSession(prepareSessionQuestions(chosen, { shuffleOptions }), timerEnabled ? Date.now() + timerMinutes * 60000 : null);
}

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
  return { ...saved, mode: saved.mode || "exam", marked: new Set(saved.marked || []), checked: new Set(saved.checked || []) };
}

function isRunningInAnotherTab(saved) {
  return Boolean(saved?.ownerTab) && saved.ownerTab !== TAB_ID && Date.now() - (saved.heartbeatAt || 0) < STALE_AFTER_MS;
}

// Starting a new exam overwrites the saved one, so ask before ending a live exam elsewhere.
async function confirmTakeOverOtherTab() {
  if (!isRunningInAnotherTab(loadSession())) return true;
  return confirmDialog("An exam is in progress in another tab. Starting a new one here will end it there.", {
    confirmText: "Start new exam",
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
  alertDialog("This exam was continued in another tab, so it was closed here. Only one tab can run an exam at a time.");
}

// Offers to restore an exam that was in progress when the page was reloaded or closed.
async function resumeSavedSession() {
  const saved = loadSession();
  if (!saved || !Array.isArray(saved.questions) || saved.questions.length === 0) return false;
  if (isRunningInAnotherTab(saved)) {
    const move = await confirmDialog(
      `An exam is in progress in another tab (question ${saved.index + 1} of ${saved.questions.length}). Continue it here instead? It will close in the other tab.`,
      { confirmText: "Continue here", cancelText: "Leave it there" }
    );
    if (!move) return false;
    state.session = restoreSession(saved);
    enterExam();
    return true;
  }
  const expired = saved.endsAt != null && Date.now() >= saved.endsAt;
  const prompt = expired
    ? "Your previous timed exam ran out of time while the page was closed. Submit it now and see the results?"
    : `Resume your unfinished exam (question ${saved.index + 1} of ${saved.questions.length})?`;
  const ok = await confirmDialog(prompt, {
    confirmText: expired ? "Submit" : "Resume",
    cancelText: expired ? "Discard" : "Start over",
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
  };
  tick();
  if (state.session === session) timerId = setInterval(tick, 1000);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

const PBQ_TYPE_LABELS = {
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

  el("#exam-progress").textContent = `Question ${s.index + 1} of ${s.questions.length}`;
  el("#exam-timer-wrap").style.display = s.timerEnabled ? "inline-block" : "none";
  el("#question-domain").textContent = `${q.domain} — ${OBJECTIVE_INDEX[q.domain]?.title || ""} · ${PBQ_TYPE_LABELS[q.type] || ""}`;

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
  if (status === "correct") return "✓ Correct";
  if (status === "partial") return `◐ Partial credit (${Math.round(points * 100)}%)`;
  return "✗ Incorrect";
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
    if (multiple) box.appendChild(ce("p", { class: "hint" }, `Select ${limit}.`));
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
      ce("p", { class: "hint" }, `Assign each item on the left to the correct match on the right. ${oneToOne ? "Each option can be used once." : "Options can be used more than once."}`)
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
      }, [ce("option", { value: "" }, "-- Select --")]);
      q.displayTargets.forEach((origIdx) => {
        const opt = ce("option", { value: String(origIdx) }, q.targets[origIdx]);
        if (response[promptIdx] === origIdx) opt.setAttribute("selected", "selected");
        select.appendChild(opt);
      });
      box.appendChild(ce("div", { class: "matching-row" }, [ce("span", { class: "matching-prompt" }, promptText), select]));
    });
  },

  ordering(q, s, box) {
    box.appendChild(ce("p", { class: "hint" }, "Drag the steps (or use the arrows) into the correct order (top = first)."));
    const order = s.answers[q._key] || blankResponse(q);
    const list = ce("div", { class: "order-list" });
    order.forEach((origIdx, pos) => {
      const row = ce("div", { class: "order-item", "data-orig": String(origIdx) }, [
        ce("span", { class: "order-handle", title: "Drag to reorder" }, "⠿"),
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
    box.appendChild(ce("p", { class: "hint" }, "Click the zone(s) that answer the question."));
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
        }, [ce("option", { value: "" }, "-- Select --"), ...row.options.map((opt) => {
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
    const ok = await confirmDialog(`${unanswered} question(s) are unanswered. Submit anyway?`, { confirmText: "Submit" });
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
  const fromEnabled = buildPool(enabledSets(), [objId]);
  const pool = fromEnabled.length ? fromEnabled : buildPool(allSets(), [objId]);
  startPractice(pickQuestions(pool, 10), `There are no questions for objective ${objId} in your question sets.`);
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
    ce("button", { class: "btn primary", id: "review-due-btn", onclick: () => startPractice(due, "Nothing is due for review right now.") }, `Review due questions (${due.length})`),
    ce("button", { class: "btn", id: "review-missed-btn", onclick: () => startPractice(missed, "No missed questions to retry.") }, `Retry all missed (${missed.length})`)
  );
  if (due.length > MAX_REVIEW) actions.appendChild(ce("span", { class: "hint" }, `Sessions are capped at ${MAX_REVIEW} questions.`));

  const history = loadHistory();
  const weak = el("#weak-objectives");
  weak.innerHTML = "";
  const accuracy = objectiveAccuracy(history);
  if (accuracy.length === 0) weak.appendChild(ce("p", { class: "hint" }, "Finish an exam or practice session to see per-objective accuracy."));
  for (const row of accuracy) {
    weak.appendChild(
      ce("div", { class: "breakdown-row weak-row" }, [
        ce("span", { class: "bd-label", title: OBJECTIVE_INDEX[row.id]?.title || "" }, `${row.id} ${OBJECTIVE_INDEX[row.id]?.title || ""}`),
        ce("div", { class: "bd-bar-bg" }, [ce("div", { class: "bd-bar", style: `width:${row.percent}%` })]),
        ce("span", { class: "bd-num" }, `${row.percent}% of ${row.total}`),
        ce("button", { class: "btn-link", onclick: () => practiceObjective(row.id) }, "Practice"),
      ])
    );
  }

  const list = el("#attempt-history");
  list.innerHTML = "";
  if (history.length === 0) {
    list.appendChild(ce("p", { class: "hint" }, "No finished attempts yet."));
  } else {
    const table = ce("table", { class: "history-table" }, [
      ce("thead", {}, [ce("tr", {}, ["Date", "Mode", "Score", "Scaled", "Result"].map((h) => ce("th", {}, h)))]),
    ]);
    const body = ce("tbody");
    for (const a of [...history].reverse().slice(0, 30)) {
      body.appendChild(
        ce("tr", {}, [
          ce("td", {}, new Date(a.finishedAt).toLocaleString()),
          ce("td", {}, a.mode === "practice" ? "Practice" : "Exam"),
          ce("td", {}, `${fmtPoints(a.points)} / ${a.total} (${a.percent}%)`),
          ce("td", {}, String(a.scaled)),
          ce("td", { class: a.passed ? "pass-text" : "fail-text" }, a.passed ? "PASS" : "FAIL"),
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
  const partialNote = result.partialCredit && result.points !== result.correctCount
    ? ` ${result.correctCount} fully correct; the rest is PBQ partial credit.`
    : "";
  el("#result-scaled").textContent =
    `Estimated scaled score: ${result.scaled} / ${EXAM_INFO.scaledScoreRange[1]}, passing ${EXAM_INFO.passingScaledScore}.${partialNote} ` +
    `CompTIA doesn't publish how raw points convert to the 100–900 scale (it is set per exam form), so this is a ` +
    `linear estimate: you need about ${passingPercent()}% of the points to reach ${EXAM_INFO.passingScaledScore}.`;
  const passBadge = el("#result-pass");
  passBadge.textContent = result.passed ? "PASS (estimated)" : "FAIL (estimated)";
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
      PBQ_TYPE_LABELS[q.type] || q.type,
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
      optList.appendChild(ce("li", { class: cls }, `${wasSelected ? "☑" : "☐"} ${optText}${isCorrectOpt ? " (correct)" : ""}`));
    });
    return optList;
  },

  matching(q, selected) {
    const list = ce("ul", { class: "review-options" });
    q.prompts.forEach((promptText, i) => {
      const correctTarget = q.targets[q.answer[i]];
      const yourTarget = selected[i] != null ? q.targets[selected[i]] : "(no answer)";
      const ok = selected[i] === q.answer[i];
      list.appendChild(
        ce("li", { class: ok ? "opt-correct" : "opt-wrong-selected" }, `${promptText} → your answer: ${yourTarget}${ok ? "" : ` (correct: ${correctTarget})`}`)
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
    if (order.length === 0) list.appendChild(ce("li", { class: "opt-wrong-selected" }, "(no answer)"));
    if (!(order.length && order.every((v, i) => v === i))) {
      const correctList = ce("ol", { class: "review-options" });
      q.items.forEach((text) => correctList.appendChild(ce("li", { class: "opt-correct" }, text)));
      return ce("div", {}, [ce("p", { class: "hint" }, "Your order:"), list, ce("p", { class: "hint" }, "Correct order:"), correctList]);
    }
    return list;
  },

  fill_blank(q, selected) {
    const list = ce("ul", { class: "review-options" });
    q.blanks.forEach((b, i) => {
      const val = (selected[i] || "").trim();
      const ok = blankMatches(b, val);
      list.appendChild(
        ce("li", { class: ok ? "opt-correct" : "opt-wrong-selected" }, `Blank ${i + 1}: "${val || "(blank)"}" ${ok ? "" : `(accepted: ${b.accepted.join(", ")})`}`)
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
      list.appendChild(ce("li", { class: cls }, `${wasSelected ? "☑" : "☐"} ${zone.label}${isCorrectZone ? " (correct)" : ""}`));
    });
    return list;
  },

  simulation(q, selected) {
    const list = ce("ul", { class: "review-options" });
    q.rows.forEach((row, i) => {
      const val = selected[i];
      const ok = rowMatches(row, val);
      const isBox = row.fieldType === "checkbox";
      const yourText = isBox ? (val ? "Checked" : "Unchecked") : val || "(no answer)";
      const correctText = isBox ? (row.answer ? "Checked" : "Unchecked") : row.answer;
      list.appendChild(ce("li", { class: ok ? "opt-correct" : "opt-wrong-selected" }, `${row.label}: ${yourText}${ok ? "" : ` (correct: ${correctText})`}`));
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
        ce("span", {}, PBQ_TYPE_LABELS[q.type] || ""),
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
    alertDialog("No missed questions — great job!");
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
  const ok = await confirmDialog("Quit this exam attempt without scoring? Progress will be lost.", {
    confirmText: "Quit exam",
    cancelText: "Keep going",
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
  ["#timer-toggle", "#timer-minutes", "#shuffle-questions", "#shuffle-options", "#weighted-toggle", "#partial-toggle", "#mode-select"].forEach((sel) => {
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
  el("#finish-btn").addEventListener("click", finishExam);
  el("#check-btn").addEventListener("click", checkCurrentAnswer);
  el("#quit-exam-btn").addEventListener("click", async () => {
    if (await confirmQuitExam()) showPage("page-setup");
  });
}

function wireProgress() {
  el("#clear-progress-btn").addEventListener("click", async () => {
    const ok = await confirmDialog("Delete your attempt history and spaced-repetition data? This can't be undone.", {
      confirmText: "Delete",
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
      el("#copy-prompt-btn").textContent = "Copied!";
      setTimeout(() => (el("#copy-prompt-btn").textContent = "Copy full instructions + prompt"), 1500);
    } catch {
      alertDialog("Could not copy automatically — please select and copy the text manually.");
    }
  });
  el("#download-example-btn").addEventListener("click", downloadExample);
}

export function initApp() {
  state.sets = loadUploadedSets();
  applySavedSettings(loadSettings());
  wireNav();
  wireSetup();
  wireExam();
  wireInstructions();
  wireProgress();
  renderSetsPanel();
  renderDomainFilters();
  renderInstructions();
  refreshPoolCount();
  showPage("page-setup");
  window.addEventListener("storage", onSessionStorageChange);
  window.addEventListener("pagehide", () => persistSession({ alive: false }));
  resumeSavedSession();
}
