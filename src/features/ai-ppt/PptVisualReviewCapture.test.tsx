import { PptVisualReviewCapture } from "@/features/ai-ppt/PptVisualReviewCapture";
import { renderPptStructureToCanvas } from "@/features/ai-ppt/render/render-ppt-structure";
import {
  createTestPptStructure,
  createTestPptVisualPlan,
} from "@/features/ai-ppt/test-fixtures";
import { render, waitFor } from "@testing-library/react";

vi.mock("@/editor/components/CanvasStage", async () => {
  const { useEffect } = await import("react");
  return {
    CanvasStage: ({
      document,
      stageHandleRef,
    }: {
      document: { id: string };
      stageHandleRef?: (handle: { exportImage: () => string }) => void;
    }) => {
      useEffect(() => {
        stageHandleRef?.({
          exportImage: () => `data:image/png;base64,${btoa(document.id)}`,
        });
        return () => stageHandleRef?.(null as never);
      }, [document.id, stageHandleRef]);
      return null;
    },
  };
});

describe("PPT 视觉评审预览", () => {
  it("按文本结构顺序导出逐页 Data URL", async () => {
    const structure = createTestPptStructure();
    const document = renderPptStructureToCanvas(
      structure,
      createTestPptVisualPlan(),
      "review-capture",
    );
    const onCaptured = vi.fn();

    render(
      <PptVisualReviewCapture
        document={document}
        slideIds={structure.slides.map((slide) => slide.id)}
        onCaptured={onCaptured}
        onError={vi.fn()}
      />,
    );

    await waitFor(() => expect(onCaptured).toHaveBeenCalledTimes(1));
    expect(onCaptured.mock.calls[0]?.[0]).toEqual(
      structure.slides.map((slide) => ({
        slideId: slide.id,
        dataUrl: expect.stringMatching(/^data:image\/png;base64,/),
      })),
    );
  });
});
