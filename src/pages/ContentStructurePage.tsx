import { AppBackLink } from "@/components/AppBackLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateOutputStructure, type ContentGenerationPhase } from "@/features/content-studio/ai";
import type { ContentProjectV1 } from "@/features/content-studio/schema";
import {
  getContentArtifact,
  getContentProject,
  saveContentProjectAndMarkArtifactStale,
  type ContentArtifactRecord,
} from "@/features/content-studio/storage";
import { DEFAULT_BAILIAN_API_HOST } from "@/features/ai-ppt/schema";
import { Eye, EyeOff, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export function ContentStructurePage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ContentProjectV1 | null>(null);
  const [artifact, setArtifact] = useState<ContentArtifactRecord | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiHost, setApiHost] = useState<string>(DEFAULT_BAILIAN_API_HOST);
  const [showKey, setShowKey] = useState(false);
  const [phase, setPhase] = useState<ContentGenerationPhase | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([getContentProject(projectId), getContentArtifact(projectId)]).then(
      ([loadedProject, loadedArtifact]) => {
        setProject(loadedProject);
        setArtifact(loadedArtifact);
      },
    );
  }, [projectId]);

  const generate = async () => {
    if (!project?.outputType) return;
    if (
      artifact &&
      !globalThis.confirm(
        artifact.manuallyEdited
          ? "当前 Canvas 已手工编辑。重新规划结构会把它标记为过期，但不会立刻删除。确认继续？"
          : "重新规划结构会把当前 Canvas 标记为过期。确认继续？",
      )
    ) {
      return;
    }
    if (!apiKey.trim()) {
      setError("请输入当前页面使用的百炼 API Key。");
      return;
    }
    setError("");
    try {
      const result = await generateOutputStructure(project.outputType, project.contentDocument, {
        apiKey: apiKey.trim(),
        apiHost,
        onPhaseChange: setPhase,
      });
      const next: ContentProjectV1 = {
        ...project,
        outputStructure: result.data,
        updatedAt: new Date().toISOString(),
      };
      await saveContentProjectAndMarkArtifactStale(next);
      setProject(next);
      setArtifact((current) =>
        current ? { ...current, stale: true, updatedAt: new Date().toISOString() } : null,
      );
      setPhase(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "输出结构生成失败。");
      setPhase(null);
    }
  };

  if (!project) return <main className="grid h-dvh place-items-center text-sm text-muted-foreground">正在读取项目…</main>;
  if (!project.outputType) {
    return (
      <main className="grid h-dvh place-items-center">
        <div className="text-center">
          <p>请先确认 Markdown 并选择产物类型。</p>
          <AppBackLink className="mt-4" to={`/studio/${project.id}/content`}>返回内容确认</AppBackLink>
        </div>
      </main>
    );
  }
  const nodes = project.outputStructure
    ? project.outputStructure.outputType === "pptx"
      ? project.outputStructure.pages
      : project.outputStructure.regions
    : [];

  return (
    <main className="h-dvh min-w-[1120px] overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 px-6 backdrop-blur">
        <AppBackLink iconOnly to={`/studio/${project.id}/content`}>返回内容确认</AppBackLink>
        <span className="text-sm font-medium">{project.contentDocument.title}</span>
        <Badge>{project.outputType === "pptx" ? "PPT" : "长图"}</Badge>
        <Badge className="ml-auto" variant="outline">阶段 3 / 5 · 输出结构</Badge>
      </header>
      <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)_360px] gap-10 px-8 py-10">
        <section>
          <p className="text-sm font-medium text-primary">OutputStructure</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">只编排信息，不改写事实。</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            每个 ContentDocument 内容块会被恰好引用一次。PPT 强调逐页推进，长图强调纵向阅读节奏。
          </p>
          {nodes.length > 0 ? (
            <div className="mt-8 space-y-3">
              {nodes.map((node, index) => (
                <article className="grid grid-cols-[80px_1fr_auto] gap-4 rounded-xl border bg-card p-5" key={node.id}>
                  <div>
                    <span className="font-mono text-sm font-semibold">{node.id}</span>
                    <Badge className="mt-2 block w-fit" variant="secondary">{node.role}</Badge>
                  </div>
                  <div>
                    <h2 className="font-semibold">{node.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{node.coreMessage}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{node.blockIds.length} 个块</div>
                    <div className="mt-2 font-mono">{node.blockIds.join(" · ")}</div>
                    <div className="mt-3">#{String(index + 1).padStart(2, "0")}</div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
              尚未生成输出结构。
            </div>
          )}
        </section>
        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-medium">当前页面凭据</h2>
            <div className="mt-4 flex gap-2">
              <Input autoComplete="off" placeholder="百炼 API Key" type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
              <Button size="icon" variant="outline" onClick={() => setShowKey((value) => !value)}>{showKey ? <EyeOff /> : <Eye />}</Button>
            </div>
            <Input className="mt-3" value={apiHost} onChange={(event) => setApiHost(event.target.value)} />
          </div>
          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" disabled={phase !== null} size="lg" onClick={() => void generate()}>
            {phase ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            {project.outputStructure ? "重新生成结构" : "生成输出结构"}
          </Button>
          <Button className="w-full" disabled={!project.outputStructure} size="lg" variant="outline" onClick={() => navigate(`/studio/${project.id}/visual`)}>
            进入视觉准备
          </Button>
        </aside>
      </div>
    </main>
  );
}
