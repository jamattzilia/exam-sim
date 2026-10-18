import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openApp, onlyObjectives, startExam, submitExam, goToQuestionOfType, setFirewallRows } from "./helpers.js";

async function finishWithPartialSimulation(page) {
  await openApp(page);
  await onlyObjectives(page, [[2, "3.2"]]);
  await startExam(page, { n: 4 });
  await goToQuestionOfType(page, "Simulation");
  await setFirewallRows(page, { "TCP 443": "Allow", "TCP 80": "Deny", "TCP 23": "Deny", "TCP 3389": "Allow" });
  await submitExam(page);
}

async function download(page, button, name) {
  const [file] = await Promise.all([page.waitForEvent("download"), page.click(button)]);
  const path = test.info().outputPath(name);
  await file.saveAs(path);
  return readFileSync(path);
}

for (const [locale, delimiter, decimal] of [["ru-RU", ";", "0,75"], ["en-US", ",", "0.75"]]) {
  test.describe(`CSV in ${locale}`, () => {
    test.use({ locale });

    test(`uses "${delimiter}" and ${decimal}, has a BOM, and keeps the summary below the table`, async ({ page }) => {
      await finishWithPartialSimulation(page);
      const buf = await download(page, "#export-csv-btn", "results.csv");
      expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      const lines = buf.toString("utf8").replace(/^\uFEFF/, "").split("\r\n");
      expect(lines[0].startsWith(["id", "domain", "objective"].join(delimiter))).toBe(true);
      const sim = lines.find((l) => l.includes("Configure the following inbound"));
      expect(sim).toContain(`${delimiter}partial${delimiter}${decimal}${delimiter}`);
      const blank = lines.indexOf("");
      expect(blank).toBeGreaterThan(1);
      expect(lines.slice(1, blank).every((l) => !l.startsWith("Score"))).toBe(true);
      expect(lines[blank + 1].startsWith("Score")).toBe(true);
    });
  });
}

test("JSON export includes points per question and in the summary", async ({ page }) => {
  await finishWithPartialSimulation(page);
  const json = JSON.parse((await download(page, "#export-json-btn", "results.json")).toString("utf8"));
  expect(json.summary.points).toBe(0.75);
  expect(json.questions.find((q) => q.type === "simulation").points).toBe(0.75);
});
