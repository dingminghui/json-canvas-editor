import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EditorIconButton } from "@/editor/components/EditorIconButton";
import {
  createCanvasElements,
  createLayerTreeItems,
  type LayerTreeItemData,
} from "@/editor/layer-tree";
import { isGroupElement, type CanvasElement } from "@/editor/types";
import { cn } from "@/lib/utils";
import type { DndContextProps } from "@dnd-kit/core";
import {
  SimpleTreeItemWrapper,
  SortableTree,
  type TreeItemComponentProps,
} from "dnd-kit-sortable-tree";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers3,
  Lock,
  Minus,
  MoveUpRight,
  Square,
  Star,
  Triangle,
  Type,
  Unlock,
} from "lucide-react";
import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

interface LayerTreeProps {
  elements: CanvasElement[];
  selectedId: string | null;
  onHover: (elementId: string | null) => void;
  onSelect: (elementId: string) => void;
  onToggleVisible: (elementId: string) => void;
  onToggleLocked: (elementId: string) => void;
  onReorder: (elements: CanvasElement[]) => void;
}

interface LayerTreeItemActions {
  selectedId: string | null;
  onHover: (elementId: string | null) => void;
  onSelect: (elementId: string) => void;
  onToggleVisible: (elementId: string) => void;
  onToggleLocked: (elementId: string) => void;
}

const LayerTreeActionsContext = createContext<LayerTreeItemActions | null>(null);
const LAYER_INDENTATION_WIDTH = 12;
const DND_CONTEXT_PROPS = {
  accessibility: {
    announcements: {
      onDragCancel: ({ active }) => `已取消移动图层 ${active.id}。`,
      onDragEnd: ({ active, over }) =>
        over ? `图层 ${active.id} 已移动到 ${over.id}。` : `图层 ${active.id} 未移动。`,
      onDragOver: ({ active, over }) =>
        over ? `图层 ${active.id} 当前位于 ${over.id}。` : undefined,
      onDragStart: ({ active }) => `已开始移动图层 ${active.id}。`,
    },
    screenReaderInstructions: {
      draggable: "按空格键开始拖动，使用方向键移动，再按空格键放置。按 Escape 键取消。",
    },
  },
} satisfies DndContextProps;
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 4 } } as const;

function collectGroupIds(elements: CanvasElement[]): string[] {
  return elements.flatMap((element) =>
    isGroupElement(element) ? [element.id, ...collectGroupIds(element.children)] : [],
  );
}

function getElementIcon(element: CanvasElement, selected: boolean): ReactNode {
  const props = {
    className: cn("size-3.5 flex-none text-muted-foreground", selected && "text-primary"),
    strokeWidth: 1.75,
  };
  switch (element.type) {
    case "group":
      return <Layers3 {...props} />;
    case "text":
      return <Type {...props} />;
    case "rect":
      return <Square {...props} />;
    case "circle":
      return <Circle {...props} />;
    case "ellipse":
      return <Circle {...props} className={cn(props.className, "scale-x-125")} />;
    case "line":
      return <Minus {...props} />;
    case "arrow":
      return <MoveUpRight {...props} />;
    case "polygon":
      return <Triangle {...props} />;
    case "star":
      return <Star {...props} />;
    case "image":
      return <ImageIcon {...props} />;
    default: {
      const exhaustiveElement: never = element;
      return exhaustiveElement;
    }
  }
}

const LayerTreeItem = forwardRef<HTMLDivElement, TreeItemComponentProps<LayerTreeItemData>>(
  function LayerTreeItem(props, ref) {
    const actions = useContext(LayerTreeActionsContext);
    const element = props.item.element;
    const isGroup = isGroupElement(element);
    const dragHandleProps = props.handleProps as ComponentProps<"button">;
    const indentWidth = props.depth * LAYER_INDENTATION_WIDTH;
    const selected = actions?.selectedId === element.id;

    if (!actions) return null;

    return (
      <SimpleTreeItemWrapper
        {...props}
        className={cn(
          "m-0! box-border w-max min-w-full max-w-none",
          props.ghost && "opacity-0",
          props.clone && "w-auto max-w-none p-0!",
        )}
        contentClassName={cn(
          "w-max min-w-full max-w-none border-0! bg-transparent! p-0! text-inherit!",
          props.clone && "rounded-none shadow-none",
        )}
        disableCollapseOnItemClick
        indentationWidth={0}
        manualDrag
        ref={ref}
        showDragHandle={false}
      >
        <div
          aria-selected={selected}
          className={cn(
            "group/layer flex min-h-8 w-max min-w-full items-center gap-0 rounded-[calc(var(--radius-sm)-4px)] bg-card py-px pr-0 pl-0.5 transition-[background-color,box-shadow,color] duration-100 hover:bg-[color-mix(in_oklch,var(--muted)_82%,var(--card))]",
            selected && "bg-[var(--selection-background)] shadow-[inset_2px_0_0_var(--primary)]",
            props.clone &&
              "min-h-7 w-auto rounded-sm border-0 bg-popover px-[7px] py-[3px] shadow-[0_8px_20px_color-mix(in_oklch,var(--foreground)_7%,transparent)]",
            props.isOver &&
              "bg-[var(--selection-background)] shadow-[inset_0_-2px_0_var(--primary)]",
            props.isOverParent &&
              "bg-[color-mix(in_oklch,var(--selection-background)_70%,transparent)]",
          )}
          data-slot="layer-row"
          data-clone={props.clone}
          data-dragging={props.ghost}
          data-element-id={element.id}
          data-over={props.isOver}
          data-over-parent={props.isOverParent}
          data-selected={selected}
          data-type={element.type}
          role="treeitem"
          tabIndex={props.clone ? -1 : 0}
          onClick={() => {
            if (!props.clone) actions.onSelect(element.id);
          }}
          onKeyDown={(event) => {
            if (
              !props.clone &&
              event.target === event.currentTarget &&
              (event.key === "Enter" || event.key === " ")
            ) {
              event.preventDefault();
              actions.onSelect(element.id);
            }
          }}
          onMouseEnter={() => {
            if (!props.clone) actions.onHover(element.id);
          }}
          onMouseLeave={() => {
            if (!props.clone) actions.onHover(null);
          }}
        >
          {props.clone ? null : (
            <span
              aria-hidden="true"
              className="block h-px flex-none"
              data-slot="layer-indent-spacer"
              style={{ width: indentWidth }}
            />
          )}

          {props.clone ? null : isGroup ? (
            <Button
              aria-label={props.collapsed ? `展开 ${element.name}` : `收起 ${element.name}`}
              className="flex-none"
              size="icon-xs"
              type="button"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                props.onCollapse?.();
              }}
            >
              {props.collapsed ? (
                <ChevronRight size={14} strokeWidth={1.75} />
              ) : (
                <ChevronDown size={14} strokeWidth={1.75} />
              )}
            </Button>
          ) : (
            <span aria-hidden="true" className="block size-6 flex-none" />
          )}

          <Button
            {...dragHandleProps}
            className={cn(
              "h-7 w-auto min-w-0 flex-none cursor-grab touch-none justify-start gap-1.5 px-[3px] text-foreground active:cursor-grabbing",
              props.clone && "w-auto max-w-60 flex-initial",
            )}
            type="button"
            variant="ghost"
          >
            {getElementIcon(element, selected)}
            <span
              className={cn(
                "w-max flex-none text-left text-xs whitespace-nowrap",
                selected && "text-primary",
              )}
            >
              {element.name}
            </span>
          </Button>

          {props.clone ? null : (
            <div
              className="sticky right-0 ml-auto flex flex-none gap-0 bg-inherit pr-0.5 pl-1"
              data-slot="layer-row-actions"
            >
              <EditorIconButton
                className={cn(
                  "size-6 opacity-0 transition-opacity duration-100 pointer-events-none group-hover/layer:pointer-events-auto group-hover/layer:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100",
                  !element.visible && "pointer-events-auto opacity-100",
                )}
                label={element.visible ? `隐藏 ${element.name}` : `显示 ${element.name}`}
                tooltip={element.visible ? "隐藏" : "显示"}
                onPress={() => actions.onToggleVisible(element.id)}
              >
                {element.visible ? (
                  <Eye size={12} strokeWidth={1.75} />
                ) : (
                  <EyeOff size={12} strokeWidth={1.75} />
                )}
              </EditorIconButton>
              <EditorIconButton
                className={cn(
                  "size-6 opacity-0 transition-opacity duration-100 pointer-events-none group-hover/layer:pointer-events-auto group-hover/layer:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100",
                  element.locked && "pointer-events-auto opacity-100",
                )}
                label={element.locked ? `解锁 ${element.name}` : `锁定 ${element.name}`}
                tooltip={element.locked ? "解锁" : "锁定"}
                onPress={() => actions.onToggleLocked(element.id)}
              >
                {element.locked ? (
                  <Lock className="h-[15px]! w-[13px]!" strokeWidth={1.75} />
                ) : (
                  <Unlock className="h-[15px]! w-[13px]!" strokeWidth={1.75} />
                )}
              </EditorIconButton>
            </div>
          )}
        </div>
      </SimpleTreeItemWrapper>
    );
  },
);

export function LayerTree({
  elements,
  selectedId,
  onHover,
  onSelect,
  onToggleVisible,
  onToggleLocked,
  onReorder,
}: LayerTreeProps) {
  const [expandedIds, setExpandedIds] = useState(() => new Set(collectGroupIds(elements)));
  const items = useMemo(() => createLayerTreeItems(elements, expandedIds), [elements, expandedIds]);

  const actions = useMemo(
    () => ({ selectedId, onHover, onSelect, onToggleVisible, onToggleLocked }),
    [onHover, onSelect, onToggleLocked, onToggleVisible, selectedId],
  );

  return (
    <ScrollArea className="min-h-0 max-h-none flex-1 px-2 pt-1.5 pb-3" scrollbars="both">
      <div className="w-max min-w-full p-0 [&>ul]:m-0 [&>ul]:w-max [&>ul]:min-w-full [&>ul]:p-0">
        <LayerTreeActionsContext.Provider value={actions}>
          <SortableTree
            TreeItemComponent={LayerTreeItem}
            dndContextProps={DND_CONTEXT_PROPS}
            indentationWidth={LAYER_INDENTATION_WIDTH}
            indicator
            items={items}
            keepGhostInPlace
            pointerSensorOptions={POINTER_SENSOR_OPTIONS}
            onItemsChanged={(nextItems, reason) => {
              if (reason.type === "collapsed" || reason.type === "expanded") {
                const groupId = String(reason.item.id);
                setExpandedIds((current) => {
                  const next = new Set(current);
                  if (reason.type === "expanded") next.add(groupId);
                  else next.delete(groupId);
                  return next;
                });
                return;
              }

              if (reason.type === "dropped") onReorder(createCanvasElements(nextItems));
            }}
          />
        </LayerTreeActionsContext.Provider>
      </div>
    </ScrollArea>
  );
}
