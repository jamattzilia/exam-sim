import { test, expect } from "@playwright/test";
import { openApp, startExam } from "./helpers.js";

test("the manifest and every icon it lists load", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ short_name: "SY0-701", display: "standalone", start_url: "./" });
  expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) expect((await request.get(`/${icon.src}`)).ok(), icon.src).toBe(true);
  expect((await request.get("/icons/icon-180.png")).ok()).toBe(true);
});

test("after one online visit the app opens and runs offline", async ({ page, context }) => {
  await openApp(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#pool-count")).toHaveText("68");
  await startExam(page, { n: 3 });
  await expect(page.locator("#exam-progress")).toHaveText(/^Question 1 of 3/);
  await context.setOffline(false);
});

test("the single-file build doesn't register a service worker", async ({ page }) => {
  await page.goto("/dist/exam-sim.html");
  await expect(page.locator("#pool-count")).toHaveText("68");
  await page.waitForTimeout(500);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
});
