import type { AssetSearchPlanV1, VisualAssetRecord } from "./schema";

const PEXELS_API_ROOT = "https://api.pexels.com/v1";
const MAX_IMAGE_EDGE = 2048;
const MAX_IMAGE_BYTES = 1_500_000;

export interface PexelsPhotoCandidate {
  id: number;
  width: number;
  height: number;
  averageColor: string;
  photographer: string;
  photographerUrl: string;
  sourceUrl: string;
  alt: string;
  previewUrl: string;
  downloadUrl: string;
}

interface PexelsSearchResponse {
  photos?: Array<{
    id?: number;
    width?: number;
    height?: number;
    avg_color?: string;
    photographer?: string;
    photographer_url?: string;
    url?: string;
    alt?: string;
    src?: {
      medium?: string;
      large2x?: string;
      original?: string;
    };
  }>;
}

export class PexelsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PexelsApiError";
  }
}

export const searchPexelsPhotos = async (
  apiKey: string,
  request: AssetSearchPlanV1["requests"][number],
  signal?: AbortSignal,
): Promise<PexelsPhotoCandidate[]> => {
  const url = new URL(`${PEXELS_API_ROOT}/search`);
  url.searchParams.set("query", request.query);
  url.searchParams.set("orientation", request.orientation);
  url.searchParams.set("per_page", "12");
  const response = await fetch(url, {
    headers: { Authorization: apiKey.trim() },
    signal,
  });
  if (!response.ok) {
    const detail =
      response.status === 401
        ? "Pexels Key 无效或未授权。"
        : response.status === 429
          ? "Pexels 请求达到限流，请稍后重试。"
          : `Pexels 搜索失败（${response.status}）。`;
    throw new PexelsApiError(detail, response.status);
  }
  const data = (await response.json()) as PexelsSearchResponse;
  return (data.photos ?? []).flatMap((photo) => {
    const downloadUrl = photo.src?.large2x ?? photo.src?.original;
    const previewUrl = photo.src?.medium ?? downloadUrl;
    if (
      photo.id === undefined ||
      photo.width === undefined ||
      photo.height === undefined ||
      !downloadUrl ||
      !previewUrl
    ) {
      return [];
    }
    return [
      {
        id: photo.id,
        width: photo.width,
        height: photo.height,
        averageColor: photo.avg_color ?? "#888888",
        photographer: photo.photographer ?? "Unknown",
        photographerUrl: photo.photographer_url ?? "https://www.pexels.com",
        sourceUrl: photo.url ?? "https://www.pexels.com",
        alt: photo.alt ?? request.purpose,
        previewUrl,
        downloadUrl,
      },
    ];
  });
};

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("浏览器无法压缩该图片。"));
      },
      "image/jpeg",
      quality,
    );
  });

export const compressImageBlob = async (source: Blob): Promise<{
  blob: Blob;
  width: number;
  height: number;
}> => {
  const bitmap = await createImageBitmap(source);
  const initialScale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  let width = Math.max(1, Math.round(bitmap.width * initialScale));
  let height = Math.max(1, Math.round(bitmap.height * initialScale));
  let quality = 0.88;
  let compressed: Blob | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      throw new Error("浏览器无法创建图片压缩画布。");
    }
    context.drawImage(bitmap, 0, 0, width, height);
    compressed = await canvasToBlob(canvas, quality);
    if (compressed.size <= MAX_IMAGE_BYTES) break;
    if (quality > 0.58) quality -= 0.1;
    else {
      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }
  }
  bitmap.close();
  if (!compressed || compressed.size > MAX_IMAGE_BYTES) {
    throw new Error("图片压缩后仍超过 1.5MB，请选择较小图片。");
  }
  return { blob: compressed, width, height };
};

export const downloadPexelsAsset = async ({
  projectId,
  purpose,
  outputNodeId,
  searchRequestId,
  candidate,
  signal,
}: {
  projectId: string;
  purpose: string;
  outputNodeId?: string;
  searchRequestId?: string;
  candidate: PexelsPhotoCandidate;
  signal?: AbortSignal;
}): Promise<VisualAssetRecord> => {
  const response = await fetch(candidate.downloadUrl, { signal });
  if (!response.ok) throw new Error(`图片下载失败（${response.status}）。`);
  const compressed = await compressImageBlob(await response.blob());
  return {
    id: `A${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`,
    projectId,
    provider: "pexels",
    providerAssetId: String(candidate.id),
    name: `Pexels ${candidate.id}`,
    alt: candidate.alt,
    purpose,
    ...(outputNodeId ? { outputNodeId } : {}),
    ...(searchRequestId ? { searchRequestId } : {}),
    photographer: candidate.photographer,
    photographerUrl: candidate.photographerUrl,
    sourceUrl: candidate.sourceUrl,
    width: compressed.width,
    height: compressed.height,
    averageColor: candidate.averageColor,
    mimeType: "image/jpeg",
    blob: compressed.blob,
    createdAt: new Date().toISOString(),
  };
};

export const createUploadedAsset = async ({
  projectId,
  purpose,
  outputNodeId,
  searchRequestId,
  file,
}: {
  projectId: string;
  purpose: string;
  outputNodeId?: string;
  searchRequestId?: string;
  file: File;
}): Promise<VisualAssetRecord> => {
  const compressed = await compressImageBlob(file);
  return {
    id: `A${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`,
    projectId,
    provider: "upload",
    name: file.name,
    alt: file.name,
    purpose,
    ...(outputNodeId ? { outputNodeId } : {}),
    ...(searchRequestId ? { searchRequestId } : {}),
    width: compressed.width,
    height: compressed.height,
    mimeType: "image/jpeg",
    blob: compressed.blob,
    createdAt: new Date().toISOString(),
  };
};
