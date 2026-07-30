import { AppBackLink } from "@/components/AppBackLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseContentMarkdown, type MarkdownIssue } from "@/features/content-studio/markdown";
import { applyConfirmedContent, selectProjectOutput } from "@/features/content-studio/model";
import type { ContentProjectV1, OutputType } from "@/features/content-studio/schema";
import {
  getContentProject,
  getContentArtifact,
  saveContentProject,
  saveContentProjectAndMarkArtifactStale,
} from "@/features/content-studio/storage";
import { Check, CircleAlert, FileText, Image, Presentation } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export function ContentMarkdownPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ContentProjectV1 | null>(null);
  const [source, setSource] = useState("");
  const [issues, setIssues] = useState<MarkdownIssue[]>([]);
  const [applied, setApplied] = useState(false);
  const [hasCanvas, setHasCanvas] = useState(false);

  useEffect(() => {
    void Promise.all([getContentProject(projectId), getContentArtifact(projectId)]).then(
      ([value, artifact]) => {
        setProject(value);
        setSource(value?.contentMarkdown ?? "");
        setApplied(Boolean(value?.contentConfirmedAt));
        setHasCanvas(Boolean(artifact));
      },
    );
  }, [projectId]);

  const preview = useMemo(
    () => (project ? parseContentMarkdown(source, project.materialPlan) : null),
    [project, source],
  );

  const validateAndApply = async () => {
    if (!project) return;
    const result = parseContentMarkdown(source, project.materialPlan);
    if (!result.success) {
      setIssues(result.issues);
      setApplied(false);
      return;
    }
    const next = applyConfirmedContent(project, result.document, result.markdown);
    await saveContentProjectAndMarkArtifactStale(next);
    setProject(next);
    setSource(result.markdown);
    setIssues([]);
    setApplied(true);
  };

  const chooseOutput = async (outputType: OutputType) => {
    if (!project || !applied) return;
    if (hasCanvas && project.outputType !== outputType) return;
    const next = selectProjectOutput(project, outputType);
    await saveContentProject(next);
    navigate(`/studio/${project.id}/structure`);
  };

  if (!project) return <main className="grid h-dvh place-items-center text-sm text-muted-foreground">正在读取项目…</main>;

  return (
    <main className="flex h-dvh min-w-[1180px] flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b px-6">
        <AppBackLink iconOnly to="/">返回工作台</AppBackLink>
        <span className="truncate text-sm font-medium">{project.contentDocument.title}</span>
        <Badge className="ml-auto" variant="outline">阶段 2 / 5 · Markdown 确认</Badge>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1fr]">
        <section className="flex min-h-0 flex-col border-r">
          <div className="flex h-12 items-center justify-between border-b px-5">
            <div className="flex items-center gap-2 text-sm font-medium"><FileText className="size-4" />规范 Markdown</div>
            <span className="text-xs text-muted-foreground">JSON 应用成功后仍是唯一事实源</span>
          </div>
          <Textarea
            className="min-h-0 flex-1 resize-none rounded-none border-0 p-5 font-mono text-xs leading-6 focus-visible:ring-0"
            spellCheck={false}
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              setApplied(false);
            }}
          />
        </section>
        <section className="min-h-0 overflow-y-auto p-7">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-sm font-medium text-primary">结构预览</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {preview?.success ? preview.document.title : project.contentDocument.title}
              </h1>
            </div>
            <Button onClick={() => void validateAndApply()}>
              <Check />校验并应用
            </Button>
          </div>
          {(issues.length > 0 || (preview && !preview.success)) ? (
            <div className="mt-6 rounded-xl border border-destructive/25 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 font-medium text-destructive"><CircleAlert className="size-4" />校验错误</div>
              <ul className="mt-3 space-y-2 text-sm text-destructive">
                {(issues.length > 0 ? issues : preview && !preview.success ? preview.issues : []).map((issue, index) => (
                  <li key={`${issue.line}-${index}`}>第 {issue.line} 行：{issue.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {preview?.success ? (
            <div className="mt-7 space-y-8">
              {preview.document.sections.map((section) => (
                <article key={section.id}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{section.id}</span>
                    <h2 className="text-xl font-semibold">{section.title}</h2>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{section.objective}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {section.blocks.map((block) => (
                      <div className="rounded-lg border bg-card p-3" key={block.id}>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs">{block.id}</span>
                          <Badge variant="secondary">{block.type}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{block.evidenceRefs.join(" · ") || "无证据引用"}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          <div className="mt-10 border-t pt-7">
            <h2 className="text-lg font-semibold">选择这个项目的唯一产物</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasCanvas ? `产物已锁定为 ${project.outputType === "pptx" ? "PPT" : "长图"}；另一载体请从工作台复制项目。` : "生成画布后类型锁定；另一载体请从工作台复制项目。"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Button className="h-24 justify-start px-5" disabled={!applied || (hasCanvas && project.outputType !== "pptx")} variant="outline" onClick={() => void chooseOutput("pptx")}>
                <Presentation className="size-6" />
                <span className="text-left"><span className="block font-medium">PPT 演示</span><span className="mt-1 block text-xs text-muted-foreground">1600×900 · 4–20 页</span></span>
              </Button>
              <Button className="h-24 justify-start px-5" disabled={!applied || (hasCanvas && project.outputType !== "longform")} variant="outline" onClick={() => void chooseOutput("longform")}>
                <Image className="size-6" />
                <span className="text-left"><span className="block font-medium">纵向长图</span><span className="mt-1 block text-xs text-muted-foreground">1080px · 自动高度</span></span>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
