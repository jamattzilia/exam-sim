// Persistence layer. Uses localStorage rather than cookies: this is a static,
// server-less app, so there is nothing to send the value to on every request —
// localStorage keeps the same "survives reload, per-browser" behavior without
// the size limits and request overhead of cookies.
const SETS_KEY = "examsim.sets.v1";
const SETTINGS_KEY = "examsim.settings.v1";
export const SESSION_KEY = "examsim.session.v1";

function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

// Returns false instead of throwing when storage is full or unavailable
// (private mode, blocked site data), so callers can tell the user.
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadUploadedSets() {
  return read(SETS_KEY, []);
}

export function addUploadedSet(set) {
  return write(SETS_KEY, [...loadUploadedSets(), set]);
}

export function removeUploadedSet(setId) {
  write(SETS_KEY, loadUploadedSets().filter((s) => s.id !== setId));
}

// Remembers the user's last-used setup screen: which sets/objectives were
// checked and the chosen exam options, so a reload doesn't reset the filters.
export function loadSettings() {
  return read(SETTINGS_KEY, null);
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

// The in-progress exam, so an accidental reload or closed tab can be resumed.
export function loadSession() {
  return read(SESSION_KEY, null);
}

export function saveSession(session) {
  write(SESSION_KEY, session);
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage unavailable; nothing to clear
  }
}
