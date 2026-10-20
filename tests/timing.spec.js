import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openApp, onlyObjectives, startExam, clickSubmit, answerModal } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await openApp(page);
  await onlyObjectives(page, [[0, "1.3"]]); // two multiple-choice questions
});

const setHidden = (page, hidden) =>
  page.evaluate((h) => {
    Object.defineProperty(document, "visibilityState", { value: h ? "hidden" : "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);

test("time on screen is tracked per question; a hidden tab and the review screen don't count", async ({ page }) => {
  await startExam(page, { n: 2, shuffleQuestions: false });
  await page.clock.fastForward("00:30");
  await setHidden(page, true);
  await page.clock.fastForward("05:00"); // tab in the background
  await setHidden(page, false);
  await page.clock.fastForward("00:10");
  await page.locator(".option-row input").first().check();
  await page.click("#next-btn");
  await page.clock.fastForward("01:30");
  await page.locator(".option-row input").first().check();
  await page.click("#finish-btn");
  await page.clock.fastForward("10:00"); // review screen
  await page.click("#review-submit-btn");

  const times = await page.locator(".review-item .time-tag").allTextContents();
  expect(times).toEqual(["⏱ 0:40", "⏱ 1:30"]);
  await expect(page.locator("#result-time")).toContainText("Time: 2:10 in all, 1:05 per question on average");

  const [csv] = await Promise.all([page.waitForEvent("download"), page.click("#export-csv-btn")]);
  const path = test.info().outputPath("r.csv");
  await csv.saveAs(path);
  const lines = readFileSync(path, "utf8").split("\r\n");
  expect(lines[0]).toContain("points,time_s,explanation");
  expect(lines.some((l) => l.startsWith("Total time,2:10"))).toBe(true);

  await page.click('button.nav-btn[data-page="page-progress"]');
  await expect(page.locator(".history-table tbody tr").first()).toContainText("2:10");
});

test("time survives a reload mid-exam", async ({ page }) => {
  await startExam(page, { n: 2, shuffleQuestions: false });
  await page.clock.fastForward("00:45");
  await page.reload();
  await answerModal(page, true); // resume
  await page.clock.fastForward("00:15");
  await page.locator(".palette-btn").last().click();
  await clickSubmit(page);
  await answerModal(page, true);
  await expect(page.locator(".review-item .time-tag").first()).toHaveText("⏱ 1:00");
});
