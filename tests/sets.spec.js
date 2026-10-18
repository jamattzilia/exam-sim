import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateQuestionSet } from "../js/validation.js";
import { openApp, importUploaded, modal } from "./helpers.js";

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const row = (page, name) => page.locator(".set-row", { hasText: name });

async function exportedJson(page, setName) {
  const [file] = await Promise.all([page.waitForEvent("download"), row(page, setName).locator("button", { hasText: "Export" }).click()]);
  const path = test.info().outputPath(file.suggestedFilename());
  await file.saveAs(path);
  return JSON.parse(readFileSync(path, "utf8"));
}

test.beforeEach(async ({ page }) => openApp(page));

test("an uploaded set can be renamed, and the name persists", async ({ page }) => {
  await importUploaded(page, fixture("collide-a.json"));
  await row(page, "Set A").locator("button", { hasText: "Rename" }).click();
  await modal(page).locator(".modal-input").fill("Domain 1 drills");
  await modal(page).locator(".modal-input").press("Enter");
  await expect(row(page, "Domain 1 drills")).toHaveCount(1);
  await page.reload();
  await expect(row(page, "Domain 1 drills")).toHaveCount(1);

  await row(page, "Domain 1 drills").locator("button", { hasText: "Rename" }).click();
  await modal(page).locator('[data-action="cancel"]').click();
  await expect(row(page, "Domain 1 drills")).toHaveCount(1);
});

test("exported sets are valid upload files (built-in and uploaded)", async ({ page }) => {
  const builtin = await exportedJson(page, "Built-in Sample Set");
  const result = validateQuestionSet(builtin, "export");
  expect(result.valid).toBe(true);
  expect(result.set.questions).toHaveLength(68);
  expect(Object.keys(builtin.questions[0]).some((k) => k.startsWith("_") || k.startsWith("display"))).toBe(false);

  await importUploaded(page, fixture("limits.json"));
  const uploaded = await exportedJson(page, "Limits");
  expect(validateQuestionSet(uploaded, "export").valid).toBe(true);
  expect(uploaded.setName).toBe("Limits");
});

test("duplicate questions across enabled sets are counted once", async ({ page }) => {
  await importUploaded(page, fixture("collide-a.json"));
  await importUploaded(page, fixture("collide-a.json"));
  await expect(page.locator("#sets-dupes")).toContainText("1 duplicate");
  await expect(page.locator("#pool-count")).toHaveText("69");
});

test("enabled sets can be saved as one combined set with unique ids", async ({ page }) => {
  await expect(page.locator("#save-combined-btn")).toBeHidden();
  await importUploaded(page, fixture("collide-a.json"));
  await importUploaded(page, fixture("collide-b.json"));
  await expect(page.locator("#save-combined-btn")).toBeVisible();
  await page.click("#save-combined-btn");
  await expect(modal(page)).toContainText("70 questions");
  await modal(page).locator(".modal-input").fill("Everything");
  await modal(page).locator('[data-action="confirm"]').click();

  await expect(row(page, "Everything")).toContainText("70 q");
  await expect(row(page, "Everything").locator("input")).toBeChecked();
  await expect(row(page, "Set A").locator("input")).not.toBeChecked();
  await expect(page.locator("#pool-count")).toHaveText("70");

  const combined = await exportedJson(page, "Everything");
  const ids = combined.questions.map((q) => q.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(validateQuestionSet(combined, "export").valid).toBe(true);
});
