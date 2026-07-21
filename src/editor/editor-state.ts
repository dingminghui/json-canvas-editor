import { EDITOR_TEMPLATES } from "@/editor/templates";
import {
  isGroupElement,
  type CanvasDocument,
  type CanvasElement,
  type CanvasElementPatch,
  type CanvasLeafElement,
} from "@/editor/types";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const MAX_HISTORY_ENTRIES = 100;

export interface EditorState {
  documents: Record<string, CanvasDocument>;
  activeTemplateId: string;
  selectedId: string | null;
  manualZoomByTemplate: Record<string, number>;
  fitMode: boolean;
}

export type EditorAction =
  | { type: "select-template"; templateId: string }
  | { type: "select-element"; elementId: string | null }
  | { type: "update-element"; elementId: string; patch: CanvasElementPatch }
  | { type: "duplicate-element"; elementId: string; duplicateId: string }
  | { type: "delete-element"; elementId: string }
  | { type: "toggle-visible"; elementId: string }
  | { type: "toggle-locked"; elementId: string }
  | { type: "reorder-elements"; elements: CanvasElement[] }
  | { type: "set-zoom"; zoom: number }
  | { type: "set-fit-mode"; enabled: boolean };

type EditorDocuments = EditorState["documents"];

export interface EditorHistoryState {
  past: EditorDocuments[];
  present: EditorState;
  future: EditorDocuments[];
}

export type EditorHistoryAction = EditorAction | { type: "undo" } | { type: "redo" };

function cloneDocument(document: CanvasDocument): CanvasDocument {
  return structuredClone(document);
}

export function createInitialEditorState(): EditorState {
  const documents = Object.fromEntries(
    EDITOR_TEMPLATES.map((template) => [template.id, cloneDocument(template)]),
  );

  return {
    documents,
    activeTemplateId: EDITOR_TEMPLATES[0].id,
    selectedId: null,
    manualZoomByTemplate: Object.fromEntries(
      EDITOR_TEMPLATES.map((template) => [template.id, template.width > 1200 ? 0.4 : 0.5]),
    ),
    fitMode: true,
  };
}

export function createInitialEditorHistoryState(): EditorHistoryState {
  return {
    past: [],
    present: createInitialEditorState(),
    future: [],
  };
}

export function getActiveDocument(state: EditorState): CanvasDocument {
  return state.documents[state.activeTemplateId];
}

export function previewDocumentElement(
  document: CanvasDocument,
  elementId: string,
  patch: CanvasElementPatch,
): CanvasDocument {
  const elements = updateLeafElement(document.elements, elementId, patch);
  return elements === document.elements ? document : { ...document, elements };
}

export interface CanvasElementContext {
  element: CanvasElement;
  effectivelyLocked: boolean;
  effectivelyVisible: boolean;
}

export function findElementContext(
  elements: CanvasElement[],
  elementId: string | null,
  inheritedLocked = false,
  inheritedVisible = true,
): CanvasElementContext | null {
  if (!elementId) return null;

  for (const element of elements) {
    const effectivelyLocked = inheritedLocked || element.locked;
    const effectivelyVisible = inheritedVisible && element.visible;

    if (element.id === elementId) {
      return { element, effectivelyLocked, effectivelyVisible };
    }

    if (isGroupElement(element)) {
      const childContext = findElementContext(
        element.children,
        elementId,
        effectivelyLocked,
        effectivelyVisible,
      );
      if (childContext) return childContext;
    }
  }

  return null;
}

export function findElement(
  elements: CanvasElement[],
  elementId: string | null,
): CanvasElement | null {
  return findElementContext(elements, elementId)?.element ?? null;
}

function mapElements(
  elements: CanvasElement[],
  elementId: string,
  update: (element: CanvasElement) => CanvasElement,
): CanvasElement[] {
  let changed = false;
  const nextElements = elements.map((element) => {
    let nextElement = element;

    if (element.id === elementId) {
      nextElement = update(element);
    } else if (isGroupElement(element)) {
      const children = mapElements(element.children, elementId, update);
      if (children !== element.children) nextElement = { ...element, children };
    }

    if (nextElement !== element) changed = true;
    return nextElement;
  });

  return changed ? nextElements : elements;
}

function updateLeafElement(
  elements: CanvasElement[],
  elementId: string,
  patch: CanvasElementPatch,
): CanvasElement[] {
  const normalizedPatch = {
    ...patch,
    ...(typeof patch.width === "number" ? { width: Math.max(8, patch.width) } : {}),
    ...(typeof patch.height === "number" ? { height: Math.max(8, patch.height) } : {}),
    ...(typeof patch.opacity === "number"
      ? { opacity: Math.min(1, Math.max(0, patch.opacity)) }
      : {}),
  } as CanvasElementPatch;

  return mapElements(elements, elementId, (element) => {
    if (isGroupElement(element)) return element;

    const currentValues = element as unknown as Record<string, unknown>;
    const hasChanges = Object.entries(normalizedPatch).some(
      ([key, value]) => !Object.is(currentValues[key], value),
    );

    return hasChanges ? ({ ...element, ...normalizedPatch } as CanvasLeafElement) : element;
  });
}

function deleteElement(elements: CanvasElement[], elementId: string): CanvasElement[] {
  let changed = false;
  const nextElements: CanvasElement[] = [];

  for (const element of elements) {
    if (element.id === elementId) {
      changed = true;
      continue;
    }

    if (isGroupElement(element)) {
      const children = deleteElement(element.children, elementId);
      if (children !== element.children) {
        nextElements.push({ ...element, children });
        changed = true;
        continue;
      }
    }

    nextElements.push(element);
  }

  return changed ? nextElements : elements;
}

function duplicateElement(
  elements: CanvasElement[],
  elementId: string,
  duplicateId: string,
): CanvasElement[] {
  const index = elements.findIndex((element) => element.id === elementId);
  if (index >= 0) {
    const source = elements[index];
    if (isGroupElement(source)) return elements;

    const duplicate: CanvasLeafElement = {
      ...source,
      id: duplicateId,
      name: `${source.name} 副本`,
      x: source.x + 24,
      y: source.y + 24,
    };
    return [...elements.slice(0, index + 1), duplicate, ...elements.slice(index + 1)];
  }

  let changed = false;
  const nextElements = elements.map((element) => {
    if (!isGroupElement(element)) return element;

    const children = duplicateElement(element.children, elementId, duplicateId);
    if (children === element.children) return element;

    changed = true;
    return { ...element, children };
  });

  return changed ? nextElements : elements;
}

function updateActiveDocument(
  state: EditorState,
  update: (document: CanvasDocument) => CanvasDocument,
): EditorState {
  const document = getActiveDocument(state);
  const nextDocument = update(document);
  if (nextDocument === document) return state;

  return {
    ...state,
    documents: {
      ...state.documents,
      [document.id]: nextDocument,
    },
  };
}

function updateActiveElements(
  state: EditorState,
  update: (elements: CanvasElement[]) => CanvasElement[],
): EditorState {
  return updateActiveDocument(state, (document) => {
    const nextElements = update(document.elements);
    const elementsUnchanged =
      nextElements === document.elements ||
      (nextElements.length === document.elements.length &&
        nextElements.every((element, index) => element === document.elements[index]));

    return elementsUnchanged ? document : { ...document, elements: nextElements };
  });
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "select-template":
      if (state.activeTemplateId === action.templateId && state.selectedId === null) return state;
      return {
        ...state,
        activeTemplateId: action.templateId,
        selectedId: null,
      };
    case "select-element":
      return state.selectedId === action.elementId
        ? state
        : { ...state, selectedId: action.elementId };
    case "update-element":
      return updateActiveElements(state, (elements) =>
        updateLeafElement(elements, action.elementId, action.patch),
      );
    case "duplicate-element": {
      const nextState = updateActiveElements(state, (elements) =>
        duplicateElement(elements, action.elementId, action.duplicateId),
      );
      return nextState === state ? state : { ...nextState, selectedId: action.duplicateId };
    }
    case "delete-element": {
      const nextState = updateActiveElements(state, (elements) =>
        deleteElement(elements, action.elementId),
      );
      if (nextState === state) return state;
      return {
        ...nextState,
        selectedId: state.selectedId === action.elementId ? null : state.selectedId,
      };
    }
    case "toggle-visible":
      return updateActiveElements(state, (elements) =>
        mapElements(elements, action.elementId, (element) => ({
          ...element,
          visible: !element.visible,
        })),
      );
    case "toggle-locked":
      return updateActiveElements(state, (elements) =>
        mapElements(elements, action.elementId, (element) => ({
          ...element,
          locked: !element.locked,
        })),
      );
    case "reorder-elements":
      return updateActiveElements(state, () => action.elements);
    case "set-zoom": {
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, action.zoom));
      if (!state.fitMode && state.manualZoomByTemplate[state.activeTemplateId] === zoom) {
        return state;
      }
      return {
        ...state,
        fitMode: false,
        manualZoomByTemplate: {
          ...state.manualZoomByTemplate,
          [state.activeTemplateId]: zoom,
        },
      };
    }
    case "set-fit-mode":
      return state.fitMode === action.enabled ? state : { ...state, fitMode: action.enabled };
    default: {
      const exhaustiveAction: never = action;
      return exhaustiveAction;
    }
  }
}

function isDocumentMutation(action: EditorAction): boolean {
  switch (action.type) {
    case "update-element":
    case "duplicate-element":
    case "delete-element":
    case "toggle-visible":
    case "toggle-locked":
    case "reorder-elements":
      return true;
    case "select-template":
    case "select-element":
    case "set-zoom":
    case "set-fit-mode":
      return false;
    default: {
      const exhaustiveAction: never = action;
      return exhaustiveAction;
    }
  }
}

function restoreDocuments(state: EditorState, documents: EditorDocuments): EditorState {
  const activeDocument = documents[state.activeTemplateId];
  const selectedId =
    activeDocument && findElement(activeDocument.elements, state.selectedId)
      ? state.selectedId
      : null;

  return { ...state, documents, selectedId };
}

export function editorHistoryReducer(
  history: EditorHistoryState,
  action: EditorHistoryAction,
): EditorHistoryState {
  if (action.type === "undo") {
    const previousDocuments = history.past.at(-1);
    if (!previousDocuments) return history;

    return {
      past: history.past.slice(0, -1),
      present: restoreDocuments(history.present, previousDocuments),
      future: [history.present.documents, ...history.future],
    };
  }

  if (action.type === "redo") {
    const [nextDocuments, ...remainingFuture] = history.future;
    if (!nextDocuments) return history;

    return {
      past: [...history.past, history.present.documents].slice(-MAX_HISTORY_ENTRIES),
      present: restoreDocuments(history.present, nextDocuments),
      future: remainingFuture,
    };
  }

  const nextPresent = editorReducer(history.present, action);
  if (nextPresent === history.present) return history;

  if (!isDocumentMutation(action) || nextPresent.documents === history.present.documents) {
    return { ...history, present: nextPresent };
  }

  return {
    past: [...history.past, history.present.documents].slice(-MAX_HISTORY_ENTRIES),
    present: nextPresent,
    future: [],
  };
}
