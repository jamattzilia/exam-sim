import { test, expect } from "@playwright/test";
import { openApp, onlyObjectives, startExam, acceptModalIfShown } from "./helpers.js";

test.use({ viewport: { width: 375, height: 800 } });

const overflows = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

test("no horizontal scrolling on setup, every question type, results, and progress", async ({ page }) => {
  await openApp(page);
  expect(await overflows(page)).toBe(false);
  await onlyObjectives(page, [[0, "1.1-1.2"], [2, "3.2"], [3, "4.8"]]);
  await startExam(page, { n: 14 });
  for (let i = 0; i < 14; i++) {
    expect(await overflows(page), await page.textContent("#question-domain")).toBe(false);
    if (i < 13) await page.click("#next-btn");
  }
  await page.click("#finish-btn");
  await expect(page.locator("#review-screen")).toBeVisible();
  expect(await overflows(page)).toBe(false);
  await page.click("#review-submit-btn");
  await acceptModalIfShown(page);
  await expect(page.locator("#page-results")).toHaveClass(/active/);
  expect(await overflows(page)).toBe(false);
  await page.click('button.nav-btn[data-page="page-progress"]');
  await expect(page.locator(".history-table")).toBeVisible();
  expect(await overflows(page)).toBe(false);
});

test("the Russian interface also fits a phone screen", async ({ page }) => {
  await openApp(page, { lang: "ru" });
  expect(await overflows(page)).toBe(false);
  await page.click('button.nav-btn[data-page="page-instructions"]');
  expect(await overflows(page)).toBe(false);
});
