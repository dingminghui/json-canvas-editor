import {
  isGroupElement,
  type CanvasElement,
  type CanvasLeafElement,
  type CanvasPoint,
} from "@/editor/types";

export interface CanvasBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface CanvasViewportSize {
  height: number;
  width: number;
}

const VIEWPORT_INSET = {
  bottom: 24,
  left: 24,
  right: 24,
  top: 64,
} as const;

function getLeafBounds(element: CanvasLeafElement): CanvasBounds {
  const angle = (element.rotation * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const corners = [
    { x: 0, y: 0 },
    { x: element.width, y: 0 },
    { x: 0, y: element.height },
    { x: element.width, y: element.height },
  ].map((corner) => ({
    x: element.x + corner.x * cosine - corner.y * sine,
    y: element.y + corner.x * sine + corner.y * cosine,
  }));

  return {
    bottom: Math.max(...corners.map((corner) => corner.y)),
    left: Math.min(...corners.map((corner) => corner.x)),
    right: Math.max(...corners.map((corner) => corner.x)),
    top: Math.min(...corners.map((corner) => corner.y)),
  };
}

function mergeBounds(bounds: CanvasBounds[]): CanvasBounds | null {
  if (bounds.length === 0) return null;

  return {
    bottom: Math.max(...bounds.map((entry) => entry.bottom)),
    left: Math.min(...bounds.map((entry) => entry.left)),
    right: Math.max(...bounds.map((entry) => entry.right)),
    top: Math.min(...bounds.map((entry) => entry.top)),
  };
}

function getElementBounds(element: CanvasElement): CanvasBounds | null {
  return isGroupElement(element)
    ? mergeBounds(
        element.children
          .map((child) => getElementBounds(child))
          .filter((bounds): bounds is CanvasBounds => bounds !== null),
      )
    : getLeafBounds(element);
}

export function findCanvasElementBounds(
  elements: CanvasElement[],
  elementId: string,
): CanvasBounds | null {
  for (const element of elements) {
    if (element.id === elementId) return getElementBounds(element);
    if (!isGroupElement(element)) continue;

    const bounds = findCanvasElementBounds(element.children, elementId);
    if (bounds) return bounds;
  }

  return null;
}

export function getViewportPositionToReveal(
  bounds: CanvasBounds,
  viewport: CanvasViewportSize,
  viewportPosition: CanvasPoint,
  zoom: number,
): CanvasPoint | null {
  const visibleBounds = {
    bottom: Math.max(VIEWPORT_INSET.top, viewport.height - VIEWPORT_INSET.bottom),
    left: VIEWPORT_INSET.left,
    right: Math.max(VIEWPORT_INSET.left, viewport.width - VIEWPORT_INSET.right),
    top: VIEWPORT_INSET.top,
  };
  const elementBounds = {
    bottom: viewportPosition.y + bounds.bottom * zoom,
    left: viewportPosition.x + bounds.left * zoom,
    right: viewportPosition.x + bounds.right * zoom,
    top: viewportPosition.y + bounds.top * zoom,
  };
  const intersectsViewport =
    elementBounds.right > visibleBounds.left &&
    elementBounds.left < visibleBounds.right &&
    elementBounds.bottom > visibleBounds.top &&
    elementBounds.top < visibleBounds.bottom;

  if (intersectsViewport) return null;

  const viewportCenter = {
    x: (visibleBounds.left + visibleBounds.right) / 2,
    y: (visibleBounds.top + visibleBounds.bottom) / 2,
  };
  const elementCenter = {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  };

  return {
    x: viewportCenter.x - elementCenter.x * zoom,
    y: viewportCenter.y - elementCenter.y * zoom,
  };
}
