import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import {
  openApp,
  onlyObjectives,
  startExam,
  submitExam,
  goToQuestionOfType,
  setFirewallRows,
  ORDERING_STEPS,
  importUploaded,
} from "./helpers.js";

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

const orderTexts = (page) => page.locator(".order-item .order-text").allTextContents();

test.describe("drag reordering", () => {
  test("mouse drag sorts the steps and scores as correct", async ({ page }) => {
    await openApp(page);
    await onlyObjectives(page, [[3, "4.8"]]);
    await startExam(page, { n: 4 });
    await goToQuestionOfType(page, "Ordering");
    for (let pos = 0; pos < ORDERING_STEPS.length; pos++) {
      const from = (await orderTexts(page)).indexOf(ORDERING_STEPS[pos]);
      if (from === pos) continue;
      const src = await page.locator(".order-item").nth(from).locator(".order-text").boundingBox();
      const dst = await page.locator(".order-item").nth(pos).boundingBox();
      await page.mouse.move(src.x + 10, src.y + src.height / 2);
      await page.mouse.down();
      await page.mouse.move(dst.x + 10, dst.y + 4, { steps: 8 });
      await page.mouse.up();
    }
    expect(await orderTexts(page)).toEqual(ORDERING_STEPS);
    expect((await page.locator(".order-item .order-pos").allTextContents()).join("")).toBe("123456");
    await submitExam(page);
    await expect(page.locator(".review-item", { hasText: "Arrange the incident response" })).toContainText("✓ Correct");
  });

  test.describe("touch", () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

    test("drags from the handle; touching the text scrolls instead", async ({ page }) => {
      await openApp(page);
      await onlyObjectives(page, [[3, "4.8"]]);
      await startExam(page, { n: 4 });
      await goToQuestionOfType(page, "Ordering");
      const cdp = await page.context().newCDPSession(page);
      const touchDrag = async (box, toY) => {
        const x = box.x + box.width / 2;
        let y = box.y + box.height / 2;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        for (let i = 0, dy = (toY - y) / 10; i < 10; i++) {
          y += dy;
          await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      };

      const before = await orderTexts(page);
      const top = await page.locator(".order-item").first().boundingBox();
      await touchDrag(await page.locator(".order-item").last().locator(".order-text").boundingBox(), top.y + 4);
      expect(await orderTexts(page)).toEqual(before);

      const topNow = await page.locator(".order-item").first().boundingBox(); // the text swipe may have scrolled
      await touchDrag(await page.locator(".order-item").last().locator(".order-handle").boundingBox(), topNow.y + 4);
      await expect.poll(async () => (await orderTexts(page))[0]).toBe(before.at(-1));
    });
  });
});

test.describe("PBQ partial credit", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  const answerThreeOfFourRows = async (page) => {
    await onlyObjectives(page, [[2, "3.2"]]);
    await startExam(page, { n: 4 });
    await goToQuestionOfType(page, "Simulation");
    await setFirewallRows(page, { "TCP 443": "Allow", "TCP 80": "Deny", "TCP 23": "Deny", "TCP 3389": "Allow" });
    await submitExam(page);
  };

  test("3 of 4 simulation rows earns 0.75 points and is labeled partial", async ({ page }) => {
    await answerThreeOfFourRows(page);
    await expect(page.locator("#result-score")).toHaveText(/^0\.75 \/ 4/);
    await expect(page.locator(".review-item", { hasText: "Configure the following inbound" })).toContainText("Partial credit (75%)");
    await expect(page.locator("#result-scaled")).toContainText("doesn't publish");
  });

  test("with partial credit off the same answer earns 0", async ({ page }) => {
    await page.uncheck("#partial-toggle");
    await answerThreeOfFourRows(page);
    await expect(page.locator("#result-score")).toHaveText(/^0 \/ 4/);
    await expect(page.locator(".review-item", { hasText: "Configure the following inbound" })).toContainText("✗ Incorrect");
  });
});

test.describe("answer limits", () => {
  test.beforeEach(async ({ page }) => openApp(page));

  test("one-to-one matching moves an option instead of reusing it", async ({ page }) => {
    await onlyObjectives(page, [[0, "1.1"]]);
    await startExam(page, { n: 3 });
    await goToQuestionOfType(page, "Matching");
    await expect(page.locator("#options-box")).toContainText("Each option can be used once.");
    const selects = page.locator(".matching-row select");
    await selects.nth(0).selectOption({ label: "Physical" });
    await selects.nth(1).selectOption({ label: "Physical" });
    await expect(selects.nth(0)).toHaveValue("");
    await expect(selects.nth(1).locator("option:checked")).toHaveText("Physical");
  });

  test("matching whose answer repeats a target allows reuse; Select 2 allows only 2", async ({ page }) => {
    await importUploaded(page, fixture("limits.json"));
    await page.locator(".set-row", { hasText: "Built-in Sample Set" }).locator("input").uncheck();
    await startExam(page, { n: 2 });

    await goToQuestionOfType(page, "Matching");
    await expect(page.locator("#options-box")).toContainText("Options can be used more than once.");
    const selects = page.locator(".matching-row select");
    await selects.nth(0).selectOption({ label: "Physical" });
    await selects.nth(1).selectOption({ label: "Physical" });
    await expect(selects.nth(0).locator("option:checked")).toHaveText("Physical");

    await goToQuestionOfType(page, "select all that apply");
    const boxes = page.locator(".option-row input");
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await expect(page.locator(".option-row input:disabled")).toHaveCount(2);
    await boxes.nth(1).uncheck();
    await expect(page.locator(".option-row input:disabled")).toHaveCount(0);
  });
});

test("reordering with the keyboard keeps focus on the moved step", async ({ page }) => {
  await openApp(page);
  await onlyObjectives(page, [[3, "4.8"]]);
  await startExam(page, { n: 4 });
  await goToQuestionOfType(page, "Ordering");
  const texts = await page.locator(".order-item .order-text").allTextContents();
  const moving = texts[3];
  await page.getByRole("button", { name: `Move “${moving}” up` }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  expect((await page.locator(".order-item .order-text").allTextContents())[0]).toBe(moving);
  // at the top the up arrow is disabled, so focus moved to the same step's down arrow
  await expect(page.getByRole("button", { name: `Move “${moving}” down` })).toBeFocused();
  await page.keyboard.press("Enter");
  expect((await page.locator(".order-item .order-text").allTextContents())[1]).toBe(moving);
});
