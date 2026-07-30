import { afterEach, describe, expect, it, vi } from "vitest";

import { PexelsApiError, searchPexelsPhotos } from "./pexels";

const request = {
  id: "Q01",
  outputNodeId: "P01",
  purpose: "封面人物",
  query: "creative team portrait",
  orientation: "landscape" as const,
  required: true,
};

describe("Pexels BYOK search", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps at most twelve candidates and sends the key only in the request header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          photos: [
            {
              id: 42,
              width: 2400,
              height: 1600,
              avg_color: "#8899AA",
              photographer: "Ada",
              photographer_url: "https://www.pexels.com/@ada",
              url: "https://www.pexels.com/photo/42",
              alt: "Team",
              src: {
                medium: "https://images.pexels.com/preview.jpg",
                large2x: "https://images.pexels.com/full.jpg",
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await searchPexelsPhotos("transient-key", request);
    expect(result[0]).toMatchObject({ id: 42, photographer: "Ada", averageColor: "#8899AA" });
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("per_page")).toBe("12");
    expect(url.searchParams.get("orientation")).toBe("landscape");
    expect(options.headers).toEqual({ Authorization: "transient-key" });
    expect(url.toString()).not.toContain("transient-key");
  });

  it.each([
    [401, "无效"],
    [429, "限流"],
    [500, "500"],
  ])("maps HTTP %s to an actionable error", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));
    await expect(searchPexelsPhotos("key", request)).rejects.toMatchObject({
      name: PexelsApiError.name,
      message: expect.stringContaining(String(message)),
      status,
    });
  });
});
