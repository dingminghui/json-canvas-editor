import type { PptTokenUsageV1 } from "@/features/ai-ppt/schema";

import { serializeContentDocument } from "./markdown";
import {
  CONTENT_MODEL,
  CONTENT_PROJECT_SCHEMA_VERSION,
  type ContentDocumentV1,
  type ContentProjectInput,
  type ContentProjectV1,
  type MaterialPlanV1,
  type OutputType,
} from "./schema";

export const CONTENT_PROMPT_VERSION = "content-document/v1";

export const createContentProject = (
  input: ContentProjectInput,
  materialPlan: MaterialPlanV1,
  contentDocument: ContentDocumentV1,
  usage: PptTokenUsageV1,
): ContentProjectV1 => {
  const now = new Date().toISOString();
  return {
    schemaVersion: CONTENT_PROJECT_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    input,
    materialPlan,
    contentDocument,
    contentMarkdown: serializeContentDocument(contentDocument),
    contentRevision: 1,
    contentConfirmedAt: null,
    outputType: null,
    outputStructure: null,
    selectedStylePackId: null,
    artDirection: null,
    assetSearchPlan: null,
    assetDecisions: {},
    generator: {
      model: CONTENT_MODEL,
      promptVersion: CONTENT_PROMPT_VERSION,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
    },
    createdAt: now,
    updatedAt: now,
  };
};

export const applyConfirmedContent = (
  project: ContentProjectV1,
  document: ContentDocumentV1,
  markdown: string,
): ContentProjectV1 => ({
  ...project,
  contentDocument: document,
  contentMarkdown: markdown,
  contentRevision: project.contentRevision + 1,
  contentConfirmedAt: new Date().toISOString(),
  outputStructure: null,
  selectedStylePackId: null,
  artDirection: null,
  assetSearchPlan: null,
  assetDecisions: {},
  updatedAt: new Date().toISOString(),
});

export const selectProjectOutput = (
  project: ContentProjectV1,
  outputType: OutputType,
): ContentProjectV1 => ({
  ...project,
  outputType,
  outputStructure: null,
  selectedStylePackId: null,
  artDirection: null,
  assetSearchPlan: null,
  assetDecisions: {},
  updatedAt: new Date().toISOString(),
});
