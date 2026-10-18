import { expect } from "@playwright/test";

export const ORDERING_STEPS = [
  "Preparation",
  "Detection and analysis",
  "Containment",
  "Eradication",
  "Recovery",
  "Post-incident activity (lessons learned)",
];

// Fails the test if the app ever falls back to a native confirm()/alert(). Tests locate
// elements by their English text, so the interface language is pinned unless given.
export async function openApp(page, { lang = "en" } = {}) {
  page.on("dialog", (d) => {
    throw new Error(`Unexpected native dialog: ${d.message()}`);
  });
  if (lang) await page.addInitScript((l) => localStorage.setItem("examsim.lang.v1", JSON.stringify(l)), lang);
  await page.goto("/index.html");
}

export const modal = (page) => page.locator(".modal");

export async function answerModal(page, accept = true) {
  await modal(page).locator(`[data-action="${accept ? "confirm" : "cancel"}"]`).click();
  await expect(modal(page)).toHaveCount(0);
}

// Clicks through a dialog only if one appears (e.g. "N unanswered, submit anyway?").
export async function acceptModalIfShown(page) {
  const confirm = modal(page).locator('[data-action="confirm"]');
  if (await confirm.isVisible({ timeout: 500 }).catch(() => false)) await confirm.click();
}

export async function onlyObjectives(page, selections) {
  await page.click("#select-no-domains");
  for (const [card, range] of selections) {
    const input = page.locator(".domain-card").nth(card).locator(".range-input");
    await input.fill(range);
    await input.press("Enter");
  }
}

export async function startExam(page, { n, timer = false, shuffleQuestions } = {}) {
  if (!timer) await page.uncheck("#timer-toggle");
  if (shuffleQuestions === false) await page.uncheck("#shuffle-questions");
  if (n != null) await page.fill("#num-questions", String(n));
  await page.click("#start-exam-btn");
  await expect(page.locator("#page-exam")).toHaveClass(/active/);
}

// "Review & submit" opens the review screen; its Submit button ends the exam.
export async function clickSubmit(page) {
  await page.click("#finish-btn");
  await page.click("#review-submit-btn");
}

export async function submitExam(page) {
  await page.locator(".palette-btn").last().click();
  await clickSubmit(page);
  await acceptModalIfShown(page);
  await expect(page.locator("#page-results")).toHaveClass(/active/);
}

export async function goToQuestionOfType(page, typeLabel) {
  const count = await page.locator(".palette-btn").count();
  for (let i = 0; i < count; i++) {
    await page.locator(".palette-btn").nth(i).click();
    if ((await page.textContent("#question-domain")).includes(typeLabel)) return;
  }
  throw new Error(`No question of type ${typeLabel}`);
}

const MCQ_ANSWERS = {
  "A guard stationed": "Physical",
  "An organization requires two different managers": "Preventive",
  "Which member of the CIA triad": "Integrity",
  "In a Zero Trust architecture": "Policy decision point",
  "Placing a public-facing web server": "demilitarized zone",
  "Which network device is primarily responsible": "Firewall",
  "During which incident response phase": "Eradication",
  "Documenting exactly who collected": "Chain of custody",
  "After an incident is fully resolved": "lessons learned review",
};

export async function sortOrderingWithArrows(page, target = ORDERING_STEPS) {
  for (let pos = 0; pos < target.length; pos++) {
    for (;;) {
      const texts = await page.locator(".order-item .order-text").allTextContents();
      if (texts[pos] === target[pos]) break;
      await page.locator(".order-item").nth(texts.indexOf(target[pos])).locator("button", { hasText: "▲" }).click();
    }
  }
}

// Answers the current built-in sample question (objectives 1.1, 1.2, 3.2, 4.8) correctly.
export async function answerSampleCorrectly(page) {
  const text = (await page.textContent("#question-text")).trim();
  const label = await page.textContent("#question-domain");
  const key = Object.keys(MCQ_ANSWERS).find((k) => text.startsWith(k));
  if (key) return page.locator(".option-row", { hasText: MCQ_ANSWERS[key] }).locator("input").check();
  if (label.includes("Matching")) {
    const targets = ["Physical", "Managerial", "Technical", "Operational"];
    for (let r = 0; r < targets.length; r++) {
      await page.locator(".matching-row").nth(r).locator("select").selectOption({ label: targets[r] });
    }
  } else if (label.includes("Ordering")) {
    await sortOrderingWithArrows(page);
  } else if (label.includes("Fill in the blank")) {
    await page.locator(".blank-input").fill("integrity");
  } else if (label.includes("Hotspot")) {
    await page.locator(".hotspot-zone", { hasText: "DMZ" }).click();
  } else if (label.includes("Simulation")) {
    await setFirewallRows(page, { "TCP 443": "Allow", "TCP 80": "Deny", "TCP 23": "Deny", "TCP 3389": "Deny" });
  } else {
    throw new Error(`Don't know how to answer: ${text.slice(0, 60)}`);
  }
}

export async function setFirewallRows(page, wanted) {
  const rows = page.locator(".sim-row");
  const n = await rows.count();
  for (let r = 0; r < n; r++) {
    const label = await rows.nth(r).locator(".sim-label").textContent();
    const key = Object.keys(wanted).find((k) => label.includes(k));
    await rows.nth(r).locator("select").selectOption({ label: wanted[key] });
  }
}

export async function uploadSet(page, filePath) {
  await page.click('button.nav-btn[data-page="page-instructions"]');
  await page.setInputFiles("#file-input", filePath);
  await expect(page.locator("#upload-result")).toBeVisible();
}

export async function importUploaded(page, filePath) {
  await uploadSet(page, filePath);
  await page.locator("#upload-result button", { hasText: "Import" }).click();
  await page.click('button.nav-btn[data-page="page-setup"]');
}
