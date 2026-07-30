import { CanvasStage, type CanvasStageHandle } from "@/editor/components/CanvasStage";
import { createPageDocument, getDocumentPages } from "@/editor/document-pages";
import type { CanvasDocument } from "@/editor/types";
import { useEffect, useMemo, useRef } from "react";

const nextFrame = () =>
  new Promise<void>((resolve) => globalThis.requestAnimationFrame(() => resolve()));

const waitForRender = async () => {
  await globalThis.document.fonts?.ready;
  await nextFrame();
  await nextFrame();
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 350));
  await nextFrame();
};

const splitLongformPreview = async (dataUrl: string): Promise<string[]> => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const value = new Image();
    value.onload = () => resolve(value);
    value.onerror = () => reject(new Error("长图预览读取失败。"));
    value.src = dataUrl;
  });
  const previews = [dataUrl];
  const segmentCount = Math.min(6, Math.max(2, Math.ceil(image.height / image.width / 2)));
  const segmentHeight = Math.ceil(image.height / segmentCount);
  for (let index = 0; index < segmentCount; index += 1) {
    const sourceY = index * segmentHeight;
    const height = Math.min(segmentHeight, image.height - sourceY);
    if (height <= 0) continue;
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) continue;
    context.drawImage(image, 0, sourceY, image.width, height, 0, 0, image.width, height);
    previews.push(canvas.toDataURL("image/jpeg", 0.82));
  }
  return previews;
};

export function ContentVisualCapture({
  document,
  onCaptured,
  onError,
}: {
  document: CanvasDocument;
  onCaptured: (images: string[]) => void;
  onError: (error: Error) => void;
}) {
  const pages = useMemo(
    () =>
      document.documentType === "pptx"
        ? getDocumentPages(document).map((page) => createPageDocument(document, page.id))
        : [document],
    [document],
  );
  const handles = useRef(new Map<string, CanvasStageHandle>());

  useEffect(() => {
    let cancelled = false;
    void waitForRender()
      .then(async () => {
        const images = pages.map((page) => {
          const pixelRatio =
            page.documentType === "longform"
              ? Math.min(0.5, 16_384 / Math.max(page.width, page.height))
              : 0.5;
          const image = handles.current.get(page.id)?.exportImage({ pixelRatio });
          if (!image) throw new Error(`无法生成 ${page.name} 的预览。`);
          return image;
        });
        const result =
          document.documentType === "longform"
            ? await splitLongformPreview(images[0])
            : images;
        if (!cancelled) onCaptured(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) onError(error instanceof Error ? error : new Error("视觉预览失败。"));
      });
    return () => {
      cancelled = true;
    };
  }, [document.documentType, onCaptured, onError, pages]);

  return (
    <div aria-hidden className="pointer-events-none fixed -left-[20000px] top-0">
      {pages.map((page) => {
        const zoom = page.documentType === "longform" ? 0.2 : 0.25;
        return (
          <CanvasStage
            readOnly
            document={page}
            editingElementId={null}
            hoveredId={null}
            isSelectedLocked
            key={page.id}
            selectedId={null}
            stageHandleRef={(handle) => {
              if (handle) handles.current.set(page.id, handle);
              else handles.current.delete(page.id);
            }}
            viewportHeight={Math.ceil(page.height * zoom)}
            viewportPosition={{ x: 0, y: 0 }}
            viewportWidth={Math.ceil(page.width * zoom)}
            zoom={zoom}
            onEditText={() => undefined}
            onElementChange={() => undefined}
            onElementPreview={() => undefined}
            onSelect={() => undefined}
          />
        );
      })}
    </div>
  );
}
