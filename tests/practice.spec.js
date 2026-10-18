import { test, expect } from "@playwright/test";
import { openApp, onlyObjectives, startExam, goToQuestionOfType, submitExam, setFirewallRows, answerModal, modal } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await page.selectOption("#mode-select", "practice");
});

test("Check answer locks the question and shows correctness and the explanation", async ({ page }) => {
  await onlyObjectives(page, [[0, "1.3"]]);
  await startExam(page, { n: 2, shuffleQuestions: false });
  await expect(page.locator("#check-btn")).toBeVisible();
  // s5: correct answer is "Backout plan"; pick a wrong one
  await page.locator(".option-row", { hasText: "Impact analysis" }).locator("input").check();
  await page.click("#check-btn");
  const feedback = page.locator(".feedback");
  await expect(feedback).toContainText("✗ Incorrect");
  await expect(feedback).toContainText("Backout plan (correct)");
  await expect(feedback).toContainText("backout (rollback) plan");
  await expect(page.locator("#check-btn")).toBeHidden();
  await expect(page.locator("#options-box input:not(:disabled)")).toHaveCount(0);
  await expect(page.locator(".palette-btn").first()).toHaveClass(/checked-incorrect/);
});

test("PBQ feedback shows partial credit, and checked state survives a reload", async ({ page }) => {
  await onlyObjectives(page, [[2, "3.2"]]);
  await startExam(page, { n: 4 });
  await goToQuestionOfType(page, "Simulation");
  await setFirewallRows(page, { "TCP 443": "Allow", "TCP 80": "Deny", "TCP 23": "Deny", "TCP 3389": "Allow" });
  await page.click("#check-btn");
  await expect(page.locator(".feedback")).toContainText("Partial credit (75%)");
  await page.reload();
  await answerModal(page, true);
  await expect(page.locator(".feedback")).toContainText("Partial credit (75%)");
  await expect(page.locator(".sim-row select:not(:disabled)")).toHaveCount(0);
});

test("a checked ordering question can no longer be dragged", async ({ page }) => {
  await onlyObjectives(page, [[3, "4.8"]]);
  await startExam(page, { n: 4 });
  await goToQuestionOfType(page, "Ordering");
  await page.click("#check-btn");
  const before = await page.locator(".order-item .order-text").allTextContents();
  const src = await page.locator(".order-item").last().boundingBox();
  const dst = await page.locator(".order-item").first().boundingBox();
  await page.mouse.move(src.x + 40, src.y + src.height / 2);
  await page.mouse.down();
  await page.mouse.move(dst.x + 40, dst.y + 4, { steps: 6 });
  await page.mouse.up();
  expect(await page.locator(".order-item .order-text").allTextContents()).toEqual(before);
});

test("exam mode has no Check answer button and practice results are scored as usual", async ({ page }) => {
  await onlyObjectives(page, [[0, "1.3"]]);
  await startExam(page, { n: 2 });
  await page.locator(".option-row input").first().check();
  await page.click("#check-btn");
  await submitExam(page);
  await expect(page.locator("#result-score")).toHaveText(/\/ 2/);
  await page.click("#back-to-setup-btn");
  await page.selectOption("#mode-select", "exam");
  await startExam(page, { n: 2 });
  await expect(page.locator("#check-btn")).toBeHidden();
  await expect(modal(page)).toHaveCount(0);
});
