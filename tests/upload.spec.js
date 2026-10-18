import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { openApp, startExam, uploadSet, importUploaded } from "./helpers.js";

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

test.beforeEach(async ({ page }) => openApp(page));

test("the downloadable example (one of every type) validates and imports", async ({ page }) => {
  await page.click('button.nav-btn[data-page="page-instructions"]');
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#download-example-btn")]);
  const path = test.info().outputPath("example.json");
  await download.saveAs(path);
  await page.setInputFiles("#file-input", path);
  await expect(page.locator("#upload-result")).toContainText("Parsed 7 valid question(s)");
});

test("invalid PBQs are rejected with specific messages", async ({ page }) => {
  await uploadSet(page, fixture("bad-pbq.json"));
  const result = page.locator("#upload-result");
  await expect(result).toContainText("Import failed");
  await expect(result).toContainText('exactly 1 "____" placeholder');
  await expect(result).toContainText("unique \"id\"");
  await expect(result).toContainText("at least 3 strings");
  await expect(result).toContainText("at least as many entries");
});

test("fill_blank accepts runs of 5 or 6 underscores", async ({ page }) => {
  await uploadSet(page, fixture("underscores.json"));
  await expect(page.locator("#upload-result")).toContainText("Parsed 1 valid question(s)");
});

test("questions with the same id in two sets keep separate answers", async ({ page }) => {
  await importUploaded(page, fixture("collide-a.json"));
  await importUploaded(page, fixture("collide-b.json"));
  await page.locator(".set-row", { hasText: "Built-in Sample Set" }).locator("input").uncheck();
  await page.uncheck("#shuffle-options");
  await startExam(page, { n: 2, shuffleQuestions: false });
  await page.locator(".option-row", { hasText: "a0" }).locator("input").check();
  await page.click("#next-btn");
  await expect(page.locator(".option-row input").first()).not.toBeChecked();
  await page.locator(".option-row", { hasText: "b1" }).locator("input").check();
  await page.click("#finish-btn");
  await expect(page.locator("#result-score")).toHaveText(/^2 \/ 2/);
});

test("removing an uploaded set asks for confirmation in-page", async ({ page }) => {
  await importUploaded(page, fixture("collide-a.json"));
  const row = page.locator(".set-row", { hasText: "Set A" });
  await row.locator("button", { hasText: "Remove" }).click();
  await page.locator('.modal [data-action="cancel"]').click();
  await expect(row).toHaveCount(1);
  await row.locator("button", { hasText: "Remove" }).click();
  await page.locator('.modal [data-action="confirm"]').click();
  await expect(row).toHaveCount(0);
});
