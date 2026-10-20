import { test, expect } from "@playwright/test";
import { openApp, modal, answerModal, startExam, clickSubmit } from "./helpers.js";

test.beforeEach(async ({ page }) => openApp(page));

test("submitting with unanswered questions asks in-page, Cancel keeps the exam and the timer", async ({ page }) => {
  await startExam(page, { n: 2, timer: true });
  await page.click("#next-btn");
  await clickSubmit(page);
  await expect(modal(page)).toContainText("unanswered");
  await answerModal(page, false);
  const t1 = await page.textContent("#exam-timer");
  await page.waitForTimeout(2200);
  await expect(page.locator("#page-exam")).toHaveClass(/active/);
  expect(await page.textContent("#exam-timer")).not.toBe(t1);
});

test("Escape cancels a confirm dialog", async ({ page }) => {
  await startExam(page, { n: 2 });
  await page.click("#quit-exam-btn");
  await expect(modal(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal(page)).toHaveCount(0);
  await expect(page.locator("#page-exam")).toHaveClass(/active/);
});

test("Quit asks first and only leaves when confirmed", async ({ page }) => {
  await startExam(page, { n: 2 });
  await page.click("#quit-exam-btn");
  await answerModal(page, false);
  await expect(page.locator("#page-exam")).toHaveClass(/active/);
  await page.click("#quit-exam-btn");
  await answerModal(page, true);
  await expect(page.locator("#page-setup")).toHaveClass(/active/);
});

test("timer running out while 'Submit anyway?' is open submits and closes the dialog", async ({ page }) => {
  await page.clock.install();
  await page.reload();
  await startExam(page, { n: 3, timer: true });
  await page.click("#next-btn");
  await page.click("#next-btn");
  await clickSubmit(page);
  await expect(modal(page)).toBeVisible();
  await page.clock.fastForward("01:31:00");
  await expect(page.locator("#page-results")).toHaveClass(/active/);
  await expect(modal(page)).toHaveCount(0);
});

test("a warning stays up while the exam can't be saved, and clears once saving works", async ({ page }) => {
  await startExam(page, { n: 3 });
  await expect(page.locator("#save-warning")).toBeHidden();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.__restoreSetItem = () => (Storage.prototype.setItem = original);
    Storage.prototype.setItem = function (key, value) {
      if (key === "examsim.session.v1") throw new DOMException("full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.click("#next-btn");
  await expect(page.locator("#save-warning")).toBeVisible();
  await expect(page.locator("#save-warning")).toContainText("Don't reload");
  await page.evaluate(() => window.__restoreSetItem());
  await page.click("#prev-btn");
  await expect(page.locator("#save-warning")).toBeHidden();
});
