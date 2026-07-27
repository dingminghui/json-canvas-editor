import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { EditorWorkspace, type EditorWorkspaceHandle } from "@/editor/components/EditorWorkspace";
import { LayerSidebar } from "@/editor/components/LayerSidebar";
import { PropertiesPanel } from "@/editor/components/PropertiesPanel";
import { SlideOverview } from "@/editor/components/SlideOverview";
import { getDocumentPages } from "@/editor/document-pages";
import {
  createInitialEditorHistoryState,
  editorHistoryReducer,
  findElementContext,
  getActiveDocument,
  getActivePageDocument,
  getActivePageId,
  patchCanvasDocumentElement,
} from "@/editor/editor-state";
import { isInteractiveTarget } from "@/editor/interaction";
import { TEMPLATE_META } from "@/editor/template-meta";
import { EDITOR_TEMPLATES } from "@/editor/templates";
import {
  isLeafElement,
  type CanvasElement,
  type CanvasElementPatch,
  type CanvasLeafElement,
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
import { useNavigate, useParams } from "react-router-dom";

function createDuplicateId(sourceId: string) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${sourceId}-copy-${suffix}`;
}

export function EditorPage() {
  const { id: templateId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const matchedMeta = TEMPLATE_META.find((t) => t.id === templateId);

  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [elementPreview, setElementPreview] = useState<{
    elementId: string;
    patch: CanvasElementPatch;
  } | null>(null);
  const [textEditing, setTextEditing] = useState<TextEditingSession | null>(null);
  const [showSlideOverview, setShowSlideOverview] = useState(false);
  const nextTextEditingSessionIdRef = useRef(0);
  const editorWorkspaceRef = useRef<EditorWorkspaceHandle>(null);
  const [history, dispatch] = useReducer(
    editorHistoryReducer,
    undefined,
    createInitialEditorHistoryState,
  );
  const state = history.present;
  const activeDocument = getActiveDocument(state);
  const activePageId = getActivePageId(state);
  const activePageDocument = getActivePageDocument(state);
  const selectedElementContext = useMemo(
    () => findElementContext(activePageDocument.elements, state.selectedId),
    [activePageDocument.elements, state.selectedId],
  );
  const selectedElement = selectedElementContext?.element ?? null;
  const canvasPageDocument = useMemo(
    () =>
      selectedElement?.type === "text" &&
      elementPreview?.elementId === selectedElement.id &&
      ("width" in elementPreview.patch || "height" in elementPreview.patch)
        ? patchCanvasDocumentElement(
            activePageDocument,
            elementPreview.elementId,
            elementPreview.patch,
          )
        : activePageDocument,
    [activePageDocument, elementPreview, selectedElement],
  );
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

  const addElement = useCallback((element: CanvasLeafElement, editText = false) => {
    setElementPreview(null);
    dispatch({ type: "add-element", element });
    if (editText && element.type === "text") {
      setTextEditing({
        elementId: element.id,
        initialText: element.text,
        sessionId: ++nextTextEditingSessionIdRef.current,
      });
    }
  }, []);

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
    editorWorkspaceRef.current?.cancelCreation();
    setHoveredElementId(null);
    setElementPreview(null);
    setTextEditing(null);
    setShowSlideOverview(false);
    dispatch({ type: "select-template", templateId });
  }, []);

  const selectPage = useCallback((templateId: string, pageId: string) => {
    editorWorkspaceRef.current?.cancelCreation();
    setHoveredElementId(null);
    setElementPreview(null);
    setTextEditing(null);
    setShowSlideOverview(false);
    dispatch({ type: "select-page", templateId, pageId });
  }, []);

  const openSlideOverview = useCallback(() => {
    if (activeDocument.documentType !== "pptx") return;
    editorWorkspaceRef.current?.cancelCreation();
    setHoveredElementId(null);
    setElementPreview(null);
    setTextEditing(null);
    dispatch({ type: "select-element", elementId: null });
    setShowSlideOverview(true);
  }, [activeDocument.documentType]);

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
      if (findElementContext(activePageDocument.elements, elementId)?.effectivelyLocked) return;
      dispatch({ type: "update-element", elementId, patch });
    },
    [activePageDocument.elements],
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
      const context = findElementContext(activePageDocument.elements, elementId);
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
    [activePageDocument.elements],
  );

  const cancelTextEditing = useCallback(() => {
    setTextEditing(null);
  }, []);

  const commitTextEditing = useCallback(
    (sessionId: number, elementId: string, markdown: string) => {
      if (textEditing?.sessionId !== sessionId || textEditing.elementId !== elementId) return;

      setTextEditing(null);
      const context = findElementContext(activePageDocument.elements, elementId);
      if (context?.element.type !== "text" || context.effectivelyLocked) return;
      dispatch({ type: "update-element", elementId, patch: { text: markdown } });
    },
    [activePageDocument.elements, textEditing],
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
      if (showSlideOverview) {
        setShowSlideOverview(false);
        return;
      }
      selectElement(null);
      return;
    }

    if (
      activeDocument.documentType === "pptx" &&
      (event.key === "PageUp" || event.key === "PageDown")
    ) {
      const pages = getDocumentPages(activeDocument);
      const currentIndex = pages.findIndex((page) => page.id === activePageId);
      const direction = event.key === "PageUp" ? -1 : 1;
      const nextPage = pages[Math.min(pages.length - 1, Math.max(0, currentIndex + direction))];
      if (nextPage && nextPage.id !== activePageId) {
        event.preventDefault();
        selectPage(activeDocument.id, nextPage.id);
      }
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

  // 挂载时根据路由参数激活对应模板
  useEffect(() => {
    if (templateId) {
      dispatch({ type: "select-template", templateId });
    }
  }, [templateId]);

  // 如果没有匹配到模板，显示提示并返回首页
  if (!matchedMeta) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg text-muted-foreground">未找到模板：{templateId}</p>
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            onClick={() => navigate("/")}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

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
            pageDocument={activePageDocument}
            documents={documents}
            activePageId={activePageId}
            onHover={setHoveredElementId}
            onOpenOverview={openSlideOverview}
            onReorder={reorderElements}
            onSelect={selectLayerElement}
            onSelectDocument={selectTemplate}
            onSelectPage={selectPage}
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
        {showSlideOverview && activeDocument.documentType === "pptx" ? (
          <SlideOverview
            activePageId={activePageId}
            document={activeDocument}
            onClose={() => setShowSlideOverview(false)}
            onReorderPages={(pageIds) => dispatch({ type: "reorder-pages", pageIds })}
            onSelectPage={(pageId) => selectPage(activeDocument.id, pageId)}
          />
        ) : (
          <EditorWorkspace
            canRedo={history.future.length > 0}
            canUndo={history.past.length > 0}
            document={canvasPageDocument}
            editingText={textEditing}
            exportDocument={activeDocument}
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
            onAddElement={addElement}
            onOpenOverview={openSlideOverview}
            onSelect={selectElement}
            onSetFitMode={setFitMode}
            onSetZoom={setZoom}
            onRedo={redo}
            onUndo={undo}
          />
        )}
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
