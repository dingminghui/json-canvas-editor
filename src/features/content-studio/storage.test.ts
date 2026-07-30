import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import { createContentProject } from "./model";
import { createContentDocumentFixture, createMaterialPlanFixture } from "./test-fixtures";
import {
  CONTENT_STUDIO_DB_NAME,
  deleteContentProject,
  duplicateContentProjectForOutput,
  getContentArtifact,
  getContentProject,
  getVisualAsset,
  listProjectAssets,
  resetContentStudioDatabaseConnectionForTests,
  saveContentArtifact,
  saveContentProject,
  saveVisualAsset,
} from "./storage";
import { createLongformVisualPlanFixture } from "./test-fixtures";

describe("content studio IndexedDB", () => {
  beforeEach(async () => {
    await resetContentStudioDatabaseConnectionForTests();
    await deleteDB(CONTENT_STUDIO_DB_NAME);
  });

  it("persists projects, Blob assets and cascades deletion", async () => {
    const project = createContentProject(
      {
        topic: "通用内容",
        audience: "团队",
        objective: "说明流程",
        sourceMarkdown: "JSON 是唯一事实源\n首期六套样式\n载体阅读节奏不同\n模型不输出坐标",
        sourceTreatment: "忠于事实",
        tone: "专业",
        mustInclude: [],
        exclude: [],
        language: "zh-CN",
      },
      createMaterialPlanFixture(),
      createContentDocumentFixture(),
      { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    );
    await saveContentProject(project);
    await saveVisualAsset({
      id: "A01",
      projectId: project.id,
      provider: "upload",
      name: "test.jpg",
      alt: "test",
      purpose: "hero",
      width: 10,
      height: 10,
      mimeType: "image/jpeg",
      blob: new Blob(["image"], { type: "image/jpeg" }),
      createdAt: new Date().toISOString(),
    });
    await saveContentArtifact({
      projectId: project.id,
      contentRevision: 1,
      outputType: "longform",
      visualPlan: createLongformVisualPlanFixture(),
      document: {
        id: "canvas",
        name: "canvas",
        description: "",
        documentType: "longform",
        width: 1080,
        height: 100,
        elements: [],
      },
      rendererVersion: "test",
      manuallyEdited: false,
      stale: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect((await getContentProject(project.id))?.id).toBe(project.id);
    expect((await getVisualAsset("A01"))?.blob.type).toBe("image/jpeg");
    expect(await listProjectAssets(project.id)).toHaveLength(1);

    await deleteContentProject(project.id);
    expect(await getContentProject(project.id)).toBeNull();
    expect(await getVisualAsset("A01")).toBeNull();
    expect(await getContentArtifact(project.id)).toBeNull();
  });

  it("duplicates only confirmed content when changing the output carrier", async () => {
    const project = createContentProject(
      {
        topic: "通用内容",
        audience: "团队",
        objective: "说明流程",
        sourceMarkdown: "JSON 是唯一事实源",
        sourceTreatment: "忠于事实",
        tone: "专业",
        mustInclude: [],
        exclude: [],
        language: "zh-CN",
      },
      createMaterialPlanFixture(),
      createContentDocumentFixture(),
      { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    );
    const duplicate = await duplicateContentProjectForOutput(project, "longform");
    expect(duplicate.id).not.toBe(project.id);
    expect(duplicate.contentDocument).toEqual(project.contentDocument);
    expect(duplicate.contentMarkdown).toBe(project.contentMarkdown);
    expect(duplicate.outputType).toBe("longform");
    expect(duplicate.outputStructure).toBeNull();
    expect(duplicate.selectedStylePackId).toBeNull();
    expect(await listProjectAssets(duplicate.id)).toEqual([]);
    expect(await getContentArtifact(duplicate.id)).toBeNull();
  });
});
