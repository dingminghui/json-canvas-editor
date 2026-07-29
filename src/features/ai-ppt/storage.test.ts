import {
  deletePptProject,
  getPptProject,
  listPptProjects,
  PPT_PROJECT_STORAGE_KEY,
  savePptProject,
} from "@/features/ai-ppt/storage";
import { createTestPptProject } from "@/features/ai-ppt/test-fixtures";

describe("PPT project storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves, reads, sorts, and deletes valid projects", () => {
    const older = createTestPptProject({
      id: "11111111-1111-4111-8111-111111111111",
      updatedAt: "2026-07-28T00:00:00.000Z",
    });
    const newer = createTestPptProject({
      id: "22222222-2222-4222-8222-222222222222",
      updatedAt: "2026-07-29T00:00:00.000Z",
    });

    expect(savePptProject(older)).toBe(true);
    expect(savePptProject(newer)).toBe(true);
    expect(listPptProjects().map((project) => project.id)).toEqual([newer.id, older.id]);
    expect(getPptProject(older.id)?.structure.deck.title).toBe("AI 产品战略");
    expect(getPptProject(older.id)?.generator.usage.total_tokens).toBe(10_110);

    expect(deletePptProject(newer.id)).toBe(true);
    expect(listPptProjects().map((project) => project.id)).toEqual([older.id]);
  });

  it("ignores malformed persisted values instead of crashing", () => {
    localStorage.setItem(PPT_PROJECT_STORAGE_KEY, JSON.stringify([{ invalid: true }]));
    expect(listPptProjects()).toEqual([]);

    localStorage.setItem(PPT_PROJECT_STORAGE_KEY, "{broken");
    expect(listPptProjects()).toEqual([]);
  });

  it("never persists an API key field", () => {
    expect(savePptProject(createTestPptProject())).toBe(true);
    const persisted = localStorage.getItem(PPT_PROJECT_STORAGE_KEY) ?? "";

    expect(persisted).not.toContain("apiKey");
    expect(persisted).not.toContain("sk-test");
  });
});
