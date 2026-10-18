import { test, expect } from "@playwright/test";
import { openApp, onlyObjectives, startExam, submitExam } from "./helpers.js";

test.use({ viewport: { width: 375, height: 800 } });

const overflows = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

test("no horizontal scrolling on setup, every question type, and results", async ({ page }) => {
  await openApp(page);
  expect(await overflows(page)).toBe(false);
  await onlyObjectives(page, [[0, "1.1-1.2"], [2, "3.2"], [3, "4.8"]]);
  await startExam(page, { n: 14 });
  for (let i = 0; i < 14; i++) {
    expect(await overflows(page), await page.textContent("#question-domain")).toBe(false);
    if (i < 13) await page.click("#next-btn");
  }
  await submitExam(page);
  expect(await overflows(page)).toBe(false);
});
