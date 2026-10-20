// Renders icons/icon.svg to the PNG sizes the web app manifest and iOS need.
// Run after changing the SVG: node scripts/make-icons.mjs (uses Playwright's Chromium).
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../icons/", import.meta.url));
const svg = readFileSync(`${dir}icon.svg`, "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [180, 192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: `${dir}icon-${size}.png` });
}
await browser.close();
console.log("Wrote icons/icon-180.png, icon-192.png, icon-512.png");
