import { CANVAS_FONT_FAMILY_IDS } from "@/editor/fonts";
import type { CanvasDocument, CanvasElement, GroupElement } from "@/editor/types";
import {
  PPT_CANVAS_RENDERER_VERSION,
  PPT_MODEL,
  PPT_VISUAL_PROMPT_VERSION,
  PPT_VISUAL_REVIEW_PROMPT_VERSION,
  PptVisualPlanSchema,
  PptVisualReviewSchema,
} from "@/features/ai-ppt/schema";
import { z } from "zod";

export const PPT_CANVAS_ARTIFACT_STORAGE_KEY = "json-canvas-editor:ppt-canvas-artifacts:v1";

const FontWeightSchema = z.enum(["400", "500", "600", "700", "800"]);
const ElementMetaSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    visible: z.boolean(),
    locked: z.boolean(),
  })
  .strict();
const TransformableElementSchema = ElementMetaSchema.extend({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative(),
  rotation: z.number().finite(),
  opacity: z.number().finite().min(0).max(1),
}).strict();
const StrokedElementSchema = TransformableElementSchema.extend({
  stroke: z.string(),
  strokeWidth: z.number().finite().nonnegative(),
}).strict();
const FilledStrokedElementSchema = StrokedElementSchema.extend({
  fill: z.string(),
}).strict();
const TextElementSchema = TransformableElementSchema.extend({
  type: z.literal("text"),
  text: z.string(),
  fontFamily: z.enum(CANVAS_FONT_FAMILY_IDS),
  fontSize: z.number().finite().positive(),
  fontWeight: FontWeightSchema,
  lineHeight: z.number().finite().positive(),
  align: z.enum(["left", "center", "right"]),
  fill: z.string(),
}).strict();
const RectElementSchema = FilledStrokedElementSchema.extend({
  type: z.literal("rect"),
  cornerRadius: z.number().finite().nonnegative(),
}).strict();
const CircleElementSchema = FilledStrokedElementSchema.extend({
  type: z.literal("circle"),
}).strict();
const EllipseElementSchema = FilledStrokedElementSchema.extend({
  type: z.literal("ellipse"),
}).strict();
const LineElementSchema = StrokedElementSchema.extend({
  type: z.literal("line"),
  points: z.array(z.number().finite()).min(4),
  lineCap: z.enum(["butt", "round", "square"]),
}).strict();
const ArrowElementSchema = StrokedElementSchema.extend({
  type: z.literal("arrow"),
  points: z.array(z.number().finite()).min(4),
  lineCap: z.enum(["butt", "round", "square"]),
  pointerLength: z.number().finite().positive(),
  pointerWidth: z.number().finite().positive(),
}).strict();
const PolygonElementSchema = FilledStrokedElementSchema.extend({
  type: z.literal("polygon"),
  sides: z.number().int().min(3),
  cornerRadius: z.number().finite().nonnegative(),
}).strict();
const StarElementSchema = FilledStrokedElementSchema.extend({
  type: z.literal("star"),
  numPoints: z.number().int().min(3),
  innerRadius: z.number().finite().positive(),
  outerRadius: z.number().finite().positive(),
}).strict();
const ImageElementSchema = TransformableElementSchema.extend({
  type: z.literal("image"),
  src: z.string().min(1),
  fit: z.enum(["cover", "contain"]),
  cornerRadius: z.number().finite().nonnegative(),
}).strict();
const ChartElementSchema = TransformableElementSchema.extend({
  type: z.literal("chart"),
  chartType: z.enum(["bar", "line", "pie"]),
  title: z.string(),
  showLegend: z.boolean(),
  showValue: z.boolean(),
  colors: z.array(z.string()).min(1),
  series: z
    .array(
      z
        .object({
          name: z.string(),
          labels: z.array(z.string()),
          values: z.array(z.number().finite()),
        })
        .strict(),
    )
    .min(1),
}).strict();
const TableCellStyleSchema = z
  .object({
    fill: z.string(),
    color: z.string(),
    fontFamily: z.enum(CANVAS_FONT_FAMILY_IDS),
    fontSize: z.number().finite().positive(),
    fontWeight: FontWeightSchema,
    align: z.enum(["left", "center", "right"]),
    valign: z.enum(["top", "middle", "bottom"]),
    borderColor: z.string(),
    borderWidth: z.number().finite().nonnegative(),
  })
  .strict();
const TableElementSchema = TransformableElementSchema.extend({
  type: z.literal("table"),
  columns: z
    .array(
      z
        .object({
          id: z.string().min(1),
          name: z.string(),
          width: z.number().finite().positive(),
        })
        .strict(),
    )
    .min(1),
  rows: z.array(
    z
      .object({
        id: z.string().min(1),
        height: z.number().finite().positive(),
        cells: z.record(z.string(), z.string()),
      })
      .strict(),
  ),
  headerStyle: TableCellStyleSchema,
  cellStyle: TableCellStyleSchema,
}).strict();

const CanvasLeafElementSchema = z.discriminatedUnion("type", [
  TextElementSchema,
  RectElementSchema,
  CircleElementSchema,
  EllipseElementSchema,
  LineElementSchema,
  ArrowElementSchema,
  PolygonElementSchema,
  StarElementSchema,
  ImageElementSchema,
  ChartElementSchema,
  TableElementSchema,
]);

const GroupElementSchema: z.ZodType<GroupElement> = ElementMetaSchema.extend({
  type: z.literal("group"),
  children: z.lazy(() => CanvasElementSchema.array()),
}).strict();

const CanvasElementSchema: z.ZodType<CanvasElement> = z.lazy(() =>
  z.union([CanvasLeafElementSchema, GroupElementSchema]),
);

export const CanvasDocumentSchema: z.ZodType<CanvasDocument> = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    description: z.string(),
    documentType: z.enum(["longform", "pptx"]),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
    elements: z.array(CanvasElementSchema).min(1),
  })
  .strict();

export const PptCanvasArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    projectId: z.string().uuid(),
    sourceStructureUpdatedAt: z.string().datetime(),
    visualPreference: z.string().max(500),
    visualPlan: PptVisualPlanSchema,
    visualReview: PptVisualReviewSchema.optional(),
    document: CanvasDocumentSchema,
    generator: z
      .object({
        model: z.literal(PPT_MODEL),
        promptVersion: z.enum([
          "ppt-visual-plan/v1",
          "ppt-visual-plan/v2",
          PPT_VISUAL_PROMPT_VERSION,
        ]),
      })
      .strict(),
    reviewer: z
      .object({
        model: z.literal(PPT_MODEL),
        promptVersion: z.enum(["ppt-visual-review/v1", PPT_VISUAL_REVIEW_PROMPT_VERSION]),
      })
      .strict()
      .optional(),
    rendererVersion: z.enum(["canvas-render/v1", PPT_CANVAS_RENDERER_VERSION]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type PptCanvasArtifactV1 = z.infer<typeof PptCanvasArtifactSchema>;

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function listPptCanvasArtifacts(): PptCanvasArtifactV1[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(PPT_CANVAS_ARTIFACT_STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .map((artifact) => PptCanvasArtifactSchema.safeParse(artifact))
      .filter((result) => result.success)
      .map((result) => result.data)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch {
    return [];
  }
}

export function getPptCanvasArtifact(projectId: string): PptCanvasArtifactV1 | null {
  return listPptCanvasArtifacts().find((artifact) => artifact.projectId === projectId) ?? null;
}

function writeArtifacts(artifacts: readonly PptCanvasArtifactV1[]): boolean {
  const storage = getStorage();
  if (!storage) return false;

  try {
    storage.setItem(PPT_CANVAS_ARTIFACT_STORAGE_KEY, JSON.stringify(artifacts));
    return true;
  } catch {
    return false;
  }
}

export function savePptCanvasArtifact(artifact: PptCanvasArtifactV1): boolean {
  const result = PptCanvasArtifactSchema.safeParse(artifact);
  if (!result.success) return false;
  const artifacts = [
    result.data,
    ...listPptCanvasArtifacts().filter((current) => current.projectId !== artifact.projectId),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return writeArtifacts(artifacts);
}

export function deletePptCanvasArtifact(projectId: string): boolean {
  return writeArtifacts(
    listPptCanvasArtifacts().filter((artifact) => artifact.projectId !== projectId),
  );
}

export function createPptCanvasArtifact(
  projectId: string,
  sourceStructureUpdatedAt: string,
  visualPreference: string,
  visualPlan: PptCanvasArtifactV1["visualPlan"],
  document: CanvasDocument,
  visualReview: NonNullable<PptCanvasArtifactV1["visualReview"]>,
): PptCanvasArtifactV1 {
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: 1,
    projectId,
    sourceStructureUpdatedAt,
    visualPreference,
    visualPlan,
    visualReview,
    document,
    generator: {
      model: PPT_MODEL,
      promptVersion: PPT_VISUAL_PROMPT_VERSION,
    },
    reviewer: {
      model: PPT_MODEL,
      promptVersion: PPT_VISUAL_REVIEW_PROMPT_VERSION,
    },
    rendererVersion: PPT_CANVAS_RENDERER_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updatePptCanvasArtifactDocument(
  artifact: PptCanvasArtifactV1,
  document: CanvasDocument,
): PptCanvasArtifactV1 {
  return {
    ...artifact,
    document,
    updatedAt: new Date().toISOString(),
  };
}

export function isPptCanvasArtifactStale(
  artifact: PptCanvasArtifactV1,
  projectUpdatedAt: string,
): boolean {
  return (
    artifact.sourceStructureUpdatedAt !== projectUpdatedAt ||
    artifact.generator.promptVersion !== PPT_VISUAL_PROMPT_VERSION ||
    artifact.reviewer?.promptVersion !== PPT_VISUAL_REVIEW_PROMPT_VERSION ||
    artifact.rendererVersion !== PPT_CANVAS_RENDERER_VERSION
  );
}
