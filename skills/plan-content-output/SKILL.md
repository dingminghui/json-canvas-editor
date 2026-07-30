---
name: plan-content-output
description: Plan a validated PPT or longform output structure from a confirmed ContentDocument without changing facts or generating visual coordinates.
---

# Plan Content Output

Convert a confirmed `ContentDocumentV1` into exactly one output carrier.

## Workflow

1. Require a successfully applied canonical Markdown revision.
2. Choose one `outputType`: `pptx` or `longform`.
3. For PPT, create 4–20 sequential `Pxx` pages at fixed `1600 × 900`.
4. For longform, create sequential `Rxx` regions at fixed width `1080` and maximum height `12000`.
5. Give every node one role, title, core message, and one or more existing block references.
6. For PPT, include audience movement and optional speaker notes.
7. Normalize block references deterministically: remove unknown IDs, remove avoidable duplicates, and assign every missing ContentDocument block to the least-loaded node.
8. If validation fails, allow exactly one repair request and validate again.

## Hard rules

- Do not copy, summarize, split, merge, or rewrite factual content during output planning.
- Do not create StylePack, Recipe, asset, CSS, color, coordinate, Canvas, or export data.
- Every ContentDocument block must appear at least once. Duplicate references are allowed only when the carrier requires more non-empty nodes than the document has blocks.
- A project owns one output type after Canvas generation. The other carrier requires project duplication.
- Keep PPT and longform reading rhythms materially different.
