---
name: plan-canvas-visual
description: Select registered StylePacks, assets, and LayoutRecipes, render deterministic PPT or longform Canvas documents, and perform one constrained visual review.
---

# Plan Canvas Visual

Create the visual plan and deterministic editable Canvas artifact for one output structure.

## Workflow

1. Recommend exactly one registered StylePack and require user confirmation.
2. Plan at most six Pexels search requests with English queries and output-node purposes.
3. Require the user to select or skip every request. Never substitute an unconfirmed image.
4. Ask the model for `VisualPlanV1`: registered Recipe IDs, density, emphasis block, asset ID, media placement, and normalized focal point only.
5. Normalize Recipe choices deterministically: treat role matching as a preference, replace content-incompatible IDs with the closest compatible registered Recipe, and avoid three consecutive repeats.
6. If JSON validation fails, allow exactly one repair request.
7. Render coordinates deterministically with native text, shapes, tables, charts, diagrams, images, attribution, strokes, opacity, and shadows.
8. Validate finite geometry, bounds, safe text areas, required assets, credits, and longform height.
9. Capture page previews for PPT or overview plus vertical segments for longform.
10. Allow at most one model review revision, constrained to VisualPlan fields, then rerender once.
11. Persist project, Blob assets, and artifact separately in IndexedDB.

## Hard rules

- The model never emits colors, arbitrary style values, CSS, Canvas coordinates, CanvasDocument, SVG, PPTX, or executable code.
- Do not change ContentDocument facts or OutputStructure block references.
- Do not use gradients or export-unstable filters in v1.
- Use `asset://<assetId>` and resolve it only at Canvas/PPTX export boundaries.
- Include `Photo: author / Pexels` on every output node using a Pexels image.
- Keep Recipe capacity and actual Canvas geometry as hard safety checks; do not fail solely because a content-compatible Recipe is registered under a different preferred role.
- Do not persist API keys, search candidates, or preview images.
- Preserve manually edited Canvas artifacts; require explicit confirmation before replacement.
