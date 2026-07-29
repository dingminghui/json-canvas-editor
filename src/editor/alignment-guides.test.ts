import {
  mergeAlignmentBounds,
  resolveAlignmentSnap,
  type AlignmentReference,
} from "@/editor/alignment-guides";

const siblingReference: AlignmentReference = {
  bounds: { bottom: 180, left: 100, right: 200, top: 80 },
  id: "sibling",
  priority: 0,
};

describe("alignment guides", () => {
  it("snaps the closest horizontal and vertical anchors independently", () => {
    const result = resolveAlignmentSnap({
      bounds: { bottom: 177, left: 96, right: 196, top: 77 },
      references: [siblingReference],
      threshold: 5,
      x: 96,
      y: 77,
    });

    expect(result).toEqual({
      guides: [
        {
          end: 180,
          orientation: "vertical",
          position: 100,
          sourceId: "sibling",
          start: 80,
        },
        {
          end: 200,
          orientation: "horizontal",
          position: 80,
          sourceId: "sibling",
          start: 100,
        },
      ],
      x: 100,
      y: 80,
    });
  });

  it("uses center anchors and does not snap outside the threshold", () => {
    const canvasReference: AlignmentReference = {
      bounds: { bottom: 300, left: 0, right: 400, top: 0 },
      id: "canvas",
      priority: 1,
    };

    expect(
      resolveAlignmentSnap({
        bounds: { bottom: 100, left: 147, right: 247, top: 50 },
        references: [canvasReference],
        threshold: 5,
        x: 147,
        y: 50,
      }),
    ).toMatchObject({
      guides: [expect.objectContaining({ orientation: "vertical", position: 200 })],
      x: 150,
      y: 50,
    });

    expect(
      resolveAlignmentSnap({
        bounds: { bottom: 100, left: 144, right: 244, top: 50 },
        references: [canvasReference],
        threshold: 5,
        x: 144,
        y: 50,
      }),
    ).toEqual({ guides: [], x: 144, y: 50 });
  });

  it("prefers the higher-priority reference when distances are equal", () => {
    const result = resolveAlignmentSnap({
      bounds: { bottom: 140, left: 98, right: 138, top: 100 },
      references: [
        {
          bounds: { bottom: 300, left: 100, right: 400, top: 0 },
          id: "canvas",
          priority: 1,
        },
        {
          bounds: { bottom: 180, left: 100, right: 160, top: 80 },
          id: "sibling",
          priority: 0,
        },
      ],
      threshold: 5,
      x: 98,
      y: 100,
    });

    expect(result.guides[0]).toMatchObject({ sourceId: "sibling" });
  });

  it("merges child bounds for a parent alignment reference", () => {
    expect(
      mergeAlignmentBounds([
        { bottom: 80, left: 20, right: 120, top: 30 },
        { bottom: 160, left: 90, right: 240, top: 100 },
      ]),
    ).toEqual({ bottom: 160, left: 20, right: 240, top: 30 });
    expect(mergeAlignmentBounds([])).toBeNull();
  });
});
