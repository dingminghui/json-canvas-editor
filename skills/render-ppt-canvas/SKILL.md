---
name: render-ppt-canvas
description: Plan and render validated presentation structures into editable CanvasDocument slide decks. Use when generating a visual plan, selecting slide layout variants, mapping semantic PPT content blocks to canvas elements, validating rendered slides, or preparing an AI-generated deck for the existing JSON canvas editor and PPTX export.
---

# Render PPT Canvas

Turn a validated `ppt-structure/v1` document into a stable, editable canvas deck without asking a language model to invent coordinates.

## Required references

1. Read [visual-plan-contract.md](references/visual-plan-contract.md) before requesting a visual plan.
2. Read [canvas-contract.md](references/canvas-contract.md) before generating `CanvasDocument`.
3. Read [rendering-rules.md](references/rendering-rules.md) before selecting layout variants or mapping content blocks.
4. Read [runtime-prompt.md](references/runtime-prompt.md) when calling an external language model.
5. Read [visual-review-prompt.md](references/visual-review-prompt.md) before reviewing rendered slide images.

## Workflow

1. Validate the incoming `PptStructureV1`.
2. Register user-provided image assets before visual planning, including stable IDs, descriptions, and credits.
3. Ask the language model for one constrained `PptVisualPlanV2` that uses native editable visual grammar and may reference only registered assets.
4. Validate page count, slide IDs, block references, asset references, colors, fonts, design-system tokens, variants, density, rhythm, primary visual, and composition.
5. Repair the visual plan once when validation fails.
6. Resolve accessible theme colors, typography, grid, motif, media treatment, and deterministic compositions.
7. Select a deterministic slide renderer for every role and content-block combination, including native charts and diagrams.
8. Generate one top-level group and one full-page background per slide.
9. Validate element IDs, finite geometry, page bounds, image references, group structure, and supported element types.
10. Render low-resolution previews for every slide and ask the same multimodal model for one constrained visual review.
11. Validate the review, apply only the declared VisualPlan revisions, and render the reviewed plan once.
12. Persist the reviewed visual plan, asset manifest, review ledger, and `CanvasDocument` separately from the semantic structure.
13. Open the result in the existing editor and preserve manual edits.

## Hard rules

- Let the model choose visual intent, never exact coordinates.
- Do not let the model return `CanvasDocument`, SVG, PPTX, image prompts, arbitrary image URLs, or executable code.
- Only reference and render user-provided images that were registered before visual planning.
- Treat image selection, focal point, crop, and treatment as explicit visual-plan decisions.
- Do not change semantic facts while planning visuals.
- Use deterministic TypeScript for IDs, geometry, overflow safeguards, canvas validation, and storage.
- Keep every leaf element inside the `1600 × 900` page.
- Include a locked full-size background rectangle on every slide.
- Consume every declared layout, rhythm, primary-visual, composition, emphasis, and table-style decision in deterministic rendering.
- Treat slide previews as ephemeral review inputs; never persist API keys or base64 preview images.
- Keep visual review revisions inside `PptVisualPlanV2`; do not let review alter source facts or Canvas coordinates.
- Limit visual review to one model-guided revision pass so generation cannot enter an unbounded loop.
- Prefer flat editorial composition, typography, registered images, native charts, native tables, shapes, and connectors over repeated card grids.
- Preserve the source structure and mark existing canvas artifacts stale instead of silently overwriting manual edits.
- Keep API keys in transient memory only.
