// In-page replacement for confirm()/alert(). Browsers let users tick "don't allow
// this site to prompt again", after which confirm() silently returns false — that
// would make it impossible to submit or quit an exam. These never get suppressed.
import { t } from "./i18n.js";

const open = new Set();

// With `input`, the dialog has a text field and resolves to its value (or null if
// cancelled); otherwise it resolves to true/false.
export function showDialog({ message, confirmText = t("dialog.ok"), cancelText = null, danger = false, input = null }) {
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

    let field = null;
    if (input) {
      field = document.createElement(input.multiline ? "textarea" : "input");
      if (input.multiline) {
        field.rows = 16;
        field.spellcheck = false;
        box.classList.add("modal-wide");
      } else {
        field.type = "text";
      }
      field.className = "modal-input";
      field.value = input.value || "";
      field.setAttribute("aria-label", message);
      box.appendChild(field);
    }
    const confirmValue = () => (field ? field.value : true);
    const cancelValue = field ? null : false;

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
    const entry = { finish, cancel: () => finish(cancelValue) };

    let cancelBtn = null;
    if (cancelText) {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn";
      cancelBtn.dataset.action = "cancel";
      cancelBtn.textContent = cancelText;
      cancelBtn.addEventListener("click", () => finish(cancelValue));
      actions.appendChild(cancelBtn);
    }
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = `btn ${danger ? "danger" : "primary"}`;
    okBtn.dataset.action = "confirm";
    okBtn.textContent = confirmText;
    okBtn.addEventListener("click", () => finish(confirmValue()));
    actions.appendChild(okBtn);
    box.appendChild(actions);

    // Capture phase so exam keyboard shortcuts don't also fire while a dialog is open.
    const onKey = (e) => {
      if (e.key === "Escape") finish(cancelText ? cancelValue : confirmValue());
      else if (e.key === "Enter" && field && !input.multiline && document.activeElement === field) finish(confirmValue());
      else if (e.key === "Tab") {
        const buttons = [field, cancelBtn, okBtn].filter(Boolean);
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
    if (field) {
      field.focus();
      field.select();
    } else {
      (danger && cancelBtn ? cancelBtn : okBtn).focus();
    }
  });
}

export function confirmDialog(message, { confirmText = t("dialog.ok"), cancelText = t("dialog.cancel"), danger = false } = {}) {
  return showDialog({ message, confirmText, cancelText, danger });
}

export function promptDialog(message, { value = "", multiline = false, confirmText = t("dialog.ok"), cancelText = t("dialog.cancel") } = {}) {
  return showDialog({ message, confirmText, cancelText, input: { value, multiline } });
}

export function alertDialog(message) {
  return showDialog({ message });
}

// Non-blocking notice that fades out on its own (e.g. "10 minutes left").
export function showToast(message, { durationMs = 6000 } = {}) {
  let region = document.querySelector(".toast-region");
  if (!region) {
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  region.appendChild(toast);
  setTimeout(() => toast.remove(), durationMs);
}

// Closes every open dialog as if cancelled, e.g. when the exam timer runs out
// while a "Submit anyway?" question is still on screen.
export function dismissAllDialogs() {
  for (const entry of [...open]) entry.cancel();
}
