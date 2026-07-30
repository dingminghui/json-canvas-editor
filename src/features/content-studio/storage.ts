import type { CanvasDocument } from "@/editor/types";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import {
  ContentProjectSchema,
  type ContentProjectV1,
  type OutputType,
  type VisualAssetRecord,
  type VisualPlanV1,
  type VisualReviewV1,
} from "./schema";

export const CONTENT_STUDIO_DB_NAME = "json-canvas-content-studio";
export const CONTENT_STUDIO_DB_VERSION = 1;

export interface ContentArtifactRecord {
  projectId: string;
  contentRevision: number;
  outputType: OutputType;
  visualPlan: VisualPlanV1;
  visualReview?: VisualReviewV1;
  document: CanvasDocument;
  rendererVersion: string;
  manuallyEdited: boolean;
  stale: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ContentStudioDatabase extends DBSchema {
  projects: {
    key: string;
    value: ContentProjectV1;
    indexes: { "by-updated-at": string };
  };
  assets: {
    key: string;
    value: VisualAssetRecord;
    indexes: { "by-project": string };
  };
  artifacts: {
    key: string;
    value: ContentArtifactRecord;
    indexes: { "by-updated-at": string };
  };
}

let databasePromise: Promise<IDBPDatabase<ContentStudioDatabase>> | null = null;

const getDatabase = () => {
  if (!databasePromise) {
    databasePromise = openDB<ContentStudioDatabase>(
      CONTENT_STUDIO_DB_NAME,
      CONTENT_STUDIO_DB_VERSION,
      {
        upgrade(database) {
          const projectStore = database.createObjectStore("projects", { keyPath: "id" });
          projectStore.createIndex("by-updated-at", "updatedAt");
          const assetStore = database.createObjectStore("assets", { keyPath: "id" });
          assetStore.createIndex("by-project", "projectId");
          const artifactStore = database.createObjectStore("artifacts", { keyPath: "projectId" });
          artifactStore.createIndex("by-updated-at", "updatedAt");
        },
      },
    );
  }
  return databasePromise;
};

export const resetContentStudioDatabaseConnectionForTests = async () => {
  if (databasePromise) {
    const database = await databasePromise;
    database.close();
  }
  databasePromise = null;
};

export const listContentProjects = async (): Promise<ContentProjectV1[]> => {
  try {
    const records = await (await getDatabase()).getAll("projects");
    return records
      .flatMap((record) => {
        const result = ContentProjectSchema.safeParse(record);
        return result.success ? [result.data] : [];
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch {
    return [];
  }
};

export const getContentProject = async (id: string): Promise<ContentProjectV1 | null> => {
  const value = await (await getDatabase()).get("projects", id);
  if (!value) return null;
  const result = ContentProjectSchema.safeParse(value);
  return result.success ? result.data : null;
};

export const saveContentProject = async (project: ContentProjectV1): Promise<void> => {
  await (await getDatabase()).put("projects", ContentProjectSchema.parse(project));
};

export const saveContentProjectAndMarkArtifactStale = async (
  project: ContentProjectV1,
): Promise<void> => {
  const database = await getDatabase();
  const transaction = database.transaction(["projects", "artifacts"], "readwrite");
  await transaction.objectStore("projects").put(ContentProjectSchema.parse(project));
  const artifact = await transaction.objectStore("artifacts").get(project.id);
  if (artifact) {
    await transaction.objectStore("artifacts").put({
      ...artifact,
      stale: true,
      updatedAt: new Date().toISOString(),
    });
  }
  await transaction.done;
};

export const duplicateContentProjectForOutput = async (
  source: ContentProjectV1,
  outputType: OutputType,
): Promise<ContentProjectV1> => {
  const now = new Date().toISOString();
  const duplicate = ContentProjectSchema.parse({
    ...source,
    id: crypto.randomUUID(),
    outputType,
    outputStructure: null,
    selectedStylePackId: null,
    artDirection: null,
    assetSearchPlan: null,
    assetDecisions: {},
    createdAt: now,
    updatedAt: now,
  });
  await saveContentProject(duplicate);
  return duplicate;
};

export const deleteContentProject = async (projectId: string): Promise<void> => {
  const database = await getDatabase();
  const transaction = database.transaction(["projects", "assets", "artifacts"], "readwrite");
  await transaction.objectStore("projects").delete(projectId);
  await transaction.objectStore("artifacts").delete(projectId);
  const assetKeys = await transaction.objectStore("assets").index("by-project").getAllKeys(projectId);
  await Promise.all(assetKeys.map((key) => transaction.objectStore("assets").delete(key)));
  await transaction.done;
};

export const listProjectAssets = async (projectId: string): Promise<VisualAssetRecord[]> =>
  (await getDatabase()).getAllFromIndex("assets", "by-project", projectId);

export const getVisualAsset = async (assetId: string): Promise<VisualAssetRecord | null> =>
  (await (await getDatabase()).get("assets", assetId)) ?? null;

export const saveVisualAsset = async (asset: VisualAssetRecord): Promise<void> => {
  await (await getDatabase()).put("assets", asset);
};

export const deleteVisualAsset = async (assetId: string): Promise<void> => {
  await (await getDatabase()).delete("assets", assetId);
};

export const getContentArtifact = async (
  projectId: string,
): Promise<ContentArtifactRecord | null> =>
  (await (await getDatabase()).get("artifacts", projectId)) ?? null;

export const saveContentArtifact = async (artifact: ContentArtifactRecord): Promise<void> => {
  await (await getDatabase()).put("artifacts", artifact);
};

export const markContentArtifactEdited = async (
  projectId: string,
  document: CanvasDocument,
): Promise<void> => {
  const artifact = await getContentArtifact(projectId);
  if (!artifact) return;
  await saveContentArtifact({
    ...artifact,
    document,
    manuallyEdited: true,
    updatedAt: new Date().toISOString(),
  });
};
