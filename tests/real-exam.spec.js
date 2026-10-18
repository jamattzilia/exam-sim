import { test, expect } from "@playwright/test";
import { openApp, onlyObjectives, startExam, answerModal, modal } from "./helpers.js";

const PBQ_LABEL = /Performance-based/;

test.beforeEach(async ({ page }) => openApp(page));

test("PBQs come first when the option is on, and keep pool order when off", async ({ page }) => {
  await onlyObjectives(page, [[0, "1.1-1.2"], [2, "3.2"], [3, "4.8"]]);
  await startExam(page, { n: 14 });
  const labels = [];
  for (let i = 0; i < 14; i++) {
    labels.push(await page.textContent("#question-domain"));
    if (i < 13) await page.click("#next-btn");
  }
  const firstMcq = labels.findIndex((l) => !PBQ_LABEL.test(l));
  expect(firstMcq).toBe(5);
  expect(labels.slice(firstMcq).some((l) => PBQ_LABEL.test(l))).toBe(false);

  await page.click("#quit-exam-btn");
  await answerModal(page, true);
  await page.uncheck("#pbq-first");
  await startExam(page, { n: 14, shuffleQuestions: false });
  expect(await page.textContent("#question-domain")).not.toMatch(PBQ_LABEL); // sample set starts with s1 (MCQ)
});

test("the review screen lists every question's status and leads back to questions or to submit", async ({ page }) => {
  await onlyObjectives(page, [[0, "1.3-1.4"]]);
  await startExam(page, { n: 4, shuffleQuestions: false });
  await page.locator(".option-row input").first().check();
  await page.click("#mark-review-btn");
  await page.locator(".palette-btn").last().click();
  await page.click("#finish-btn");

  await expect(page.locator("#review-screen")).toBeVisible();
  await expect(page.locator("#question-view")).toBeHidden();
  await expect(page.locator("#review-screen-counts")).toContainText("Answered: 1 · Unanswered: 3 · Marked for review: 1");
  const cells = page.locator(".review-cell");
  await expect(cells).toHaveCount(4);
  await expect(cells.nth(0)).toHaveClass(/answered/);
  await expect(cells.nth(0)).toHaveClass(/marked/);
  await expect(cells.nth(2)).toHaveClass(/unanswered/);

  await cells.nth(2).click();
  await expect(page.locator("#question-view")).toBeVisible();
  await expect(page.locator("#exam-progress")).toHaveText(/^Question 3 of 4/);

  await page.locator(".palette-btn").last().click();
  await page.click("#finish-btn");
  await page.click("#review-return-btn");
  await expect(page.locator("#exam-progress")).toHaveText(/^Question 4 of 4/);

  await page.click("#finish-btn");
  await page.click("#review-submit-btn");
  await expect(modal(page)).toContainText("3 question(s) are unanswered");
  await answerModal(page, true);
  await expect(page.locator("#page-results")).toHaveClass(/active/);
});

test("timer warns at 10 and 5 minutes left, once each, even across a reload", async ({ page }) => {
  await page.clock.install();
  await page.reload();
  await page.fill("#timer-minutes", "30");
  await startExam(page, { n: 3, timer: true });
  const toasts = page.locator(".toast");

  await page.clock.fastForward("19:50");
  await expect(toasts).toHaveCount(0);
  await page.clock.fastForward("00:15");
  await expect(toasts).toHaveText(["10 minutes left"]);
  await expect(page.locator("#exam-timer-wrap")).not.toHaveClass(/low/);

  await page.clock.fastForward("05:00");
  await expect(toasts.last()).toHaveText("5 minutes left");
  await expect(page.locator("#exam-timer-wrap")).toHaveClass(/low/);

  await page.reload();
  await answerModal(page, true); // resume
  await page.clock.fastForward("00:05");
  await expect(page.locator(".toast")).toHaveCount(0);
});

test("a short exam doesn't warn about thresholds longer than the exam itself", async ({ page }) => {
  await page.clock.install();
  await page.reload();
  await page.fill("#timer-minutes", "5");
  await startExam(page, { n: 3, timer: true });
  await page.clock.fastForward("00:30");
  await expect(page.locator(".toast")).toHaveCount(0);
});
