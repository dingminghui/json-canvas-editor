import {
  createInitialEditorHistoryState,
  createInitialEditorState,
  editorHistoryReducer,
  editorReducer,
  findElement,
  findElementContext,
  getActiveDocument,
} from "@/editor/editor-state";
import { isGroupElement } from "@/editor/types";

describe("editorReducer", () => {
  it("keeps independent document edits while switching templates", () => {
    let state = createInitialEditorState();
    state = editorReducer(state, {
      type: "update-element",
      elementId: "square-title",
      patch: { text: "A NEW TITLE" },
    });
    state = editorReducer(state, { type: "select-template", templateId: "field-landscape" });
    state = editorReducer(state, { type: "select-template", templateId: "studio-square" });

    const title = findElement(getActiveDocument(state).elements, "square-title");
    expect(title).toMatchObject({ type: "text", text: "A NEW TITLE" });
  });

  it("normalizes dimensions and opacity updates", () => {
    const state = editorReducer(createInitialEditorState(), {
      type: "update-element",
      elementId: "square-title",
      patch: { width: 2, height: -1, opacity: 2 },
    });

    const title = findElement(getActiveDocument(state).elements, "square-title");
    expect(title).toMatchObject({ width: 8, height: 8, opacity: 1 });
  });

  it("preserves untouched branches and ignores no-op mutations", () => {
    const initialState = createInitialEditorState();
    const initialDocument = getActiveDocument(initialState);
    const untouchedGroup = findElement(initialDocument.elements, "square-photo-group");

    const updatedState = editorReducer(initialState, {
      type: "update-element",
      elementId: "square-title",
      patch: { x: 83 },
    });
    const updatedDocument = getActiveDocument(updatedState);

    expect(findElement(updatedDocument.elements, "square-photo-group")).toBe(untouchedGroup);

    const noOpState = editorReducer(updatedState, {
      type: "update-element",
      elementId: "square-title",
      patch: { x: 83 },
    });
    const missingElementState = editorReducer(updatedState, {
      type: "delete-element",
      elementId: "missing-element",
    });

    expect(noOpState).toBe(updatedState);
    expect(missingElementState).toBe(updatedState);
  });

  it("duplicates a leaf with a unique id and then deletes it", () => {
    let state = createInitialEditorState();
    state = editorReducer(state, {
      type: "duplicate-element",
      elementId: "square-title",
      duplicateId: "square-title-copy-test",
    });

    expect(state.selectedId).toBe("square-title-copy-test");
    expect(findElement(getActiveDocument(state).elements, "square-title-copy-test")).toMatchObject({
      name: "主标题 副本",
      x: 106,
      y: 826,
    });

    state = editorReducer(state, {
      type: "delete-element",
      elementId: "square-title-copy-test",
    });
    expect(findElement(getActiveDocument(state).elements, "square-title-copy-test")).toBeNull();
    expect(state.selectedId).toBeNull();
  });

  it("applies group locking and visibility without losing child state", () => {
    let state = createInitialEditorState();
    state = editorReducer(state, {
      type: "toggle-locked",
      elementId: "square-copy-group",
    });
    state = editorReducer(state, {
      type: "toggle-visible",
      elementId: "square-copy-group",
    });

    const document = getActiveDocument(state);
    const group = findElement(document.elements, "square-copy-group");
    expect(group).toMatchObject({ locked: true, visible: false });
    expect(findElementContext(document.elements, "square-title")).toMatchObject({
      effectivelyLocked: true,
      effectivelyVisible: false,
    });
    expect(findElement(document.elements, "square-title")).toMatchObject({
      locked: false,
      visible: true,
    });
  });

  it("reparents an element across groups while preserving its properties", () => {
    const initialState = createInitialEditorState();
    const elements = structuredClone(getActiveDocument(initialState).elements);
    const photoGroup = findElement(elements, "square-photo-group");
    const copyGroup = findElement(elements, "square-copy-group");
    const originalTitle = findElement(elements, "square-title");

    expect(photoGroup && isGroupElement(photoGroup)).toBe(true);
    expect(copyGroup && isGroupElement(copyGroup)).toBe(true);
    expect(originalTitle?.type).toBe("text");
    if (
      !photoGroup ||
      !copyGroup ||
      !isGroupElement(photoGroup) ||
      !isGroupElement(copyGroup) ||
      originalTitle?.type !== "text"
    ) {
      return;
    }

    const titleIndex = copyGroup.children.findIndex((element) => element.id === "square-title");
    const [movedTitle] = copyGroup.children.splice(titleIndex, 1);
    photoGroup.children.push(movedTitle);

    const state = editorReducer(initialState, { type: "reorder-elements", elements });
    const document = getActiveDocument(state);
    const nextPhotoGroup = findElement(document.elements, "square-photo-group");
    const nextCopyGroup = findElement(document.elements, "square-copy-group");

    expect(
      nextPhotoGroup && isGroupElement(nextPhotoGroup)
        ? nextPhotoGroup.children.map((child) => child.id)
        : [],
    ).toContain("square-title");
    expect(
      nextCopyGroup && isGroupElement(nextCopyGroup)
        ? nextCopyGroup.children.map((child) => child.id)
        : [],
    ).not.toContain("square-title");
    expect(findElement(document.elements, "square-title")).toMatchObject({
      text: originalTitle.text,
      x: originalTitle.x,
      y: originalTitle.y,
    });
  });

  it("undoes and redoes document changes without recording zoom changes", () => {
    let history = createInitialEditorHistoryState();

    history = editorHistoryReducer(history, { type: "set-zoom", zoom: 0.8 });
    expect(history.past).toHaveLength(0);

    history = editorHistoryReducer(history, {
      type: "update-element",
      elementId: "square-title",
      patch: { text: "可撤销标题" },
    });
    expect(history.past).toHaveLength(1);
    expect(findElement(getActiveDocument(history.present).elements, "square-title")).toMatchObject({
      text: "可撤销标题",
    });

    history = editorHistoryReducer(history, { type: "undo" });
    expect(
      findElement(getActiveDocument(history.present).elements, "square-title"),
    ).not.toMatchObject({ text: "可撤销标题" });
    expect(history.future).toHaveLength(1);

    history = editorHistoryReducer(history, { type: "redo" });
    expect(findElement(getActiveDocument(history.present).elements, "square-title")).toMatchObject({
      text: "可撤销标题",
    });
  });

  it("does not add no-op changes to history", () => {
    const history = createInitialEditorHistoryState();
    const nextHistory = editorHistoryReducer(history, {
      type: "update-element",
      elementId: "square-title",
      patch: { x: 82 },
    });

    expect(nextHistory.past).toHaveLength(0);
    expect(nextHistory).toBe(history);
    expect(nextHistory.present).toBe(history.present);
  });
});
