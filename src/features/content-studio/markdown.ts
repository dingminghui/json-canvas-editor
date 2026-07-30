import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";

import {
  ContentDocumentSchema,
  type ContentBlock,
  type ContentDocumentV1,
  type MaterialPlanV1,
} from "./schema";

const FRONTMATTER_KEYS = [
  "schemaVersion",
  "title",
  "subtitle",
  "language",
  "audience",
  "purpose",
  "coreMessage",
] as const;

const BlockMarkerSchema = z.object({
  id: z.string().regex(/^B\d{3,}$/),
  type: z.string(),
  evidenceRefs: z.array(z.string().regex(/^F\d{3,}$/)),
});

export interface MarkdownIssue {
  line: number;
  message: string;
}

export type MarkdownParseResult =
  | {
      success: true;
      document: ContentDocumentV1;
      markdown: string;
      issues: [];
    }
  | {
      success: false;
      issues: MarkdownIssue[];
    };

interface SourceChunk {
  line: number;
  value: string;
}

const escapeCell = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");

const renderBlockBody = (block: ContentBlock): string => {
  switch (block.type) {
    case "paragraph":
      return block.text;
    case "bullet-list":
      return block.items.map((item) => `- ${item}`).join("\n");
    case "numbered-list":
      return block.items.map((item, index) => `${index + 1}. ${item}`).join("\n");
    case "quote":
      return [
        ...block.quote.split("\n").map((line) => `> ${line}`),
        ...(block.attribution ? [`> — ${block.attribution}`] : []),
      ].join("\n");
    case "table":
      return [
        `| ${block.columns.map(escapeCell).join(" | ")} |`,
        `| ${block.columns.map(() => "---").join(" | ")} |`,
        ...block.rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
      ].join("\n");
    case "comparison":
    case "process":
    case "metrics":
    case "chart":
    case "diagram": {
      const { id: _id, evidenceRefs: _evidenceRefs, ...value } = block;
      return `\`\`\`content-block\n${JSON.stringify(value, null, 2)}\n\`\`\``;
    }
  }
};

export const serializeContentDocument = (document: ContentDocumentV1): string => {
  const parsed = ContentDocumentSchema.parse(document);
  const frontmatter = Object.fromEntries(
    FRONTMATTER_KEYS.flatMap((key) => {
      const value = parsed[key];
      return value === undefined || value === "" ? [] : [[key, value]];
    }),
  );
  const body = parsed.sections
    .flatMap((section) => [
      `<!-- section:${section.id} -->`,
      `## ${section.title}`,
      ...(section.objective
        ? ["", "> [!objective]", ...section.objective.split("\n").map((line) => `> ${line}`)]
        : []),
      ...section.blocks.flatMap((block) => [
        "",
        `<!-- block:${block.id} type:${block.type} evidence:${block.evidenceRefs.join(",")} -->`,
        renderBlockBody(block),
      ]),
    ])
    .join("\n");

  return `---\n${stringifyYaml(frontmatter, { lineWidth: 0 }).trim()}\n---\n\n${body}\n`;
};

const splitSource = (source: string): SourceChunk[] =>
  source.replaceAll("\r\n", "\n").split("\n").map((value, index) => ({ line: index + 1, value }));

const parseFrontmatter = (
  chunks: SourceChunk[],
  issues: MarkdownIssue[],
): { data: Record<string, unknown>; endIndex: number } | null => {
  if (chunks[0]?.value.trim() !== "---") {
    issues.push({ line: 1, message: "Markdown 必须以 YAML Frontmatter 开始。" });
    return null;
  }
  const endIndex = chunks.findIndex((chunk, index) => index > 0 && chunk.value.trim() === "---");
  if (endIndex < 0) {
    issues.push({ line: 1, message: "YAML Frontmatter 缺少结束分隔符 ---。" });
    return null;
  }
  try {
    const raw = chunks.slice(1, endIndex).map((chunk) => chunk.value).join("\n");
    const data = parseYaml(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      issues.push({ line: 2, message: "YAML Frontmatter 必须是键值对象。" });
      return null;
    }
    return { data: data as Record<string, unknown>, endIndex };
  } catch (error) {
    issues.push({
      line: 2,
      message: `YAML Frontmatter 无法解析：${error instanceof Error ? error.message : "未知错误"}`,
    });
    return null;
  }
};

const parseBlockMarker = (chunk: SourceChunk, issues: MarkdownIssue[]) => {
  const match = chunk.value.match(
    /^<!--\s*block:(B\d{3,})\s+type:([a-z-]+)\s+evidence:([^>]*)\s*-->$/,
  );
  if (!match) {
    issues.push({ line: chunk.line, message: "内容块标记格式错误。" });
    return null;
  }
  const result = BlockMarkerSchema.safeParse({
    id: match[1],
    type: match[2],
    evidenceRefs: match[3]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  });
  if (!result.success) {
    issues.push({ line: chunk.line, message: "内容块 ID、类型或证据引用格式错误。" });
    return null;
  }
  return result.data;
};

const stripBlankEdges = (chunks: SourceChunk[]) => {
  let start = 0;
  let end = chunks.length;
  while (start < end && chunks[start].value.trim() === "") start += 1;
  while (end > start && chunks[end - 1].value.trim() === "") end -= 1;
  return chunks.slice(start, end);
};

const parseTableRow = (value: string) =>
  value
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replaceAll("\\|", "|"));

const parseNaturalBlock = (
  marker: z.infer<typeof BlockMarkerSchema>,
  bodyChunks: SourceChunk[],
  issues: MarkdownIssue[],
): ContentBlock | null => {
  const body = stripBlankEdges(bodyChunks);
  const startLine = body[0]?.line ?? 1;
  const text = body.map((chunk) => chunk.value).join("\n").trim();
  const base = { id: marker.id, evidenceRefs: marker.evidenceRefs };

  switch (marker.type) {
    case "paragraph":
      if (
        body.some((chunk) =>
          /^\s*(?:#{1,6}\s|[-*+]\s+\S|\d+\.\s+\S|>\s?|```|\|)/.test(chunk.value),
        )
      ) {
        issues.push({
          line: startLine,
          message: "paragraph 中包含与块类型不匹配或不支持的 Markdown 语法。",
        });
        return null;
      }
      return { ...base, type: "paragraph", text };
    case "bullet-list": {
      const items = body.map((chunk) => chunk.value.match(/^\s*-\s+(.+)$/)?.[1]);
      if (items.some((item) => !item)) {
        issues.push({ line: startLine, message: "bullet-list 的每一行都必须以 “- ” 开始。" });
        return null;
      }
      return { ...base, type: "bullet-list", items: items as string[] };
    }
    case "numbered-list": {
      const items = body.map((chunk) => chunk.value.match(/^\s*\d+\.\s+(.+)$/)?.[1]);
      if (items.some((item) => !item)) {
        issues.push({ line: startLine, message: "numbered-list 的每一行都必须使用数字列表语法。" });
        return null;
      }
      return { ...base, type: "numbered-list", items: items as string[] };
    }
    case "quote": {
      const quoteLines = body.map((chunk) => chunk.value.match(/^\s*>\s?(.*)$/)?.[1]);
      if (quoteLines.some((line) => line === undefined)) {
        issues.push({ line: startLine, message: "quote 的每一行都必须以 “>” 开始。" });
        return null;
      }
      const values = quoteLines as string[];
      const last = values.at(-1) ?? "";
      const attribution = last.startsWith("— ") ? last.slice(2).trim() : undefined;
      return {
        ...base,
        type: "quote",
        quote: (attribution ? values.slice(0, -1) : values).join("\n").trim(),
        ...(attribution ? { attribution } : {}),
      };
    }
    case "table": {
      if (body.length < 3) {
        issues.push({ line: startLine, message: "table 至少需要表头、分隔行和一行数据。" });
        return null;
      }
      const columns = parseTableRow(body[0].value);
      const separator = parseTableRow(body[1].value);
      if (
        separator.length !== columns.length ||
        separator.some((cell) => !/^:?-{3,}:?$/.test(cell))
      ) {
        issues.push({ line: body[1].line, message: "table 分隔行格式或列数错误。" });
        return null;
      }
      const rows = body.slice(2).map((chunk) => parseTableRow(chunk.value));
      if (rows.some((row) => row.length !== columns.length)) {
        issues.push({ line: startLine, message: "table 的所有数据行必须与表头列数一致。" });
        return null;
      }
      return { ...base, type: "table", columns, rows };
    }
    case "comparison":
    case "process":
    case "metrics":
    case "chart":
    case "diagram": {
      if (body[0]?.value.trim() !== "```content-block" || body.at(-1)?.value.trim() !== "```") {
        issues.push({
          line: startLine,
          message: `${marker.type} 必须使用 \`\`\`content-block JSON fenced block。`,
        });
        return null;
      }
      try {
        const value = JSON.parse(body.slice(1, -1).map((chunk) => chunk.value).join("\n"));
        if (value?.type !== marker.type) {
          issues.push({ line: startLine, message: "JSON fenced block 的 type 与块标记不一致。" });
          return null;
        }
        return { ...value, ...base } as ContentBlock;
      } catch (error) {
        issues.push({
          line: startLine,
          message: `JSON fenced block 无法解析：${error instanceof Error ? error.message : "未知错误"}`,
        });
        return null;
      }
    }
    default:
      issues.push({ line: startLine, message: `不支持的内容块类型：${marker.type}` });
      return null;
  }
};

export const parseContentMarkdown = (
  source: string,
  materialPlan?: MaterialPlanV1 | null,
): MarkdownParseResult => {
  const chunks = splitSource(source);
  const issues: MarkdownIssue[] = [];
  const frontmatter = parseFrontmatter(chunks, issues);
  if (!frontmatter) return { success: false, issues };

  const sections: ContentDocumentV1["sections"] = [];
  let index = frontmatter.endIndex + 1;
  while (index < chunks.length) {
    const chunk = chunks[index];
    if (!chunk.value.trim()) {
      index += 1;
      continue;
    }
    const sectionMatch = chunk.value.match(/^<!--\s*section:(S\d{2,})\s*-->$/);
    if (!sectionMatch) {
      issues.push({ line: chunk.line, message: "章节必须以 <!-- section:S01 --> 开始。" });
      index += 1;
      continue;
    }
    const titleChunk = chunks[index + 1];
    const titleMatch = titleChunk?.value.match(/^##\s+(.+)$/);
    if (!titleMatch) {
      issues.push({ line: titleChunk?.line ?? chunk.line, message: "章节标记后必须紧跟二级标题。" });
      index += 1;
      continue;
    }
    index += 2;
    let objective: string | undefined;
    while (index < chunks.length && !chunks[index].value.trim()) index += 1;
    if (chunks[index]?.value.trim() === "> [!objective]") {
      index += 1;
      const objectiveLines: string[] = [];
      while (index < chunks.length) {
        const match = chunks[index].value.match(/^>\s?(.*)$/);
        if (!match) break;
        objectiveLines.push(match[1]);
        index += 1;
      }
      objective = objectiveLines.join("\n").trim() || undefined;
    }
    if (!objective) {
      issues.push({ line: titleChunk.line, message: "每个章节都必须包含 [!objective] 说明。" });
    }

    const blocks: ContentBlock[] = [];
    while (index < chunks.length) {
      if (chunks[index].value.match(/^<!--\s*section:/)) break;
      if (!chunks[index].value.trim()) {
        index += 1;
        continue;
      }
      if (!chunks[index].value.match(/^<!--\s*block:/)) {
        issues.push({ line: chunks[index].line, message: "章节内只允许内容块标记及其内容。" });
        index += 1;
        continue;
      }
      const marker = parseBlockMarker(chunks[index], issues);
      index += 1;
      const bodyStart = index;
      while (
        index < chunks.length &&
        !chunks[index].value.match(/^<!--\s*(?:block:|section:)/)
      ) {
        index += 1;
      }
      if (marker) {
        const block = parseNaturalBlock(marker, chunks.slice(bodyStart, index), issues);
        if (block) blocks.push(block);
      }
    }
    sections.push({
      id: sectionMatch[1],
      title: titleMatch[1].trim(),
      objective: objective ?? "",
      blocks,
    });
  }

  const candidate = { ...frontmatter.data, sections };
  const parsed = ContentDocumentSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({ line: 1, message: `${issue.path.join(".") || "document"}：${issue.message}` });
    }
  }
  if (materialPlan && parsed.success) {
    const validEvidenceIds = new Set(materialPlan.facts.map((fact) => fact.id));
    for (const section of parsed.data.sections) {
      for (const block of section.blocks) {
        for (const evidenceRef of block.evidenceRefs) {
          if (!validEvidenceIds.has(evidenceRef)) {
            issues.push({
              line: 1,
              message: `${block.id} 引用了材料计划中不存在的证据 ${evidenceRef}。`,
            });
          }
        }
      }
    }
  }

  if (!parsed.success || issues.length > 0) return { success: false, issues };
  const markdown = serializeContentDocument(parsed.data);
  return { success: true, document: parsed.data, markdown, issues: [] };
};
