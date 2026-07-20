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
    const items = createLayerTreeItems(
      elements,
      new Set(["square-photo-group", "square-copy-group"]),
    );
    const photoGroup = findTreeItem(items, "square-photo-group");
    const copyGroup = findTreeItem(items, "square-copy-group");
    const title = findTreeItem(items, "square-title");

    expect(photoGroup?.canHaveChildren).toBe(true);
    expect(title?.canHaveChildren).toBe(false);
    expect(copyGroup?.children).toContain(title);
    if (!photoGroup || !copyGroup || !title) return;

    copyGroup.children = copyGroup.children?.filter((item) => item.id !== title.id);
    photoGroup.children = [title, ...(photoGroup.children ?? [])];

    const nextElements = createCanvasElements(items);
    const nextPhotoGroup = findElement(nextElements, "square-photo-group");
    const nextCopyGroup = findElement(nextElements, "square-copy-group");
    const nextTitle = findElement(nextElements, "square-title");

    expect(
      nextPhotoGroup && isGroupElement(nextPhotoGroup)
        ? nextPhotoGroup.children.map((element) => element.id)
        : [],
    ).toContain("square-title");
    expect(
      nextCopyGroup && isGroupElement(nextCopyGroup)
        ? nextCopyGroup.children.map((element) => element.id)
        : [],
    ).not.toContain("square-title");
    expect(nextTitle).toMatchObject({
      id: "square-title",
      type: "text",
      x: 82,
      y: 802,
    });
  });
});
