// Pure-logic tests for scoring and validation (no browser needed).
import { test, expect } from "@playwright/test";
import { partialScore, isCorrect, weightedDomainCounts } from "../js/examEngine.js";
import { validateQuestionSet } from "../js/validation.js";
import { SAMPLE_SET } from "../js/data/sampleQuestions.js";
import { DOMAIN2_21_23_SET } from "../js/data/domain2Set.js";

test("partial credit per question type", () => {
  const hotspot = { type: "hotspot", answer: ["a", "b"], zones: [] };
  const sim = { type: "simulation", rows: [{ fieldType: "select", answer: "Allow" }, { fieldType: "checkbox", answer: false }] };
  expect(partialScore(hotspot, ["a", "b"])).toBe(1);
  expect(partialScore(hotspot, ["a"])).toBe(0.5);
  expect(partialScore(hotspot, ["a", "b", "c", "d"])).toBe(0); // clicking everything earns nothing
  expect(partialScore(hotspot, ["a", "c"])).toBe(0);
  expect(partialScore({ type: "matching", answer: [0, 1, 2] }, [0, 1, 0])).toBeCloseTo(2 / 3);
  expect(partialScore({ type: "ordering", items: [1, 2, 3, 4] }, [0, 1, 3, 2])).toBe(0.5);
  expect(partialScore({ type: "fill_blank", blanks: [{ accepted: ["x"] }, { accepted: ["y"] }] }, [" X ", "z"])).toBe(0.5);
  expect(partialScore({ type: "multiple", answer: [0, 2] }, [0])).toBe(0);
  expect(partialScore(sim, [])).toBe(0); // empty answer never "matches" an unchecked box
  expect(partialScore(sim, ["Allow", false])).toBe(1);
  expect(isCorrect({ type: "hotspot", answer: ["a"] }, ["a", "a"])).toBe(true);
});

test("weighted domain split caps small domains and redistributes", () => {
  expect(weightedDomainCounts({ "1.0": 10, "2.0": 11, "3.0": 10, "4.0": 25, "5.0": 12 }, 50)).toEqual({
    "1.0": 6, "2.0": 11, "3.0": 9, "4.0": 14, "5.0": 10,
  });
  const capped = weightedDomainCounts({ "1.0": 1, "4.0": 100 }, 20);
  expect(capped).toEqual({ "1.0": 1, "4.0": 19 });
});

for (const set of [SAMPLE_SET, DOMAIN2_21_23_SET]) {
  test(`built-in set "${set.setName}" passes validation with unique ids`, () => {
    const result = validateQuestionSet(set, set.setName);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    const ids = set.questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
}
