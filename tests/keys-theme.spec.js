import { test, expect } from "@playwright/test";
import { openApp, onlyObjectives, startExam, goToQuestionOfType, modal, answerModal } from "./helpers.js";

const bodyBackground = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const LIGHT_BG = "rgb(244, 246, 249)";
const DARK_BG = "rgb(15, 23, 42)";

test.describe("keyboard shortcuts", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("digits choose, arrows navigate, M marks", async ({ page }) => {
    await onlyObjectives(page, [[0, "1.3-1.4"]]);
    await page.uncheck("#shuffle-options");
    await startExam(page, { n: 4, shuffleQuestions: false });
    await page.locator("body").press("2");
    await expect(page.locator(".option-row input").nth(1)).toBeChecked();
    await page.keyboard.press("m");
    await expect(page.locator("#mark-review-btn")).toHaveClass(/active/);
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#exam-progress")).toHaveText(/^Question 2 of 4/);
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#exam-progress")).toHaveText(/^Question 1 of 4/);
    await expect(page.locator(".palette-btn").first()).toHaveClass(/marked/);
  });

  test("typing into a text field is not treated as a shortcut", async ({ page }) => {
    await onlyObjectives(page, [[0, "1.2"]]);
    await startExam(page, { n: 3 });
    await goToQuestionOfType(page, "Fill in the blank");
    const progress = await page.textContent("#exam-progress");
    await page.locator(".blank-input").pressSequentially("m1");
    await page.locator(".blank-input").press("ArrowLeft");
    await expect(page.locator(".blank-input")).toHaveValue("m1");
    await expect(page.locator("#exam-progress")).toHaveText(progress);
    await expect(page.locator("#mark-review-btn")).not.toHaveClass(/active/);
  });

  test("shortcuts are ignored while a dialog is open; C checks in practice mode", async ({ page }) => {
    await page.selectOption("#mode-select", "practice");
    await onlyObjectives(page, [[0, "1.3"]]);
    await startExam(page, { n: 2 });
    await page.click("#quit-exam-btn");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("1");
    await answerModal(page, false);
    await expect(page.locator("#exam-progress")).toHaveText(/^Question 1 of 2/);
    await expect(page.locator(".option-row input:checked")).toHaveCount(0);
    await page.keyboard.press("1");
    await page.keyboard.press("c");
    await expect(page.locator(".feedback")).toBeVisible();
    await expect(modal(page)).toHaveCount(0);
  });
});

test.describe("theme", () => {
  test("dark theme can be forced and is applied before scripts run after a reload", async ({ page }) => {
    await openApp(page);
    expect(await bodyBackground(page)).toBe(LIGHT_BG);
    await page.selectOption("#theme-select", "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await bodyBackground(page)).toBe(DARK_BG);
    await page.reload({ waitUntil: "commit" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test.describe("with a dark system theme", () => {
    test.use({ colorScheme: "dark" });

    test("Auto follows the system, Light overrides it", async ({ page }) => {
      await openApp(page);
      await expect(page.locator("#theme-select")).toHaveValue("auto");
      expect(await bodyBackground(page)).toBe(DARK_BG);
      await page.selectOption("#theme-select", "light");
      expect(await bodyBackground(page)).toBe(LIGHT_BG);
    });
  });
});
