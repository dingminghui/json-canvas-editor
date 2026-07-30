import { getVisualAsset } from "./storage";

const objectUrls = new Map<string, string>();

export const isAssetUri = (value: string): boolean => /^asset:\/\/A[a-zA-Z0-9]+$/.test(value);

export const getAssetIdFromUri = (value: string): string | null =>
  isAssetUri(value) ? value.slice("asset://".length) : null;

export const resolveAssetObjectUrl = async (source: string): Promise<string> => {
  const assetId = getAssetIdFromUri(source);
  if (!assetId) return source;
  const existing = objectUrls.get(assetId);
  if (existing) return existing;
  const asset = await getVisualAsset(assetId);
  if (!asset) throw new Error(`找不到图片素材 ${assetId}。`);
  const url = URL.createObjectURL(asset.blob);
  objectUrls.set(assetId, url);
  return url;
};

export const resolveAssetDataUrl = async (source: string): Promise<string> => {
  const assetId = getAssetIdFromUri(source);
  if (!assetId) return source;
  const asset = await getVisualAsset(assetId);
  if (!asset) throw new Error(`找不到图片素材 ${assetId}。`);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("图片素材读取失败。"));
    reader.readAsDataURL(asset.blob);
  });
};

export const revokeResolvedAssetUrls = () => {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
};
