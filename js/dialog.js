// In-page replacement for confirm()/alert(). Browsers let users tick "don't allow
// this site to prompt again", after which confirm() silently returns false — that
// would make it impossible to submit or quit an exam. These never get suppressed.

const open = new Set();

export function showDialog({ message, confirmText = "OK", cancelText = null, danger = false }) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    const box = document.createElement("div");
    box.className = "modal";
    box.setAttribute("role", cancelText ? "alertdialog" : "dialog");
    box.setAttribute("aria-modal", "true");

    const text = document.createElement("p");
    text.className = "modal-message";
    text.textContent = message;
    box.appendChild(text);

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const finish = (value) => {
      if (!open.has(entry)) return;
      open.delete(entry);
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
      resolve(value);
    };
    const entry = { finish };

    let cancelBtn = null;
    if (cancelText) {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn";
      cancelBtn.dataset.action = "cancel";
      cancelBtn.textContent = cancelText;
      cancelBtn.addEventListener("click", () => finish(false));
      actions.appendChild(cancelBtn);
    }
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = `btn ${danger ? "danger" : "primary"}`;
    okBtn.dataset.action = "confirm";
    okBtn.textContent = confirmText;
    okBtn.addEventListener("click", () => finish(true));
    actions.appendChild(okBtn);
    box.appendChild(actions);

    // Capture phase so exam keyboard shortcuts don't also fire while a dialog is open.
    const onKey = (e) => {
      if (e.key === "Escape") finish(!cancelText);
      else if (e.key === "Tab") {
        const buttons = [cancelBtn, okBtn].filter(Boolean);
        const i = buttons.indexOf(document.activeElement);
        buttons[(i + (e.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus();
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("keydown", onKey, true);

    open.add(entry);
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);
    (danger && cancelBtn ? cancelBtn : okBtn).focus();
  });
}

export function confirmDialog(message, { confirmText = "OK", cancelText = "Cancel", danger = false } = {}) {
  return showDialog({ message, confirmText, cancelText, danger });
}

export function alertDialog(message) {
  return showDialog({ message });
}

// Closes every open dialog as if cancelled, e.g. when the exam timer runs out
// while a "Submit anyway?" question is still on screen.
export function dismissAllDialogs() {
  for (const entry of [...open]) entry.finish(false);
}
