import { AppBackLink } from "@/components/AppBackLink";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { JsonCanvasEditor } from "@/editor/JsonCanvasEditor";
import {
  getPptCanvasArtifact,
  isPptCanvasArtifactStale,
  savePptCanvasArtifact,
  updatePptCanvasArtifactDocument,
  type PptCanvasArtifactV1,
} from "@/features/ai-ppt/canvas-storage";
import { getPptProject } from "@/features/ai-ppt/storage";
import { Check, CircleAlert } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

type CanvasSaveState = "saved" | "error";

function MissingCanvas({ projectId }: { projectId: string }) {
  return (
    <main className="grid h-dvh min-w-[960px] place-items-center bg-background p-10">
      <Empty className="max-w-lg border">
        <EmptyHeader>
          <EmptyMedia>
            <CircleAlert />
          </EmptyMedia>
          <EmptyTitle>没有找到可编辑画布</EmptyTitle>
          <EmptyDescription>请先返回文本大纲，生成这份演示的视觉方案和画布。</EmptyDescription>
        </EmptyHeader>
        <AppBackLink to={`/ai-ppt/${projectId}`} variant="outline">
          返回文本大纲
        </AppBackLink>
      </Empty>
    </main>
  );
}

function CanvasEditorPage({ projectId }: { projectId: string }) {
  const project = getPptProject(projectId);
  const [artifact, setArtifact] = useState<PptCanvasArtifactV1 | null>(() =>
    getPptCanvasArtifact(projectId),
  );
  const [saveState, setSaveState] = useState<CanvasSaveState>("saved");

  if (!project || !artifact) return <MissingCanvas projectId={projectId} />;

  const stale = isPptCanvasArtifactStale(artifact, project.updatedAt);

  return (
    <main className="flex h-dvh min-w-[1180px] flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <AppBackLink iconOnly to={`/ai-ppt/${projectId}`}>
            返回文本大纲
          </AppBackLink>
          <span className="min-w-0 truncate text-sm font-medium">{artifact.document.name}</span>
          {stale ? <Badge variant="secondary">文本结构已更新</Badge> : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs leading-none text-muted-foreground">
          {saveState === "saved" ? (
            <>
              <Check aria-hidden="true" className="size-3.5" />
              已保存到本地
            </>
          ) : (
            <>
              <CircleAlert aria-hidden="true" className="size-3.5" />
              保存失败
            </>
          )}
        </span>
      </header>
      <div className="min-h-0 flex-1">
        <JsonCanvasEditor
          initialDocumentId={artifact.document.id}
          onChange={(documents) => {
            const document = documents[0];
            if (!document) return;
            const nextArtifact = updatePptCanvasArtifactDocument(artifact, document);
            setArtifact(nextArtifact);
            setSaveState(savePptCanvasArtifact(nextArtifact) ? "saved" : "error");
          }}
          value={[artifact.document]}
        />
      </div>
    </main>
  );
}

export function AiPptCanvasPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <CanvasEditorPage key={projectId} projectId={projectId ?? ""} />;
}
