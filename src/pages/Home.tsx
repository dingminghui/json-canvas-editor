import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { EditorWorkspace, type EditorWorkspaceHandle } from "@/editor/components/EditorWorkspace";
import { LayerSidebar } from "@/editor/components/LayerSidebar";
import { PropertiesPanel } from "@/editor/components/PropertiesPanel";
import {
  createInitialEditorHistoryState,
  editorHistoryReducer,
  findElementContext,
  getActiveDocument,
  previewDocumentElement,
} from "@/editor/editor-state";
import { isInteractiveTarget } from "@/editor/interaction";
import { EDITOR_TEMPLATES } from "@/editor/templates";
import {
  isLeafElement,
  type CanvasElement,
  type CanvasElementPatch,
  type TextEditingSession,
} from "@/editor/types";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

function createDuplicateId(sourceId: string) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${sourceId}-copy-${suffix}`;
}

export function Home() {
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [elementPreview, setElementPreview] = useState<{
    elementId: string;
    patch: CanvasElementPatch;
  } | null>(null);
  const [textEditing, setTextEditing] = useState<TextEditingSession | null>(null);
  const nextTextEditingSessionIdRef = useRef(0);
  const editorWorkspaceRef = useRef<EditorWorkspaceHandle>(null);
  const [history, dispatch] = useReducer(
    editorHistoryReducer,
    undefined,
    createInitialEditorHistoryState,
  );
  const state = history.present;
  const activeDocument = getActiveDocument(state);
  const displayedDocument = useMemo(
    () =>
      elementPreview
        ? previewDocumentElement(activeDocument, elementPreview.elementId, elementPreview.patch)
        : activeDocument,
    [activeDocument, elementPreview],
  );
  const selectedElementContext = useMemo(
    () => findElementContext(activeDocument.elements, state.selectedId),
    [activeDocument.elements, state.selectedId],
  );
  const selectedElement = selectedElementContext?.element ?? null;
  const displayedSelectedElement =
    selectedElement &&
    isLeafElement(selectedElement) &&
    elementPreview?.elementId === selectedElement.id
      ? { ...selectedElement, ...elementPreview.patch }
      : selectedElement;
  const isSelectedLocked = selectedElementContext?.effectivelyLocked ?? false;
  const documents = useMemo(
    () => EDITOR_TEMPLATES.map((template) => state.documents[template.id]),
    [state.documents],
  );
  const canMutateSelected =
    Boolean(selectedElement && isLeafElement(selectedElement)) && !isSelectedLocked;

  const updateSelectedElement = useCallback(
    (patch: CanvasElementPatch) => {
      if (!state.selectedId || isSelectedLocked) return;
      dispatch({ type: "update-element", elementId: state.selectedId, patch });
    },
    [isSelectedLocked, state.selectedId],
  );

  const selectElement = useCallback((elementId: string | null) => {
    setElementPreview(null);
    dispatch({ type: "select-element", elementId });
  }, []);

  const selectLayerElement = useCallback(
    (elementId: string) => {
      selectElement(elementId);
      editorWorkspaceRef.current?.revealElement(elementId);
    },
    [selectElement],
  );

  const selectTemplate = useCallback((templateId: string) => {
    setHoveredElementId(null);
    setElementPreview(null);
    setTextEditing(null);
    dispatch({ type: "select-template", templateId });
  }, []);

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const reorderElements = useCallback(
    (elements: CanvasElement[]) => dispatch({ type: "reorder-elements", elements }),
    [],
  );
  const toggleLocked = useCallback(
    (elementId: string) => dispatch({ type: "toggle-locked", elementId }),
    [],
  );
  const toggleVisible = useCallback(
    (elementId: string) => dispatch({ type: "toggle-visible", elementId }),
    [],
  );
  const updateElement = useCallback(
    (elementId: string, patch: CanvasElementPatch) => {
      if (findElementContext(activeDocument.elements, elementId)?.effectivelyLocked) return;
      dispatch({ type: "update-element", elementId, patch });
    },
    [activeDocument.elements],
  );
  const previewElement = useCallback((elementId: string, patch: CanvasElementPatch | null) => {
    setElementPreview(patch ? { elementId, patch } : null);
  }, []);
  const setFitMode = useCallback(
    (enabled: boolean) => dispatch({ type: "set-fit-mode", enabled }),
    [],
  );
  const setZoom = useCallback((zoom: number) => dispatch({ type: "set-zoom", zoom }), []);

  const beginTextEditing = useCallback(
    (elementId: string) => {
      const context = findElementContext(activeDocument.elements, elementId);
      if (
        context?.element.type !== "text" ||
        context.effectivelyLocked ||
        !context.effectivelyVisible
      ) {
        return;
      }

      setElementPreview(null);
      dispatch({ type: "select-element", elementId });
      setTextEditing({
        elementId,
        initialText: context.element.text,
        sessionId: ++nextTextEditingSessionIdRef.current,
      });
    },
    [activeDocument.elements],
  );

  const cancelTextEditing = useCallback(() => {
    setTextEditing(null);
  }, []);

  const commitTextEditing = useCallback(
    (sessionId: number, elementId: string, markdown: string) => {
      if (textEditing?.sessionId !== sessionId || textEditing.elementId !== elementId) return;

      setTextEditing(null);
      const context = findElementContext(activeDocument.elements, elementId);
      if (context?.element.type !== "text" || context.effectivelyLocked) return;
      dispatch({ type: "update-element", elementId, patch: { text: markdown } });
    },
    [activeDocument.elements, textEditing],
  );

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (textEditing) {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelTextEditing();
      }
      return;
    }

    if (isInteractiveTarget(event.target)) return;

    if (event.key === "Escape") {
      selectElement(null);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      dispatch({ type: event.shiftKey ? "redo" : "undo" });
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      dispatch({ type: "redo" });
      return;
    }

    if (event.key === "Enter" && selectedElement?.type === "text" && !isSelectedLocked) {
      event.preventDefault();
      beginTextEditing(selectedElement.id);
      return;
    }

    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "d" &&
      canMutateSelected &&
      state.selectedId
    ) {
      event.preventDefault();
      dispatch({
        type: "duplicate-element",
        elementId: state.selectedId,
        duplicateId: createDuplicateId(state.selectedId),
      });
      return;
    }

    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      canMutateSelected &&
      state.selectedId
    ) {
      event.preventDefault();
      dispatch({ type: "delete-element", elementId: state.selectedId });
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <ResizablePanelGroup className="h-dvh w-full bg-background" orientation="horizontal">
      <ResizablePanel
        className="h-full min-w-0"
        defaultSize={240}
        groupResizeBehavior="preserve-pixel-size"
        id="layers-panel"
        maxSize={360}
        minSize={180}
      >
        <aside className="relative z-10 h-full min-w-0 bg-card">
          <LayerSidebar
            document={activeDocument}
            documents={documents}
            onHover={setHoveredElementId}
            onReorder={reorderElements}
            onSelect={selectLayerElement}
            onSelectDocument={selectTemplate}
            onToggleLocked={toggleLocked}
            onToggleVisible={toggleVisible}
            selectedId={state.selectedId}
          />
        </aside>
      </ResizablePanel>

      <ResizableHandle
        aria-label="调整图层栏宽度"
        className="transition-colors duration-150 hover:bg-primary/20 focus-visible:bg-primary/20 data-[resize-handle-active]:bg-primary/20"
      />

      <ResizablePanel className="h-full min-w-0" id="canvas-panel" minSize={480}>
        <EditorWorkspace
          canRedo={history.future.length > 0}
          canUndo={history.past.length > 0}
          document={displayedDocument}
          editingText={textEditing}
          fitMode={state.fitMode}
          hoveredId={hoveredElementId}
          isSelectedLocked={isSelectedLocked}
          manualZoom={state.manualZoomByTemplate[state.activeTemplateId]}
          selectedId={state.selectedId}
          workspaceHandleRef={editorWorkspaceRef}
          onCancelTextEdit={cancelTextEditing}
          onCommitTextEdit={commitTextEditing}
          onEditText={beginTextEditing}
          onElementChange={updateElement}
          onElementPreview={previewElement}
          onSelect={selectElement}
          onSetFitMode={setFitMode}
          onSetZoom={setZoom}
          onRedo={redo}
          onUndo={undo}
        />
      </ResizablePanel>

      <ResizableHandle
        aria-label="调整属性栏宽度"
        className="transition-colors duration-150 hover:bg-primary/20 focus-visible:bg-primary/20 data-[resize-handle-active]:bg-primary/20"
      />

      <ResizablePanel
        className="h-full min-w-0"
        defaultSize={320}
        groupResizeBehavior="preserve-pixel-size"
        id="properties-panel"
        maxSize={440}
        minSize={260}
      >
        <aside className="relative z-10 h-full min-w-0 bg-card">
          <PropertiesPanel
            isLocked={isSelectedLocked}
            selectedElement={displayedSelectedElement}
            onUpdate={updateSelectedElement}
          />
        </aside>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
