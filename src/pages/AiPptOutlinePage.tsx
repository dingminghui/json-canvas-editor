import { AppBackLink } from "@/components/AppBackLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { CanvasDocument } from "@/editor/types";
import { isLocalBrowserHost, PptGenerationError } from "@/features/ai-ppt/api";
import {
  createPptCanvasArtifact,
  getPptCanvasArtifact,
  isPptCanvasArtifactStale,
  savePptCanvasArtifact,
  type PptCanvasArtifactV2,
} from "@/features/ai-ppt/canvas-storage";
import {
  addSlideAfter,
  deleteSlideById,
  moveSlide,
  recordPptProjectUsage,
  touchPptProject,
  updateSection,
} from "@/features/ai-ppt/model";
import {
  CanvasRenderError,
  renderPptStructureToCanvas,
} from "@/features/ai-ppt/render/render-ppt-structure";
import {
  DEFAULT_BAILIAN_API_HOST,
  getPptMaterialCoverage,
  PPT_LAYOUT_INTENTS,
  PPT_SLIDE_ROLES,
  type PptContentBlock,
  type PptProjectV1,
  type PptSlide,
  type PptStructureV1,
  type PptVisualAsset,
} from "@/features/ai-ppt/schema";
import { getPptProject, savePptProject } from "@/features/ai-ppt/storage";
import { mergePptTokenUsage } from "@/features/ai-ppt/token-usage";
import {
  generatePptVisualPlan,
  reviewPptVisualPlan,
  type PptSlidePreview,
  type PptVisualGenerationPhase,
  type PptVisualReviewPhase,
} from "@/features/ai-ppt/visual-api";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  Plus,
  Save,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

const PptVisualReviewCapture = lazy(() =>
  import("@/features/ai-ppt/PptVisualReviewCapture").then((module) => ({
    default: module.PptVisualReviewCapture,
  })),
);

const MAX_VISUAL_ASSET_COUNT = 6;
const MAX_VISUAL_ASSET_BYTES = 1_500_000;
const MAX_VISUAL_ASSET_TOTAL_BYTES = 4_000_000;
const ACCEPTED_VISUAL_ASSET_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

function readVisualAssetFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("图片读取结果无效"));
    reader.readAsDataURL(file);
  });
}

function getNextVisualAssetId(assets: readonly PptVisualAsset[]): string {
  const usedIds = new Set(assets.map((asset) => asset.id));
  for (let index = 1; index <= MAX_VISUAL_ASSET_COUNT + 1; index += 1) {
    const id = `A${String(index).padStart(2, "0")}`;
    if (!usedIds.has(id)) return id;
  }
  return `A${String(assets.length + 1).padStart(2, "0")}`;
}

type SaveState = "saved" | "saving" | "error";
type CanvasGenerationState =
  | { status: "idle" }
  | {
      status: "generating";
      phase:
        | PptVisualGenerationPhase
        | PptVisualReviewPhase
        | "rendering"
        | "capturing-previews"
        | "rerendering";
    }
  | { status: "error"; message: string };

interface PreviewCaptureRequest {
  document: CanvasDocument;
  slideIds: string[];
}

interface PreviewCapturePending {
  resolve: (previews: PptSlidePreview[]) => void;
  reject: (error: Error) => void;
  removeAbortListener: () => void;
}

const CANVAS_GENERATION_LABELS: Record<
  Extract<CanvasGenerationState, { status: "generating" }>["phase"],
  string
> = {
  "planning-visuals": "正在规划视觉方案",
  "repairing-visuals": "正在修复视觉方案",
  rendering: "正在生成初稿画布",
  "capturing-previews": "正在渲染视觉预览",
  "reviewing-visuals": "正在进行视觉评审",
  "repairing-visual-review": "正在修复视觉评审",
  rerendering: "正在应用视觉评审",
};

const ROLE_LABELS: Record<PptSlide["role"], string> = {
  cover: "封面",
  agenda: "议程",
  section: "章节",
  content: "内容",
  comparison: "比较",
  process: "流程",
  timeline: "时间线",
  data: "数据",
  summary: "总结",
  closing: "结束",
};

const LAYOUT_LABELS: Record<PptSlide["layoutIntent"], string> = {
  cover: "封面",
  "title-body": "标题 + 正文",
  "title-bullets": "标题 + 要点",
  "two-column": "双栏",
  comparison: "对比",
  process: "流程",
  timeline: "时间线",
  metrics: "指标",
  chart: "数据图表",
  diagram: "结构图",
  quote: "引用",
  summary: "总结",
};

const BLOCK_LABELS: Record<PptContentBlock["type"], string> = {
  paragraph: "段落",
  "bullet-list": "要点列表",
  "numbered-list": "编号列表",
  comparison: "对比",
  process: "流程",
  metrics: "指标",
  chart: "数据图表",
  diagram: "结构图",
  quote: "引用",
  table: "表格",
};

const NARRATIVE_LABELS: Record<PptStructureV1["deck"]["narrativeMode"], string> = {
  pyramid: "结论先行",
  narrative: "故事叙述",
  instructional: "教学讲解",
  showcase: "成果展示",
  briefing: "情况简报",
};

const READING_LABELS: Record<PptStructureV1["deck"]["readingMode"], string> = {
  text: "偏文本阅读",
  balanced: "阅读与演讲平衡",
  presentation: "偏现场演讲",
};

function LinesEditor({
  id,
  label,
  items,
  onChange,
}: {
  id: string;
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        className="min-h-24 text-sm"
        id={id}
        onChange={(event) => onChange(event.target.value.split("\n"))}
        value={items.join("\n")}
      />
    </Field>
  );
}

function chartBlockToText(block: Extract<PptContentBlock, { type: "chart" }>): string {
  return [
    ["类别", ...block.series.map((series) => series.name)].join(" | "),
    ...block.categories.map((category, categoryIndex) =>
      [category, ...block.series.map((series) => String(series.values[categoryIndex] ?? 0))].join(
        " | ",
      ),
    ),
  ].join("\n");
}

function updateChartBlockFromText(
  block: Extract<PptContentBlock, { type: "chart" }>,
  value: string,
): Extract<PptContentBlock, { type: "chart" }> {
  const rows = value
    .split("\n")
    .map((row) => row.split("|").map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));
  const header = rows[0];
  if (!header || header.length < 2 || rows.length < 3) return block;
  const categories = rows.slice(1).map((row) => row[0] || "未命名");
  const series = header.slice(1).map((name, seriesIndex) => ({
    name: name || `系列 ${seriesIndex + 1}`,
    values: rows.slice(1).map((row) => {
      const valueAtCell = Number(row[seriesIndex + 1]);
      return Number.isFinite(valueAtCell) ? valueAtCell : 0;
    }),
  }));
  return {
    ...block,
    categories,
    series: block.relationship === "part-to-whole" ? series.slice(0, 1) : series,
  };
}

function diagramNodesToText(block: Extract<PptContentBlock, { type: "diagram" }>): string {
  return block.nodes
    .map((node) => [node.id, node.label, node.description ?? ""].join(" | "))
    .join("\n");
}

function diagramEdgesToText(block: Extract<PptContentBlock, { type: "diagram" }>): string {
  return block.edges.map((edge) => [edge.from, edge.to, edge.label ?? ""].join(" | ")).join("\n");
}

function ContentBlockEditor({
  block,
  blockIndex,
  slideId,
  canDelete,
  onChange,
  onDelete,
}: {
  block: PptContentBlock;
  blockIndex: number;
  slideId: string;
  canDelete: boolean;
  onChange: (block: PptContentBlock) => void;
  onDelete: () => void;
}) {
  const prefix = `${slideId}-block-${blockIndex}`;

  let fields: React.ReactNode;
  switch (block.type) {
    case "paragraph":
      fields = (
        <Textarea
          aria-label="段落内容"
          className="min-h-28"
          onChange={(event) => onChange({ ...block, text: event.target.value })}
          value={block.text}
        />
      );
      break;
    case "bullet-list":
    case "numbered-list":
      fields = (
        <LinesEditor
          id={`${prefix}-items`}
          items={block.items}
          label={block.type === "bullet-list" ? "要点（每行一项）" : "步骤（每行一项）"}
          onChange={(items) => onChange({ ...block, items })}
        />
      );
      break;
    case "comparison":
      fields = (
        <FieldGroup className="grid! grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor={`${prefix}-left-title`}>左侧标题</FieldLabel>
            <Input
              id={`${prefix}-left-title`}
              onChange={(event) =>
                onChange({ ...block, left: { ...block.left, heading: event.target.value } })
              }
              value={block.left.heading}
            />
            <LinesEditor
              id={`${prefix}-left`}
              items={block.left.items}
              label="左侧内容"
              onChange={(items) => onChange({ ...block, left: { ...block.left, items } })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${prefix}-right-title`}>右侧标题</FieldLabel>
            <Input
              id={`${prefix}-right-title`}
              onChange={(event) =>
                onChange({ ...block, right: { ...block.right, heading: event.target.value } })
              }
              value={block.right.heading}
            />
            <LinesEditor
              id={`${prefix}-right`}
              items={block.right.items}
              label="右侧内容"
              onChange={(items) => onChange({ ...block, right: { ...block.right, items } })}
            />
          </Field>
        </FieldGroup>
      );
      break;
    case "process":
      fields = (
        <div className="flex flex-col gap-3">
          {block.steps.map((step, index) => (
            <div className="grid grid-cols-[150px_1fr] gap-3" key={`${prefix}-step-${index}`}>
              <Input
                aria-label={`步骤 ${index + 1} 标题`}
                onChange={(event) => {
                  const steps = block.steps.slice();
                  steps[index] = { ...step, title: event.target.value };
                  onChange({ ...block, steps });
                }}
                value={step.title}
              />
              <Input
                aria-label={`步骤 ${index + 1} 说明`}
                onChange={(event) => {
                  const steps = block.steps.slice();
                  steps[index] = { ...step, description: event.target.value };
                  onChange({ ...block, steps });
                }}
                placeholder="说明"
                value={step.description ?? ""}
              />
            </div>
          ))}
          <Button
            disabled={block.steps.length >= 8}
            onClick={() =>
              onChange({
                ...block,
                steps: [...block.steps, { title: "新步骤", description: "" }],
              })
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus aria-hidden="true" data-icon="inline-start" />
            添加步骤
          </Button>
        </div>
      );
      break;
    case "metrics":
      fields = (
        <div className="flex flex-col gap-3">
          {block.items.map((item, index) => (
            <div
              className="grid grid-cols-[120px_160px_1fr] gap-3"
              key={`${prefix}-metric-${index}`}
            >
              {(["value", "label", "context"] as const).map((key) => (
                <Input
                  aria-label={`指标 ${index + 1} ${key}`}
                  key={key}
                  onChange={(event) => {
                    const items = block.items.slice();
                    items[index] = { ...item, [key]: event.target.value };
                    onChange({ ...block, items });
                  }}
                  placeholder={{ value: "数值", label: "标签", context: "说明" }[key]}
                  value={item[key] ?? ""}
                />
              ))}
            </div>
          ))}
          <Button
            disabled={block.items.length >= 6}
            onClick={() =>
              onChange({
                ...block,
                items: [...block.items, { value: "0", label: "新指标", context: "" }],
              })
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus aria-hidden="true" data-icon="inline-start" />
            添加指标
          </Button>
        </div>
      );
      break;
    case "quote":
      fields = (
        <div className="flex flex-col gap-3">
          <Textarea
            aria-label="引用内容"
            className="min-h-24"
            onChange={(event) => onChange({ ...block, quote: event.target.value })}
            value={block.quote}
          />
          <Input
            aria-label="引用来源"
            onChange={(event) => onChange({ ...block, attribution: event.target.value })}
            placeholder="引用来源"
            value={block.attribution ?? ""}
          />
        </div>
      );
      break;
    case "table":
      fields = (
        <div className="flex flex-col gap-3">
          <Input
            aria-label="表格列名"
            onChange={(event) =>
              onChange({
                ...block,
                columns: event.target.value.split("|").map((item) => item.trim()),
              })
            }
            placeholder="列名 1 | 列名 2"
            value={block.columns.join(" | ")}
          />
          <Textarea
            aria-label="表格数据"
            className="min-h-28 font-mono text-xs"
            onChange={(event) =>
              onChange({
                ...block,
                rows: event.target.value
                  .split("\n")
                  .map((row) => row.split("|").map((cell) => cell.trim())),
              })
            }
            placeholder={"单元格 1 | 单元格 2\n单元格 3 | 单元格 4"}
            value={block.rows.map((row) => row.join(" | ")).join("\n")}
          />
        </div>
      );
      break;
    case "chart":
      fields = (
        <div className="flex flex-col gap-3">
          <Select
            onValueChange={(relationship) =>
              onChange({
                ...block,
                relationship: relationship as typeof block.relationship,
                series: relationship === "part-to-whole" ? block.series.slice(0, 1) : block.series,
              })
            }
            value={block.relationship}
          >
            <SelectTrigger aria-label="图表数据关系" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="comparison">类别比较</SelectItem>
              <SelectItem value="trend">趋势变化</SelectItem>
              <SelectItem value="part-to-whole">构成占比</SelectItem>
            </SelectContent>
          </Select>
          <Input
            aria-label="图表核心结论"
            onChange={(event) => onChange({ ...block, takeaway: event.target.value })}
            placeholder="读者看完图表后应记住的结论"
            value={block.takeaway}
          />
          <Textarea
            aria-label="图表数据"
            className="min-h-32 font-mono text-xs"
            onChange={(event) => onChange(updateChartBlockFromText(block, event.target.value))}
            placeholder={"类别 | 系列 A | 系列 B\n第一项 | 10 | 12\n第二项 | 18 | 20"}
            value={chartBlockToText(block)}
          />
        </div>
      );
      break;
    case "diagram":
      fields = (
        <div className="flex flex-col gap-3">
          <Select
            onValueChange={(relationship) =>
              onChange({ ...block, relationship: relationship as typeof block.relationship })
            }
            value={block.relationship}
          >
            <SelectTrigger aria-label="结构图关系类型" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="process">顺序流程</SelectItem>
              <SelectItem value="hierarchy">层级关系</SelectItem>
              <SelectItem value="cycle">循环关系</SelectItem>
              <SelectItem value="system">中心系统</SelectItem>
              <SelectItem value="cause-effect">因果关系</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            aria-label="结构图节点"
            className="min-h-28 font-mono text-xs"
            onChange={(event) => {
              const nodes = event.target.value
                .split("\n")
                .map((row) => row.split("|").map((cell) => cell.trim()))
                .filter((row) => row[0] && row[1])
                .map(([id, label, description]) => ({
                  id,
                  label,
                  description: description || undefined,
                }));
              if (nodes.length >= 2) onChange({ ...block, nodes });
            }}
            placeholder={"input | 输入 | 原始信息\nengine | 引擎 | 处理逻辑"}
            value={diagramNodesToText(block)}
          />
          <Textarea
            aria-label="结构图连接"
            className="min-h-24 font-mono text-xs"
            onChange={(event) => {
              const edges = event.target.value
                .split("\n")
                .map((row) => row.split("|").map((cell) => cell.trim()))
                .filter((row) => row[0] && row[1])
                .map(([from, to, label]) => ({
                  from,
                  to,
                  label: label || undefined,
                }));
              if (edges.length >= 1) onChange({ ...block, edges });
            }}
            placeholder={"input | engine | 进入\nengine | output | 产出"}
            value={diagramEdgesToText(block)}
          />
        </div>
      );
      break;
    default: {
      const exhaustiveBlock: never = block;
      fields = exhaustiveBlock;
    }
  }

  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <Badge variant="outline">{BLOCK_LABELS[block.type]}</Badge>
        <Button
          aria-label={`删除内容块 ${blockIndex + 1}`}
          disabled={!canDelete}
          onClick={onDelete}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" data-icon="inline-start" />
        </Button>
      </div>
      {fields}
    </div>
  );
}

function OutlineEditor({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const [project, setProject] = useState<PptProjectV1 | null>(() => getPptProject(projectId));
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [canvasArtifact, setCanvasArtifact] = useState<PptCanvasArtifactV2 | null>(() =>
    getPptCanvasArtifact(projectId),
  );
  const [canvasDialogOpen, setCanvasDialogOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiHost, setApiHost] = useState<string>(DEFAULT_BAILIAN_API_HOST);
  const [visualPreference, setVisualPreference] = useState("");
  const [visualAssets, setVisualAssets] = useState<PptVisualAsset[]>([]);
  const [visualAssetError, setVisualAssetError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [canvasGeneration, setCanvasGeneration] = useState<CanvasGenerationState>({
    status: "idle",
  });
  const [previewCaptureRequest, setPreviewCaptureRequest] = useState<PreviewCaptureRequest | null>(
    null,
  );
  const canvasAbortControllerRef = useRef<AbortController | null>(null);
  const previewCapturePendingRef = useRef<PreviewCapturePending | null>(null);
  const materialFactById = useMemo(
    () => new Map(project?.materialPlan?.facts.map((fact) => [fact.id, fact] as const) ?? []),
    [project?.materialPlan],
  );

  useEffect(() => {
    if (!project || saveState !== "saving") return;
    const timeoutId = globalThis.setTimeout(() => {
      setSaveState(savePptProject(project) ? "saved" : "error");
    }, 300);
    return () => globalThis.clearTimeout(timeoutId);
  }, [project, saveState]);

  useEffect(
    () => () => {
      canvasAbortControllerRef.current?.abort();
    },
    [],
  );

  const captureSlidePreviews = useCallback(
    (
      document: CanvasDocument,
      slideIds: string[],
      signal: AbortSignal,
    ): Promise<PptSlidePreview[]> =>
      new Promise((resolve, reject) => {
        if (previewCapturePendingRef.current) {
          reject(new Error("已有视觉评审预览正在生成"));
          return;
        }
        if (signal.aborted) {
          reject(new PptGenerationError("cancelled", "已取消生成视觉评审预览。"));
          return;
        }

        const handleAbort = () => {
          const pending = previewCapturePendingRef.current;
          previewCapturePendingRef.current = null;
          setPreviewCaptureRequest(null);
          pending?.removeAbortListener();
          pending?.reject(new PptGenerationError("cancelled", "已取消生成视觉评审预览。"));
        };
        signal.addEventListener("abort", handleAbort, { once: true });
        previewCapturePendingRef.current = {
          reject,
          resolve,
          removeAbortListener: () => signal.removeEventListener("abort", handleAbort),
        };
        void import("@/features/ai-ppt/PptVisualReviewCapture").then(
          () => {
            if (signal.aborted || !previewCapturePendingRef.current) return;
            setPreviewCaptureRequest({ document, slideIds });
          },
          (error: unknown) => {
            const pending = previewCapturePendingRef.current;
            previewCapturePendingRef.current = null;
            pending?.removeAbortListener();
            pending?.reject(error instanceof Error ? error : new Error("无法加载视觉评审预览组件"));
          },
        );
      }),
    [],
  );

  const handlePreviewsCaptured = useCallback((previews: PptSlidePreview[]) => {
    const pending = previewCapturePendingRef.current;
    if (!pending) return;
    previewCapturePendingRef.current = null;
    setPreviewCaptureRequest(null);
    pending.removeAbortListener();
    pending.resolve(previews);
  }, []);

  const handlePreviewCaptureError = useCallback((error: Error) => {
    const pending = previewCapturePendingRef.current;
    if (!pending) return;
    previewCapturePendingRef.current = null;
    setPreviewCaptureRequest(null);
    pending.removeAbortListener();
    pending.reject(error);
  }, []);

  if (!project) {
    return (
      <main className="grid h-dvh min-w-[960px] place-items-center bg-background p-10">
        <Empty className="max-w-lg border">
          <EmptyHeader>
            <EmptyMedia>
              <CircleAlert />
            </EmptyMedia>
            <EmptyTitle>没有找到这份大纲</EmptyTitle>
            <EmptyDescription>它可能已被删除，或者保存在另一个浏览器中。</EmptyDescription>
          </EmptyHeader>
          <AppBackLink iconOnly to="/" variant="outline">
            返回首页
          </AppBackLink>
        </Empty>
      </main>
    );
  }

  function updateStructure(
    updater: (structure: PptStructureV1) => PptStructureV1,
    immediate = false,
  ) {
    setProject((current) => {
      if (!current) return current;
      const next = touchPptProject(current, updater(current.structure));
      if (immediate) setSaveState(savePptProject(next) ? "saved" : "error");
      else setSaveState("saving");
      return next;
    });
  }

  function updateSlide(slideId: string, patch: Partial<PptSlide>) {
    updateStructure((structure) => ({
      ...structure,
      slides: structure.slides.map((slide) =>
        slide.id === slideId ? { ...slide, ...patch } : slide,
      ),
    }));
  }

  function updateBlock(slideId: string, blockIndex: number, block: PptContentBlock) {
    updateStructure((structure) => ({
      ...structure,
      slides: structure.slides.map((slide) => {
        if (slide.id !== slideId) return slide;
        const contentBlocks = slide.contentBlocks.slice();
        contentBlocks[blockIndex] = block;
        return { ...slide, contentBlocks };
      }),
    }));
  }

  const structure = project.structure;
  const materialCoverage = project.materialPlan
    ? getPptMaterialCoverage(structure, project.materialPlan)
    : null;
  const artifactIsStale = canvasArtifact
    ? isPptCanvasArtifactStale(canvasArtifact, project.updatedAt)
    : false;
  const isGeneratingCanvas = canvasGeneration.status === "generating";

  function handleCanvasDialogChange(open: boolean) {
    if (!open) {
      canvasAbortControllerRef.current?.abort();
      setApiKey("");
      setShowApiKey(false);
      setVisualAssets([]);
      setVisualAssetError(null);
      setCanvasGeneration({ status: "idle" });
    }
    setCanvasDialogOpen(open);
  }

  async function handleVisualAssetFiles(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) return;
    if (visualAssets.length + selectedFiles.length > MAX_VISUAL_ASSET_COUNT) {
      setVisualAssetError(`最多添加 ${MAX_VISUAL_ASSET_COUNT} 张图片。`);
      return;
    }
    const unsupported = selectedFiles.find(
      (file) =>
        !ACCEPTED_VISUAL_ASSET_TYPES.includes(
          file.type as (typeof ACCEPTED_VISUAL_ASSET_TYPES)[number],
        ),
    );
    if (unsupported) {
      setVisualAssetError("仅支持 PNG、JPEG 或 WebP 图片。");
      return;
    }
    if (selectedFiles.some((file) => file.size > MAX_VISUAL_ASSET_BYTES)) {
      setVisualAssetError("单张图片不能超过 1.5MB。");
      return;
    }
    const currentBytes = visualAssets.reduce((total, asset) => total + asset.src.length, 0);
    const selectedBytes = selectedFiles.reduce((total, file) => total + file.size, 0);
    if (currentBytes + selectedBytes > MAX_VISUAL_ASSET_TOTAL_BYTES) {
      setVisualAssetError("图片总大小不能超过 4MB，以确保画布可以稳定保存。");
      return;
    }

    try {
      const sources = await Promise.all(selectedFiles.map(readVisualAssetFile));
      setVisualAssets((current) => {
        const next = current.slice();
        selectedFiles.forEach((file, index) => {
          next.push({
            id: getNextVisualAssetId(next),
            name: file.name,
            alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
            src: sources[index],
          });
        });
        return next;
      });
      setVisualAssetError(null);
    } catch {
      setVisualAssetError("图片读取失败，请重试。");
    }
  }

  async function handleGenerateCanvas(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentProject = project;
    if (!currentProject) return;
    if (!isLocalBrowserHost()) {
      setCanvasGeneration({ status: "error", message: "本功能仅支持从本地地址运行。" });
      return;
    }
    if (!apiKey.trim()) {
      setCanvasGeneration({ status: "error", message: "请输入百炼接口密钥。" });
      return;
    }

    const controller = new AbortController();
    canvasAbortControllerRef.current = controller;
    setCanvasGeneration({ status: "generating", phase: "planning-visuals" });
    try {
      const { usage: visualPlanUsage, visualPlan } = await generatePptVisualPlan({
        apiHost,
        apiKey: apiKey.trim(),
        onPhaseChange: (phase) => setCanvasGeneration({ status: "generating", phase }),
        signal: controller.signal,
        structure,
        assets: visualAssets,
        visualPreference,
      });
      setCanvasGeneration({ status: "generating", phase: "rendering" });
      const initialDocument = renderPptStructureToCanvas(
        structure,
        visualPlan,
        `ai-ppt-canvas-${currentProject.id}`,
        visualAssets,
      );
      setCanvasGeneration({ status: "generating", phase: "capturing-previews" });
      const previews = await captureSlidePreviews(
        initialDocument,
        structure.slides.map((slide) => slide.id),
        controller.signal,
      );
      const { review, usage: visualReviewUsage } = await reviewPptVisualPlan({
        apiHost,
        apiKey: apiKey.trim(),
        onPhaseChange: (phase) => setCanvasGeneration({ status: "generating", phase }),
        previews,
        signal: controller.signal,
        structure,
        visualPlan,
        assets: visualAssets,
        visualPreference,
      });
      const reviewedVisualPlan = review.revisedVisualPlan;
      let document = initialDocument;
      if (review.verdict === "revised") {
        setCanvasGeneration({ status: "generating", phase: "rerendering" });
        document = renderPptStructureToCanvas(
          structure,
          reviewedVisualPlan,
          `ai-ppt-canvas-${currentProject.id}`,
          visualAssets,
        );
      }
      const projectWithUsage = recordPptProjectUsage(
        currentProject,
        mergePptTokenUsage(visualPlanUsage, visualReviewUsage),
      );
      const artifact = createPptCanvasArtifact(
        currentProject.id,
        projectWithUsage.updatedAt,
        visualPreference.trim(),
        visualAssets,
        reviewedVisualPlan,
        document,
        review,
      );
      if (!savePptProject(projectWithUsage)) {
        setCanvasGeneration({
          status: "error",
          message: "视觉方案生成成功，但无法保存模型用量。",
        });
        return;
      }
      setProject(projectWithUsage);
      if (!savePptCanvasArtifact(artifact)) {
        setCanvasGeneration({
          status: "error",
          message: "画布生成成功，但无法保存到当前浏览器。",
        });
        return;
      }
      setCanvasArtifact(artifact);
      setApiKey("");
      navigate(`/ai-ppt/${currentProject.id}/editor`);
    } catch (error) {
      setCanvasGeneration({
        status: "error",
        message:
          error instanceof PptGenerationError
            ? error.message
            : error instanceof CanvasRenderError
              ? `画布渲染未通过校验：${error.message}`
              : "画布生成失败，请稍后重试。",
      });
    } finally {
      canvasAbortControllerRef.current = null;
    }
  }

  return (
    <>
      <main className="h-dvh min-w-[1180px] overflow-y-auto bg-background text-foreground">
        <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between px-8">
            <AppBackLink iconOnly to="/">
              全部项目
            </AppBackLink>
            <div className="flex shrink-0 items-center gap-4">
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs leading-none text-muted-foreground",
                  saveState === "error" && "text-destructive",
                )}
                role="status"
              >
                {saveState === "saving" ? (
                  <>
                    <Save aria-hidden="true" className="size-3.5" />
                    保存中…
                  </>
                ) : saveState === "error" ? (
                  <>
                    <CircleAlert aria-hidden="true" className="size-3.5" />
                    内容未通过校验，暂未保存
                  </>
                ) : (
                  <>
                    <Check aria-hidden="true" className="size-3.5" />
                    已保存到本地
                  </>
                )}
              </span>
              <Badge className="tabular-nums" variant="outline">
                共 {structure.deck.pageCount} 页
              </Badge>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1320px] px-8 py-10">
          <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-12">
            <section>
              <div className="pb-9">
                <p className="text-sm font-medium text-primary">演示内容总览</p>
                <Input
                  aria-label="PPT 标题"
                  className="mt-3 h-auto border-0 bg-transparent p-0 text-4xl font-semibold leading-tight tracking-[-0.04em] shadow-none focus-visible:ring-0"
                  maxLength={100}
                  onChange={(event) =>
                    updateStructure((current) => ({
                      ...current,
                      deck: { ...current.deck, title: event.target.value },
                    }))
                  }
                  value={structure.deck.title}
                />
                <Textarea
                  aria-label="PPT 核心信息"
                  className="mt-4 min-h-20 resize-none bg-muted/40 text-base"
                  maxLength={500}
                  onChange={(event) =>
                    updateStructure((current) => ({
                      ...current,
                      deck: { ...current.deck, coreMessage: event.target.value },
                    }))
                  }
                  value={structure.deck.coreMessage}
                />
                <FieldGroup className="mt-5 grid! grid-cols-2 gap-5">
                  <Field>
                    <FieldLabel htmlFor="deck-audience">目标听众</FieldLabel>
                    <Textarea
                      className="min-h-20"
                      id="deck-audience"
                      maxLength={300}
                      onChange={(event) =>
                        updateStructure((current) => ({
                          ...current,
                          deck: { ...current.deck, audience: event.target.value },
                        }))
                      }
                      value={structure.deck.audience}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="deck-purpose">演示目标</FieldLabel>
                    <Textarea
                      className="min-h-20"
                      id="deck-purpose"
                      maxLength={500}
                      onChange={(event) =>
                        updateStructure((current) => ({
                          ...current,
                          deck: { ...current.deck, purpose: event.target.value },
                        }))
                      }
                      value={structure.deck.purpose}
                    />
                  </Field>
                </FieldGroup>
              </div>

              {project.materialPlan && materialCoverage ? (
                <section className="mb-9 border-y py-6" aria-labelledby="material-coverage-title">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="text-xs font-medium text-primary">材料主导生成</p>
                      <h2 className="mt-1 text-lg font-semibold" id="material-coverage-title">
                        {project.materialPlan.direction.title}
                      </h2>
                    </div>
                    <Badge className="tabular-nums" variant="secondary">
                      材料覆盖 {materialCoverage.coveragePercent}%
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {project.materialPlan.direction.coreMessage}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      已使用 {materialCoverage.coveredFactCount}/{materialCoverage.totalFactCount}{" "}
                      条事实
                    </Badge>
                    <Badge
                      variant={
                        materialCoverage.coveredRequiredFactCount ===
                        materialCoverage.requiredFactCount
                          ? "outline"
                          : "destructive"
                      }
                    >
                      必需事实 {materialCoverage.coveredRequiredFactCount}/
                      {materialCoverage.requiredFactCount}
                    </Badge>
                  </div>
                  {materialCoverage.missingRequiredFacts.length > 0 ? (
                    <ul className="mt-4 list-disc space-y-1 pl-5 text-xs leading-5 text-destructive">
                      {materialCoverage.missingRequiredFacts.map((fact) => (
                        <li key={fact.id}>
                          {fact.id}：{fact.statement}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}

              <div>
                {structure.slides.map((slide, slideIndex) => (
                  <article
                    className="grid grid-cols-[58px_1fr] gap-5 border-t py-8"
                    data-slide-id={slide.id}
                    key={slide.id}
                  >
                    <div className="pt-1">
                      <span className="font-mono text-sm font-medium tabular-nums">{slide.id}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {ROLE_LABELS[slide.role]}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-start gap-3">
                        <Input
                          aria-label={`${slide.id} 标题`}
                          className="h-auto flex-1 border-0 bg-transparent p-0 text-2xl font-semibold leading-tight tracking-tight shadow-none focus-visible:ring-0"
                          maxLength={160}
                          onChange={(event) => updateSlide(slide.id, { title: event.target.value })}
                          value={slide.title}
                        />
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            aria-label={`上移 ${slide.id}`}
                            disabled={slideIndex <= 1}
                            onClick={() =>
                              updateStructure((current) => moveSlide(current, slide.id, -1), true)
                            }
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <ArrowUp aria-hidden="true" />
                          </Button>
                          <Button
                            aria-label={`下移 ${slide.id}`}
                            disabled={slideIndex >= structure.slides.length - 2}
                            onClick={() =>
                              updateStructure((current) => moveSlide(current, slide.id, 1), true)
                            }
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <ArrowDown aria-hidden="true" />
                          </Button>
                          <Button
                            aria-label={`删除 ${slide.id}`}
                            disabled={
                              slideIndex === 0 ||
                              slideIndex === structure.slides.length - 1 ||
                              structure.slides.length <= 4
                            }
                            onClick={() =>
                              updateStructure((current) => deleteSlideById(current, slide.id), true)
                            }
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 aria-hidden="true" data-icon="inline-start" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-[140px_180px_1fr] gap-3">
                        <Select
                          onValueChange={(value) =>
                            updateSlide(slide.id, { role: value as PptSlide["role"] })
                          }
                          value={slide.role}
                        >
                          <SelectTrigger
                            aria-label={`${slide.id} 页面角色`}
                            className="w-full"
                            size="sm"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper">
                            <SelectGroup>
                              {PPT_SLIDE_ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <Select
                          onValueChange={(value) =>
                            updateSlide(slide.id, {
                              layoutIntent: value as PptSlide["layoutIntent"],
                            })
                          }
                          value={slide.layoutIntent}
                        >
                          <SelectTrigger
                            aria-label={`${slide.id} 布局意图`}
                            className="w-full"
                            size="sm"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper">
                            <SelectGroup>
                              {PPT_LAYOUT_INTENTS.map((layout) => (
                                <SelectItem key={layout} value={layout}>
                                  {LAYOUT_LABELS[layout]}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <Badge
                          aria-label={`${slide.id} 所属章节`}
                          className="h-7 justify-start rounded-lg px-3 font-normal"
                          variant="secondary"
                        >
                          {structure.sections.find((section) => section.id === slide.sectionId)
                            ?.title ?? slide.sectionId}
                        </Badge>
                      </div>

                      <Field className="mt-5">
                        <FieldLabel htmlFor={`${slide.id}-core-message`}>核心信息</FieldLabel>
                        <Textarea
                          className="min-h-20 bg-muted/40"
                          id={`${slide.id}-core-message`}
                          maxLength={500}
                          onChange={(event) =>
                            updateSlide(slide.id, { coreMessage: event.target.value })
                          }
                          value={slide.coreMessage}
                        />
                      </Field>

                      <FieldGroup className="mt-4 grid! grid-cols-2 gap-4">
                        <Field>
                          <FieldLabel htmlFor={`${slide.id}-audience-before`}>
                            观众看之前
                          </FieldLabel>
                          <Input
                            id={`${slide.id}-audience-before`}
                            maxLength={300}
                            onChange={(event) =>
                              updateSlide(slide.id, {
                                audienceMove: {
                                  ...slide.audienceMove,
                                  before: event.target.value,
                                },
                              })
                            }
                            value={slide.audienceMove.before}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`${slide.id}-audience-after`}>观众看之后</FieldLabel>
                          <Input
                            id={`${slide.id}-audience-after`}
                            maxLength={300}
                            onChange={(event) =>
                              updateSlide(slide.id, {
                                audienceMove: {
                                  ...slide.audienceMove,
                                  after: event.target.value,
                                },
                              })
                            }
                            value={slide.audienceMove.after}
                          />
                        </Field>
                      </FieldGroup>

                      {project.materialPlan ? (
                        <Field className="mt-4">
                          <FieldLabel htmlFor={`${slide.id}-evidence-refs`}>材料依据 ID</FieldLabel>
                          <Input
                            aria-label={`${slide.id} 材料依据 ID`}
                            defaultValue={slide.evidenceRefs.join(", ")}
                            id={`${slide.id}-evidence-refs`}
                            key={`${slide.id}-${slide.evidenceRefs.join("-")}`}
                            onBlur={(event) => {
                              const evidenceRefs = Array.from(
                                new Set(
                                  event.target.value
                                    .split(/[\s,，]+/)
                                    .map((value) => value.trim().toUpperCase())
                                    .filter((value) => /^F\d{3,}$/.test(value)),
                                ),
                              ).slice(0, 20);
                              updateSlide(slide.id, { evidenceRefs });
                            }}
                            placeholder="F001, F002"
                          />
                          {slide.evidenceRefs.length > 0 ? (
                            <div className="mt-2 flex flex-col gap-1">
                              {slide.evidenceRefs.map((factId) => (
                                <p className="text-xs leading-5 text-muted-foreground" key={factId}>
                                  <span className="mr-2 font-mono text-foreground">{factId}</span>
                                  {materialFactById.get(factId)?.statement ?? "未找到对应材料事实"}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <FieldDescription>
                              本页没有标记材料事实；封面或纯转场页可以留空。
                            </FieldDescription>
                          )}
                        </Field>
                      ) : null}

                      <div className="mt-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">内容块</span>
                          <Button
                            disabled={slide.contentBlocks.length >= 8}
                            onClick={() =>
                              updateSlide(slide.id, {
                                contentBlocks: [
                                  ...slide.contentBlocks,
                                  { type: "paragraph", text: "新的正文内容。" },
                                ],
                              })
                            }
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <Plus data-icon="inline-start" />
                            添加段落
                          </Button>
                        </div>
                        {slide.contentBlocks.map((block, blockIndex) => (
                          <ContentBlockEditor
                            block={block}
                            blockIndex={blockIndex}
                            canDelete={slide.contentBlocks.length > 1}
                            key={`${slide.id}-${blockIndex}-${block.type}`}
                            onChange={(nextBlock) => updateBlock(slide.id, blockIndex, nextBlock)}
                            onDelete={() =>
                              updateSlide(slide.id, {
                                contentBlocks: slide.contentBlocks.filter(
                                  (_, index) => index !== blockIndex,
                                ),
                              })
                            }
                            slideId={slide.id}
                          />
                        ))}
                      </div>

                      <Field className="mt-5">
                        <FieldLabel htmlFor={`${slide.id}-speaker-notes`}>讲稿备注</FieldLabel>
                        <Textarea
                          className="min-h-20"
                          id={`${slide.id}-speaker-notes`}
                          maxLength={4000}
                          onChange={(event) =>
                            updateSlide(slide.id, { speakerNotes: event.target.value })
                          }
                          value={slide.speakerNotes ?? ""}
                        />
                      </Field>

                      <Separator className="mt-6 mb-4" />
                      <div>
                        <Button
                          disabled={structure.slides.length >= 20}
                          onClick={() =>
                            updateStructure((current) => addSlideAfter(current, slide.id), true)
                          }
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Plus data-icon="inline-start" />
                          在后面添加一页
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="sticky top-24 h-fit border-l pl-8">
              <div>
                <h2 className="text-sm font-semibold">结构元数据</h2>
                <dl className="mt-4 grid grid-cols-[100px_1fr] gap-y-2 text-xs">
                  <dt className="text-muted-foreground">叙事模式</dt>
                  <dd>{NARRATIVE_LABELS[structure.deck.narrativeMode]}</dd>
                  <dt className="text-muted-foreground">阅读模式</dt>
                  <dd>{READING_LABELS[structure.deck.readingMode]}</dd>
                  <dt className="text-muted-foreground">语言</dt>
                  <dd>{structure.deck.language === "zh-CN" ? "简体中文" : "英文"}</dd>
                  <dt className="text-muted-foreground">模型</dt>
                  <dd className="font-mono">{project.generator.model}</dd>
                </dl>
                <FieldDescription className="mt-4">
                  {canvasArtifact
                    ? artifactIsStale
                      ? "文本结构已更新，需要重新生成画布才能同步。"
                      : "视觉方案、看图评审和可编辑画布已保存在当前浏览器。"
                    : "当前产物是文本语义结构，下一步可生成视觉方案和可编辑画布。"}
                </FieldDescription>
                {canvasArtifact?.visualReview && !artifactIsStale ? (
                  <div className="mt-4 rounded-md border bg-muted/35 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Qwen 看图评审</Badge>
                      <Badge variant="outline">
                        {canvasArtifact.visualReview.verdict === "approved"
                          ? "初稿通过"
                          : `修订 ${canvasArtifact.visualReview.revisedSlideIds.length} 页`}
                      </Badge>
                      {canvasArtifact.visualReview.themeChanged ? (
                        <Badge variant="outline">主题已调整</Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {canvasArtifact.visualReview.summary}
                    </p>
                  </div>
                ) : null}
                <div className="mt-5 flex flex-col gap-2">
                  {canvasArtifact ? (
                    <Button asChild size="sm">
                      <Link to={`/ai-ppt/${project.id}/editor`}>打开可编辑幻灯片</Link>
                    </Button>
                  ) : null}
                  <Button
                    onClick={() => setCanvasDialogOpen(true)}
                    size="sm"
                    type="button"
                    variant={canvasArtifact ? "outline" : "default"}
                  >
                    <Sparkles data-icon="inline-start" />
                    {canvasArtifact
                      ? artifactIsStale
                        ? "根据最新结构重新生成"
                        : "重新生成视觉方案"
                      : "生成可编辑幻灯片"}
                  </Button>
                </div>
              </div>

              <Separator className="my-7" />

              <div>
                <p className="text-sm text-muted-foreground">叙事结构</p>
                <h2 className="mt-1 text-lg font-semibold">章节结构</h2>
                <div className="mt-5 flex flex-col gap-5">
                  {structure.sections.map((section, index) => (
                    <Field key={section.id}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          第 {String(index + 1).padStart(2, "0")} 章
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {section.slideIds.length} 页
                        </span>
                      </div>
                      <Input
                        aria-label={`章节 ${index + 1} 标题`}
                        onChange={(event) =>
                          updateStructure((current) =>
                            updateSection(current, section.id, { title: event.target.value }),
                          )
                        }
                        value={section.title}
                      />
                      <Textarea
                        aria-label={`章节 ${index + 1} 目标`}
                        className="min-h-16 resize-none text-xs"
                        onChange={(event) =>
                          updateStructure((current) =>
                            updateSection(current, section.id, { objective: event.target.value }),
                          )
                        }
                        value={section.objective}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Dialog onOpenChange={handleCanvasDialogChange} open={canvasDialogOpen}>
        <DialogContent className="w-[560px] p-6">
          <DialogHeader>
            <DialogTitle className="text-base">
              {canvasArtifact ? "重新生成视觉方案和画布" : "生成视觉方案和画布"}
            </DialogTitle>
            <DialogDescription className="mt-2 leading-5">
              百炼先规划视觉方案，本地生成每页预览后再由百炼看图评审，并按评审结果生成最终可编辑画布。
              {canvasArtifact ? "重新生成会覆盖当前已编辑的画布。" : ""}
            </DialogDescription>
          </DialogHeader>

          <form className="mt-6 flex flex-col gap-5" onSubmit={handleGenerateCanvas}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="canvas-api-key">百炼接口密钥</FieldLabel>
                <InputGroup className="h-9">
                  <InputGroupInput
                    autoComplete="off"
                    id="canvas-api-key"
                    name="canvas-bailian-key"
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="sk-..."
                    spellCheck={false}
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                  />
                  <InputGroupAddon align="inline-end">
                    <Button
                      aria-label={showApiKey ? "隐藏接口密钥" : "显示接口密钥"}
                      onClick={() => setShowApiKey((visible) => !visible)}
                      size="icon-xs"
                      type="button"
                      variant="ghost"
                    >
                      {showApiKey ? <EyeOff /> : <Eye />}
                    </Button>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>仅保存在当前页面内存，关闭或刷新后自动清除。</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="visual-preference">
                  视觉偏好
                  <span className="font-normal text-muted-foreground">选填</span>
                </FieldLabel>
                <Textarea
                  className="min-h-24"
                  id="visual-preference"
                  maxLength={500}
                  onChange={(event) => setVisualPreference(event.target.value)}
                  placeholder="例如：适合管理层评审，克制、专业，重点突出数据和行动项。"
                  value={visualPreference}
                />
                <FieldDescription className="text-right tabular-nums">
                  {visualPreference.length} / 500 字
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="visual-assets">
                  图片素材
                  <span className="font-normal text-muted-foreground">选填</span>
                </FieldLabel>
                <Input
                  accept={ACCEPTED_VISUAL_ASSET_TYPES.join(",")}
                  disabled={isGeneratingCanvas || visualAssets.length >= MAX_VISUAL_ASSET_COUNT}
                  id="visual-assets"
                  multiple
                  onChange={(event) => {
                    void handleVisualAssetFiles(event.target.files);
                    event.target.value = "";
                  }}
                  type="file"
                />
                <FieldDescription>
                  最多 {MAX_VISUAL_ASSET_COUNT}{" "}
                  张；模型只会从这些已登记图片中选择主视觉，不会编造图片地址。
                </FieldDescription>
                {visualAssets.length > 0 ? (
                  <div className="grid gap-2">
                    {visualAssets.map((asset) => (
                      <div className="flex items-center gap-2 rounded-lg border p-2" key={asset.id}>
                        <img
                          alt=""
                          className="size-12 shrink-0 rounded-md object-cover"
                          src={asset.src}
                        />
                        <Input
                          aria-label={`${asset.name} 的图片描述`}
                          disabled={isGeneratingCanvas}
                          maxLength={300}
                          onChange={(event) =>
                            setVisualAssets((current) =>
                              current.map((item) =>
                                item.id === asset.id ? { ...item, alt: event.target.value } : item,
                              ),
                            )
                          }
                          placeholder="描述图片主体及适合表达的内容"
                          value={asset.alt}
                        />
                        <Button
                          aria-label={`移除图片 ${asset.name}`}
                          disabled={isGeneratingCanvas}
                          onClick={() =>
                            setVisualAssets((current) =>
                              current.filter((item) => item.id !== asset.id),
                            )
                          }
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {visualAssetError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {visualAssetError}
                  </p>
                ) : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="canvas-api-host">接口地址</FieldLabel>
                <Input
                  id="canvas-api-host"
                  onChange={(event) => setApiHost(event.target.value)}
                  spellCheck={false}
                  value={apiHost}
                />
              </Field>
            </FieldGroup>

            {canvasGeneration.status === "error" ? (
              <p className="text-sm text-destructive" role="alert">
                {canvasGeneration.message}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              {isGeneratingCanvas ? (
                <Button
                  onClick={() => canvasAbortControllerRef.current?.abort()}
                  type="button"
                  variant="outline"
                >
                  <Square data-icon="inline-start" />
                  取消生成
                </Button>
              ) : (
                <Button
                  onClick={() => handleCanvasDialogChange(false)}
                  type="button"
                  variant="outline"
                >
                  取消
                </Button>
              )}
              <Button disabled={isGeneratingCanvas} type="submit">
                {isGeneratingCanvas ? (
                  <LoaderCircle className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Sparkles data-icon="inline-start" />
                )}
                {canvasGeneration.status === "generating"
                  ? CANVAS_GENERATION_LABELS[canvasGeneration.phase]
                  : canvasArtifact
                    ? "重新生成并覆盖"
                    : "生成可编辑幻灯片"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {previewCaptureRequest ? (
        <Suspense fallback={null}>
          <PptVisualReviewCapture
            document={previewCaptureRequest.document}
            slideIds={previewCaptureRequest.slideIds}
            onCaptured={handlePreviewsCaptured}
            onError={handlePreviewCaptureError}
          />
        </Suspense>
      ) : null}
    </>
  );
}

export function AiPptOutlinePage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <OutlineEditor key={projectId} projectId={projectId ?? ""} />;
}
