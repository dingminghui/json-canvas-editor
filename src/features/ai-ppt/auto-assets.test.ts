import { resolvePptAutoAssets } from "@/features/ai-ppt/auto-assets";
import { createTestPptStructure, createTestPptTokenUsage } from "@/features/ai-ppt/test-fixtures";
import { generatePptAssetSearchPlan, selectPptAssetCandidate } from "@/features/ai-ppt/visual-api";
import { searchPexelsPhotos } from "@/features/content-studio/pexels";

vi.mock("@/features/ai-ppt/visual-api", () => ({
  generatePptAssetSearchPlan: vi.fn(),
  selectPptAssetCandidate: vi.fn(),
}));

vi.mock("@/features/content-studio/pexels", () => ({
  searchPexelsPhotos: vi.fn(),
}));

const generateSearchPlanMock = vi.mocked(generatePptAssetSearchPlan);
const selectCandidateMock = vi.mocked(selectPptAssetCandidate);
const searchPexelsMock = vi.mocked(searchPexelsPhotos);

const request = {
  id: "Q01",
  slideId: "P01",
  purpose: "封面团队场景",
  query: "creative team working landscape copy space",
  orientation: "landscape" as const,
  required: false,
};

const candidate = {
  id: 42,
  width: 2400,
  height: 1600,
  averageColor: "#8899AA",
  photographer: "Ada",
  photographerUrl: "https://www.pexels.com/@ada",
  sourceUrl: "https://www.pexels.com/photo/42",
  alt: "Creative team",
  previewUrl: "https://images.pexels.com/preview.jpg",
  downloadUrl: "https://images.pexels.com/full.jpg",
};

describe("AI PPT 自动配图", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("模型判断无须配图时不调用 Pexels", async () => {
    generateSearchPlanMock.mockResolvedValue({
      assetSearchPlan: { schemaVersion: "ppt-asset-search-plan/v1", requests: [] },
      usage: createTestPptTokenUsage(),
    });

    const result = await resolvePptAutoAssets({
      apiKey: "sk-test",
      pexelsKey: "pexels-test",
      structure: createTestPptStructure(),
    });

    expect(result.assets).toEqual([]);
    expect(searchPexelsMock).not.toHaveBeenCalled();
  });

  it("从 Pexels 第一页候选中自动选择并登记来源", async () => {
    generateSearchPlanMock.mockResolvedValue({
      assetSearchPlan: {
        schemaVersion: "ppt-asset-search-plan/v1",
        requests: [request],
      },
      usage: createTestPptTokenUsage(),
    });
    searchPexelsMock.mockResolvedValue([candidate]);
    selectCandidateMock.mockResolvedValue({
      selection: {
        schemaVersion: "ppt-asset-selection/v1",
        requestId: "Q01",
        selectedPhotoId: 42,
        rationale: "主题与构图匹配。",
      },
      usage: createTestPptTokenUsage(),
    });

    const result = await resolvePptAutoAssets({
      apiKey: "sk-test",
      pexelsKey: "pexels-test",
      structure: createTestPptStructure(),
    });

    expect(searchPexelsMock).toHaveBeenCalledWith("pexels-test", request, undefined);
    expect(result.assets).toEqual([
      expect.objectContaining({
        id: "A01",
        name: "Pexels 42",
        targetSlideId: "P01",
        credit: "Photo: Ada / Pexels",
        sourceUrl: candidate.sourceUrl,
        src: candidate.downloadUrl,
      }),
    ]);
    expect(result.usage.total_tokens).toBe(20_220);
  });

  it("可选图片检索失败时无图继续", async () => {
    generateSearchPlanMock.mockResolvedValue({
      assetSearchPlan: {
        schemaVersion: "ppt-asset-search-plan/v1",
        requests: [request],
      },
      usage: createTestPptTokenUsage(),
    });
    searchPexelsMock.mockRejectedValue(new Error("Pexels unavailable"));

    const result = await resolvePptAutoAssets({
      apiKey: "sk-test",
      pexelsKey: "pexels-test",
      structure: createTestPptStructure(),
    });

    expect(result.assets).toEqual([]);
    expect(selectCandidateMock).not.toHaveBeenCalled();
  });

  it("明确必需配图但没有 Pexels Key 时停止", async () => {
    generateSearchPlanMock.mockResolvedValue({
      assetSearchPlan: {
        schemaVersion: "ppt-asset-search-plan/v1",
        requests: [{ ...request, required: true }],
      },
      usage: createTestPptTokenUsage(),
    });

    await expect(
      resolvePptAutoAssets({
        apiKey: "sk-test",
        pexelsKey: "",
        structure: createTestPptStructure(),
      }),
    ).rejects.toMatchObject({
      code: "request-failed",
      message: expect.stringContaining("P01"),
    });
  });
});
