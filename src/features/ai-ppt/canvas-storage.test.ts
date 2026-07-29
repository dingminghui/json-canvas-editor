import {
  createPptCanvasArtifact,
  deletePptCanvasArtifact,
  getPptCanvasArtifact,
  isPptCanvasArtifactStale,
  listPptCanvasArtifacts,
  PPT_CANVAS_ARTIFACT_STORAGE_KEY,
  savePptCanvasArtifact,
  updatePptCanvasArtifactDocument,
} from "@/features/ai-ppt/canvas-storage";
import { renderPptStructureToCanvas } from "@/features/ai-ppt/render/render-ppt-structure";
import {
  createTestPptProject,
  createTestPptStructure,
  createTestPptVisualPlan,
  createTestPptVisualReview,
} from "@/features/ai-ppt/test-fixtures";

function createArtifact() {
  const project = createTestPptProject();
  const visualPlan = createTestPptVisualPlan();
  const document = renderPptStructureToCanvas(
    createTestPptStructure(),
    visualPlan,
    `ai-ppt-canvas-${project.id}`,
  );
  return createPptCanvasArtifact(
    project.id,
    project.updatedAt,
    "克制、专业",
    [],
    visualPlan,
    document,
    createTestPptVisualReview(visualPlan),
  );
}

describe("PPT 画布产物存储", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("保存、读取、更新并删除合法画布", () => {
    const artifact = createArtifact();
    expect(savePptCanvasArtifact(artifact)).toBe(true);
    expect(getPptCanvasArtifact(artifact.projectId)?.document.elements).toHaveLength(4);

    const updated = updatePptCanvasArtifactDocument(artifact, {
      ...artifact.document,
      name: "人工修改后的标题",
    });
    expect(savePptCanvasArtifact(updated)).toBe(true);
    expect(getPptCanvasArtifact(artifact.projectId)?.document.name).toBe("人工修改后的标题");

    expect(deletePptCanvasArtifact(artifact.projectId)).toBe(true);
    expect(getPptCanvasArtifact(artifact.projectId)).toBeNull();
  });

  it("识别文本结构更新后的过期画布", () => {
    const artifact = createArtifact();
    expect(isPptCanvasArtifactStale(artifact, artifact.sourceStructureUpdatedAt)).toBe(false);
    expect(isPptCanvasArtifactStale(artifact, "2026-07-30T00:00:00.000Z")).toBe(true);
  });

  it("忽略损坏数据且永不持久化接口密钥", () => {
    localStorage.setItem(
      PPT_CANVAS_ARTIFACT_STORAGE_KEY,
      JSON.stringify([{ invalid: true, apiKey: "sk-leaked" }]),
    );
    expect(listPptCanvasArtifacts()).toEqual([]);

    const artifact = createArtifact();
    expect(savePptCanvasArtifact(artifact)).toBe(true);
    const raw = localStorage.getItem(PPT_CANVAS_ARTIFACT_STORAGE_KEY) ?? "";
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("sk-leaked");
  });
});
