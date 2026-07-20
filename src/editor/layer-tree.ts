import { isGroupElement, type CanvasElement } from "@/editor/types";
import type { TreeItem, TreeItems } from "dnd-kit-sortable-tree";

export interface LayerTreeItemData {
  element: CanvasElement;
}

export function createLayerTreeItems(
  elements: CanvasElement[],
  expandedIds: Set<string>,
): TreeItems<LayerTreeItemData> {
  return elements.map((element): TreeItem<LayerTreeItemData> => {
    const isGroup = isGroupElement(element);

    return {
      canHaveChildren: isGroup,
      children: isGroup ? createLayerTreeItems(element.children, expandedIds) : undefined,
      collapsed: isGroup ? !expandedIds.has(element.id) : undefined,
      element,
      id: element.id,
    };
  });
}

export function createCanvasElements(items: TreeItems<LayerTreeItemData>): CanvasElement[] {
  return items.map((item) => {
    const element = item.element;
    if (!isGroupElement(element)) return element;

    const children = createCanvasElements(item.children ?? []);
    const childrenUnchanged =
      children.length === element.children.length &&
      children.every((child, index) => child === element.children[index]);

    if (childrenUnchanged) return element;

    return {
      ...element,
      children,
    };
  });
}
