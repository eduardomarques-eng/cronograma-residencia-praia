import { describe, expect, it } from "vitest";
import { allBriefingQuestions, briefingSections } from "./briefing-definition";

describe("guided briefing definition", () => {
  it("preserves unique legacy question ids and groups every question", () => {
    const ids = allBriefingQuestions.map((question) => question.id);
    expect(ids.length).toBeGreaterThan(20);
    expect(new Set(ids).size).toBe(ids.length);
    expect(briefingSections.every((section) => section.questions.length > 0)).toBe(true);
  });

  it("provides actionable choices for visual questions", () => {
    expect(allBriefingQuestions.filter((question) => question.type === "visual").every((question) => (question.visualOptions?.length ?? 0) > 0)).toBe(true);
  });
});
