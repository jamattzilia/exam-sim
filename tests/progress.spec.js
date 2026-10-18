import { test, expect } from "@playwright/test";
import { updateStats, isDue, objectiveAccuracy } from "../js/progress.js";
import { openApp, onlyObjectives, startExam, answerModal, clickSubmit } from "./helpers.js";

const DAY = 24 * 60 * 60 * 1000;

test("Leitner boxes: a miss is due now, each correct answer pushes the review out", () => {
  let stats = updateStats({}, [{ key: "q", correct: false }], 0);
  expect(stats.q.box).toBe(0);
  expect(isDue(stats.q, 0)).toBe(true);
  stats = updateStats(stats, [{ key: "q", correct: true }], 0);
  expect(stats.q.box).toBe(1);
  expect(isDue(stats.q, DAY - 1)).toBe(false);
  expect(isDue(stats.q, DAY)).toBe(true);
  for (let i = 0; i < 10; i++) stats = updateStats(stats, [{ key: "q", correct: true }], 0);
  expect(stats.q.box).toBe(4);
  expect(isDue(stats.q, 20 * DAY)).toBe(false);
  stats = updateStats(stats, [{ key: "q", correct: false }], 0);
  expect(stats.q).toMatchObject({ box: 0, seen: 13, right: 11 });
});

test("objective accuracy aggregates attempts, weakest first", () => {
  const rows = objectiveAccuracy([
    { perObjective: { "1.1": { points: 2, total: 2 }, "2.4": { points: 0, total: 2 } } },
    { perObjective: { "2.4": { points: 1, total: 2 } } },
  ]);
  expect(rows.map((r) => [r.id, r.percent])).toEqual([["2.4", 25], ["1.1", 100]]);
});

test.describe("Progress page", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  // Objective 1.3 has two multiple-choice questions: s5 (Backout plan), s6 (Approval process).
  async function finishOneRightOneWrong(page) {
    await onlyObjectives(page, [[0, "1.3"]]);
    await startExam(page, { n: 2, shuffleQuestions: false });
    for (let i = 0; i < 2; i++) {
      const text = await page.textContent("#question-text");
      const pick = text.includes("reverse the change") ? "Impact analysis" : "Approval process"; // first wrong, second right
      await page.locator(".option-row", { hasText: pick }).locator("input").check();
      await (i === 0 ? page.click("#next-btn") : clickSubmit(page));
    }
    await expect(page.locator("#page-results")).toHaveClass(/active/);
  }

  test("a finished exam shows up in history, weak objectives and missed review", async ({ page }) => {
    await finishOneRightOneWrong(page);
    await page.click('button.nav-btn[data-page="page-progress"]');
    await expect(page.locator(".history-table tbody tr")).toHaveCount(1);
    await expect(page.locator(".history-table tbody tr")).toContainText("1 / 2 (50%)");
    await expect(page.locator(".weak-row")).toContainText("1.3");
    await expect(page.locator("#review-missed-btn")).toHaveText("Retry all missed (1)");
    await expect(page.locator("#review-due-btn")).toHaveText("Review due questions (1)");

    await page.click("#review-missed-btn");
    await expect(page.locator("#page-exam")).toHaveClass(/active/);
    await expect(page.locator("#exam-progress")).toHaveText("Question 1 of 1");
    await expect(page.locator("#question-text")).toContainText("reverse the change");
    await expect(page.locator("#check-btn")).toBeVisible(); // review runs in practice mode
  });

  test("answering a missed question correctly takes it off the review list", async ({ page }) => {
    await finishOneRightOneWrong(page);
    await page.click('button.nav-btn[data-page="page-progress"]');
    await page.click("#review-missed-btn");
    await page.locator(".option-row", { hasText: "Backout plan" }).locator("input").check();
    await clickSubmit(page);
    await page.click('button.nav-btn[data-page="page-progress"]');
    await expect(page.locator("#review-missed-btn")).toHaveText("Retry all missed (0)");
    await expect(page.locator(".history-table tbody tr")).toHaveCount(2);
  });

  test("skipped questions don't count as missed", async ({ page }) => {
    await onlyObjectives(page, [[0, "1.3"]]);
    await startExam(page, { n: 2 });
    await page.click("#next-btn");
    await clickSubmit(page);
    await answerModal(page, true);
    await page.click('button.nav-btn[data-page="page-progress"]');
    await expect(page.locator("#review-missed-btn")).toHaveText("Retry all missed (0)");
  });

  test("Practice on a weak objective starts a practice session for that objective", async ({ page }) => {
    await finishOneRightOneWrong(page);
    await page.click('button.nav-btn[data-page="page-progress"]');
    await page.locator(".weak-row", { hasText: "1.3" }).locator("button", { hasText: "Practice" }).click();
    await expect(page.locator("#question-domain")).toContainText("1.3");
    await expect(page.locator("#exam-progress")).toHaveText("Question 1 of 2");
    await expect(page.locator("#check-btn")).toBeVisible();
  });

  test("history can be cleared after confirming", async ({ page }) => {
    await finishOneRightOneWrong(page);
    await page.click('button.nav-btn[data-page="page-progress"]');
    await page.click("#clear-progress-btn");
    await answerModal(page, true);
    await expect(page.locator("#attempt-history")).toContainText("No finished attempts yet.");
    await expect(page.locator("#review-missed-btn")).toHaveText("Retry all missed (0)");
  });
});
