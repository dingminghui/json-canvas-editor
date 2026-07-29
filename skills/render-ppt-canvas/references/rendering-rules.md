# Rendering rules

## Layout routing

- cover: editorial or split cover;
- agenda: numbered list or grid;
- section: full-field statement page;
- title body and title bullets: editorial flow or content cards;
- comparison: paired panels;
- process and timeline: connected horizontal sequence or compact two-row sequence;
- metrics: metric cards;
- chart: native editable chart plus an interpretation rail;
- diagram: deterministic native-shape topology with editable nodes and connectors;
- quote: focused quotation;
- table: editable report table;
- summary and closing: action-oriented closing statement.

Let semantic role and content-block type override an incompatible visual variant.

## Content blocks

- paragraph: body text;
- bullet list: bullet characters and line breaks;
- numbered list: numbered steps;
- comparison: two named panels;
- process: step cards and arrows;
- metrics: individual value cards;
- quote: quotation and attribution;
- table: native table columns, rows, and styles.
- chart: map comparison to bar, trend to line, and part-to-whole to pie while preserving exact source series;
- diagram: map system to hub-and-spoke, hierarchy to layered rows, cycle to a ring, and process/cause-effect to connected sequences.

## Page rhythm and composition

- `breathing`: one dominant statement, metric, or visual hook with generous whitespace;
- `anchor`: one primary visual with supporting interpretation;
- `dense`: compact but structured evidence, never a paragraph dump.

Use asymmetric split, centered statement, modular grid, data-led, relationship-led, report-table, editorial-flow, and action-close compositions only when the renderer has an implemented branch. Do not emit decorative aliases.

Avoid more than two adjacent card-grid pages. Change the information grammar through typography, charts, diagrams, tables, editorial flow, or breathing pages.

Use visual-plan table tokens to choose header fill, cell fill, border weight, typography, and density.

## Overflow safeguards

Apply these in order:

1. reduce font size within a defined minimum;
2. use a denser layout variant;
3. increase the number of rows or columns;
4. report a render issue.

Never silently remove source content. Do not generate negative frames or place elements outside the page.

## Validation

Before saving:

- compare slide IDs with the source structure;
- verify top-level group count;
- verify unique recursive element IDs;
- verify a full-page background on every slide;
- verify finite geometry and page bounds;
- verify supported fonts and element types;
- verify every visual-plan field selected for a slide affected its renderer branch;
- verify charts retain exact category/series lengths and diagram edges reference existing nodes;
- reject invalid artifacts instead of persisting them.
