import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { buildBackup, parseBackup, mergeBackup } from "../js/backup.js";
import { openApp, importUploaded, startExam, clickSubmit, answerModal, modal } from "./helpers.js";

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const SET = { id: "up-1", setName: "S", questions: [{ id: "a", domain: "1.1", type: "single", question: "Q?", options: ["x", "y"], answer: [0] }] };

test.describe("backup format", () => {
  test("rejects files that aren't backups and skips damaged sets", () => {
    expect(parseBackup({ setName: "x", questions: [] }).ok).toBe(false);
    expect(parseBackup({ kind: "exam-sim-backup", version: 99, data: {} }).ok).toBe(false);
    const raw = buildBackup({ sets: [SET, { id: "bad", setName: "Bad", questions: [{ domain: "9.9" }] }], history: [], stats: {}, settings: null });
    const parsed = parseBackup(JSON.parse(JSON.stringify(raw)));
    expect(parsed.ok).toBe(true);
    expect(parsed.skippedSets).toBe(1);
    expect(parsed.backup.sets.map((s) => s.id)).toEqual(["up-1"]);
  });

  test("merging keeps existing data, adds new data, newer review stats win, preferences come from the backup", () => {
    const current = {
      sets: [SET],
      history: [{ finishedAt: 1, total: 2 }],
      stats: { qa: { box: 2, lastSeen: 100 }, qb: { box: 0, lastSeen: 500 } },
      settings: { mode: "exam" },
      language: "en",
      theme: "auto",
    };
    const backup = {
      sets: [SET, { ...SET, id: "up-2", setName: "T" }],
      history: [{ finishedAt: 1, total: 2 }, { finishedAt: 2, total: 3 }],
      stats: { qa: { box: 3, lastSeen: 200 }, qb: { box: 4, lastSeen: 400 }, qc: { box: 1, lastSeen: 50 } },
      settings: { mode: "practice" },
      language: "ru",
      theme: "dark",
    };
    current.flags = { qa: { note: "mine", flaggedAt: 1 } };
    backup.flags = { qa: { note: "theirs", flaggedAt: 2 }, qd: { note: "", flaggedAt: 3 } };
    const m = mergeBackup(current, backup);
    expect(m.flags).toEqual({ qa: { note: "mine", flaggedAt: 1 }, qd: { note: "", flaggedAt: 3 } });
    expect(m.sets.map((s) => s.id)).toEqual(["up-1", "up-2"]);
    expect(m.history.map((a) => a.finishedAt)).toEqual([1, 2]);
    expect(m.stats).toEqual({ qa: { box: 3, lastSeen: 200 }, qb: { box: 0, lastSeen: 500 }, qc: { box: 1, lastSeen: 50 } });
    expect([m.settings.mode, m.language, m.theme]).toEqual(["practice", "ru", "dark"]);
    expect(m.added).toEqual({ sets: 1, attempts: 1 });
  });
});

test("a backup made in one browser restores into a fresh one, and restoring twice adds nothing", async ({ browser }) => {
  const first = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await openApp(first);
  await importUploaded(first, fixture("collide-a.json"));
  await first.locator(".set-row", { hasText: "Built-in Sample Set" }).locator("input").uncheck();
  await startExam(first, { n: 1 });
  await first.locator(".option-row", { hasText: "a1" }).locator("input").check(); // wrong
  await clickSubmit(first);
  await first.selectOption("#theme-select", "dark");
  await first.click('button.nav-btn[data-page="page-progress"]');
  const [download] = await Promise.all([first.waitForEvent("download"), first.locator(".panel .backup-download-btn").last().click()]);
  const backupPath = test.info().outputPath("backup.json");
  await download.saveAs(backupPath);
  expect(download.suggestedFilename()).toMatch(/^exam-sim-backup-\d{4}-\d{2}-\d{2}\.json$/);

  const second = await (await browser.newContext()).newPage();
  await openApp(second);
  await expect(second.locator(".set-row", { hasText: "Set A" })).toHaveCount(0);
  await second.click('button.nav-btn[data-page="page-progress"]');
  const restore = async () => {
    await second.setInputFiles("#restore-input", backupPath);
    await expect(modal(second)).toContainText("1 question set(s), 1 attempt(s)");
    await answerModal(second, true);
  };
  await restore();
  await expect(second.locator(".toast").last()).toHaveText("Backup restored: 1 new set(s), 1 new attempt(s).");
  await expect(second.locator(".history-table tbody tr")).toHaveCount(1);
  await expect(second.locator("#review-missed-btn")).toHaveText("Retry all missed (1)");
  await expect(second.locator("html")).toHaveAttribute("data-theme", "dark");

  await restore();
  await expect(second.locator(".toast").last()).toHaveText("Backup restored: 0 new set(s), 0 new attempt(s).");
  await expect(second.locator(".history-table tbody tr")).toHaveCount(1);
  await second.click('button.nav-btn[data-page="page-setup"]');
  await expect(second.locator(".set-row", { hasText: "Set A" })).toHaveCount(1);
});

test("a file that isn't a backup is refused with a message", async ({ page }) => {
  await openApp(page);
  await page.click('button.nav-btn[data-page="page-progress"]');
  await page.setInputFiles("#restore-input", fixture("collide-a.json"));
  await expect(modal(page)).toContainText("can't be restored: not an exam-sim backup file");
});
