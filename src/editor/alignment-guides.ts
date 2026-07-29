export interface AlignmentBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface AlignmentReference {
  bounds: AlignmentBounds;
  id: string;
  priority: number;
}

export type AlignmentGuide =
  | {
      end: number;
      orientation: "horizontal";
      position: number;
      sourceId: string;
      start: number;
    }
  | {
      end: number;
      orientation: "vertical";
      position: number;
      sourceId: string;
      start: number;
    };

export interface AlignmentSnapResult {
  guides: AlignmentGuide[];
  x: number;
  y: number;
}

interface AxisAnchor {
  kind: "center" | "end" | "start";
  position: number;
}

interface AxisSnap {
  delta: number;
  reference: AlignmentReference;
  referenceAnchor: AxisAnchor;
  targetAnchor: AxisAnchor;
}

function getHorizontalAnchors(bounds: AlignmentBounds): AxisAnchor[] {
  return [
    { kind: "start", position: bounds.left },
    { kind: "center", position: (bounds.left + bounds.right) / 2 },
    { kind: "end", position: bounds.right },
  ];
}

function getVerticalAnchors(bounds: AlignmentBounds): AxisAnchor[] {
  return [
    { kind: "start", position: bounds.top },
    { kind: "center", position: (bounds.top + bounds.bottom) / 2 },
    { kind: "end", position: bounds.bottom },
  ];
}

function isBetterSnap(candidate: AxisSnap, current: AxisSnap | null): boolean {
  if (!current) return true;

  const candidateDistance = Math.abs(candidate.delta);
  const currentDistance = Math.abs(current.delta);
  if (candidateDistance !== currentDistance) return candidateDistance < currentDistance;
  if (candidate.reference.priority !== current.reference.priority) {
    return candidate.reference.priority < current.reference.priority;
  }

  const candidateMatchesAnchor = candidate.targetAnchor.kind === candidate.referenceAnchor.kind;
  const currentMatchesAnchor = current.targetAnchor.kind === current.referenceAnchor.kind;
  return candidateMatchesAnchor && !currentMatchesAnchor;
}

function findAxisSnap(
  targetAnchors: AxisAnchor[],
  references: AlignmentReference[],
  getReferenceAnchors: (bounds: AlignmentBounds) => AxisAnchor[],
  threshold: number,
): AxisSnap | null {
  let bestSnap: AxisSnap | null = null;

  for (const reference of references) {
    for (const referenceAnchor of getReferenceAnchors(reference.bounds)) {
      for (const targetAnchor of targetAnchors) {
        const delta = referenceAnchor.position - targetAnchor.position;
        if (Math.abs(delta) > threshold) continue;

        const candidate = { delta, reference, referenceAnchor, targetAnchor };
        if (isBetterSnap(candidate, bestSnap)) bestSnap = candidate;
      }
    }
  }

  return bestSnap;
}

function shiftBounds(bounds: AlignmentBounds, deltaX: number, deltaY: number): AlignmentBounds {
  return {
    bottom: bounds.bottom + deltaY,
    left: bounds.left + deltaX,
    right: bounds.right + deltaX,
    top: bounds.top + deltaY,
  };
}

export function mergeAlignmentBounds(bounds: readonly AlignmentBounds[]): AlignmentBounds | null {
  if (bounds.length === 0) return null;

  return {
    bottom: Math.max(...bounds.map((entry) => entry.bottom)),
    left: Math.min(...bounds.map((entry) => entry.left)),
    right: Math.max(...bounds.map((entry) => entry.right)),
    top: Math.min(...bounds.map((entry) => entry.top)),
  };
}

export function resolveAlignmentSnap({
  bounds,
  references,
  threshold,
  x,
  y,
}: {
  bounds: AlignmentBounds;
  references: AlignmentReference[];
  threshold: number;
  x: number;
  y: number;
}): AlignmentSnapResult {
  const horizontalSnap = findAxisSnap(
    getHorizontalAnchors(bounds),
    references,
    getHorizontalAnchors,
    threshold,
  );
  const verticalSnap = findAxisSnap(
    getVerticalAnchors(bounds),
    references,
    getVerticalAnchors,
    threshold,
  );
  const deltaX = horizontalSnap?.delta ?? 0;
  const deltaY = verticalSnap?.delta ?? 0;
  const shiftedBounds = shiftBounds(bounds, deltaX, deltaY);
  const guides: AlignmentGuide[] = [];

  if (horizontalSnap) {
    guides.push({
      end: Math.max(shiftedBounds.bottom, horizontalSnap.reference.bounds.bottom),
      orientation: "vertical",
      position: horizontalSnap.referenceAnchor.position,
      sourceId: horizontalSnap.reference.id,
      start: Math.min(shiftedBounds.top, horizontalSnap.reference.bounds.top),
    });
  }

  if (verticalSnap) {
    guides.push({
      end: Math.max(shiftedBounds.right, verticalSnap.reference.bounds.right),
      orientation: "horizontal",
      position: verticalSnap.referenceAnchor.position,
      sourceId: verticalSnap.reference.id,
      start: Math.min(shiftedBounds.left, verticalSnap.reference.bounds.left),
    });
  }

  return {
    guides,
    x: x + deltaX,
    y: y + deltaY,
  };
}
