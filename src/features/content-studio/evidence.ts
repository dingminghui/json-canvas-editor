import type { MaterialPlanV1 } from "./schema";

export type EvidenceMatchKind =
  | "exact"
  | "normalized"
  | "approximate"
  | "missing";

export interface EvidenceMatch {
  kind: EvidenceMatchKind;
  score: number;
}

const stripMarkdown = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/^```[^\n]*|```$/g, ""),
    )
    .replace(/[`*_~>#|[\]{}()-]/g, " ");

const normalizeEvidenceText = (value: string) =>
  stripMarkdown(value)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

const toNgrams = (value: string, size: number) => {
  if (value.length < size) return [];
  return Array.from(
    { length: value.length - size + 1 },
    (_, index) => value.slice(index, index + size),
  );
};

const calculateCoverage = (needles: string[], haystack: Set<string>) => {
  if (needles.length === 0) return 0;
  const matched = needles.filter((needle) => haystack.has(needle)).length;
  return matched / needles.length;
};

const calculateApproximateScore = (source: string, excerpt: string) => {
  const sourceBigrams = new Set(toNgrams(source, 2));
  const excerptBigrams = toNgrams(excerpt, 2);
  const bigramCoverage = calculateCoverage(excerptBigrams, sourceBigrams);

  const sourceCharacters = new Set(Array.from(source));
  const excerptCharacters = Array.from(excerpt);
  const characterCoverage = calculateCoverage(excerptCharacters, sourceCharacters);

  return bigramCoverage * 0.75 + characterCoverage * 0.25;
};

export const matchMaterialEvidence = (
  sourceMarkdown: string,
  sourceExcerpt: string,
): EvidenceMatch => {
  const trimmedExcerpt = sourceExcerpt.trim();
  if (trimmedExcerpt && sourceMarkdown.includes(trimmedExcerpt)) {
    return { kind: "exact", score: 1 };
  }

  const normalizedSource = normalizeEvidenceText(sourceMarkdown);
  const normalizedExcerpt = normalizeEvidenceText(sourceExcerpt);
  if (!normalizedExcerpt) return { kind: "missing", score: 0 };

  if (normalizedSource.includes(normalizedExcerpt)) {
    return { kind: "normalized", score: 1 };
  }

  // Very short excerpts are too ambiguous for fuzzy validation.
  if (normalizedExcerpt.length < 8) {
    return { kind: "missing", score: 0 };
  }

  const score = calculateApproximateScore(normalizedSource, normalizedExcerpt);
  return score >= 0.5
    ? { kind: "approximate", score }
    : { kind: "missing", score };
};

export const getMaterialEvidenceIssues = (
  plan: MaterialPlanV1,
  sourceMarkdown: string,
) =>
  plan.facts.flatMap((fact) => {
    const match = matchMaterialEvidence(sourceMarkdown, fact.sourceExcerpt);
    return match.kind === "missing"
      ? [
          `${fact.id}.sourceExcerpt 与材料缺少足够文本关联（已允许标点、换行、Markdown 格式和轻微改写差异）。`,
        ]
      : [];
  });
