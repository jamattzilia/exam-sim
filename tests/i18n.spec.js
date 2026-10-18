import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dictionaryKeys } from "../js/i18n.js";
import { openApp, modal, answerModal, startExam, onlyObjectives, goToQuestionOfType, clickSubmit } from "./helpers.js";

test("English and Russian dictionaries have the same keys", () => {
  expect(dictionaryKeys("ru").sort()).toEqual(dictionaryKeys("en").sort());
});

test("every translation key used in index.html exists", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const used = [...html.matchAll(/data-i18n(?:-html|-title)?="([^"]+)"/g)].map((m) => m[1]);
  expect(used.length).toBeGreaterThan(40);
  const known = new Set(dictionaryKeys("en"));
  expect(used.filter((k) => !known.has(k))).toEqual([]);
});

test("the Russian interface covers setup, exam, dialogs and results", async ({ page }) => {
  await openApp(page, { lang: "ru" });
  await expect(page.locator('button.nav-btn[data-page="page-setup"]')).toHaveText("Настройка");
  await expect(page.locator("#start-exam-btn")).toHaveText("Начать экзамен");
  await expect(page.locator(".set-row").first()).toContainText("встроенный");
  await onlyObjectives(page, [[0, "1.1"]]);
  await startExam(page, { n: 3 });
  await expect(page.locator("#exam-progress")).toHaveText(/^Вопрос 1 из 3/);
  await goToQuestionOfType(page, "PBQ: сопоставление");
  await expect(page.locator("#options-box")).toContainText("Каждый вариант можно использовать один раз.");
  await page.click("#quit-exam-btn");
  await expect(modal(page)).toContainText("Выйти из экзамена");
  await expect(modal(page).locator('[data-action="cancel"]')).toHaveText("Продолжить");
  await answerModal(page, false);
  await page.locator(".palette-btn").last().click(); // question order is shuffled
  await clickSubmit(page);
  await expect(modal(page)).toContainText("Вопросов без ответа");
  await answerModal(page, true);
  await expect(page.locator("#result-pass")).toHaveText("НЕ СДАН (оценка)");
  await expect(page.locator("#result-scaled")).toContainText("линейная прикидка");
});

test("switching language live re-renders the current page and is remembered", async ({ page }) => {
  await openApp(page);
  await onlyObjectives(page, [[0, "1.3"]]);
  await startExam(page, { n: 2 });
  await expect(page.locator("#exam-progress")).toHaveText(/^Question 1 of 2/);
  await page.selectOption("#lang-select", "ru");
  await expect(page.locator("#exam-progress")).toHaveText(/^Вопрос 1 из 2/);
  await expect(page.locator("#next-btn")).toHaveText("Далее ▶");
  await expect(page.locator("#page-exam")).toHaveClass(/active/); // still in the exam
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("examsim.lang.v1")))).toBe("ru");
});

test.describe("browser language", () => {
  test.use({ locale: "ru-RU" });

  test("defaults to Russian for a Russian browser when nothing is saved", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator("#start-exam-btn")).toHaveText("Начать экзамен");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  });
});
