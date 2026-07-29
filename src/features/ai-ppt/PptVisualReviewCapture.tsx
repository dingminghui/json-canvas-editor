import { CanvasStage, type CanvasStageHandle } from "@/editor/components/CanvasStage";
import { createPageDocument, getDocumentPages } from "@/editor/document-pages";
import type { CanvasDocument } from "@/editor/types";
import type { PptSlidePreview } from "@/features/ai-ppt/visual-api";
import { useEffect, useMemo, useRef } from "react";

const PREVIEW_WIDTH = 400;
const PREVIEW_HEIGHT = 225;
const PREVIEW_ZOOM = 0.25;
const PREVIEW_PIXEL_RATIO = 0.5;

interface PptVisualReviewCaptureProps {
  document: CanvasDocument;
  slideIds: readonly string[];
  onCaptured: (previews: PptSlidePreview[]) => void;
  onError: (error: Error) => void;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(() => resolve());
      return;
    }
    globalThis.setTimeout(resolve, 16);
  });
}

async function waitForPreviewRender(): Promise<void> {
  await globalThis.document.fonts?.ready;
  await nextFrame();
  await nextFrame();
  await nextFrame();
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 80));
  await nextFrame();
}

export function PptVisualReviewCapture({
  document,
  slideIds,
  onCaptured,
  onError,
}: PptVisualReviewCaptureProps) {
  const pages = useMemo(() => getDocumentPages(document), [document]);
  const stageHandlesRef = useRef(new Map<string, CanvasStageHandle>());

  useEffect(() => {
    let cancelled = false;

    void waitForPreviewRender()
      .then(() => {
        if (cancelled) return;
        if (pages.length !== slideIds.length) {
          throw new Error("视觉评审预览页数与文本结构不一致");
        }
        const previews = pages.map((page, index) => {
          const dataUrl = stageHandlesRef.current
            .get(page.id)
            ?.exportImage({ pixelRatio: PREVIEW_PIXEL_RATIO });
          if (!dataUrl) throw new Error(`无法渲染 ${page.name} 的视觉评审预览`);
          const slideId = slideIds[index];
          if (!slideId) throw new Error(`无法识别 ${page.name} 对应的幻灯片编号`);
          return { dataUrl, slideId };
        });
        onCaptured(previews);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onError(error instanceof Error ? error : new Error("无法生成视觉评审预览"));
      });

    return () => {
      cancelled = true;
    };
  }, [onCaptured, onError, pages, slideIds]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed -left-[10000px] top-0 overflow-hidden"
    >
      {pages.map((page) => (
        <CanvasStage
          readOnly
          document={createPageDocument(document, page.id)}
          editingElementId={null}
          hoveredId={null}
          isSelectedLocked
          key={page.id}
          selectedId={null}
          stageHandleRef={(handle) => {
            if (handle) stageHandlesRef.current.set(page.id, handle);
            else stageHandlesRef.current.delete(page.id);
          }}
          viewportHeight={PREVIEW_HEIGHT}
          viewportPosition={{ x: 0, y: 0 }}
          viewportWidth={PREVIEW_WIDTH}
          zoom={PREVIEW_ZOOM}
          onEditText={() => undefined}
          onElementChange={() => undefined}
          onElementPreview={() => undefined}
          onSelect={() => undefined}
        />
      ))}
    </div>
  );
}
