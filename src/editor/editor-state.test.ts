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
  it("initializes all templates with the kidney case active", () => {
    let state = createInitialEditorState();
    expect(Object.keys(state.documents)).toEqual([
      "kidney-awakening-story",
      "lymphoma-transformation-story",
      "symbicort-longform-story-template",
      "symbicort-longform-medical-comic",
    ]);
    expect(state.activeTemplateId).toBe("kidney-awakening-story");

    state = editorReducer(state, {
      type: "update-element",
      elementId: "story-title",
      patch: { text: "A NEW TITLE" },
    });

    state = editorReducer(state, {
      type: "select-template",
      templateId: "lymphoma-transformation-story",
    });
    expect(findElement(getActiveDocument(state).elements, "story-title")).toMatchObject({
      type: "text",
      text: '从"惰性"到"侵袭"',
    });

    state = editorReducer(state, {
      type: "select-template",
      templateId: "kidney-awakening-story",
    });
    const title = findElement(getActiveDocument(state).elements, "story-title");
    expect(title).toMatchObject({
      fontFamily: "noto-serif-sc",
      type: "text",
      text: "A NEW TITLE",
    });
    expect(findElement(getActiveDocument(state).elements, "story-eyebrow")).toMatchObject({
      fontFamily: "jetbrains-mono",
    });
    expect(findElement(getActiveDocument(state).elements, "chapter-1-paragraph-0")).toMatchObject({
      fontFamily: "noto-sans-sc",
    });
  });

  it("normalizes dimensions and opacity updates", () => {
    const state = editorReducer(createInitialEditorState(), {
      type: "update-element",
      elementId: "story-title",
      patch: { width: 2, height: -1, opacity: 2 },
    });

    const title = findElement(getActiveDocument(state).elements, "story-title");
    expect(title).toMatchObject({ width: 8, height: 8, opacity: 1 });
  });

  it("builds the Symbicort page through the shared story template", () => {
    const template = createInitialEditorState().documents["symbicort-longform-story-template"];

    expect(template).toMatchObject({
      description: "信必可：从 GINA 原则看懂哮喘长期管理",
      width: 1080,
    });
    expect(findElement(template.elements, "story-title")).toMatchObject({
      fontFamily: "noto-serif-sc",
      type: "text",
      text: "不只在“喘”的时候",
    });
    expect(findElement(template.elements, "symbicort-chapter-1-group")).toMatchObject({
      name: "第一章 · 不只控制症状，更要降低风险",
      type: "group",
    });
    expect(findElement(template.elements, "story-hero-image-0")).toMatchObject({
      type: "image",
      src: expect.stringContaining("11-symbicort-hero.webp"),
    });
  });

  it("loads the unmodified Symbicort canvas as a separate page", () => {
    const template = createInitialEditorState().documents["symbicort-longform-medical-comic"];

    expect(template).toMatchObject({
      height: 5993,
      name: "信必可：从 GINA 原则看懂哮喘长期管理",
      width: 1080,
    });
    expect(findElement(template.elements, "hero-title")).toMatchObject({
      text: "不只在“喘”的时候",
      type: "text",
      x: 452,
      y: 155,
    });
    expect(findElement(template.elements, "hero-image")).toMatchObject({
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
      elementId: "story-title",
      patch: { x: 83 },
    });
    const updatedDocument = getActiveDocument(updatedState);

    expect(findElement(updatedDocument.elements, "chapter-1-group")).toBe(untouchedGroup);

    const noOpState = editorReducer(updatedState, {
      type: "update-element",
      elementId: "story-title",
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
      elementId: "story-title",
      duplicateId: "story-title-copy-test",
    });

    expect(state.selectedId).toBe("story-title-copy-test");
    expect(findElement(getActiveDocument(state).elements, "story-title-copy-test")).toMatchObject({
      name: "主标题 副本",
      x: 164,
      y: 168,
    });

    state = editorReducer(state, {
      type: "delete-element",
      elementId: "story-title-copy-test",
    });
    expect(findElement(getActiveDocument(state).elements, "story-title-copy-test")).toBeNull();
    expect(state.selectedId).toBeNull();
  });

  it("applies group locking and visibility without losing child state", () => {
    let state = createInitialEditorState();
    state = editorReducer(state, {
      type: "toggle-locked",
      elementId: "story-hero-group",
    });
    state = editorReducer(state, {
      type: "toggle-visible",
      elementId: "story-hero-group",
    });

    const document = getActiveDocument(state);
    const group = findElement(document.elements, "story-hero-group");
    expect(group).toMatchObject({ locked: true, visible: false });
    expect(findElementContext(document.elements, "story-title")).toMatchObject({
      effectivelyLocked: true,
      effectivelyVisible: false,
    });
    expect(findElement(document.elements, "story-title")).toMatchObject({
      locked: false,
      visible: true,
    });
  });

  it("reparents an element across groups while preserving its properties", () => {
    const initialState = createInitialEditorState();
    const elements = structuredClone(getActiveDocument(initialState).elements);
    const heroGroup = findElement(elements, "story-hero-group");
    const chapterGroup = findElement(elements, "chapter-1-group");
    const originalTitle = findElement(elements, "story-title");

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

    const titleIndex = heroGroup.children.findIndex((element) => element.id === "story-title");
    const [movedTitle] = heroGroup.children.splice(titleIndex, 1);
    chapterGroup.children.push(movedTitle);

    const state = editorReducer(initialState, { type: "reorder-elements", elements });
    const document = getActiveDocument(state);
    const nextHeroGroup = findElement(document.elements, "story-hero-group");
    const nextChapterGroup = findElement(document.elements, "chapter-1-group");

    expect(
      nextChapterGroup && isGroupElement(nextChapterGroup)
        ? nextChapterGroup.children.map((child) => child.id)
        : [],
    ).toContain("story-title");
    expect(
      nextHeroGroup && isGroupElement(nextHeroGroup)
        ? nextHeroGroup.children.map((child) => child.id)
        : [],
    ).not.toContain("story-title");
    expect(findElement(document.elements, "story-title")).toMatchObject({
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
      elementId: "story-title",
      patch: { text: "可撤销标题" },
    });
    expect(history.past).toHaveLength(1);
    expect(findElement(getActiveDocument(history.present).elements, "story-title")).toMatchObject({
      text: "可撤销标题",
    });

    history = editorHistoryReducer(history, { type: "undo" });
    expect(
      findElement(getActiveDocument(history.present).elements, "story-title"),
    ).not.toMatchObject({ text: "可撤销标题" });
    expect(history.future).toHaveLength(1);

    history = editorHistoryReducer(history, { type: "redo" });
    expect(findElement(getActiveDocument(history.present).elements, "story-title")).toMatchObject({
      text: "可撤销标题",
    });
  });

  it("does not add no-op changes to history", () => {
    const history = createInitialEditorHistoryState();
    const nextHistory = editorHistoryReducer(history, {
      type: "update-element",
      elementId: "story-title",
      patch: { x: 140 },
    });

    expect(nextHistory.past).toHaveLength(0);
    expect(nextHistory).toBe(history);
    expect(nextHistory.present).toBe(history.present);
  });
});
