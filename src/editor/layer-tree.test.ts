import { findElement } from "@/editor/editor-state";
import {
  createCanvasElements,
  createLayerTreeItems,
  type LayerTreeItemData,
} from "@/editor/layer-tree";
import { isGroupElement } from "@/editor/types";
import { EDITOR_TEST_DOCUMENTS } from "@/test/fixtures/editor-documents";
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
    const elements = structuredClone(EDITOR_TEST_DOCUMENTS[0].elements);
    const items = createLayerTreeItems(elements, new Set());
    const rebuiltElements = createCanvasElements(items);

    expect(rebuiltElements).not.toBe(elements);
    expect(rebuiltElements).toEqual(elements);
    expect(rebuiltElements.every((element, index) => element === elements[index])).toBe(true);
  });

  it("rebuilds a cross-group hierarchy without changing element properties", () => {
    const elements = structuredClone(EDITOR_TEST_DOCUMENTS[0].elements);
    const items = createLayerTreeItems(
      elements,
      new Set(["test-cover-group", "test-chapter-group"]),
    );
    const heroGroup = findTreeItem(items, "test-cover-group");
    const chapterGroup = findTreeItem(items, "test-chapter-group");
    const title = findTreeItem(items, "test-title");

    expect(heroGroup?.canHaveChildren).toBe(true);
    expect(title?.canHaveChildren).toBe(false);
    expect(heroGroup?.children).toContain(title);
    if (!heroGroup || !chapterGroup || !title) return;

    heroGroup.children = heroGroup.children?.filter((item) => item.id !== title.id);
    chapterGroup.children = [title, ...(chapterGroup.children ?? [])];

    const nextElements = createCanvasElements(items);
    const nextHeroGroup = findElement(nextElements, "test-cover-group");
    const nextChapterGroup = findElement(nextElements, "test-chapter-group");
    const nextTitle = findElement(nextElements, "test-title");

    expect(
      nextChapterGroup && isGroupElement(nextChapterGroup)
        ? nextChapterGroup.children.map((element) => element.id)
        : [],
    ).toContain("test-title");
    expect(
      nextHeroGroup && isGroupElement(nextHeroGroup)
        ? nextHeroGroup.children.map((element) => element.id)
        : [],
    ).not.toContain("test-title");
    expect(nextTitle).toMatchObject({
      id: "test-title",
      type: "text",
      x: 452,
      y: 155,
    });
  });
});
