import { describe, expect, it } from "vitest";

import {
  getOutputStructureIssues,
  normalizeOutputStructureBlockRefs,
  type ContentDocumentV1,
} from "./schema";
import {
  createContentDocumentFixture,
  createPresentationStructureFixture,
} from "./test-fixtures";

describe("output structure block references", () => {
  it("removes unknown and duplicate references, then fills missing blocks", () => {
    const document = createContentDocumentFixture();
    const structure = createPresentationStructureFixture();
    structure.pages[0].blockIds = ["B000"];
    structure.pages[1].blockIds = ["B001"];
    structure.pages[2].blockIds = ["B002", "B001"];
    structure.pages[3].blockIds = ["B004"];

    const normalized = normalizeOutputStructureBlockRefs(structure, document);
    if (normalized.outputType !== "pptx") throw new Error("expected PPT structure");
    const referenced = normalized.pages.flatMap((page) => page.blockIds);

    expect(referenced).not.toContain("B000");
    expect(referenced).toEqual(expect.arrayContaining(["B001", "B002", "B003", "B004"]));
    expect(new Set(referenced).size).toBe(4);
    expect(getOutputStructureIssues(normalized, document)).toEqual([]);
  });

  it("allows necessary duplicate references when there are more pages than blocks", () => {
    const fullDocument = createContentDocumentFixture();
    const document: ContentDocumentV1 = {
      ...fullDocument,
      sections: [
        {
          ...fullDocument.sections[0],
          blocks: [fullDocument.sections[0].blocks[0]],
        },
      ],
    };
    const structure = createPresentationStructureFixture();
    structure.pages.forEach((page) => {
      page.blockIds = ["B001"];
    });

    const normalized = normalizeOutputStructureBlockRefs(structure, document);
    if (normalized.outputType !== "pptx") throw new Error("expected PPT structure");

    expect(normalized.pages.every((page) => page.blockIds[0] === "B001")).toBe(true);
    expect(getOutputStructureIssues(normalized, document)).toEqual([]);
  });
});
