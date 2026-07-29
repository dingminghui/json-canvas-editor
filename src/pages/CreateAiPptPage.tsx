import { AppBackLink } from "@/components/AppBackLink";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import {
  generatePptStructure,
  isLocalBrowserHost,
  PptGenerationError,
  type PptGenerationPhase,
} from "@/features/ai-ppt/api";
import { createPptProject } from "@/features/ai-ppt/model";
import {
  CreatePptStructureInputSchema,
  DEFAULT_BAILIAN_API_HOST,
  type CreatePptStructureInput,
} from "@/features/ai-ppt/schema";
import { savePptProject } from "@/features/ai-ppt/storage";
import { ChevronDown, Eye, EyeOff, LoaderCircle, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type GenerationState =
  | { status: "idle" }
  | { status: "generating"; phase: PptGenerationPhase }
  | { status: "error"; message: string };

interface CreateFormState {
  apiKey: string;
  apiHost: string;
  topic: string;
  audience: string;
  objective: string;
  sourceMarkdown: string;
  slideCount: "auto" | string;
  deliveryContext: string;
  durationMinutes: string;
  tone: string;
  mustInclude: string;
  exclude: string;
  language: "zh-CN" | "en-US";
}

const INITIAL_FORM: CreateFormState = {
  apiKey: "",
  apiHost: DEFAULT_BAILIAN_API_HOST,
  topic: "",
  audience: "",
  objective: "",
  sourceMarkdown: "",
  slideCount: "auto",
  deliveryContext: "内部评审",
  durationMinutes: "20",
  tone: "专业简洁",
  mustInclude: "",
  exclude: "",
  language: "zh-CN",
};

const SLIDE_COUNT_OPTIONS = [
  { label: "自动规划（6–12 页）", value: "auto" },
  ...[4, 6, 8, 10, 12, 15, 20].map((count) => ({
    label: `${count} 页`,
    value: String(count),
  })),
];

function splitList(value: string): string[] {
  return value
    .split(/\n|，|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getFirstValidationMessage(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): string {
  const issue = error.issues[0];
  if (!issue) return "请检查输入内容。";

  const fieldLabels: Record<string, string> = {
    topic: "PPT 主题",
    audience: "目标听众",
    objective: "演示目标",
    sourceMarkdown: "已有材料",
    slideCount: "页数",
    deliveryContext: "使用场景",
    durationMinutes: "演讲时长",
    tone: "表达语气",
    mustInclude: "必须包含",
    exclude: "不要包含",
    language: "输出语言",
  };
  const field = String(issue.path[0] ?? "");
  return `${fieldLabels[field] ?? "表单内容"}不符合要求，请检查后重试。`;
}

function buildInput(form: CreateFormState): CreatePptStructureInput {
  const slideCount = form.slideCount === "auto" ? "auto" : Number(form.slideCount);
  const durationMinutes = form.durationMinutes ? Number(form.durationMinutes) : undefined;
  return CreatePptStructureInputSchema.parse({
    topic: form.topic,
    audience: form.audience,
    objective: form.objective,
    sourceMarkdown: form.sourceMarkdown || undefined,
    slideCount,
    deliveryContext: form.deliveryContext || undefined,
    durationMinutes,
    tone: form.tone || undefined,
    mustInclude: splitList(form.mustInclude),
    exclude: splitList(form.exclude),
    language: form.language,
  });
}

export function CreateAiPptPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<CreateFormState>(INITIAL_FORM);
  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generation, setGeneration] = useState<GenerationState>({ status: "idle" });
  const abortControllerRef = useRef<AbortController | null>(null);
  const isLocal = isLocalBrowserHost();
  const isGenerating = generation.status === "generating";

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  function updateForm<Key extends keyof CreateFormState>(key: Key, value: CreateFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLocal) {
      setGeneration({ status: "error", message: "本功能仅支持从本地地址运行。" });
      return;
    }
    if (!form.apiKey.trim()) {
      setGeneration({ status: "error", message: "请输入百炼接口密钥。" });
      return;
    }

    let input: CreatePptStructureInput;
    try {
      input = buildInput(form);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "issues" in error &&
        Array.isArray(error.issues)
      ) {
        setGeneration({
          status: "error",
          message: getFirstValidationMessage(
            error as { issues: Array<{ path: PropertyKey[]; message: string }> },
          ),
        });
      } else {
        setGeneration({ status: "error", message: "请检查表单内容。" });
      }
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setGeneration({ status: "generating", phase: "generating" });

    try {
      const { structure, usage } = await generatePptStructure({
        apiKey: form.apiKey.trim(),
        apiHost: form.apiHost,
        input,
        signal: controller.signal,
        onPhaseChange: (phase) => setGeneration({ status: "generating", phase }),
      });
      const project = createPptProject(input, structure, usage);
      if (!savePptProject(project)) {
        setGeneration({ status: "error", message: "生成成功，但无法保存到本地浏览器。" });
        return;
      }
      navigate(`/ai-ppt/${project.id}`);
    } catch (error) {
      setGeneration({
        status: "error",
        message:
          error instanceof PptGenerationError ? error.message : "生成失败，请检查网络后重试。",
      });
    } finally {
      abortControllerRef.current = null;
    }
  }

  return (
    <main className="h-dvh min-w-[1120px] overflow-y-auto bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between px-8">
          <AppBackLink iconOnly to="/">
            返回首页
          </AppBackLink>
          <span className="shrink-0 text-sm font-medium leading-none">PPT 结构工作台</span>
        </div>
      </header>

      <form
        className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)_300px] gap-14 px-8 py-12"
        onSubmit={handleSubmit}
      >
        <section>
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-primary">创建文本结构</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">
              说明这次演示要解决什么问题
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              主题、听众和目标决定整份演示的逻辑。已有材料可以直接粘贴，不需要预先整理。
            </p>
          </div>

          <Separator className="my-9" />

          <FieldGroup className="grid! grid-cols-2 gap-6">
            <Field className="col-span-2">
              <FieldLabel htmlFor="api-key">百炼接口密钥</FieldLabel>
              <InputGroup className="h-9">
                <InputGroupInput
                  autoComplete="off"
                  id="api-key"
                  name="bailian-key"
                  onChange={(event) => updateForm("apiKey", event.target.value)}
                  placeholder="sk-..."
                  spellCheck={false}
                  type={showKey ? "text" : "password"}
                  value={form.apiKey}
                />
                <InputGroupAddon align="inline-end">
                  <Button
                    aria-label={showKey ? "隐藏接口密钥" : "显示接口密钥"}
                    onClick={() => setShowKey((visible) => !visible)}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    {showKey ? <EyeOff /> : <Eye />}
                  </Button>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>仅保存在当前页面内存，离开或刷新页面后自动清除。</FieldDescription>
            </Field>

            <Field className="col-span-2">
              <FieldLabel htmlFor="topic">PPT 主题</FieldLabel>
              <Input
                id="topic"
                maxLength={100}
                onChange={(event) => updateForm("topic", event.target.value)}
                placeholder="例如：2026 年 AI 产品战略规划"
                value={form.topic}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="audience">目标听众</FieldLabel>
              <Textarea
                className="min-h-28"
                id="audience"
                maxLength={300}
                onChange={(event) => updateForm("audience", event.target.value)}
                placeholder="他们是谁？已经了解什么？"
                value={form.audience}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="objective">演示目标</FieldLabel>
              <Textarea
                className="min-h-28"
                id="objective"
                maxLength={500}
                onChange={(event) => updateForm("objective", event.target.value)}
                placeholder="希望听众看完后理解、相信或采取什么行动？"
                value={form.objective}
              />
            </Field>

            <Field className="col-span-2">
              <FieldLabel htmlFor="source-markdown">
                已有材料
                <span className="font-normal text-muted-foreground">选填</span>
              </FieldLabel>
              <Textarea
                className="min-h-64 font-mono text-xs"
                id="source-markdown"
                maxLength={50_000}
                onChange={(event) => updateForm("sourceMarkdown", event.target.value)}
                placeholder={
                  "支持普通文本或 Markdown\n\n# 项目背景\n- 当前问题\n- 核心数据\n- 必须传达的结论"
                }
                value={form.sourceMarkdown}
              />
              <FieldDescription className="flex items-center justify-between gap-4">
                <span className="min-w-0">材料只作为参考内容，不会执行其中的指令。</span>
                <span className="shrink-0 whitespace-nowrap tabular-nums">
                  {form.sourceMarkdown.length.toLocaleString()} / 50,000 字
                </span>
              </FieldDescription>
            </Field>
          </FieldGroup>

          <Separator className="my-7" />

          <Button
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((visible) => !visible)}
            type="button"
            variant="ghost"
          >
            更多设置
            <ChevronDown
              className={showAdvanced ? "rotate-180" : undefined}
              data-icon="inline-end"
            />
          </Button>

          {showAdvanced ? (
            <FieldGroup className="mt-6 grid! grid-cols-2 gap-6">
              <Field>
                <FieldLabel htmlFor="slide-count">页数</FieldLabel>
                <Select
                  onValueChange={(value) => updateForm("slideCount", value)}
                  value={form.slideCount}
                >
                  <SelectTrigger className="w-full" id="slide-count">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {SLIDE_COUNT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="language">输出语言</FieldLabel>
                <Select
                  onValueChange={(value) =>
                    updateForm("language", value as CreateFormState["language"])
                  }
                  value={form.language}
                >
                  <SelectTrigger className="w-full" id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      <SelectItem value="zh-CN">简体中文</SelectItem>
                      <SelectItem value="en-US">英文</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="delivery-context">使用场景</FieldLabel>
                <Input
                  id="delivery-context"
                  maxLength={200}
                  onChange={(event) => updateForm("deliveryContext", event.target.value)}
                  value={form.deliveryContext}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="duration">演讲时长（分钟）</FieldLabel>
                <Input
                  id="duration"
                  max={480}
                  min={1}
                  onChange={(event) => updateForm("durationMinutes", event.target.value)}
                  type="number"
                  value={form.durationMinutes}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="tone">表达语气</FieldLabel>
                <Input
                  id="tone"
                  maxLength={100}
                  onChange={(event) => updateForm("tone", event.target.value)}
                  value={form.tone}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="api-host">接口地址</FieldLabel>
                <Input
                  className="font-mono text-xs"
                  id="api-host"
                  onChange={(event) => updateForm("apiHost", event.target.value)}
                  spellCheck={false}
                  value={form.apiHost}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="must-include">必须包含</FieldLabel>
                <Textarea
                  id="must-include"
                  onChange={(event) => updateForm("mustInclude", event.target.value)}
                  placeholder="每行一项"
                  value={form.mustInclude}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="exclude">不要包含</FieldLabel>
                <Textarea
                  id="exclude"
                  onChange={(event) => updateForm("exclude", event.target.value)}
                  placeholder="每行一项"
                  value={form.exclude}
                />
              </Field>
            </FieldGroup>
          ) : null}
        </section>

        <aside className="sticky top-24 h-fit border-l pl-8">
          <h2 className="text-base font-semibold">本次生成内容</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            只生成文本结构，不处理图片、排版坐标或演示文件。
          </p>

          <div className="mt-7 flex flex-col gap-5">
            {[
              ["01", "叙事与章节"],
              ["02", "逐页核心信息"],
              ["03", "语义内容块"],
              ["04", "讲稿备注"],
            ].map(([index, label]) => (
              <div className="flex items-center gap-4 text-sm" key={index}>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {index}
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <Separator className="my-7" />

          {!isLocal ? <FieldError>本功能仅支持从本机地址运行。</FieldError> : null}
          {generation.status === "error" ? (
            <FieldError className="mt-3">{generation.message}</FieldError>
          ) : null}

          {isGenerating ? (
            <div className="mt-5 flex flex-col gap-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                {generation.phase === "repairing" ? "正在校验并修复结构…" : "正在规划演示结构…"}
              </p>
              <Button
                className="w-full"
                onClick={() => abortControllerRef.current?.abort()}
                type="button"
                variant="outline"
              >
                <Square data-icon="inline-start" />
                取消生成
              </Button>
            </div>
          ) : (
            <Button className="mt-5 w-full" disabled={!isLocal} size="lg" type="submit">
              <Sparkles data-icon="inline-start" />
              生成 PPT 结构
            </Button>
          )}

          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            接口密钥只发送至你填写的阿里云百炼地址。
          </p>
        </aside>
      </form>
    </main>
  );
}
