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

  it("读取新增材料字段之前保存的兼容项目", () => {
    const legacy = structuredClone(createTestPptProject()) as Record<string, unknown>;
    delete legacy.materialPlan;
    const input = legacy.input as Record<string, unknown>;
    delete input.sourceTreatment;
    const structure = legacy.structure as { slides: Array<Record<string, unknown>> };
    structure.slides.forEach((slide) => delete slide.evidenceRefs);
    const generator = legacy.generator as Record<string, unknown>;
    generator.promptVersion = "ppt-structure/v2";
    localStorage.setItem(PPT_PROJECT_STORAGE_KEY, JSON.stringify([legacy]));

    const project = listPptProjects()[0];
    expect(project?.materialPlan).toBeUndefined();
    expect(project?.input.sourceTreatment).toContain("已有材料为内容边界");
    expect(project?.structure.slides.every((slide) => slide.evidenceRefs.length === 0)).toBe(true);
  });

  it("never persists an API key field", () => {
    expect(savePptProject(createTestPptProject())).toBe(true);
    const persisted = localStorage.getItem(PPT_PROJECT_STORAGE_KEY) ?? "";

    expect(persisted).not.toContain("apiKey");
    expect(persisted).not.toContain("sk-test");
  });
});
