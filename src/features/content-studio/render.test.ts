import { describe, expect, it } from "vitest";

import {
  getSafeLongformPixelRatio,
  getVisualPlanRecipeIssues,
  normalizeVisualPlanRecipes,
  renderContentToCanvas,
} from "./render";
import { STYLE_PACK_IDS } from "./schema";
import {
  createContentDocumentFixture,
  createLongformStructureFixture,
  createLongformVisualPlanFixture,
  createPresentationStructureFixture,
  createPresentationVisualPlanFixture,
} from "./test-fixtures";

describe("content renderer", () => {
  it.each(STYLE_PACK_IDS)("renders executable StylePack %s", (stylePackId) => {
    const document = renderContentToCanvas({
      documentId: `test-${stylePackId}`,
      contentDocument: createContentDocumentFixture(),
      outputStructure: createPresentationStructureFixture(),
      visualPlan: createPresentationVisualPlanFixture(stylePackId),
    });
    expect(document.width).toBe(1600);
    expect(document.height).toBe(900);
    expect(document.elements).toHaveLength(4);
    expect(document.elements.every((element) => element.type === "group")).toBe(true);
  });

  it("renders a 1080px flow layout and computes a safe PNG ratio", () => {
    const document = renderContentToCanvas({
      documentId: "longform-test",
      contentDocument: createContentDocumentFixture(),
      outputStructure: createLongformStructureFixture(),
      visualPlan: createLongformVisualPlanFixture(),
    });
    expect(document.width).toBe(1080);
    expect(document.height).toBeLessThanOrEqual(12_000);
    expect(getSafeLongformPixelRatio(document.width, document.height) * document.height).toBeLessThanOrEqual(16_384);
  });

  it("replaces incompatible model-selected recipes with compatible recipes", () => {
    const contentDocument = createContentDocumentFixture();
    contentDocument.sections[1].blocks[0] = {
      id: "B003",
      type: "comparison",
      left: { heading: "PPT", items: ["逐页推进"] },
      right: { heading: "长图", items: ["连续阅读"] },
      evidenceRefs: ["F003"],
    };
    const outputStructure = createPresentationStructureFixture();
    outputStructure.pages[0].role = "timeline";
    outputStructure.pages[0].blockIds = ["B002"];
    outputStructure.pages[1].role = "data";
    outputStructure.pages[1].blockIds = ["B001"];
    outputStructure.pages[2].role = "comparison";
    outputStructure.pages[2].blockIds = ["B003"];
    const visualPlan = createPresentationVisualPlanFixture();
    visualPlan.items[0].recipeId = "timeline-ribbon";
    visualPlan.items[1].recipeId = "metrics-cluster";
    visualPlan.items[2].recipeId = "chart-insight";

    const normalized = normalizeVisualPlanRecipes(
      contentDocument,
      outputStructure,
      visualPlan,
    );
    if (normalized.outputType !== "pptx") throw new Error("expected PPT plan");

    expect(normalized.items.slice(0, 3).map((item) => item.recipeId)).toEqual([
      "metrics-cluster",
      "chart-insight",
      "comparison-panels",
    ]);
    expect(
      getVisualPlanRecipeIssues(
        contentDocument,
        outputStructure,
        normalized,
      ),
    ).toEqual([]);
  });
});
