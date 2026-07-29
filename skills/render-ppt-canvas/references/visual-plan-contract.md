# Visual plan contract

`PptVisualPlanV2` is the only model-generated input accepted by the canvas renderer.

## Deck theme

Require:

- one supported style family, including restrained, editorial, data-led, Swiss, dark, rounded, or brutalist directions;
- seven six-digit hexadecimal colors;
- one supported Chinese heading font and body font;
- one corner treatment.
- one deck grid, type scale, motif, and media policy.

Treat model colors as proposals. Resolve foreground colors locally to maintain readable contrast.

## Slide plans

Require exactly one plan for each source slide, in the same order.

Each plan contains:

- `slideId`;
- one supported `layoutVariant`;
- density: spacious, standard, or compact;
- a short `visualFocus`;
- an optional zero-based `accentBlockIndex`;
- table style: minimal, contrast, or soft.
- page rhythm: anchor, dense, or breathing;
- one primary visual: typography, chart, diagram, table, metrics, or mixed;
- one executable composition selected from the supported composition catalog.
- an optional registered image asset ID;
- one media layout, image treatment, and normalized focal point.

Reject duplicated IDs, missing pages, reordered pages, references to missing content blocks, unsupported variants, unsupported fonts, and invalid colors.

## Responsibility boundary

The visual plan may choose:

- theme tokens;
- layout variants;
- density;
- emphasis;
- table treatment.
- page rhythm and cross-page pacing;
- native editable visual form;
- executable composition.
- registered asset selection, crop focus, and media treatment.

It may not contain:

- coordinates or dimensions;
- canvas elements;
- SVG or drawing commands;
- image prompts, arbitrary image URLs, or asset requests;
- revised presentation facts;
- executable code.
