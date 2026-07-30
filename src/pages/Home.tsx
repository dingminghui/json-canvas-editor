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
import type { ContentProjectV1, OutputType } from "@/features/content-studio/schema";
import {
  deleteContentProject,
  duplicateContentProjectForOutput,
  listContentProjects,
} from "@/features/content-studio/storage";
import { Clock3, Copy, FileJson2, Image, Plus, Presentation, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const formatUpdatedAt = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const getProjectPath = (project: ContentProjectV1) => {
  if (!project.contentConfirmedAt) return `/studio/${project.id}/content`;
  if (!project.outputStructure) return `/studio/${project.id}/structure`;
  return `/studio/${project.id}/visual`;
};

export function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ContentProjectV1[]>([]);
  const [pendingDelete, setPendingDelete] = useState<ContentProjectV1 | null>(null);

  useEffect(() => {
    void listContentProjects().then(setProjects);
  }, []);

  const remove = async () => {
    if (!pendingDelete) return;
    await deleteContentProject(pendingDelete.id);
    setProjects((current) => current.filter((project) => project.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  const duplicate = async (project: ContentProjectV1) => {
    const outputType: OutputType = project.outputType === "longform" ? "pptx" : "longform";
    const copy = await duplicateContentProjectForOutput(project, outputType);
    setProjects((current) => [copy, ...current]);
    navigate(`/studio/${copy.id}/structure`);
  };

  return (
    <main className="h-dvh min-w-[1120px] overflow-y-auto bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between px-8">
          <Link className="font-medium tracking-tight" to="/">内容工作台</Link>
          <Button asChild size="sm" variant="ghost">
            <Link to="/json-structure"><FileJson2 />结构详情</Link>
          </Button>
        </div>
      </header>
      <div className="mx-auto max-w-[1320px] px-8 pb-20">
        <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-16 py-16">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-primary">通用内容 → PPT / 长图</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.06] tracking-[-0.05em] text-balance">
              先确认内容，再让样式真正参与排版。
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              ContentDocument 是唯一事实源。Markdown 负责人工确认，StylePack 与 LayoutRecipe 负责把同一份内容变成明显不同的视觉产物。
            </p>
            <Button asChild className="mt-8" size="lg">
              <Link to="/studio/new"><Plus />创建内容项目</Link>
            </Button>
          </div>
          <div className="flex flex-col justify-end gap-4">
            {["材料事实与 ContentDocument", "Markdown 校验并选择产物", "StylePack、素材与 Recipe", "看图评审、编辑与导出"].map((item, index) => (
              <div className="flex items-center gap-4 text-sm" key={item}>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">0{index + 1}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="border-t py-12">
          <div className="mb-7">
            <p className="text-sm text-muted-foreground">IndexedDB 本地保存 · 不读取旧 localStorage</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">最近项目</h2>
          </div>
          {projects.length === 0 ? (
            <Empty className="min-h-52 border">
              <EmptyHeader>
                <EmptyMedia><Presentation /></EmptyMedia>
                <EmptyTitle>还没有内容项目</EmptyTitle>
                <EmptyDescription>创建后会先进入独立的 Markdown 确认页。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {projects.map((project) => (
                <article className="rounded-xl border bg-card p-5" key={project.id}>
                  <Link className="group block" to={getProjectPath(project)}>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {project.outputType === "pptx" ? <Presentation className="size-4" /> : project.outputType === "longform" ? <Image className="size-4" /> : <FileJson2 className="size-4" />}
                      <span>{project.outputType === "pptx" ? "PPT" : project.outputType === "longform" ? "长图" : "未选择产物"}</span>
                      <span>·</span>
                      <Clock3 className="size-3.5" />
                      <span>{formatUpdatedAt(project.updatedAt)}</span>
                    </div>
                    <h3 className="mt-3 truncate text-lg font-semibold group-hover:text-primary">{project.contentDocument.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{project.contentDocument.coreMessage}</p>
                    <p className="mt-4 text-xs text-muted-foreground">
                      {project.contentDocument.sections.length} 章节 · {project.contentDocument.sections.reduce((sum, section) => sum + section.blocks.length, 0)} 内容块 · 修订 {project.contentRevision}
                    </p>
                  </Link>
                  <div className="mt-5 flex justify-end gap-2 border-t pt-4">
                    {project.outputType ? (
                      <Button size="sm" variant="ghost" onClick={() => void duplicate(project)}><Copy />复制为{project.outputType === "pptx" ? "长图" : "PPT"}</Button>
                    ) : null}
                    <Button aria-label={`删除 ${project.contentDocument.title}`} size="icon-sm" variant="ghost" onClick={() => setPendingDelete(project)}><Trash2 /></Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="w-[420px]">
          <DialogHeader>
            <DialogTitle>删除这个内容项目？</DialogTitle>
            <DialogDescription>项目、图片 Blob 和 Canvas 产物会从 IndexedDB 级联删除，无法恢复。</DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingDelete(null)}>取消</Button>
            <Button variant="destructive" onClick={() => void remove()}>删除</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
