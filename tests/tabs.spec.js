import { test, expect } from "@playwright/test";
import { openApp, modal, answerModal, startExam } from "./helpers.js";

// Pages in one browser context share localStorage, like two tabs of one browser.
async function twoTabs(context) {
  const a = await context.newPage();
  await openApp(a);
  await startExam(a, { n: 3 });
  await a.locator(".option-row input").first().check();
  const b = await context.newPage();
  await openApp(b);
  return { a, b };
}

test("opening a second tab offers to move the exam; moving closes it in the first tab", async ({ context }) => {
  const { a, b } = await twoTabs(context);
  await expect(modal(b)).toContainText("in progress in another tab");
  await answerModal(b, true);
  await expect(b.locator("#page-exam")).toHaveClass(/active/);
  await expect(b.locator(".palette-btn.answered")).toHaveCount(1);
  await expect(modal(a)).toContainText("continued in another tab");
  await expect(a.locator("#page-setup")).toHaveClass(/active/);
});

test("'Leave it there' keeps the exam running and saved in the first tab", async ({ context }) => {
  const { a, b } = await twoTabs(context);
  await answerModal(b, false);
  await expect(b.locator("#page-setup")).toHaveClass(/active/);
  await a.click("#next-btn");
  await expect(a.locator("#page-exam")).toHaveClass(/active/);
  const saved = await b.evaluate(() => JSON.parse(localStorage.getItem("examsim.session.v1")));
  expect(saved.index).toBe(1);
});

test("starting a new exam in another tab asks first, then ends the old one", async ({ context }) => {
  const { a, b } = await twoTabs(context);
  await answerModal(b, false);
  await b.click("#start-exam-btn");
  await expect(modal(b)).toContainText("Starting a new one here will end it");
  await answerModal(b, false);
  await expect(b.locator("#page-setup")).toHaveClass(/active/);
  await b.click("#start-exam-btn");
  await answerModal(b, true);
  await expect(b.locator("#page-exam")).toHaveClass(/active/);
  await expect(modal(a)).toContainText("continued in another tab");
});

test("reloading the exam's own tab offers a normal resume", async ({ page }) => {
  await openApp(page);
  await startExam(page, { n: 3 });
  await page.reload();
  await expect(modal(page)).toContainText("Resume your unfinished exam");
});
