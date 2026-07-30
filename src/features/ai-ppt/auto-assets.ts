import { PptGenerationError } from "@/features/ai-ppt/api";
import type { PptStructureV1, PptTokenUsageV1, PptVisualAsset } from "@/features/ai-ppt/schema";
import { mergePptTokenUsage } from "@/features/ai-ppt/token-usage";
import {
  generatePptAssetSearchPlan,
  selectPptAssetCandidate,
  type PptAssetPlanningPhase,
  type PptAssetSelectionPhase,
} from "@/features/ai-ppt/visual-api";
import { searchPexelsPhotos, type PexelsPhotoCandidate } from "@/features/content-studio/pexels";

export type PptAutoAssetPhase = PptAssetPlanningPhase | PptAssetSelectionPhase | "searching-assets";

interface ResolvePptAutoAssetsOptions {
  apiKey: string;
  apiHost?: string;
  pexelsKey: string;
  structure: PptStructureV1;
  visualPreference?: string;
  signal?: AbortSignal;
  onPhaseChange?: (phase: PptAutoAssetPhase) => void;
}

interface ResolvePptAutoAssetsResult {
  assets: PptVisualAsset[];
  usage: PptTokenUsageV1;
}

interface CandidateGroup {
  request: Awaited<
    ReturnType<typeof generatePptAssetSearchPlan>
  >["assetSearchPlan"]["requests"][number];
  candidates: PexelsPhotoCandidate[];
}

function mergeUsageList(
  initial: PptTokenUsageV1,
  usages: readonly PptTokenUsageV1[],
): PptTokenUsageV1 {
  return usages.reduce(mergePptTokenUsage, initial);
}

export async function resolvePptAutoAssets({
  apiKey,
  apiHost,
  pexelsKey,
  structure,
  visualPreference = "",
  signal,
  onPhaseChange,
}: ResolvePptAutoAssetsOptions): Promise<ResolvePptAutoAssetsResult> {
  const { assetSearchPlan, usage: planningUsage } = await generatePptAssetSearchPlan({
    apiHost,
    apiKey,
    structure,
    visualPreference,
    signal,
    onPhaseChange,
  });
  if (assetSearchPlan.requests.length === 0) {
    return { assets: [], usage: planningUsage };
  }

  const requiredRequests = assetSearchPlan.requests.filter((request) => request.required);
  if (!pexelsKey.trim()) {
    if (requiredRequests.length > 0) {
      throw new PptGenerationError(
        "request-failed",
        `模型判断 ${requiredRequests.map((request) => request.slideId).join("、")} 必须配图，请输入 Pexels API Key。`,
      );
    }
    return { assets: [], usage: planningUsage };
  }

  onPhaseChange?.("searching-assets");
  const searchedGroups = await Promise.all(
    assetSearchPlan.requests.map(async (request): Promise<CandidateGroup | null> => {
      try {
        const candidates = await searchPexelsPhotos(pexelsKey.trim(), request, signal);
        if (candidates.length === 0) {
          if (request.required) {
            throw new PptGenerationError(
              "request-failed",
              `${request.slideId} 的必需图片没有检索到结果。`,
            );
          }
          return null;
        }
        return { request, candidates };
      } catch (error) {
        if (request.required) {
          if (error instanceof PptGenerationError) throw error;
          throw new PptGenerationError(
            "request-failed",
            error instanceof Error ? error.message : `${request.slideId} 的图片检索失败。`,
          );
        }
        return null;
      }
    }),
  );
  const candidateGroups = searchedGroups.filter((group): group is CandidateGroup => group !== null);
  if (candidateGroups.length === 0) {
    return { assets: [], usage: planningUsage };
  }

  const selectionResults = await Promise.all(
    candidateGroups.map(async (group) => {
      try {
        const result = await selectPptAssetCandidate({
          apiHost,
          apiKey,
          request: group.request,
          candidates: group.candidates,
          signal,
          onPhaseChange,
        });
        const candidate = group.candidates.find(
          (item) => item.id === result.selection.selectedPhotoId,
        );
        if (!candidate) {
          throw new PptGenerationError(
            "invalid-visual-plan",
            `${group.request.id} 的选图结果不在候选列表中。`,
          );
        }
        return { candidate, group, usage: result.usage };
      } catch (error) {
        if (group.request.required) throw error;
        return null;
      }
    }),
  );
  const selected = selectionResults.filter((result) => result !== null);
  const assets = selected.map(({ candidate, group }, index): PptVisualAsset => ({
    id: `A${String(index + 1).padStart(2, "0")}`,
    name: `Pexels ${candidate.id}`,
    alt: candidate.alt || group.request.purpose,
    credit: `Photo: ${candidate.photographer} / Pexels`,
    targetSlideId: group.request.slideId,
    sourceUrl: candidate.sourceUrl,
    photographerUrl: candidate.photographerUrl,
    src: candidate.downloadUrl,
  }));

  return {
    assets,
    usage: mergeUsageList(
      planningUsage,
      selected.map((result) => result.usage),
    ),
  };
}
