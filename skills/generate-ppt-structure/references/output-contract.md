# Output contract

Return one JSON object with `schemaVersion: "ppt-structure/v1"`.

## Deck

Describe the title, optional subtitle, language, audience, purpose, core message, delivery context, reading mode, narrative mode, and exact page count.

## Sections

Create ordered sections with a stable ID, title, objective, and the ordered slide IDs that belong to the section.

## Slides

Each slide must contain:

- `id` and one-based `index`
- `sectionId`
- semantic `role`
- preferred `title`
- one `coreMessage`
- `audienceMove.before` and `audienceMove.after`
- semantic `layoutIntent`
- one or more `contentBlocks`
- optional `speakerNotes`

Available content-block types are `paragraph`, `bullet-list`, `numbered-list`, `comparison`, `process`, `metrics`, `quote`, `table`, `chart`, and `diagram`.

- `chart` preserves categories, numeric series, the relationship (`comparison`, `trend`, or `part-to-whole`), and one takeaway.
- `diagram` preserves explicit nodes, edges, and the relationship (`process`, `hierarchy`, `cycle`, `system`, or `cause-effect`).

Use the title, core message, and first semantic block to expose a concrete communication hook. Covers, section anchors, and closing pages must not rely on generic topic labels alone.

The runtime-provided JSON Schema is authoritative for exact fields, enums, limits, and nesting.
