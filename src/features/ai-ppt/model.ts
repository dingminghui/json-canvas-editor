import {
  PPT_MODEL,
  PPT_PROJECT_SCHEMA_VERSION,
  PPT_PROMPT_VERSION,
  type CreatePptStructureInput,
  type PptProjectV1,
  type PptSlide,
  type PptStructureV1,
  type PptTokenUsageV1,
} from "@/features/ai-ppt/schema";
import { mergePptTokenUsage } from "@/features/ai-ppt/token-usage";

export function createPptProject(
  input: CreatePptStructureInput,
  structure: PptStructureV1,
  usage: PptTokenUsageV1,
): PptProjectV1 {
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: PPT_PROJECT_SCHEMA_VERSION,
    id: globalThis.crypto.randomUUID(),
    input,
    structure,
    generator: {
      model: PPT_MODEL,
      promptVersion: PPT_PROMPT_VERSION,
      usage,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function recordPptProjectUsage(project: PptProjectV1, usage: PptTokenUsageV1): PptProjectV1 {
  return {
    ...project,
    generator: {
      ...project.generator,
      usage: mergePptTokenUsage(project.generator.usage, usage),
    },
  };
}

export function touchPptProject(project: PptProjectV1, structure: PptStructureV1): PptProjectV1 {
  return {
    ...project,
    structure,
    updatedAt: new Date().toISOString(),
  };
}

export function reindexPptStructure(structure: PptStructureV1): PptStructureV1 {
  const slides = structure.slides.map((slide, index) => {
    const id = `P${String(index + 1).padStart(2, "0")}`;
    return { ...slide, id, index: index + 1 };
  });

  const sections = structure.sections
    .map((section) => ({
      ...section,
      slideIds: slides.filter((slide) => slide.sectionId === section.id).map((slide) => slide.id),
    }))
    .filter((section) => section.slideIds.length > 0);

  return {
    ...structure,
    deck: { ...structure.deck, pageCount: slides.length },
    sections,
    slides,
  };
}

function createBlankSlide(sectionId: string): PptSlide {
  return {
    id: "P00",
    index: 0,
    sectionId,
    role: "content",
    title: "新幻灯片",
    coreMessage: "填写这一页唯一需要传达的核心信息。",
    audienceMove: {
      before: "尚未了解本页信息",
      after: "理解本页的核心结论",
    },
    layoutIntent: "title-body",
    contentBlocks: [{ type: "paragraph", text: "在这里补充正文内容。" }],
    speakerNotes: "",
  };
}

export function addSlideAfter(structure: PptStructureV1, slideId: string): PptStructureV1 {
  if (structure.slides.length >= 20) return structure;
  const currentIndex = structure.slides.findIndex((slide) => slide.id === slideId);
  if (currentIndex < 0) return structure;

  const currentSlide = structure.slides[currentIndex];
  const insertionIndex =
    currentIndex === structure.slides.length - 1 ? currentIndex : currentIndex + 1;
  const slides = structure.slides.slice();
  slides.splice(insertionIndex, 0, createBlankSlide(currentSlide.sectionId));
  return reindexPptStructure({ ...structure, slides });
}

export function deleteSlideById(structure: PptStructureV1, slideId: string): PptStructureV1 {
  const index = structure.slides.findIndex((slide) => slide.id === slideId);
  if (structure.slides.length <= 4 || index <= 0 || index === structure.slides.length - 1) {
    return structure;
  }
  return reindexPptStructure({
    ...structure,
    slides: structure.slides.filter((slide) => slide.id !== slideId),
  });
}

export function moveSlide(
  structure: PptStructureV1,
  slideId: string,
  direction: -1 | 1,
): PptStructureV1 {
  const index = structure.slides.findIndex((slide) => slide.id === slideId);
  const targetIndex = index + direction;
  if (
    index <= 0 ||
    index >= structure.slides.length - 1 ||
    targetIndex <= 0 ||
    targetIndex >= structure.slides.length - 1
  ) {
    return structure;
  }

  const slides = structure.slides.slice();
  [slides[index], slides[targetIndex]] = [slides[targetIndex], slides[index]];
  return reindexPptStructure({ ...structure, slides });
}

export function updateSection(
  structure: PptStructureV1,
  sectionId: string,
  patch: Partial<Pick<PptStructureV1["sections"][number], "title" | "objective">>,
): PptStructureV1 {
  return {
    ...structure,
    sections: structure.sections.map((section) =>
      section.id === sectionId ? { ...section, ...patch } : section,
    ),
  };
}
