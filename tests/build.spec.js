import { test, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { answerModal } from "./helpers.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const singleFile = pathToFileURL(fileURLToPath(new URL("../dist/exam-sim.html", import.meta.url))).href;

test("dist/exam-sim.html is up to date with the sources", () => {
  const run = spawnSync(process.execPath, ["scripts/build.mjs", "--check"], { cwd: root, encoding: "utf8" });
  expect(run.status, run.stderr).toBe(0);
});

test("the single-file build works when opened straight from disk (file://)", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(singleFile);
  await expect(page.locator("#pool-count")).toHaveText("68");

  // The Domain 2 set contains a literal "<script>" payload in question text; it must
  // neither break the inline script nor be rendered as HTML.
  await page.locator(".set-row", { hasText: "Built-in Sample Set" }).locator("input").uncheck();
  await page.locator(".set-row", { hasText: "Domain 2.0" }).locator("input").check();
  await page.uncheck("#timer-toggle");
  await page.fill("#num-questions", "49");
  await page.click("#start-exam-btn");
  await page.locator(".palette-btn").last().click();
  await page.click("#finish-btn");
  await answerModal(page, true);
  await expect(page.locator("#review-list")).toContainText("GET /search?q=<script>");

  await page.click('button.nav-btn[data-page="page-instructions"]');
  await expect(page.locator("#instructions-text")).toContainText("  - id (string, optional)");
  expect(errors).toEqual([]);
});
