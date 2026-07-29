import {
  addSlideAfter,
  deleteSlideById,
  moveSlide,
  recordPptProjectUsage,
  reindexPptStructure,
} from "@/features/ai-ppt/model";
import { PptStructureSchema } from "@/features/ai-ppt/schema";
import {
  createTestPptProject,
  createTestPptStructure,
  createTestPptTokenUsage,
} from "@/features/ai-ppt/test-fixtures";

describe("PPT 大纲结构操作", () => {
  it("新增页面后重新编号并同步页数与章节引用", () => {
    const result = addSlideAfter(createTestPptStructure(), "P02");

    expect(result.deck.pageCount).toBe(5);
    expect(result.slides.map((slide) => slide.id)).toEqual(["P01", "P02", "P03", "P04", "P05"]);
    expect(result.sections[0].slideIds).toEqual(["P01", "P02", "P03", "P04", "P05"]);
    expect(result.slides[2]).toMatchObject({
      role: "content",
      layoutIntent: "title-body",
      title: "新幻灯片",
    });
    expect(PptStructureSchema.safeParse(result).success).toBe(true);
  });

  it("只允许移动中间页面且移动后保持连续编号", () => {
    const fiveSlides = addSlideAfter(createTestPptStructure(), "P02");
    const moved = moveSlide(fiveSlides, "P03", 1);

    expect(moved.slides[2].title).toBe("高价值场景应成为第一优先级");
    expect(moved.slides.map((slide) => slide.id)).toEqual(["P01", "P02", "P03", "P04", "P05"]);
    expect(moveSlide(moved, "P01", 1)).toEqual(moved);
  });

  it("保护封面、末页和四页结构不被删除", () => {
    const structure = createTestPptStructure();

    expect(deleteSlideById(structure, "P01")).toEqual(structure);
    expect(deleteSlideById(structure, "P04")).toEqual(structure);
    expect(deleteSlideById(structure, "P02")).toEqual(structure);
  });

  it("清理没有页面的章节", () => {
    const structure = createTestPptStructure();
    const result = reindexPptStructure({
      ...structure,
      sections: [
        ...structure.sections,
        { id: "empty", title: "空章节", objective: "待补充", slideIds: ["P99"] },
      ],
    });

    expect(result.sections.map((section) => section.id)).toEqual(["main"]);
  });

  it("累计模型用量且不改变内容更新时间", () => {
    const project = createTestPptProject();
    const result = recordPptProjectUsage(
      project,
      createTestPptTokenUsage({
        total_tokens: 900,
        completion_tokens: 400,
        prompt_tokens: 500,
      }),
    );

    expect(result.generator.usage).toMatchObject({
      total_tokens: 11_010,
      completion_tokens: 4_594,
      prompt_tokens: 6_416,
    });
    expect(result.updatedAt).toBe(project.updatedAt);
  });
});
