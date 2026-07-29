import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  type EditorHistoryAction,
  type EditorHistoryState,
} from "@/editor/editor-state";
import { isInteractiveTarget } from "@/editor/interaction";
import {
  isLeafElement,
  type CanvasDocument,
  type CanvasElement,
  type CanvasElementPatch,
  type CanvasLeafElement,
  type TextEditingSession,
} from "@/editor/types";
import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

function createDuplicateId(sourceId: string) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${sourceId}-copy-${suffix}`;
}

interface JsonCanvasEditorCommonProps {
  /** Document selected when the editor is first mounted. */
  initialDocumentId?: string;
  /** Prevents document mutations while keeping navigation and export available. */
  readOnly?: boolean;
  className?: string;
  style?: CSSProperties;
  onActiveDocumentChange?: (documentId: string) => void;
  /** Overrides the built-in PNG/PPTX download behavior. */
  onExport?: (document: CanvasDocument) => void | Promise<void>;
}

interface JsonCanvasEditorControlledProps {
  value: readonly CanvasDocument[];
  defaultValue?: never;
  onChange: (documents: CanvasDocument[]) => void;
}

interface JsonCanvasEditorUncontrolledProps {
  value?: never;
  defaultValue: readonly CanvasDocument[];
  onChange?: (documents: CanvasDocument[]) => void;
}

export type JsonCanvasEditorProps = JsonCanvasEditorCommonProps &
  (JsonCanvasEditorControlledProps | JsonCanvasEditorUncontrolledProps);

function getDocumentList(history: EditorHistoryState): CanvasDocument[] {
  return Object.values(history.present.documents);
}

function documentsMatch(
  currentDocuments: Record<string, CanvasDocument>,
  nextDocuments: readonly CanvasDocument[],
) {
  const currentIds = Object.keys(currentDocuments);
  return (
    currentIds.length === nextDocuments.length &&
    nextDocuments.every((document) => currentDocuments[document.id] === document)
  );
}

export function JsonCanvasEditor({
  value,
  defaultValue,
  initialDocumentId,
  readOnly = false,
  className,
  style,
  onActiveDocumentChange,
  onChange,
  onExport,
}: JsonCanvasEditorProps) {
  const initialDocuments = value ?? defaultValue;

  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [elementPreview, setElementPreview] = useState<{
    elementId: string;
    patch: CanvasElementPatch;
  } | null>(null);
  const [propertyPreview, setPropertyPreview] = useState<{
    elementId: string;
    patch: CanvasElementPatch;
  } | null>(null);
  const [textEditing, setTextEditing] = useState<TextEditingSession | null>(null);
  const [showSlideOverview, setShowSlideOverview] = useState(false);
  const nextTextEditingSessionIdRef = useRef(0);
  const editorWorkspaceRef = useRef<EditorWorkspaceHandle>(null);
  const [history, setHistory] = useState(() =>
    createInitialEditorHistoryState(initialDocuments, initialDocumentId),
  );
  const historyRef = useRef(history);

  const applyAction = useCallback(
    (action: EditorHistoryAction) => {
      const currentHistory = historyRef.current;
      const nextHistory = editorHistoryReducer(currentHistory, action);
      if (nextHistory === currentHistory) return;

      historyRef.current = nextHistory;
      setHistory(nextHistory);
      if (nextHistory.present.documents !== currentHistory.present.documents) {
        onChange?.(getDocumentList(nextHistory));
      }
    },
    [onChange],
  );

  useEffect(() => {
    if (!value || documentsMatch(historyRef.current.present.documents, value)) return;

    const currentDocumentId = historyRef.current.present.activeTemplateId;
    const nextHistory = createInitialEditorHistoryState(
      value,
      value.some((document) => document.id === currentDocumentId)
        ? currentDocumentId
        : initialDocumentId,
    );
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    setHoveredElementId(null);
    setElementPreview(null);
    setPropertyPreview(null);
    setTextEditing(null);
    setShowSlideOverview(false);
  }, [initialDocumentId, value]);

  const state = history.present;
  const activeDocument = getActiveDocument(state);
  const activePageId = getActivePageId(state);
  const activePageDocument = getActivePageDocument(state);
  const selectedElementContext = useMemo(
    () => findElementContext(activePageDocument.elements, state.selectedId),
    [activePageDocument.elements, state.selectedId],
  );
  const selectedElement = selectedElementContext?.element ?? null;
  const canvasPageDocument = useMemo(() => {
    const propertyPreviewDocument =
      selectedElement && propertyPreview?.elementId === selectedElement.id
        ? patchCanvasDocumentElement(
            activePageDocument,
            propertyPreview.elementId,
            propertyPreview.patch,
          )
        : activePageDocument;

    return selectedElement?.type === "text" &&
      elementPreview?.elementId === selectedElement.id &&
      ("width" in elementPreview.patch || "height" in elementPreview.patch)
      ? patchCanvasDocumentElement(
          propertyPreviewDocument,
          elementPreview.elementId,
          elementPreview.patch,
        )
      : propertyPreviewDocument;
  }, [activePageDocument, elementPreview, propertyPreview, selectedElement]);
  const displayedSelectedElement =
    selectedElement &&
    isLeafElement(selectedElement) &&
    (elementPreview?.elementId === selectedElement.id ||
      propertyPreview?.elementId === selectedElement.id)
      ? {
          ...selectedElement,
          ...(elementPreview?.elementId === selectedElement.id ? elementPreview.patch : {}),
          ...(propertyPreview?.elementId === selectedElement.id ? propertyPreview.patch : {}),
        }
      : selectedElement;
  const isSelectedLocked = selectedElementContext?.effectivelyLocked ?? false;
  const documents = useMemo(() => Object.values(state.documents), [state.documents]);
  const canMutateSelected =
    Boolean(selectedElement && isLeafElement(selectedElement)) && !isSelectedLocked && !readOnly;

  const updateSelectedElement = useCallback(
    (patch: CanvasElementPatch) => {
      if (!state.selectedId || isSelectedLocked || readOnly) return;
      applyAction({ type: "update-element", elementId: state.selectedId, patch });
    },
    [applyAction, isSelectedLocked, readOnly, state.selectedId],
  );
  const previewSelectedElement = useCallback(
    (patch: CanvasElementPatch | null) => {
      if (!patch) {
        setPropertyPreview(null);
        return;
      }
      if (!state.selectedId || isSelectedLocked || readOnly) return;
      setPropertyPreview({ elementId: state.selectedId, patch });
    },
    [isSelectedLocked, readOnly, state.selectedId],
  );

  const addElement = useCallback(
    (element: CanvasLeafElement, editText = false) => {
      if (readOnly) return;
      setElementPreview(null);
      setPropertyPreview(null);
      applyAction({ type: "add-element", element });
      if (editText && element.type === "text") {
        setTextEditing({
          elementId: element.id,
          initialText: element.text,
          sessionId: ++nextTextEditingSessionIdRef.current,
        });
      }
    },
    [applyAction, readOnly],
  );

  const selectElement = useCallback(
    (elementId: string | null) => {
      setElementPreview(null);
      setPropertyPreview(null);
      applyAction({ type: "select-element", elementId });
    },
    [applyAction],
  );

  const selectLayerElement = useCallback(
    (elementId: string) => {
      selectElement(elementId);
      editorWorkspaceRef.current?.revealElement(elementId);
    },
    [selectElement],
  );

  const selectTemplate = useCallback(
    (documentId: string) => {
      editorWorkspaceRef.current?.cancelCreation();
      setHoveredElementId(null);
      setElementPreview(null);
      setPropertyPreview(null);
      setTextEditing(null);
      setShowSlideOverview(false);
      applyAction({ type: "select-template", templateId: documentId });
      onActiveDocumentChange?.(documentId);
    },
    [applyAction, onActiveDocumentChange],
  );

  const selectPage = useCallback(
    (documentId: string, pageId: string) => {
      editorWorkspaceRef.current?.cancelCreation();
      setHoveredElementId(null);
      setElementPreview(null);
      setPropertyPreview(null);
      setTextEditing(null);
      setShowSlideOverview(false);
      applyAction({ type: "select-page", templateId: documentId, pageId });
      if (documentId !== state.activeTemplateId) {
        onActiveDocumentChange?.(documentId);
      }
    },
    [applyAction, onActiveDocumentChange, state.activeTemplateId],
  );

  const openSlideOverview = useCallback(() => {
    if (activeDocument.documentType !== "pptx") return;
    editorWorkspaceRef.current?.cancelCreation();
    setHoveredElementId(null);
    setElementPreview(null);
    setPropertyPreview(null);
    setTextEditing(null);
    applyAction({ type: "select-element", elementId: null });
    setShowSlideOverview(true);
  }, [activeDocument.documentType, applyAction]);

  const undo = useCallback(() => {
    if (!readOnly) applyAction({ type: "undo" });
  }, [applyAction, readOnly]);
  const redo = useCallback(() => {
    if (!readOnly) applyAction({ type: "redo" });
  }, [applyAction, readOnly]);
  const reorderElements = useCallback(
    (elements: CanvasElement[]) => {
      if (!readOnly) applyAction({ type: "reorder-elements", elements });
    },
    [applyAction, readOnly],
  );
  const toggleLocked = useCallback(
    (elementId: string) => {
      if (!readOnly) applyAction({ type: "toggle-locked", elementId });
    },
    [applyAction, readOnly],
  );
  const toggleVisible = useCallback(
    (elementId: string) => {
      if (!readOnly) applyAction({ type: "toggle-visible", elementId });
    },
    [applyAction, readOnly],
  );
  const updateElement = useCallback(
    (elementId: string, patch: CanvasElementPatch) => {
      if (
        readOnly ||
        findElementContext(activePageDocument.elements, elementId)?.effectivelyLocked
      ) {
        return;
      }
      applyAction({ type: "update-element", elementId, patch });
    },
    [activePageDocument.elements, applyAction, readOnly],
  );
  const previewElement = useCallback((elementId: string, patch: CanvasElementPatch | null) => {
    setElementPreview(patch ? { elementId, patch } : null);
  }, []);
  const setFitMode = useCallback(
    (enabled: boolean) => applyAction({ type: "set-fit-mode", enabled }),
    [applyAction],
  );
  const setZoom = useCallback(
    (zoom: number) => applyAction({ type: "set-zoom", zoom }),
    [applyAction],
  );

  const beginTextEditing = useCallback(
    (elementId: string) => {
      if (readOnly) return;
      const context = findElementContext(activePageDocument.elements, elementId);
      if (
        context?.element.type !== "text" ||
        context.effectivelyLocked ||
        !context.effectivelyVisible
      ) {
        return;
      }

      setElementPreview(null);
      setPropertyPreview(null);
      applyAction({ type: "select-element", elementId });
      setTextEditing({
        elementId,
        initialText: context.element.text,
        sessionId: ++nextTextEditingSessionIdRef.current,
      });
    },
    [activePageDocument.elements, applyAction, readOnly],
  );

  const cancelTextEditing = useCallback(() => {
    setTextEditing(null);
  }, []);

  const commitTextEditing = useCallback(
    (sessionId: number, elementId: string, markdown: string) => {
      if (textEditing?.sessionId !== sessionId || textEditing.elementId !== elementId) return;

      setTextEditing(null);
      if (readOnly) return;
      const context = findElementContext(activePageDocument.elements, elementId);
      if (context?.element.type !== "text" || context.effectivelyLocked) return;
      applyAction({ type: "update-element", elementId, patch: { text: markdown } });
    },
    [activePageDocument.elements, applyAction, readOnly, textEditing],
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
      if (readOnly) return;
      event.preventDefault();
      applyAction({ type: event.shiftKey ? "redo" : "undo" });
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
      if (readOnly) return;
      event.preventDefault();
      applyAction({ type: "redo" });
      return;
    }

    if (
      event.key === "Enter" &&
      selectedElement?.type === "text" &&
      !isSelectedLocked &&
      !readOnly
    ) {
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
      applyAction({
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
      applyAction({ type: "delete-element", elementId: state.selectedId });
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <TooltipProvider delayDuration={350}>
      <ResizablePanelGroup
        className={cn("h-full min-h-0 w-full bg-background", className)}
        orientation="horizontal"
        style={style}
      >
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
              readOnly={readOnly}
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
              readOnly={readOnly}
              onClose={() => setShowSlideOverview(false)}
              onExport={onExport}
              onReorderPages={(pageIds) => {
                if (!readOnly) applyAction({ type: "reorder-pages", pageIds });
              }}
              onSelectPage={(pageId) => selectPage(activeDocument.id, pageId)}
            />
          ) : (
            <EditorWorkspace
              canRedo={!readOnly && history.future.length > 0}
              canUndo={!readOnly && history.past.length > 0}
              document={canvasPageDocument}
              editingText={textEditing}
              exportDocument={activeDocument}
              fitMode={state.fitMode}
              hoveredId={hoveredElementId}
              isSelectedLocked={isSelectedLocked || readOnly}
              manualZoom={state.manualZoomByTemplate[state.activeTemplateId]}
              readOnly={readOnly}
              selectedId={state.selectedId}
              workspaceHandleRef={editorWorkspaceRef}
              onCancelTextEdit={cancelTextEditing}
              onCommitTextEdit={commitTextEditing}
              onEditText={beginTextEditing}
              onElementChange={updateElement}
              onElementPreview={previewElement}
              onAddElement={addElement}
              onOpenOverview={openSlideOverview}
              onExport={onExport}
              onHover={setHoveredElementId}
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
              isLocked={isSelectedLocked || readOnly}
              selectedElement={displayedSelectedElement}
              onPreview={previewSelectedElement}
              onUpdate={updateSelectedElement}
            />
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
    </TooltipProvider>
  );
}
