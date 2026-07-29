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
import { deletePptCanvasArtifact } from "@/features/ai-ppt/canvas-storage";
import type { PptProjectV1 } from "@/features/ai-ppt/schema";
import { deletePptProject, listPptProjects } from "@/features/ai-ppt/storage";
import { Clock3, FileJson2, Plus, Presentation, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const TOKEN_COUNT_FORMATTER = new Intl.NumberFormat("zh-CN");

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function Home() {
  const [projects, setProjects] = useState(listPptProjects);
  const [pendingDelete, setPendingDelete] = useState<PptProjectV1 | null>(null);

  function handleDelete() {
    if (!pendingDelete || !deletePptProject(pendingDelete.id)) return;
    deletePptCanvasArtifact(pendingDelete.id);
    setProjects((current) => current.filter((project) => project.id !== pendingDelete.id));
    setPendingDelete(null);
  }

  return (
    <main className="h-dvh min-w-[1120px] overflow-y-auto bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between px-8">
          <Link className="font-medium tracking-tight" to="/">
            内容工作台
          </Link>
          <Button asChild size="sm" variant="ghost">
            <Link to="/json-structure">
              <FileJson2 data-icon="inline-start" />
              结构详情
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-8 pb-20">
        <section className="grid grid-cols-[minmax(0,1fr)_300px] gap-16 py-16">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-primary">AI 生成 PPT 结构</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.08] tracking-[-0.045em] text-balance">
              先整理观点，再开始设计幻灯片。
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              输入主题、听众、目标和 Markdown 材料，生成可继续编辑的章节与逐页内容结构。
            </p>
            <Button asChild className="mt-8" size="lg">
              <Link to="/ai-ppt/new">
                <Plus data-icon="inline-start" />
                创建 PPT 结构
              </Link>
            </Button>
          </div>

          <div className="flex flex-col justify-end gap-4">
            {["规划叙事与章节", "明确逐页核心信息", "组织语义内容块"].map((item, index) => (
              <div className="flex items-center gap-4 text-sm" key={item}>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  0{index + 1}
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="py-14">
          <div className="mb-7">
            <p className="text-sm text-muted-foreground">仅保存在当前浏览器</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">最近生成</h2>
          </div>

          {projects.length === 0 ? (
            <Empty className="min-h-48">
              <EmptyHeader>
                <EmptyMedia>
                  <Presentation />
                </EmptyMedia>
                <EmptyTitle>还没有生成过 PPT 结构</EmptyTitle>
                <EmptyDescription>第一份大纲会出现在这里，可以继续编辑或删除。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div>
              {projects.map((project) => (
                <div key={project.id}>
                  <article className="grid grid-cols-[1fr_auto] items-center gap-6 py-5">
                    <Link
                      aria-label={`打开 AI PPT 项目 ${project.structure.deck.title}`}
                      className="group min-w-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      to={`/ai-ppt/${project.id}`}
                    >
                      <div className="flex items-center gap-3 whitespace-nowrap text-xs text-muted-foreground">
                        <span className="tabular-nums">{project.structure.deck.pageCount} 页</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock3 className="size-3.5" data-icon="inline-start" />
                          {formatUpdatedAt(project.updatedAt)}
                        </span>
                      </div>
                      <h3 className="mt-2 truncate text-lg font-medium tracking-tight transition-colors group-hover:text-primary">
                        {project.structure.deck.title}
                      </h3>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {project.structure.deck.coreMessage}
                      </p>
                      <footer className="mt-3 text-xs tabular-nums text-muted-foreground">
                        模型用量{" "}
                        {TOKEN_COUNT_FORMATTER.format(project.generator.usage.total_tokens)} 词元
                      </footer>
                    </Link>
                    <div className="flex items-center gap-2">
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/ai-ppt/${project.id}`}>继续编辑</Link>
                      </Button>
                      <Button
                        aria-label={`删除 AI PPT 项目 ${project.structure.deck.title}`}
                        onClick={() => setPendingDelete(project)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        open={pendingDelete !== null}
      >
        <DialogContent className="w-[420px] p-6">
          <DialogHeader>
            <DialogTitle className="text-base">删除这份 PPT 结构？</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6">
              “{pendingDelete?.structure.deck.title}”将从当前浏览器中永久删除。
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={() => setPendingDelete(null)} type="button" variant="outline">
              取消
            </Button>
            <Button onClick={handleDelete} type="button" variant="destructive">
              删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
