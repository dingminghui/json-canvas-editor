import { AppBackLink } from "@/components/AppBackLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeContentMaterial,
  generateContentDocument,
  type ContentGenerationPhase,
} from "@/features/content-studio/ai";
import { createContentProject } from "@/features/content-studio/model";
import {
  ContentProjectInputSchema,
  type ContentProjectInput,
  type MaterialPlanV1,
} from "@/features/content-studio/schema";
import { saveContentProject } from "@/features/content-studio/storage";
import {
  DEFAULT_BAILIAN_API_HOST,
  type PptTokenUsageV1,
} from "@/features/ai-ppt/schema";
import { mergePptTokenUsage } from "@/features/ai-ppt/token-usage";
import { Eye, EyeOff, LoaderCircle, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

interface FormState {
  apiKey: string;
  apiHost: string;
  topic: string;
  audience: string;
  objective: string;
  sourceMarkdown: string;
  sourceTreatment: string;
  tone: string;
  language: "zh-CN" | "en-US";
}

const INITIAL_FORM: FormState = {
  apiKey: "",
  apiHost: DEFAULT_BAILIAN_API_HOST,
  topic: "",
  audience: "",
  objective: "",
  sourceMarkdown: "",
  sourceTreatment: "忠于材料事实，删除重复信息，保留关键数据和限定条件。",
  tone: "专业、清晰、有编辑感",
  language: "zh-CN",
};

interface MaterialDraft {
  plan: MaterialPlanV1;
  usage: PptTokenUsageV1;
}

const splitList = (value: string) =>
  value
    .split(/\n|，|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const buildInput = (form: FormState): ContentProjectInput =>
  ContentProjectInputSchema.parse({
    topic: form.topic,
    audience: form.audience,
    objective: form.objective,
    sourceMarkdown: form.sourceMarkdown,
    sourceTreatment: form.sourceTreatment,
    tone: form.tone || undefined,
    mustInclude: splitList(""),
    exclude: splitList(""),
    language: form.language,
  });

export function CreateContentProjectPage() {
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [showKey, setShowKey] = useState(false);
  const [draft, setDraft] = useState<MaterialDraft | null>(null);
  const [phase, setPhase] = useState<ContentGenerationPhase | "analyzing" | null>(null);
  const [error, setError] = useState("");

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key !== "apiKey" && key !== "apiHost") setDraft(null);
  };

  const run = async () => {
    setError("");
    if (!form.apiKey.trim()) {
      setError("请输入百炼 API Key。Key 只保留在当前页面内存中。");
      return;
    }
    let input: ContentProjectInput;
    try {
      input = buildInput(form);
    } catch {
      setError("请完整填写主题、受众、目标和已有材料。");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (!draft) {
        setPhase("analyzing");
        const result = await analyzeContentMaterial(input, {
          apiKey: form.apiKey.trim(),
          apiHost: form.apiHost,
          signal: controller.signal,
          onPhaseChange: setPhase,
        });
        setDraft({ plan: result.data, usage: result.usage });
        setPhase(null);
        return;
      }
      setPhase("generating");
      const result = await generateContentDocument(input, draft.plan, {
        apiKey: form.apiKey.trim(),
        apiHost: form.apiHost,
        signal: controller.signal,
        onPhaseChange: setPhase,
      });
      const project = createContentProject(
        input,
        draft.plan,
        result.data,
        mergePptTokenUsage(draft.usage, result.usage),
      );
      await saveContentProject(project);
      navigate(`/studio/${project.id}/content`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成失败，请重试。");
      setPhase(null);
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <main className="h-dvh min-w-[1120px] overflow-y-auto bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-8">
          <AppBackLink iconOnly to="/">返回工作台</AppBackLink>
          <span className="text-sm font-medium">创建通用内容项目</span>
          <Badge className="ml-auto" variant="outline">阶段 1 / 5 · 材料与内容</Badge>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)_380px] gap-12 px-8 py-12">
        <section>
          <p className="text-sm font-medium text-primary">ContentDocument</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">先把事实整理成可迁移的内容。</h1>
          <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
            这里不决定最终做 PPT 还是长图。AI 先提取材料事实，再生成带稳定块 ID 的通用内容文档。
          </p>
          <div className="mt-10 grid grid-cols-2 gap-5">
            <label className="space-y-2" htmlFor="content-topic">
              <span className="text-sm font-medium">主题</span>
              <Input id="content-topic" value={form.topic} onChange={(event) => update("topic", event.target.value)} />
            </label>
            <label className="space-y-2" htmlFor="content-audience">
              <span className="text-sm font-medium">目标受众</span>
              <Input id="content-audience" value={form.audience} onChange={(event) => update("audience", event.target.value)} />
            </label>
          </div>
          <label className="mt-5 block space-y-2" htmlFor="content-objective">
            <span className="text-sm font-medium">沟通目标</span>
            <Textarea id="content-objective" className="min-h-24" value={form.objective} onChange={(event) => update("objective", event.target.value)} />
          </label>
          <label className="mt-5 block space-y-2" htmlFor="content-source">
            <span className="text-sm font-medium">已有材料（Markdown / 纯文本）</span>
            <Textarea id="content-source" className="min-h-72 font-mono text-xs leading-6" value={form.sourceMarkdown} onChange={(event) => update("sourceMarkdown", event.target.value)} />
          </label>
          <div className="mt-5 grid grid-cols-2 gap-5">
            <label className="space-y-2" htmlFor="content-treatment">
              <span className="text-sm font-medium">材料处理要求</span>
              <Textarea id="content-treatment" value={form.sourceTreatment} onChange={(event) => update("sourceTreatment", event.target.value)} />
            </label>
            <label className="space-y-2" htmlFor="content-tone">
              <span className="text-sm font-medium">表达语气</span>
              <Textarea id="content-tone" value={form.tone} onChange={(event) => update("tone", event.target.value)} />
            </label>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-medium">当前页面凭据</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Key 不写入 IndexedDB、localStorage 或项目数据。</p>
            <div className="mt-4 flex gap-2">
              <Input
                autoComplete="off"
                placeholder="sk-..."
                type={showKey ? "text" : "password"}
                value={form.apiKey}
                onChange={(event) => update("apiKey", event.target.value)}
              />
              <Button size="icon" variant="outline" onClick={() => setShowKey((value) => !value)}>
                {showKey ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            <Input className="mt-3" value={form.apiHost} onChange={(event) => update("apiHost", event.target.value)} />
          </div>

          {draft ? (
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">材料方向待确认</h2>
                <Badge>{draft.plan.facts.length} 条事实</Badge>
              </div>
              <h3 className="mt-4 text-xl font-semibold">{draft.plan.direction.title}</h3>
              <p className="mt-2 text-sm leading-6">{draft.plan.direction.coreMessage}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{draft.plan.direction.rationale}</p>
              <div className="mt-4 space-y-2">
                {draft.plan.direction.sections.map((section) => (
                  <div className="rounded-lg bg-muted/60 p-3 text-sm" key={section.id}>
                    <span className="font-mono text-xs text-muted-foreground">{section.id}</span>
                    <span className="ml-2 font-medium">{section.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" disabled={phase !== null} size="lg" onClick={() => void run()}>
            {phase ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            {phase === "repairing"
              ? "正在校验修复"
              : phase
                ? "正在生成"
                : draft
                  ? "确认方向并生成 ContentDocument"
                  : "分析材料"}
          </Button>
        </aside>
      </div>
    </main>
  );
}
