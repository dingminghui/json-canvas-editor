import { findElement } from "@/editor/editor-state";
import {
  createCanvasElements,
  createLayerTreeItems,
  type LayerTreeItemData,
} from "@/editor/layer-tree";
import { EDITOR_TEMPLATES } from "@/editor/templates";
import { isGroupElement } from "@/editor/types";
import type { TreeItem, TreeItems } from "dnd-kit-sortable-tree";

function findTreeItem(
  items: TreeItems<LayerTreeItemData>,
  itemId: string,
): TreeItem<LayerTreeItemData> | null {
  for (const item of items) {
    if (item.id === itemId) return item;
    const child = findTreeItem(item.children ?? [], itemId);
    if (child) return child;
  }
  return null;
}

describe("layer tree conversion", () => {
  it("reuses unchanged groups when the hierarchy did not move", () => {
    const elements = structuredClone(EDITOR_TEMPLATES[0].elements);
    const items = createLayerTreeItems(elements, new Set());
    const rebuiltElements = createCanvasElements(items);

    expect(rebuiltElements).not.toBe(elements);
    expect(rebuiltElements).toEqual(elements);
    expect(rebuiltElements.every((element, index) => element === elements[index])).toBe(true);
  });

  it("rebuilds a cross-group hierarchy without changing element properties", () => {
    const elements = structuredClone(EDITOR_TEMPLATES[0].elements);
    const items = createLayerTreeItems(elements, new Set(["story-hero-group", "chapter-1-group"]));
    const heroGroup = findTreeItem(items, "story-hero-group");
    const chapterGroup = findTreeItem(items, "chapter-1-group");
    const title = findTreeItem(items, "story-title");

    expect(heroGroup?.canHaveChildren).toBe(true);
    expect(title?.canHaveChildren).toBe(false);
    expect(heroGroup?.children).toContain(title);
    if (!heroGroup || !chapterGroup || !title) return;

    heroGroup.children = heroGroup.children?.filter((item) => item.id !== title.id);
    chapterGroup.children = [title, ...(chapterGroup.children ?? [])];

    const nextElements = createCanvasElements(items);
    const nextHeroGroup = findElement(nextElements, "story-hero-group");
    const nextChapterGroup = findElement(nextElements, "chapter-1-group");
    const nextTitle = findElement(nextElements, "story-title");

    expect(
      nextChapterGroup && isGroupElement(nextChapterGroup)
        ? nextChapterGroup.children.map((element) => element.id)
        : [],
    ).toContain("story-title");
    expect(
      nextHeroGroup && isGroupElement(nextHeroGroup)
        ? nextHeroGroup.children.map((element) => element.id)
        : [],
    ).not.toContain("story-title");
    expect(nextTitle).toMatchObject({
      id: "story-title",
      type: "text",
      x: 140,
      y: 144,
    });
  });
});
