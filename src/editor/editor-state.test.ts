import {
  createInitialEditorHistoryState as createHistoryState,
  createInitialEditorState as createState,
  editorHistoryReducer,
  editorReducer,
  findElement,
  findElementContext,
  getActiveDocument,
  getActivePageDocument,
  getActivePageId,
} from "@/editor/editor-state";
import { isGroupElement, type CanvasElement, type ChartElement } from "@/editor/types";
import { EDITOR_TEST_DOCUMENTS } from "@/test/fixtures/editor-documents";

const createInitialEditorState = (initialDocumentId?: string) =>
  createState(EDITOR_TEST_DOCUMENTS, initialDocumentId);
const createInitialEditorHistoryState = (initialDocumentId?: string) =>
  createHistoryState(EDITOR_TEST_DOCUMENTS, initialDocumentId);

describe("editorReducer", () => {
  it("initializes longform and presentation documents", () => {
    const state = createInitialEditorState();

    expect(Object.keys(state.documents)).toEqual(["test-longform", "test-presentation"]);
    expect(state.activeTemplateId).toBe("test-longform");
    expect(state.documents["test-longform"].documentType).toBe("longform");
    expect(state.documents["test-presentation"].documentType).toBe("pptx");
    expect(state.documents["test-presentation"].elements).toHaveLength(3);
    expect(state.documents["test-presentation"].height).toBe(900);
    expect(state.activePageIdByTemplate["test-presentation"]).toBe("test-slide-1");
    expect(findElement(getActiveDocument(state).elements, "test-title")).toMatchObject({
      fontFamily: "noto-sans-sc",
      lineHeight: 1.42,
      text: "测试标题",
      type: "text",
    });
  });

  it("selects and remembers one PPT page while exposing only its page elements", () => {
    let state = createInitialEditorState();
    state = editorReducer(state, {
      type: "select-template",
      templateId: "test-presentation",
    });

    expect(getActivePageId(state)).toBe("test-slide-1");
    expect(getActivePageDocument(state)).toMatchObject({
      height: 900,
      id: "test-presentation::test-slide-1",
      width: 1600,
    });
    expect(
      getActivePageDocument(state).elements.some((element) => element.id === "test-slide-1-title"),
    ).toBe(true);
    expect(
      getActivePageDocument(state).elements.some((element) => element.id === "test-slide-2-title"),
    ).toBe(false);

    state = editorReducer(state, {
      type: "select-page",
      templateId: "test-presentation",
      pageId: "test-slide-3",
    });
    expect(getActivePageId(state)).toBe("test-slide-3");

    state = editorReducer(state, {
      type: "select-template",
      templateId: "test-longform",
    });
    state = editorReducer(state, {
      type: "select-template",
      templateId: "test-presentation",
    });
    expect(getActivePageId(state)).toBe("test-slide-3");
  });

  it("adds, reorders, and renumbers elements within the active PPT page", () => {
    let state = editorReducer(createInitialEditorState(), {
      type: "select-page",
      templateId: "test-presentation",
      pageId: "test-slide-2",
    });
    const newElement = {
      align: "left",
      fill: "#000000",
      fontFamily: "noto-sans-sc",
      fontSize: 24,
      fontWeight: "400",
      height: 60,
      id: "new-slide-text",
      lineHeight: 1.2,
      locked: false,
      name: "新文本",
      opacity: 1,
      rotation: 0,
      text: "新建内容",
      type: "text",
      visible: true,
      width: 240,
      x: 100,
      y: 100,
    } as const;

    state = editorReducer(state, { type: "add-element", element: newElement });
    expect(findElement(getActivePageDocument(state).elements, newElement.id)).toBe(newElement);
    expect(
      findElement(
        (getActiveDocument(state).elements[0] as { children: CanvasElement[] }).children,
        newElement.id,
      ),
    ).toBeNull();

    state = editorReducer(state, {
      type: "reorder-pages",
      pageIds: ["test-slide-2", "test-slide-1", "test-slide-3"],
    });

    expect(getActiveDocument(state).elements[0]).toMatchObject({
      id: "test-slide-2",
      name: "01 议程",
    });
    expect(
      findElement(getActiveDocument(state).elements, "test-slide-2-page-number"),
    ).toMatchObject({
      text: "01 / 03",
    });
    expect(getActivePageId(state)).toBe("test-slide-2");
  });

  it("normalizes dimensions, opacity, and non-negative appearance updates", () => {
    const state = editorReducer(createInitialEditorState(), {
      type: "update-element",
      elementId: "test-background",
      patch: { width: 2, height: -1, opacity: 2, cornerRadius: -4, strokeWidth: -2 },
    });

    const background = findElement(getActiveDocument(state).elements, "test-background");
    expect(background).toMatchObject({
      width: 8,
      height: 8,
      opacity: 1,
      cornerRadius: 0,
      strokeWidth: 0,
    });
    const lineHeightState = editorReducer(state, {
      type: "update-element",
      elementId: "test-title",
      patch: { lineHeight: 0 },
    });
    expect(findElement(getActiveDocument(lineHeightState).elements, "test-title")).toMatchObject({
      lineHeight: 0.5,
    });
  });

  it("keeps semantic charts locked to zero rotation", () => {
    const chart: ChartElement = {
      chartType: "bar",
      colors: ["#4F46E5"],
      height: 320,
      id: "chart-test",
      locked: false,
      name: "图表",
      opacity: 1,
      rotation: 0,
      series: [{ labels: ["A", "B"], name: "系列", values: [1, 2] }],
      showLegend: true,
      showValue: true,
      title: "测试图表",
      type: "chart",
      visible: true,
      width: 520,
      x: 100,
      y: 100,
    };
    let state = editorReducer(createInitialEditorState(), { type: "add-element", element: chart });
    state = editorReducer(state, {
      type: "update-element",
      elementId: chart.id,
      patch: { rotation: 45 },
    });

    expect(findElement(getActiveDocument(state).elements, chart.id)).toMatchObject({
      rotation: 0,
      type: "chart",
    });
  });

  it("preserves untouched branches and ignores no-op mutations", () => {
    const initialState = createInitialEditorState();
    const initialDocument = getActiveDocument(initialState);
    const untouchedGroup = findElement(initialDocument.elements, "test-chapter-group");

    const updatedState = editorReducer(initialState, {
      type: "update-element",
      elementId: "test-title",
      patch: { x: 453 },
    });
    const updatedDocument = getActiveDocument(updatedState);

    expect(findElement(updatedDocument.elements, "test-chapter-group")).toBe(untouchedGroup);

    const noOpState = editorReducer(updatedState, {
      type: "update-element",
      elementId: "test-title",
      patch: { x: 453 },
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
      elementId: "test-title",
      duplicateId: "test-title-copy",
    });

    expect(state.selectedId).toBe("test-title-copy");
    expect(findElement(getActiveDocument(state).elements, "test-title-copy")).toMatchObject({
      name: "测试标题 副本",
      x: 476,
      y: 179,
    });

    state = editorReducer(state, {
      type: "delete-element",
      elementId: "test-title-copy",
    });
    expect(findElement(getActiveDocument(state).elements, "test-title-copy")).toBeNull();
    expect(state.selectedId).toBeNull();
  });

  it("applies group locking and visibility without losing child state", () => {
    let state = createInitialEditorState();
    state = editorReducer(state, {
      type: "toggle-locked",
      elementId: "test-cover-group",
    });
    state = editorReducer(state, {
      type: "toggle-visible",
      elementId: "test-cover-group",
    });

    const document = getActiveDocument(state);
    const group = findElement(document.elements, "test-cover-group");
    expect(group).toMatchObject({ locked: true, visible: false });
    expect(findElementContext(document.elements, "test-title")).toMatchObject({
      effectivelyLocked: true,
      effectivelyVisible: false,
    });
    expect(findElement(document.elements, "test-title")).toMatchObject({
      locked: false,
      visible: true,
    });
  });

  it("reparents an element across groups while preserving its properties", () => {
    const initialState = createInitialEditorState();
    const elements = structuredClone(getActiveDocument(initialState).elements);
    const heroGroup = findElement(elements, "test-cover-group");
    const chapterGroup = findElement(elements, "test-chapter-group");
    const originalTitle = findElement(elements, "test-title");

    expect(heroGroup && isGroupElement(heroGroup)).toBe(true);
    expect(chapterGroup && isGroupElement(chapterGroup)).toBe(true);
    expect(originalTitle?.type).toBe("text");
    if (
      !heroGroup ||
      !chapterGroup ||
      !isGroupElement(heroGroup) ||
      !isGroupElement(chapterGroup) ||
      originalTitle?.type !== "text"
    ) {
      return;
    }

    const titleIndex = heroGroup.children.findIndex((element) => element.id === "test-title");
    const [movedTitle] = heroGroup.children.splice(titleIndex, 1);
    chapterGroup.children.push(movedTitle);

    const state = editorReducer(initialState, { type: "reorder-elements", elements });
    const document = getActiveDocument(state);
    const nextHeroGroup = findElement(document.elements, "test-cover-group");
    const nextChapterGroup = findElement(document.elements, "test-chapter-group");

    expect(
      nextChapterGroup && isGroupElement(nextChapterGroup)
        ? nextChapterGroup.children.map((child) => child.id)
        : [],
    ).toContain("test-title");
    expect(
      nextHeroGroup && isGroupElement(nextHeroGroup)
        ? nextHeroGroup.children.map((child) => child.id)
        : [],
    ).not.toContain("test-title");
    expect(findElement(document.elements, "test-title")).toMatchObject({
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
      elementId: "test-title",
      patch: { text: "可撤销标题" },
    });
    expect(history.past).toHaveLength(1);
    expect(findElement(getActiveDocument(history.present).elements, "test-title")).toMatchObject({
      text: "可撤销标题",
    });

    history = editorHistoryReducer(history, { type: "undo" });
    expect(
      findElement(getActiveDocument(history.present).elements, "test-title"),
    ).not.toMatchObject({ text: "可撤销标题" });
    expect(history.future).toHaveLength(1);

    history = editorHistoryReducer(history, { type: "redo" });
    expect(findElement(getActiveDocument(history.present).elements, "test-title")).toMatchObject({
      text: "可撤销标题",
    });
  });

  it("does not add no-op changes to history", () => {
    const history = createInitialEditorHistoryState();
    const nextHistory = editorHistoryReducer(history, {
      type: "update-element",
      elementId: "test-title",
      patch: { x: 452 },
    });

    expect(nextHistory.past).toHaveLength(0);
    expect(nextHistory).toBe(history);
    expect(nextHistory.present).toBe(history.present);
  });
});
