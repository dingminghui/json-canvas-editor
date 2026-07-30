import { AppBackLink } from "@/components/AppBackLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  generateAssetSearchPlan,
  generateVisualPlan,
  recommendArtDirection,
  reviewVisualPlan,
  type ContentGenerationPhase,
} from "@/features/content-studio/ai";
import { ContentVisualCapture } from "@/features/content-studio/ContentVisualCapture";
import {
  createUploadedAsset,
  downloadPexelsAsset,
  searchPexelsPhotos,
  type PexelsPhotoCandidate,
} from "@/features/content-studio/pexels";
import {
  CONTENT_CANVAS_RENDERER_VERSION,
  renderContentToCanvas,
} from "@/features/content-studio/render";
import {
  STYLE_PACK_LIST,
  type StylePack,
} from "@/features/content-studio/style-packs";
import {
  type ArtDirection,
  type ContentProjectV1,
  type StylePackId,
  type VisualAssetRecord,
} from "@/features/content-studio/schema";
import {
  getContentArtifact,
  getContentProject,
  listProjectAssets,
  saveContentArtifact,
  saveContentProject,
  saveVisualAsset,
  type ContentArtifactRecord,
} from "@/features/content-studio/storage";
import { DEFAULT_BAILIAN_API_HOST } from "@/features/ai-ppt/schema";
import { Check, Eye, EyeOff, ImageOff, LoaderCircle, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type BusyState =
  | null
  | "style"
  | "assets"
  | "visual"
  | "review"
  | `search:${string}`
  | `select:${string}`;

const StylePreview = ({ pack, selected }: { pack: StylePack; selected: boolean }) => (
  <div
    className="h-28 overflow-hidden rounded-lg border"
    style={{ background: pack.colors.canvas, borderColor: selected ? pack.colors.accent : pack.colors.line }}
  >
    <div className="h-3" style={{ background: pack.colors.primary }} />
    <div className="grid grid-cols-[1fr_72px] gap-3 p-4">
      <div>
        <div className="h-3 w-3/4" style={{ background: pack.colors.text }} />
        <div className="mt-2 h-2 w-full" style={{ background: pack.colors.textMuted, opacity: 0.55 }} />
        <div className="mt-1 h-2 w-2/3" style={{ background: pack.colors.textMuted, opacity: 0.35 }} />
      </div>
      <div className="h-16" style={{ background: pack.colors.secondary, borderRadius: pack.shape.radius / 2 }} />
    </div>
  </div>
);

export function ContentVisualPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ContentProjectV1 | null>(null);
  const [assets, setAssets] = useState<VisualAssetRecord[]>([]);
  const [artifact, setArtifact] = useState<ContentArtifactRecord | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiHost, setApiHost] = useState<string>(DEFAULT_BAILIAN_API_HOST);
  const [pexelsKey, setPexelsKey] = useState("");
  const [showBailianKey, setShowBailianKey] = useState(false);
  const [showPexelsKey, setShowPexelsKey] = useState(false);
  const [styleChoice, setStyleChoice] = useState<StylePackId>("editorial-swiss");
  const [recommendedDirection, setRecommendedDirection] = useState<ArtDirection | null>(null);
  const [candidates, setCandidates] = useState<Record<string, PexelsPhotoCandidate[]>>({});
  const [handledRequests, setHandledRequests] = useState<Set<string>>(new Set());
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState<BusyState>(null);
  const [phase, setPhase] = useState<ContentGenerationPhase | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      getContentProject(projectId),
      listProjectAssets(projectId),
      getContentArtifact(projectId),
    ]).then(([loadedProject, loadedAssets, loadedArtifact]) => {
      setProject(loadedProject);
      setAssets(loadedAssets);
      setArtifact(loadedArtifact);
      if (loadedProject?.selectedStylePackId) setStyleChoice(loadedProject.selectedStylePackId);
      setHandledRequests(
        new Set(
          [
            ...Object.keys(loadedProject?.assetDecisions ?? {}),
            ...loadedAssets.flatMap((asset) =>
              asset.searchRequestId ? [asset.searchRequestId] : [],
            ),
          ],
        ),
      );
    });
  }, [projectId]);

  const captureComplete = useCallback((images: string[]) => setPreviews(images), []);
  const captureError = useCallback((caught: Error) => setError(caught.message), []);

  const requireBailianKey = () => {
    if (apiKey.trim()) return true;
    setError("请输入当前页面使用的百炼 API Key。");
    return false;
  };

  const recommendStyle = async () => {
    if (!project?.outputStructure || !requireBailianKey()) return;
    setBusy("style");
    setError("");
    try {
      const result = await recommendArtDirection(
        project.outputStructure,
        project.contentDocument,
        { apiKey: apiKey.trim(), apiHost, onPhaseChange: setPhase },
      );
      setRecommendedDirection(result.data);
      setStyleChoice(result.data.stylePackId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "样式推荐失败。");
    } finally {
      setBusy(null);
      setPhase(null);
    }
  };

  const confirmStyle = async () => {
    if (!project) return;
    if (
      artifact &&
      !globalThis.confirm(
        artifact.manuallyEdited
          ? "当前 Canvas 已手工编辑。切换 StylePack 后只有显式重新生成才会覆盖旧产物，确认继续？"
          : "切换 StylePack 会使当前视觉方案过期，确认继续？",
      )
    ) {
      return;
    }
    const direction: ArtDirection =
      recommendedDirection?.stylePackId === styleChoice
        ? recommendedDirection
        : {
            stylePackId: styleChoice,
            rationale: "用户手动选择该 StylePack。",
            emphasisStrategy: "按内容块语义和 Recipe 容量确定强调层级。",
            pacing: "通过不同 Recipe 与密度形成稳定阅读节奏。",
          };
    const next = {
      ...project,
      selectedStylePackId: styleChoice,
      artDirection: direction,
      assetSearchPlan: null,
      assetDecisions: {},
      updatedAt: new Date().toISOString(),
    };
    await saveContentProject(next);
    setProject(next);
    if (!artifact) setPreviews([]);
  };

  const planAssets = async (skip = false) => {
    if (!project?.outputStructure || !project.artDirection) return;
    if (!skip && !requireBailianKey()) return;
    setBusy("assets");
    setError("");
    try {
      const plan = skip
        ? { schemaVersion: "asset-search-plan/v1" as const, requests: [] }
        : (
            await generateAssetSearchPlan(project.outputStructure, project.artDirection, {
              apiKey: apiKey.trim(),
              apiHost,
              onPhaseChange: setPhase,
            })
          ).data;
      const next = {
        ...project,
        assetSearchPlan: plan,
        assetDecisions: {},
        updatedAt: new Date().toISOString(),
      };
      await saveContentProject(next);
      setProject(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "素材计划生成失败。");
    } finally {
      setBusy(null);
      setPhase(null);
    }
  };

  const search = async (request: NonNullable<ContentProjectV1["assetSearchPlan"]>["requests"][number]) => {
    if (!pexelsKey.trim()) {
      setError("请输入当前页面使用的 Pexels API Key。");
      return;
    }
    setBusy(`search:${request.id}`);
    setError("");
    try {
      const result = await searchPexelsPhotos(pexelsKey.trim(), request);
      setCandidates((current) => ({ ...current, [request.id]: result }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "图片搜索失败。");
    } finally {
      setBusy(null);
    }
  };

  const selectPhoto = async (
    request: NonNullable<ContentProjectV1["assetSearchPlan"]>["requests"][number],
    candidate: PexelsPhotoCandidate,
  ) => {
    if (!project) return;
    setBusy(`select:${request.id}`);
    setError("");
    try {
      const asset = await downloadPexelsAsset({
        projectId,
        purpose: request.purpose,
        outputNodeId: request.outputNodeId,
        searchRequestId: request.id,
        candidate,
      });
      await saveVisualAsset(asset);
      const nextProject = {
        ...project,
        assetDecisions: { ...project.assetDecisions, [request.id]: "selected" as const },
        updatedAt: new Date().toISOString(),
      };
      await saveContentProject(nextProject);
      setProject(nextProject);
      setAssets((current) => [...current.filter((item) => item.searchRequestId !== request.id), asset]);
      setHandledRequests((current) => new Set([...current, request.id]));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "图片下载或压缩失败。");
    } finally {
      setBusy(null);
    }
  };

  const uploadPhoto = async (
    request: NonNullable<ContentProjectV1["assetSearchPlan"]>["requests"][number],
    file: File,
  ) => {
    if (!project) return;
    setBusy(`select:${request.id}`);
    setError("");
    try {
      const asset = await createUploadedAsset({
        projectId,
        purpose: request.purpose,
        outputNodeId: request.outputNodeId,
        searchRequestId: request.id,
        file,
      });
      await saveVisualAsset(asset);
      const nextProject = {
        ...project,
        assetDecisions: { ...project.assetDecisions, [request.id]: "selected" as const },
        updatedAt: new Date().toISOString(),
      };
      await saveContentProject(nextProject);
      setProject(nextProject);
      setAssets((current) => [
        ...current.filter((item) => item.searchRequestId !== request.id),
        asset,
      ]);
      setHandledRequests((current) => new Set([...current, request.id]));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "手动图片读取或压缩失败。");
    } finally {
      setBusy(null);
    }
  };

  const skipRequest = async (requestId: string) => {
    if (!project) return;
    const nextProject = {
      ...project,
      assetDecisions: { ...project.assetDecisions, [requestId]: "skipped" as const },
      updatedAt: new Date().toISOString(),
    };
    await saveContentProject(nextProject);
    setProject(nextProject);
    setHandledRequests((current) => new Set([...current, requestId]));
  };

  const generateCanvas = async () => {
    if (
      !project?.outputStructure ||
      !project.selectedStylePackId ||
      !project.artDirection ||
      !project.assetSearchPlan ||
      !requireBailianKey()
    ) {
      return;
    }
    setBusy("visual");
    setError("");
    try {
      const result = await generateVisualPlan(
        project.outputStructure,
        project.contentDocument,
        project.selectedStylePackId,
        project.artDirection,
        assets.map((asset) => ({
          id: asset.id,
          outputNodeId: asset.outputNodeId,
          purpose: asset.purpose,
        })),
        { apiKey: apiKey.trim(), apiHost, onPhaseChange: setPhase },
      );
      const document = renderContentToCanvas({
        documentId: `canvas-${project.id}`,
        contentDocument: project.contentDocument,
        outputStructure: project.outputStructure,
        visualPlan: result.data,
        assets,
      });
      const now = new Date().toISOString();
      const nextArtifact: ContentArtifactRecord = {
        projectId: project.id,
        contentRevision: project.contentRevision,
        outputType: project.outputStructure.outputType,
        visualPlan: result.data,
        document,
        rendererVersion: CONTENT_CANVAS_RENDERER_VERSION,
        manuallyEdited: false,
        stale: false,
        createdAt: artifact?.createdAt ?? now,
        updatedAt: now,
      };
      await saveContentArtifact(nextArtifact);
      setArtifact(nextArtifact);
      setPreviews([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Canvas 生成失败。");
    } finally {
      setBusy(null);
      setPhase(null);
    }
  };

  const requestRegeneration = () => {
    if (!artifact) return;
    const confirmed = globalThis.confirm(
      artifact.manuallyEdited
        ? "当前 Canvas 包含手工编辑。确认显式重新生成并在生成成功后替换它？"
        : "确认显式重新生成 Canvas？旧产物会保留到新产物生成成功。",
    );
    if (!confirmed) return;
    setArtifact(null);
    setPreviews([]);
  };

  const runReview = async () => {
    if (!project?.outputStructure || !artifact || previews.length === 0 || !requireBailianKey()) return;
    setBusy("review");
    setError("");
    try {
      const result = await reviewVisualPlan(
        project.outputStructure,
        project.contentDocument,
        artifact.visualPlan,
        assets.map((asset) => asset.id),
        previews,
        { apiKey: apiKey.trim(), apiHost, onPhaseChange: setPhase },
      );
      const document =
        result.data.verdict === "revised"
          ? renderContentToCanvas({
              documentId: artifact.document.id,
              contentDocument: project.contentDocument,
              outputStructure: project.outputStructure,
              visualPlan: result.data.revisedVisualPlan,
              assets,
            })
          : artifact.document;
      const next = {
        ...artifact,
        visualPlan: result.data.revisedVisualPlan,
        visualReview: result.data,
        document,
        updatedAt: new Date().toISOString(),
      };
      await saveContentArtifact(next);
      setArtifact(next);
      setPreviews([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "视觉评审失败。");
    } finally {
      setBusy(null);
      setPhase(null);
    }
  };

  const allRequestsHandled = useMemo(
    () =>
      Boolean(
        project?.assetSearchPlan?.requests.every((request) => handledRequests.has(request.id)),
      ),
    [handledRequests, project?.assetSearchPlan],
  );

  if (!project) return <main className="grid h-dvh place-items-center text-sm text-muted-foreground">正在读取项目…</main>;
  if (!project.outputStructure) {
    return <main className="grid h-dvh place-items-center"><AppBackLink to={`/studio/${project.id}/structure`}>请先生成输出结构</AppBackLink></main>;
  }

  return (
    <main className="h-dvh min-w-[1180px] overflow-y-auto bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b bg-background/95 px-6 backdrop-blur">
        <AppBackLink iconOnly to={`/studio/${project.id}/structure`}>返回输出结构</AppBackLink>
        <span className="text-sm font-medium">{project.contentDocument.title}</span>
        <Badge>{project.outputType === "pptx" ? "PPT" : "长图"}</Badge>
        <Badge className="ml-auto" variant="outline">阶段 4 / 5 · 视觉准备与评审</Badge>
      </header>
      <div className="mx-auto max-w-[1320px] px-8 py-10">
        <section className="grid grid-cols-[1fr_320px] gap-10">
          <div>
            <p className="text-sm font-medium text-primary">01 · StylePack</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">样式在结构之后、布局之前加入。</h1>
            <div className="mt-6 grid grid-cols-3 gap-4">
              {STYLE_PACK_LIST.map((pack) => (
                <button
                  className={`rounded-xl border p-3 text-left transition ${styleChoice === pack.id ? "border-primary ring-2 ring-primary/15" : "hover:border-foreground/30"}`}
                  key={pack.id}
                  type="button"
                  onClick={() => setStyleChoice(pack.id)}
                >
                  <StylePreview pack={pack} selected={styleChoice === pack.id} />
                  <h3 className="mt-3 font-medium">{pack.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{pack.description}</p>
                </button>
              ))}
            </div>
          </div>
          <aside className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <h2 className="font-medium">当前页面凭据</h2>
              <div className="mt-4 flex gap-2">
                <Input autoComplete="off" placeholder="百炼 API Key" type={showBailianKey ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
                <Button size="icon" variant="outline" onClick={() => setShowBailianKey((value) => !value)}>{showBailianKey ? <EyeOff /> : <Eye />}</Button>
              </div>
              <Input className="mt-3" value={apiHost} onChange={(event) => setApiHost(event.target.value)} />
              <div className="mt-4 flex gap-2">
                <Input autoComplete="off" placeholder="Pexels API Key" type={showPexelsKey ? "text" : "password"} value={pexelsKey} onChange={(event) => setPexelsKey(event.target.value)} />
                <Button size="icon" variant="outline" onClick={() => setShowPexelsKey((value) => !value)}>{showPexelsKey ? <EyeOff /> : <Eye />}</Button>
              </div>
            </div>
            <Button className="w-full" disabled={busy !== null} variant="outline" onClick={() => void recommendStyle()}>
              {busy === "style" ? <LoaderCircle className="animate-spin" /> : <Sparkles />}AI 推荐 StylePack
            </Button>
            <Button className="w-full" disabled={busy !== null} onClick={() => void confirmStyle()}>
              <Check />确认当前 StylePack
            </Button>
            {project.selectedStylePackId ? <p className="text-xs text-muted-foreground">已确认：{project.selectedStylePackId}</p> : null}
          </aside>
        </section>

        {project.selectedStylePackId && project.artDirection ? (
          <section className="mt-14 border-t pt-10">
            <p className="text-sm font-medium text-primary">02 · 图片检索与确认</p>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-semibold">只使用用户确认的图片。</h2>
                <p className="mt-2 text-sm text-muted-foreground">AI 最多规划 6 个搜索需求；候选结果不持久化。</p>
              </div>
              {!project.assetSearchPlan ? (
                <div className="flex gap-2">
                  <Button disabled={busy !== null} variant="outline" onClick={() => void planAssets(true)}><ImageOff />无图继续</Button>
                  <Button disabled={busy !== null} onClick={() => void planAssets(false)}><Sparkles />生成素材计划</Button>
                </div>
              ) : null}
            </div>
            {project.assetSearchPlan ? (
              project.assetSearchPlan.requests.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">已确认无图继续。</div>
              ) : (
                <div className="mt-6 space-y-5">
                  {project.assetSearchPlan.requests.map((request) => {
                    const selected = assets.find((asset) => asset.searchRequestId === request.id);
                    return (
                      <article className="rounded-xl border bg-card p-5" key={request.id}>
                        <div className="flex items-start justify-between gap-5">
                          <div>
                            <div className="flex items-center gap-2"><Badge>{request.outputNodeId}</Badge><span className="font-medium">{request.purpose}</span>{request.required ? <Badge variant="destructive">必需</Badge> : null}</div>
                            <p className="mt-2 font-mono text-sm text-muted-foreground">{request.query} · {request.orientation}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => void skipRequest(request.id)}>跳过</Button>
                            <Button asChild size="sm" variant="outline">
                              <label>
                                手动上传
                                <input
                                  accept="image/png,image/jpeg,image/webp"
                                  className="sr-only"
                                  type="file"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) void uploadPhoto(request, file);
                                    event.target.value = "";
                                  }}
                                />
                              </label>
                            </Button>
                            <Button disabled={busy !== null} size="sm" onClick={() => void search(request)}><Search />搜索</Button>
                          </div>
                        </div>
                        {selected ? (
                          <p className="mt-4 text-sm text-primary">
                            已选择：{selected.name}
                            {selected.photographer ? ` · Photo: ${selected.photographer} / Pexels` : ""}
                            {selected.sourceUrl ? (
                              <>
                                {" · "}
                                <a className="underline underline-offset-4" href={selected.sourceUrl} rel="noreferrer" target="_blank">查看来源</a>
                              </>
                            ) : null}
                          </p>
                        ) : null}
                        {candidates[request.id] ? (
                          <div className="mt-4 grid grid-cols-6 gap-3">
                            {candidates[request.id].map((candidate) => (
                              <button className="overflow-hidden rounded-lg border text-left hover:border-primary" key={candidate.id} type="button" onClick={() => void selectPhoto(request, candidate)}>
                                <img alt={candidate.alt} className="aspect-[4/3] w-full object-cover" src={candidate.previewUrl} />
                                <span className="block truncate px-2 py-2 text-[11px]">{candidate.photographer}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )
            ) : null}
          </section>
        ) : null}

        {project.assetSearchPlan && allRequestsHandled ? (
          <section className="mt-14 border-t pt-10">
            <p className="text-sm font-medium text-primary">03 · LayoutRecipe 与看图评审</p>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-semibold">模型选配方，渲染器算坐标。</h2>
                <p className="mt-2 text-sm text-muted-foreground">AI 不能输出任意 CSS、颜色或 Canvas 坐标。</p>
              </div>
              {!artifact ? (
                <Button disabled={busy !== null} size="lg" onClick={() => void generateCanvas()}>
                  {busy === "visual" ? <LoaderCircle className="animate-spin" /> : <Sparkles />}生成 Canvas 初稿
                </Button>
              ) : (
                <Button disabled={busy !== null} size="lg" variant="outline" onClick={requestRegeneration}>
                  显式重新生成
                </Button>
              )}
            </div>
            {artifact ? (
              <div className="mt-6 grid grid-cols-[340px_1fr] gap-8">
                <div className="space-y-3">
                  {artifact.visualPlan.items.map((item) => (
                    <div className="rounded-lg border bg-card p-3" key={item.outputNodeId}>
                      <div className="flex items-center justify-between"><span className="font-mono text-xs">{item.outputNodeId}</span><Badge variant="secondary">{item.density}</Badge></div>
                      <p className="mt-2 text-sm font-medium">{item.recipeId}</p>
                    </div>
                  ))}
                </div>
                <div>
                  {previews.length === 0 ? <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">正在生成看图评审预览…</p> : (
                    <div className={artifact.outputType === "pptx" ? "grid grid-cols-2 gap-4" : "grid grid-cols-3 items-start gap-4"}>
                      {previews.map((preview, index) => <img alt={`视觉预览 ${index + 1}`} className="w-full rounded-lg border bg-white shadow-sm" key={index} src={preview} />)}
                    </div>
                  )}
                  <div className="mt-5 flex justify-end gap-3">
                    {!artifact.visualReview ? <Button disabled={busy !== null || previews.length === 0} variant="outline" onClick={() => void runReview()}><Sparkles />执行一次 AI 看图评审</Button> : <Badge variant="outline">已完成一次视觉评审：{artifact.visualReview.verdict}</Badge>}
                    <Button onClick={() => navigate(`/studio/${project.id}/editor`)}>进入编辑与导出</Button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {error ? <p className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-destructive/30 bg-background px-4 py-3 text-sm text-destructive shadow-lg">{error}</p> : null}
        {busy ? <Badge className="fixed right-5 bottom-5 z-30"><LoaderCircle className="animate-spin" />{phase === "repairing" ? "校验修复中" : "处理中"}</Badge> : null}
      </div>
      {artifact && previews.length === 0 ? (
        <ContentVisualCapture document={artifact.document} onCaptured={captureComplete} onError={captureError} />
      ) : null}
    </main>
  );
}
