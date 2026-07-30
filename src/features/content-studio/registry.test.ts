import { describe, expect, it } from "vitest";

import {
  LONGFORM_RECIPES,
  PRESENTATION_RECIPES,
  RECIPE_REGISTRY,
  getRecipeCapacityIssues,
} from "./recipes";
import {
  LONGFORM_RECIPE_IDS,
  PRESENTATION_RECIPE_IDS,
  STYLE_PACK_IDS,
} from "./schema";
import { STYLE_PACK_LIST } from "./style-packs";

const luminance = (color: string) => {
  const components = color
    .slice(1)
    .match(/.{2}/g)
    ?.map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  if (!components || components.length !== 3) return 0;
  return components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722;
};

const contrast = (foreground: string, background: string) => {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

describe("StylePack and Recipe registries", () => {
  it("registers six complete, visually distinct StylePacks with readable body text", () => {
    expect(STYLE_PACK_LIST.map((pack) => pack.id)).toEqual(STYLE_PACK_IDS);
    expect(
      new Set(
        STYLE_PACK_LIST.map(
          (pack) =>
            `${pack.backgroundMotif}:${pack.shape.radius}:${pack.shape.borderWidth}:${pack.shape.shadow.blur}:${pack.fonts.display}`,
        ),
      ).size,
    ).toBe(STYLE_PACK_LIST.length);
    for (const pack of STYLE_PACK_LIST) {
      expect(contrast(pack.colors.text, pack.colors.canvas)).toBeGreaterThanOrEqual(4.5);
      expect(pack.chart.palette.length).toBeGreaterThanOrEqual(5);
      expect(pack.typeScale.hero).toBeGreaterThan(pack.typeScale.body);
      expect(pack.spacing.page).toBeGreaterThan(pack.spacing.inline);
    }
  });

  it("covers every registered recipe ID with deterministic capacity metadata", () => {
    expect(PRESENTATION_RECIPES.map((recipe) => recipe.id)).toEqual(PRESENTATION_RECIPE_IDS);
    expect(LONGFORM_RECIPES.map((recipe) => recipe.id)).toEqual(LONGFORM_RECIPE_IDS);
    expect(RECIPE_REGISTRY).toHaveLength(
      PRESENTATION_RECIPE_IDS.length + LONGFORM_RECIPE_IDS.length,
    );
    for (const recipe of RECIPE_REGISTRY) {
      expect(recipe.renderer).toBe(recipe.id);
      expect(recipe.roles.length).toBeGreaterThan(0);
      expect(recipe.blockTypes.length).toBeGreaterThan(0);
      expect(recipe.capacity.maxCharacters).toBeGreaterThan(0);
    }
  });

  it("reports content and image capacity overflow", () => {
    expect(
      getRecipeCapacityIssues("cover-editorial", {
        blockCount: 3,
        characterCount: 500,
        itemCount: 8,
        imageCount: 2,
      }),
    ).toHaveLength(4);
  });
});
