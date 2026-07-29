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

## Workflow

1. Validate the incoming `PptStructureV1`.
2. Ask the language model for one constrained `PptVisualPlanV1` that uses only native editable visual grammar.
3. Validate page count, slide IDs, block references, colors, fonts, variants, density, rhythm, primary visual, and composition.
4. Repair the visual plan once when validation fails.
5. Resolve accessible theme colors and typography.
6. Select a deterministic slide renderer for every role and content-block combination, including native charts and diagrams.
7. Generate one top-level group and one full-page background per slide.
8. Validate element IDs, finite geometry, page bounds, group structure, and supported element types.
9. Persist the visual plan and `CanvasDocument` separately from the semantic structure.
10. Open the result in the existing editor and preserve manual edits.

## Hard rules

- Let the model choose visual intent, never exact coordinates.
- Do not let the model return `CanvasDocument`, SVG, PPTX, image prompts, or executable code.
- Do not fetch, generate, reference, or render images.
- Do not change semantic facts while planning visuals.
- Use deterministic TypeScript for IDs, geometry, overflow safeguards, canvas validation, and storage.
- Keep every leaf element inside the `1600 × 900` page.
- Include a locked full-size background rectangle on every slide.
- Consume every declared layout, rhythm, primary-visual, composition, emphasis, and table-style decision in deterministic rendering.
- Prefer typography, native charts, native tables, shapes, and connectors over repeated card grids.
- Preserve the source structure and mark existing canvas artifacts stale instead of silently overwriting manual edits.
- Keep API keys in transient memory only.
