import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateQuestionSet } from "../js/validation.js";
import { openApp, onlyObjectives, startExam, submitExam, clickSubmit, importUploaded, modal, answerModal } from "./helpers.js";

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const toProgress = (page) => page.click('button.nav-btn[data-page="page-progress"]');
const toSetup = (page) => page.click('button.nav-btn[data-page="page-setup"]');

async function flagFirstReviewItem(page, note) {
  await page.locator(".review-item .flag-btn").first().click();
  await modal(page).locator(".modal-input").fill(note);
  await answerModal(page, true);
  await expect(page.locator(".review-item .flag-btn").first()).toHaveText("⚑ Flagged — undo");
}

test.beforeEach(async ({ page }) => openApp(page));

test("a flagged question is listed with its note and left out of exams until unflagged", async ({ page }) => {
  await onlyObjectives(page, [[0, "1.3"]]);
  await startExam(page, { n: 2 });
  await submitExam(page);
  await flagFirstReviewItem(page, "answer key looks wrong");

  await toProgress(page);
  const row = page.locator(".flag-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("answer key looks wrong");
  await expect(row).toContainText("built-in — can't be edited");

  await toSetup(page);
  await expect(page.locator("#pool-count")).toHaveText("1");
  await expect(page.locator("#sets-dupes")).toContainText("1 flagged question(s) skipped");
  await page.uncheck("#skip-flagged");
  await expect(page.locator("#pool-count")).toHaveText("2");
  await page.check("#skip-flagged");

  await toProgress(page);
  await row.locator("button", { hasText: "Unflag" }).click();
  await expect(page.locator("#flagged-list")).toContainText("No flagged questions.");
  await toSetup(page);
  await expect(page.locator("#pool-count")).toHaveText("2");
});

test("questions can be flagged from practice feedback", async ({ page }) => {
  await page.selectOption("#mode-select", "practice");
  await onlyObjectives(page, [[0, "1.3"]]);
  await startExam(page, { n: 2 });
  await page.click("#check-btn");
  await page.locator(".feedback .flag-btn").click();
  await answerModal(page, true); // empty note is fine
  await expect(page.locator(".feedback .flag-btn")).toHaveText("⚑ Flagged — undo");
});

test("an uploaded question can be fixed in the JSON editor; invalid edits are refused", async ({ page }) => {
  await importUploaded(page, fixture("collide-a.json")); // q1: options a0/a1, answer a0
  await page.locator(".set-row", { hasText: "Built-in Sample Set" }).locator("input").uncheck();
  await startExam(page, { n: 1 });
  await page.locator(".option-row", { hasText: "a1" }).locator("input").check();
  await clickSubmit(page);
  await expect(page.locator(".review-item")).toContainText("✗ Incorrect");
  await flagFirstReviewItem(page, "a1 is right");

  await toProgress(page);
  await page.locator(".flag-row button", { hasText: "Edit" }).click();
  const editor = modal(page).locator("textarea");
  const original = JSON.parse(await editor.inputValue());
  expect(original.answer).toEqual([0]);

  // Each step here opens the next dialog, so press the buttons directly.
  const confirm = () => modal(page).locator('[data-action="confirm"]').click();
  await editor.fill(JSON.stringify({ ...original, domain: "9.9" }));
  await confirm();
  await expect(modal(page)).toContainText("isn't valid");
  await confirm();
  await expect(modal(page).locator("textarea")).toHaveValue(/"9\.9"/); // reopened with the user's text

  await modal(page).locator("textarea").fill(JSON.stringify({ ...original, answer: [1] }));
  await answerModal(page, true);
  await expect(page.locator(".toast").last()).toHaveText("Question updated.");
  await expect(page.locator("#flagged-list")).toContainText("No flagged questions.");

  await toSetup(page);
  await startExam(page, { n: 1 });
  await page.locator(".option-row", { hasText: "a1" }).locator("input").check();
  await clickSubmit(page);
  await expect(page.locator(".review-item")).toContainText("✓ Correct");
});

test("flagged questions export in the upload format with their notes", async ({ page }) => {
  await onlyObjectives(page, [[0, "1.3"]]);
  await startExam(page, { n: 2 });
  await submitExam(page);
  await flagFirstReviewItem(page, "typo in option C");
  await toProgress(page);
  const [file] = await Promise.all([page.waitForEvent("download"), page.click("#export-flags-btn")]);
  const path = test.info().outputPath("flagged.json");
  await file.saveAs(path);
  const data = JSON.parse(readFileSync(path, "utf8"));
  expect(data.questions).toHaveLength(1);
  expect(data.questions[0].flagNote).toBe("typo in option C");
  expect(validateQuestionSet(data, "flagged").valid).toBe(true);
});
