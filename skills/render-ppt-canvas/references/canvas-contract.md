# Canvas contract

Generate a `CanvasDocument` with:

- `documentType: "pptx"`;
- width `1600`;
- height `900`;
- one top-level `GroupElement` for each slide;
- no top-level leaf elements.

## Page groups

Use stable IDs derived from document ID and source slide ID. Give every child a unique deterministic ID.

Every page group must contain a locked rectangle with:

- `x: 0`;
- `y: 0`;
- `width: 1600`;
- `height: 900`.

The full background establishes the export coordinate system and prevents page content from being scaled to partial bounds.

## Geometry

Require finite coordinates, sizes, rotation, and opacity. Keep each leaf inside page bounds. Permit zero height only for horizontal line or arrow geometry.

## Supported elements

Prefer:

- `TextElement` for headings, body text, lists, metrics, and quotes;
- `RectElement` for backgrounds, panels, cards, and emphasis;
- `ArrowElement` for process connections;
- `ChartElement` for editable category comparisons, trends, and part-to-whole data;
- `TableElement` for editable tabular content.

Do not introduce `ImageElement` in this rendering workflow.

## Persistence

Store the canvas artifact separately from `PptProjectV1`. Include the source project update time, visual plan, renderer version, model version, and edited document. Mark the artifact stale when the semantic project update time changes.
