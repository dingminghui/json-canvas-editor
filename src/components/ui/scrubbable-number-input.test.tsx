import { ScrubbableNumberInput } from "@/components/ui/scrubbable-number-input";
import { act, fireEvent, render, screen } from "@testing-library/react";

function renderNumberInput(
  overrides: Partial<React.ComponentProps<typeof ScrubbableNumberInput>> = {},
) {
  const label = overrides.label ?? "宽";
  const onValueChange = vi.fn();
  const onScrubPreview = vi.fn();
  const onScrubCommit = vi.fn();
  const onScrubCancel = vi.fn();

  const result = render(
    <ScrubbableNumberInput
      icon={<span aria-hidden="true">↔</span>}
      label={label}
      scrubDirection="horizontal"
      scrubSensitivity={1}
      value={100}
      onScrubCancel={onScrubCancel}
      onScrubCommit={onScrubCommit}
      onScrubPreview={onScrubPreview}
      onValueChange={onValueChange}
      {...overrides}
    />,
  );
  const input = screen.getByLabelText(label);
  const trigger = screen.getByRole("button", { name: `拖动调整${label}` });
  let capturedPointerId: number | null = null;

  trigger.setPointerCapture = vi.fn((pointerId: number) => {
    capturedPointerId = pointerId;
  });
  trigger.releasePointerCapture = vi.fn(() => {
    capturedPointerId = null;
  });
  trigger.hasPointerCapture = vi.fn((pointerId: number) => capturedPointerId === pointerId);

  return {
    ...result,
    input,
    onScrubCancel,
    onScrubCommit,
    onScrubPreview,
    onValueChange,
    trigger,
  };
}

function startMouseScrub(trigger: HTMLElement, clientX = 10, clientY = 10) {
  fireEvent.pointerDown(trigger, {
    button: 0,
    clientX,
    clientY,
    isPrimary: true,
    pointerId: 1,
    pointerType: "mouse",
  });
  act(() => vi.advanceTimersByTime(250));
}

describe("ScrubbableNumberInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("keeps typing on the input and limits the resize cursor to the icon trigger", () => {
    const { input, onScrubPreview, onValueChange, trigger } = renderNumberInput();

    expect(trigger).toHaveClass("cursor-ew-resize");
    expect(input).not.toHaveClass("cursor-ew-resize");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "123.45" } });
    expect(onValueChange).toHaveBeenLastCalledWith(123.45);
    expect(onScrubPreview).not.toHaveBeenCalled();
  });

  it("requires a long press and previews a horizontal drag before one commit", () => {
    const { onScrubCommit, onScrubPreview, trigger } = renderNumberInput();

    fireEvent.pointerDown(trigger, {
      button: 0,
      clientX: 10,
      clientY: 10,
      isPrimary: true,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(trigger, {
      clientX: 30,
      clientY: 10,
      pointerId: 1,
      pointerType: "mouse",
    });
    expect(onScrubPreview).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(250));
    fireEvent.pointerMove(trigger, {
      clientX: 30,
      clientY: 10,
      pointerId: 1,
      pointerType: "mouse",
    });
    expect(onScrubPreview).toHaveBeenLastCalledWith(120);

    fireEvent.pointerUp(trigger, { pointerId: 1, pointerType: "mouse" });
    expect(onScrubCommit).toHaveBeenCalledOnce();
    expect(onScrubCommit).toHaveBeenLastCalledWith(120);
  });

  it("increases vertical values upward and clamps them to their minimum", () => {
    const { onScrubCommit, onScrubPreview, trigger } = renderNumberInput({
      label: "高",
      minValue: 80,
      scrubDirection: "vertical",
      scrubSensitivity: 2,
    });

    expect(trigger).toHaveClass("cursor-ns-resize");
    startMouseScrub(trigger, 10, 20);
    fireEvent.pointerMove(trigger, {
      clientX: 10,
      clientY: 10,
      pointerId: 1,
      pointerType: "mouse",
    });
    expect(onScrubPreview).toHaveBeenLastCalledWith(120);

    fireEvent.pointerMove(trigger, {
      clientX: 10,
      clientY: 80,
      pointerId: 1,
      pointerType: "mouse",
    });
    expect(onScrubPreview).toHaveBeenLastCalledWith(80);
    fireEvent.pointerUp(trigger, { pointerId: 1, pointerType: "mouse" });
    expect(onScrubCommit).toHaveBeenLastCalledWith(80);
  });

  it("cancels an active scrub on pointer cancellation or Escape", () => {
    const first = renderNumberInput();
    startMouseScrub(first.trigger);
    fireEvent.pointerMove(first.trigger, {
      clientX: 20,
      clientY: 10,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerCancel(first.trigger, { pointerId: 1, pointerType: "mouse" });
    expect(first.onScrubCancel).toHaveBeenCalledOnce();
    expect(first.onScrubCommit).not.toHaveBeenCalled();
    first.unmount();

    const second = renderNumberInput();
    startMouseScrub(second.trigger);
    fireEvent.pointerMove(second.trigger, {
      clientX: 20,
      clientY: 10,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.keyDown(second.trigger, { key: "Escape" });
    expect(second.onScrubCancel).toHaveBeenCalledOnce();
    expect(second.onScrubCommit).not.toHaveBeenCalled();
  });

  it("does not activate while disabled and clears a pending timer on unmount", () => {
    const disabled = renderNumberInput({ disabled: true });
    expect(disabled.trigger).toBeDisabled();
    expect(disabled.input).toBeDisabled();
    expect(disabled.trigger).not.toHaveClass("cursor-ew-resize");
    disabled.unmount();

    const pending = renderNumberInput();
    fireEvent.pointerDown(pending.trigger, {
      button: 0,
      clientX: 10,
      clientY: 10,
      isPrimary: true,
      pointerId: 1,
      pointerType: "mouse",
    });
    pending.unmount();
    act(() => vi.advanceTimersByTime(300));
    expect(pending.onScrubPreview).not.toHaveBeenCalled();
    expect(pending.onScrubCommit).not.toHaveBeenCalled();
  });
});
