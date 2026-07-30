import { AppBackLink } from "@/components/AppBackLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { JsonCanvasEditor } from "@/editor/JsonCanvasEditor";
import type { ContentProjectV1 } from "@/features/content-studio/schema";
import {
  getContentArtifact,
  getContentProject,
  markContentArtifactEdited,
  type ContentArtifactRecord,
} from "@/features/content-studio/storage";
import { Check, CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

export function ContentEditorPage() {
  const { projectId = "" } = useParams();
  const [project, setProject] = useState<ContentProjectV1 | null>(null);
  const [artifact, setArtifact] = useState<ContentArtifactRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");

  useEffect(() => {
    void Promise.all([getContentProject(projectId), getContentArtifact(projectId)]).then(
      ([loadedProject, loadedArtifact]) => {
        setProject(loadedProject);
        setArtifact(loadedArtifact);
        setLoaded(true);
      },
    );
  }, [projectId]);

  if (!loaded) return <main className="grid h-dvh place-items-center text-sm text-muted-foreground">正在读取 Canvas…</main>;
  if (!project || !artifact) {
    return (
      <main className="grid h-dvh min-w-[960px] place-items-center bg-background p-10">
        <Empty className="max-w-lg border">
          <EmptyHeader>
            <EmptyMedia><CircleAlert /></EmptyMedia>
            <EmptyTitle>没有找到可编辑画布</EmptyTitle>
            <EmptyDescription>请先完成 StylePack、素材与 LayoutRecipe 视觉准备。</EmptyDescription>
          </EmptyHeader>
          <Button asChild variant="outline"><Link to={`/studio/${projectId}/visual`}>返回视觉准备</Link></Button>
        </Empty>
      </main>
    );
  }

  const stale = artifact.stale || artifact.contentRevision !== project.contentRevision;

  return (
    <main className="flex h-dvh min-w-[1180px] flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b px-4">
        <AppBackLink iconOnly to={`/studio/${project.id}/visual`}>返回视觉准备</AppBackLink>
        <span className="truncate text-sm font-medium">{artifact.document.name}</span>
        <Badge>{artifact.outputType === "pptx" ? "PPT" : "长图"}</Badge>
        {stale ? <Badge variant="destructive">内容已更新 · 画布过期</Badge> : null}
        {artifact.manuallyEdited ? <Badge variant="secondary">已手工编辑 · 禁止自动覆盖</Badge> : null}
        {artifact.visualReview ? <Badge variant="outline">视觉评审：{artifact.visualReview.verdict}</Badge> : null}
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {saveState === "error" ? <CircleAlert className="size-3.5" /> : <Check className="size-3.5" />}
          {saveState === "saving" ? "保存中" : saveState === "saved" ? "已保存到 IndexedDB" : "保存失败"}
        </span>
      </header>
      {stale ? (
        <div className="flex items-center justify-between border-b border-amber-300/50 bg-amber-50 px-5 py-2 text-sm text-amber-950">
          <span>旧 Canvas 已保留。只有回到视觉准备并显式重新生成才会创建新版本。</span>
          <Button asChild size="sm" variant="outline"><Link to={`/studio/${project.id}/visual`}>返回重新生成</Link></Button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <JsonCanvasEditor
          initialDocumentId={artifact.document.id}
          value={[artifact.document]}
          onChange={(documents) => {
            const document = documents[0];
            if (!document) return;
            const next = {
              ...artifact,
              document,
              manuallyEdited: true,
              updatedAt: new Date().toISOString(),
            };
            setArtifact(next);
            setSaveState("saving");
            void markContentArtifactEdited(project.id, document)
              .then(() => setSaveState("saved"))
              .catch(() => setSaveState("error"));
          }}
        />
      </div>
    </main>
  );
}
