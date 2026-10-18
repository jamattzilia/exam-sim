import { test, expect } from "@playwright/test";
import {
  openApp,
  answerModal,
  onlyObjectives,
  startExam,
  submitExam,
  answerSampleCorrectly,
  goToQuestionOfType,
  modal, clickSubmit } from "./helpers.js";

test.beforeEach(async ({ page }) => openApp(page));

const PBQ_OBJECTIVES = [[0, "1.1-1.2"], [2, "3.2"], [3, "4.8"]];

test("all 7 question types score 100% when answered correctly", async ({ page }) => {
  await onlyObjectives(page, PBQ_OBJECTIVES);
  const n = Number(await page.textContent("#pool-count"));
  expect(n).toBe(14);
  await startExam(page, { n });
  for (let i = 0; i < n; i++) {
    await answerSampleCorrectly(page);
    await (i < n - 1 ? page.click("#next-btn") : clickSubmit(page));
  }
  await expect(page.locator("#result-score")).toHaveText(/^14 \/ 14 \(100%\)/);
  const review = page.locator("#review-list");
  for (const label of ["Matching", "Ordering", "Fill in the blank", "Hotspot", "Simulation"]) {
    await expect(review).toContainText(label);
  }
});

test("Domain 2 built-in set renders every question and skipping everything scores 0", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator(".set-row", { hasText: "Built-in Sample Set" }).locator("input").uncheck();
  await page.locator(".set-row", { hasText: "Domain 2.0" }).locator("input").check();
  await expect(page.locator("#pool-count")).toHaveText("49");
  await startExam(page, { n: 49 });
  for (let i = 0; i < 48; i++) await page.click("#next-btn");
  await clickSubmit(page);
  await answerModal(page, true);
  await expect(page.locator("#result-score")).toHaveText(/^0 \/ 49/);
  await expect(page.locator(".review-item")).toHaveCount(49);
  expect(errors).toEqual([]);
});

test("leaving a timed exam stops its timer (next untimed exam is not auto-submitted)", async ({ page }) => {
  await startExam(page, { n: 5, timer: true });
  await page.click('button.nav-btn[data-page="page-setup"]');
  await answerModal(page, true);
  await startExam(page, { n: 5 });
  await page.waitForTimeout(2500);
  await expect(page.locator("#page-exam")).toHaveClass(/active/);
});

test("cancelling navigation away from an exam keeps the exam", async ({ page }) => {
  await startExam(page, { n: 3 });
  await page.click('button.nav-btn[data-page="page-instructions"]');
  await answerModal(page, false);
  await expect(page.locator("#page-exam")).toHaveClass(/active/);
});

test("untimed exams also warn about unanswered questions", async ({ page }) => {
  await startExam(page, { n: 2 });
  await page.click("#next-btn");
  await clickSubmit(page);
  await expect(modal(page)).toContainText("unanswered");
});

test("an ordering question never opened shows the correct order in review", async ({ page }) => {
  await onlyObjectives(page, [[3, "4.8"]]);
  // Jump straight to the last question; retry until the ordering question isn't last,
  // so it is never opened.
  for (let attempt = 0; attempt < 15; attempt++) {
    await startExam(page, { n: 4 });
    await page.locator(".palette-btn").last().click();
    if (!(await page.textContent("#question-domain")).includes("Ordering")) break;
    await page.click("#quit-exam-btn");
    await answerModal(page, true);
  }
  await clickSubmit(page);
  await answerModal(page, true);
  const item = page.locator(".review-item", { hasText: "Arrange the incident response" });
  await expect(item).toContainText("Incorrect");
  await expect(item).toContainText("(no answer)");
  await expect(item).toContainText("Correct order");
});

test("an opened but untouched ordering question counts as unanswered", async ({ page }) => {
  await onlyObjectives(page, [[3, "4.8"]]);
  await startExam(page, { n: 4 });
  await goToQuestionOfType(page, "Ordering");
  const current = page.locator(".palette-btn.current");
  await expect(current).not.toHaveClass(/answered/);
  await page.locator(".order-item").nth(1).locator("button", { hasText: "▲" }).click();
  await expect(current).toHaveClass(/answered/);
  await page.locator(".order-item").nth(0).locator("button", { hasText: "▼" }).click(); // back to the start
  await expect(current).not.toHaveClass(/answered/);
});

test("official domain weighting splits the count 12/22/18/28/20", async ({ page }) => {
  await page.check("#weighted-toggle");
  await startExam(page, { n: 50 });
  await submitExam(page);
  const totals = (await page.locator(".breakdown-row .bd-num").allTextContents()).map((t) => Number(t.split("/")[1].split(" ")[0]));
  expect(totals).toEqual([6, 11, 9, 14, 10]);
});

test("an in-progress exam can be resumed after reload, and finishing clears it", async ({ page }) => {
  await onlyObjectives(page, [[0, "1.3-1.4"]]);
  await startExam(page, { n: 4, shuffleQuestions: false });
  await page.locator(".option-row input").first().check();
  await page.click("#next-btn");
  await page.reload();
  await expect(modal(page)).toContainText("Resume your unfinished exam");
  await answerModal(page, true);
  await expect(page.locator("#exam-progress")).toHaveText(/^Question 2 of 4/);
  await expect(page.locator(".palette-btn.answered")).toHaveCount(1);
  await submitExam(page);
  await page.reload();
  await expect(page.locator("#page-setup")).toHaveClass(/active/);
  await expect(modal(page)).toHaveCount(0);
});

test("declining resume discards the saved exam", async ({ page }) => {
  await startExam(page, { n: 3 });
  await page.reload();
  await answerModal(page, false);
  expect(await page.evaluate(() => localStorage.getItem("examsim.session.v1"))).toBeNull();
});

test("a timed exam that expired while closed is submitted on resume", async ({ page, context }) => {
  await startExam(page, { n: 3, timer: true });
  await page.close();
  const later = await context.newPage();
  // Simulate the time limit passing while no tab had the app open.
  await later.addInitScript(() => {
    const s = JSON.parse(localStorage.getItem("examsim.session.v1"));
    if (s) localStorage.setItem("examsim.session.v1", JSON.stringify({ ...s, endsAt: Date.now() - 1000 }));
  });
  await openApp(later);
  await expect(modal(later)).toContainText("ran out of time");
  await answerModal(later, true);
  await expect(later.locator("#page-results")).toHaveClass(/active/);
});

test("objective ranges accept an en dash and Enter", async ({ page }) => {
  await onlyObjectives(page, [[0, "1.1–1.3"]]);
  await expect(page.locator("#pool-count")).toHaveText("8");
});

test("filters persist across reloads", async ({ page }) => {
  await onlyObjectives(page, [[1, "2.1-2.3"]]);
  await page.uncheck("#timer-toggle");
  await page.reload();
  const checks = await page.locator(".domain-card").nth(1).locator(".objective-row input").evaluateAll((els) => els.map((e) => e.checked));
  expect(checks).toEqual([true, true, true, false, false]);
  expect(await page.isChecked("#timer-toggle")).toBe(false);
});
