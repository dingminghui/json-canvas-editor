import {
  createInitialEditorHistoryState,
  createInitialEditorState,
  editorHistoryReducer,
  editorReducer,
  findElement,
  findElementContext,
  getActiveDocument,
  getActivePageDocument,
  getActivePageId,
} from "@/editor/editor-state";
import { isGroupElement, type CanvasElement } from "@/editor/types";

describe("editorReducer", () => {
  it("initializes the imported Symbicort document and PPT template 2", () => {
    const state = createInitialEditorState();

    expect(Object.keys(state.documents)).toEqual([
      "symbicort-longform-medical-comic",
      "ppt-template-2-medical-brief",
    ]);
    expect(state.activeTemplateId).toBe("symbicort-longform-medical-comic");
    expect(state.documents["symbicort-longform-medical-comic"].documentType).toBe("longform");
    expect(state.documents["ppt-template-2-medical-brief"].documentType).toBe("pptx");
    expect(state.documents["ppt-template-2-medical-brief"].elements).toHaveLength(8);
    expect(state.documents["ppt-template-2-medical-brief"].height).toBe(900);
    expect(state.activePageIdByTemplate["ppt-template-2-medical-brief"]).toBe("ppt2-slide-1");
    expect(findElement(getActiveDocument(state).elements, "symbicort-006")).toMatchObject({
      fontFamily: "noto-sans-sc",
      lineHeight: 1.42,
      text: "不只在“喘”的时候",
      type: "text",
    });
    expect(findElement(getActiveDocument(state).elements, "symbicort-084")).toMatchObject({
      lineCap: "butt",
      type: "line",
    });
  });

  it("selects and remembers one PPT page while exposing only its page elements", () => {
    let state = createInitialEditorState();
    state = editorReducer(state, {
      type: "select-template",
      templateId: "ppt-template-2-medical-brief",
    });

    expect(getActivePageId(state)).toBe("ppt2-slide-1");
    expect(getActivePageDocument(state)).toMatchObject({
      height: 900,
      id: "ppt-template-2-medical-brief::ppt2-slide-1",
      width: 1600,
    });
    expect(
      getActivePageDocument(state).elements.some((element) => element.id === "ppt2-s1-title"),
    ).toBe(true);
    expect(
      getActivePageDocument(state).elements.some((element) => element.id === "ppt2-s2-title"),
    ).toBe(false);

    state = editorReducer(state, {
      type: "select-page",
      templateId: "ppt-template-2-medical-brief",
      pageId: "ppt2-slide-3",
    });
    expect(getActivePageId(state)).toBe("ppt2-slide-3");

    state = editorReducer(state, {
      type: "select-template",
      templateId: "symbicort-longform-medical-comic",
    });
    state = editorReducer(state, {
      type: "select-template",
      templateId: "ppt-template-2-medical-brief",
    });
    expect(getActivePageId(state)).toBe("ppt2-slide-3");
  });

  it("adds, reorders, and renumbers elements within the active PPT page", () => {
    let state = editorReducer(createInitialEditorState(), {
      type: "select-page",
      templateId: "ppt-template-2-medical-brief",
      pageId: "ppt2-slide-2",
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
      pageIds: [
        "ppt2-slide-2",
        "ppt2-slide-1",
        "ppt2-slide-3",
        "ppt2-slide-4",
        "ppt2-slide-5",
        "ppt2-slide-6",
        "ppt2-slide-7",
        "ppt2-slide-8",
      ],
    });

    expect(getActiveDocument(state).elements[0]).toMatchObject({
      id: "ppt2-slide-2",
      name: "01 议程",
    });
    expect(findElement(getActiveDocument(state).elements, "ppt2-s2-footer-page")).toMatchObject({
      text: "01 / 08",
    });
    expect(getActivePageId(state)).toBe("ppt2-slide-2");
  });

  it("normalizes dimensions, opacity, and non-negative appearance updates", () => {
    const state = editorReducer(createInitialEditorState(), {
      type: "update-element",
      elementId: "background",
      patch: { width: 2, height: -1, opacity: 2, cornerRadius: -4, strokeWidth: -2 },
    });

    const background = findElement(getActiveDocument(state).elements, "background");
    expect(background).toMatchObject({
      width: 8,
      height: 8,
      opacity: 1,
      cornerRadius: 0,
      strokeWidth: 0,
    });
    const lineHeightState = editorReducer(state, {
      type: "update-element",
      elementId: "symbicort-006",
      patch: { lineHeight: 0 },
    });
    expect(findElement(getActiveDocument(lineHeightState).elements, "symbicort-006")).toMatchObject(
      {
        lineHeight: 0.5,
      },
    );
  });

  it("resolves the imported image assets", () => {
    const template = getActiveDocument(createInitialEditorState());

    expect(findElement(template.elements, "symbicort-007")).toMatchObject({
      src: expect.stringContaining("11-symbicort-hero.webp"),
      type: "image",
    });
  });

  it("preserves untouched branches and ignores no-op mutations", () => {
    const initialState = createInitialEditorState();
    const initialDocument = getActiveDocument(initialState);
    const untouchedGroup = findElement(initialDocument.elements, "chapter-1-group");

    const updatedState = editorReducer(initialState, {
      type: "update-element",
      elementId: "symbicort-006",
      patch: { x: 453 },
    });
    const updatedDocument = getActiveDocument(updatedState);

    expect(findElement(updatedDocument.elements, "chapter-1-group")).toBe(untouchedGroup);

    const noOpState = editorReducer(updatedState, {
      type: "update-element",
      elementId: "symbicort-006",
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
      elementId: "symbicort-006",
      duplicateId: "symbicort-006-copy-test",
    });

    expect(state.selectedId).toBe("symbicort-006-copy-test");
    expect(findElement(getActiveDocument(state).elements, "symbicort-006-copy-test")).toMatchObject(
      {
        name: "封面主标题 副本",
        x: 476,
        y: 179,
      },
    );

    state = editorReducer(state, {
      type: "delete-element",
      elementId: "symbicort-006-copy-test",
    });
    expect(findElement(getActiveDocument(state).elements, "symbicort-006-copy-test")).toBeNull();
    expect(state.selectedId).toBeNull();
  });

  it("applies group locking and visibility without losing child state", () => {
    let state = createInitialEditorState();
    state = editorReducer(state, {
      type: "toggle-locked",
      elementId: "hero-group",
    });
    state = editorReducer(state, {
      type: "toggle-visible",
      elementId: "hero-group",
    });

    const document = getActiveDocument(state);
    const group = findElement(document.elements, "hero-group");
    expect(group).toMatchObject({ locked: true, visible: false });
    expect(findElementContext(document.elements, "symbicort-006")).toMatchObject({
      effectivelyLocked: true,
      effectivelyVisible: false,
    });
    expect(findElement(document.elements, "symbicort-006")).toMatchObject({
      locked: false,
      visible: true,
    });
  });

  it("reparents an element across groups while preserving its properties", () => {
    const initialState = createInitialEditorState();
    const elements = structuredClone(getActiveDocument(initialState).elements);
    const heroGroup = findElement(elements, "hero-group");
    const chapterGroup = findElement(elements, "chapter-1-group");
    const originalTitle = findElement(elements, "symbicort-006");

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

    const titleIndex = heroGroup.children.findIndex((element) => element.id === "symbicort-006");
    const [movedTitle] = heroGroup.children.splice(titleIndex, 1);
    chapterGroup.children.push(movedTitle);

    const state = editorReducer(initialState, { type: "reorder-elements", elements });
    const document = getActiveDocument(state);
    const nextHeroGroup = findElement(document.elements, "hero-group");
    const nextChapterGroup = findElement(document.elements, "chapter-1-group");

    expect(
      nextChapterGroup && isGroupElement(nextChapterGroup)
        ? nextChapterGroup.children.map((child) => child.id)
        : [],
    ).toContain("symbicort-006");
    expect(
      nextHeroGroup && isGroupElement(nextHeroGroup)
        ? nextHeroGroup.children.map((child) => child.id)
        : [],
    ).not.toContain("symbicort-006");
    expect(findElement(document.elements, "symbicort-006")).toMatchObject({
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
      elementId: "symbicort-006",
      patch: { text: "可撤销标题" },
    });
    expect(history.past).toHaveLength(1);
    expect(findElement(getActiveDocument(history.present).elements, "symbicort-006")).toMatchObject(
      {
        text: "可撤销标题",
      },
    );

    history = editorHistoryReducer(history, { type: "undo" });
    expect(
      findElement(getActiveDocument(history.present).elements, "symbicort-006"),
    ).not.toMatchObject({ text: "可撤销标题" });
    expect(history.future).toHaveLength(1);

    history = editorHistoryReducer(history, { type: "redo" });
    expect(findElement(getActiveDocument(history.present).elements, "symbicort-006")).toMatchObject(
      {
        text: "可撤销标题",
      },
    );
  });

  it("does not add no-op changes to history", () => {
    const history = createInitialEditorHistoryState();
    const nextHistory = editorHistoryReducer(history, {
      type: "update-element",
      elementId: "symbicort-006",
      patch: { x: 452 },
    });

    expect(nextHistory.past).toHaveLength(0);
    expect(nextHistory).toBe(history);
    expect(nextHistory.present).toBe(history.present);
  });
});
