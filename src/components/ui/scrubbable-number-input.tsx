import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import * as React from "react";

const DEFAULT_HOLD_DELAY = 250;
const NUMBER_INPUT_CLASS_NAME =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none";

export type ScrubDirection = "horizontal" | "vertical";

type ScrubSession =
  | {
      status: "pending";
      pointerId: number;
      startX: number;
      startY: number;
      startValue: number;
      target: HTMLButtonElement;
      timer: ReturnType<typeof setTimeout>;
    }
  | {
      status: "active";
      pointerId: number;
      startX: number;
      startY: number;
      startValue: number;
      latestValue: number;
      target: HTMLButtonElement;
    };

export interface ScrubbableNumberInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  | "aria-label"
  | "defaultValue"
  | "max"
  | "min"
  | "onChange"
  | "onKeyDown"
  | "onPointerCancel"
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerUp"
  | "step"
  | "type"
  | "value"
> {
  label: string;
  value: number;
  minValue?: number;
  maxValue?: number;
  inputStep?: number;
  fractionDigits?: number;
  allowNegativeInput?: boolean;
  allowUnlimitedFractionDigits?: boolean;
  displaySuffix?: string;
  icon: React.ReactNode;
  containerClassName?: string;
  scrubDirection: ScrubDirection;
  scrubSensitivity: number;
  holdDelay?: number;
  showInvalidState?: boolean;
  onValueChange: (value: number) => void;
  onScrubPreview?: (value: number) => void;
  onScrubCommit?: (value: number) => void;
  onScrubCancel?: () => void;
}

function getDecimalPattern(allowNegative: boolean, fractionDigits: number) {
  const signPattern = allowNegative ? "-?" : "";
  if (fractionDigits <= 0) return new RegExp(`^${signPattern}\\d*$`);
  return new RegExp(`^${signPattern}\\d*(?:\\.\\d{0,${fractionDigits}})?$`);
}

function roundNumber(value: number, fractionDigits: number) {
  const factor = 10 ** fractionDigits;
  const rounded = Math.round((value + Math.sign(value) * Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function constrainNumber(
  value: number,
  minValue: number | undefined,
  maxValue: number | undefined,
  fractionDigits: number,
) {
  return roundNumber(
    Math.min(
      maxValue ?? Number.POSITIVE_INFINITY,
      Math.max(minValue ?? Number.NEGATIVE_INFINITY, value),
    ),
    fractionDigits,
  );
}

function formatNumber(value: number, fractionDigits: number) {
  if (!Number.isFinite(value)) return "0";
  if (fractionDigits <= 0) return String(Math.round(value));

  return roundNumber(value, fractionDigits)
    .toFixed(fractionDigits)
    .replace(/\.?0+$/, "");
}

function parseNumber(rawValue: string, displaySuffix: string) {
  const normalizedValue = displaySuffix
    ? rawValue
        .trim()
        .replace(new RegExp(`${displaySuffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "")
        .trim()
    : rawValue.trim();
  if (normalizedValue === "" || normalizedValue === "-" || normalizedValue === ".") return null;

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export function ScrubbableNumberInput({
  allowNegativeInput = true,
  allowUnlimitedFractionDigits = false,
  className,
  containerClassName,
  disabled,
  displaySuffix = "",
  fractionDigits = 2,
  holdDelay = DEFAULT_HOLD_DELAY,
  id,
  icon,
  inputStep = 0.01,
  label,
  maxValue,
  minValue,
  onBlur,
  onFocus,
  onScrubCancel,
  onScrubCommit,
  onScrubPreview,
  onValueChange,
  scrubDirection,
  scrubSensitivity,
  showInvalidState = false,
  value,
  ...props
}: ScrubbableNumberInputProps) {
  const [draftValue, setDraftValue] = React.useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = React.useState(false);
  const sessionRef = React.useRef<ScrubSession | null>(null);
  const suppressTriggerClickRef = React.useRef(false);
  const cancelBlurCommitRef = React.useRef(false);
  const allowNegative = allowNegativeInput;
  const inputPattern = allowUnlimitedFractionDigits
    ? new RegExp(`^${allowNegative ? "-?" : ""}\\d*(?:\\.\\d*)?$`)
    : getDecimalPattern(allowNegative, fractionDigits);
  const formattedValue = formatNumber(value, fractionDigits);
  const displayValue = draftValue ?? `${formattedValue}${displaySuffix}`;
  const parsedDisplayValue = parseNumber(displayValue, displaySuffix);
  const invalid =
    parsedDisplayValue === null ||
    (minValue !== undefined && parsedDisplayValue < minValue) ||
    (maxValue !== undefined && parsedDisplayValue > maxValue);

  React.useEffect(
    () => () => {
      const session = sessionRef.current;
      if (session?.status === "pending") clearTimeout(session.timer);
      sessionRef.current = null;
    },
    [],
  );

  function commitRawValue(rawValue: string) {
    const parsedValue = parseNumber(rawValue, displaySuffix);
    if (parsedValue === null) return;
    onValueChange(constrainNumber(parsedValue, minValue, maxValue, fractionDigits));
  }

  function finishScrub(mode: "commit" | "cancel", pointerId?: number) {
    const session = sessionRef.current;
    if (!session || (pointerId !== undefined && session.pointerId !== pointerId)) return;

    if (session.status === "pending") {
      clearTimeout(session.timer);
      sessionRef.current = null;
      if (session.target.hasPointerCapture(session.pointerId)) {
        session.target.releasePointerCapture(session.pointerId);
      }
      return;
    }

    const changed = !Object.is(session.latestValue, session.startValue);
    sessionRef.current = null;
    setIsScrubbing(false);

    if (session.target.hasPointerCapture(session.pointerId)) {
      session.target.releasePointerCapture(session.pointerId);
    }

    if (mode === "cancel") {
      cancelBlurCommitRef.current = true;
      setDraftValue(null);
      if (onScrubPreview) {
        onScrubCancel?.();
      } else {
        onValueChange(session.startValue);
      }
      return;
    }

    suppressTriggerClickRef.current = changed;
    setDraftValue(null);
    if (!changed) {
      onScrubCancel?.();
      return;
    }

    if (onScrubCommit) {
      onScrubCommit(session.latestValue);
    } else {
      onValueChange(session.latestValue);
    }
  }

  return (
    <div
      className={cn(
        "group/scrubbable-number relative flex h-8 w-full min-w-0 items-center rounded-lg border border-input transition-colors outline-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-disabled:bg-input/50 has-disabled:opacity-50 dark:bg-input/30 dark:has-disabled:bg-input/80",
        containerClassName,
      )}
      data-scrub-direction={scrubDirection}
      data-scrubbing={isScrubbing ? "true" : undefined}
      data-slot="scrubbable-number-input"
    >
      <button
        aria-label={`拖动调整${label}`}
        className={cn(
          "flex h-full w-7 flex-none items-center justify-center border-r border-border/60 text-muted-foreground transition-colors outline-none hover:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed [&>svg]:size-3.5",
          !disabled && (scrubDirection === "horizontal" ? "cursor-ew-resize" : "cursor-ns-resize"),
          isScrubbing && "text-foreground select-none",
        )}
        disabled={disabled}
        tabIndex={-1}
        type="button"
        onClick={(event) => {
          if (!suppressTriggerClickRef.current) return;
          suppressTriggerClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || sessionRef.current?.status !== "active") return;
          event.preventDefault();
          finishScrub("cancel");
        }}
        onLostPointerCapture={(event) => {
          if (sessionRef.current?.pointerId === event.pointerId) {
            finishScrub("cancel", event.pointerId);
          }
        }}
        onPointerCancel={(event) => finishScrub("cancel", event.pointerId)}
        onPointerDown={(event) => {
          if (disabled || event.button !== 0 || !event.isPrimary || event.pointerType !== "mouse") {
            return;
          }

          const target = event.currentTarget;
          target.setPointerCapture(event.pointerId);
          const pendingSession: ScrubSession = {
            pointerId: event.pointerId,
            startValue: value,
            startX: event.clientX,
            startY: event.clientY,
            status: "pending",
            target,
            timer: setTimeout(() => {
              const currentSession = sessionRef.current;
              if (
                currentSession?.status !== "pending" ||
                currentSession.pointerId !== event.pointerId
              ) {
                return;
              }
              sessionRef.current = {
                pointerId: currentSession.pointerId,
                startValue: currentSession.startValue,
                startX: currentSession.startX,
                startY: currentSession.startY,
                latestValue: currentSession.startValue,
                status: "active",
                target: currentSession.target,
              };
              setDraftValue(formatNumber(currentSession.startValue, fractionDigits));
              setIsScrubbing(true);
            }, holdDelay),
          };
          sessionRef.current = pendingSession;
        }}
        onPointerMove={(event) => {
          const session = sessionRef.current;
          if (session?.status !== "active" || session.pointerId !== event.pointerId) return;

          event.preventDefault();
          const pixelDelta =
            scrubDirection === "horizontal"
              ? event.clientX - session.startX
              : session.startY - event.clientY;
          const nextValue = constrainNumber(
            session.startValue + pixelDelta * scrubSensitivity,
            minValue,
            maxValue,
            fractionDigits,
          );
          if (Object.is(nextValue, session.latestValue)) return;

          session.latestValue = nextValue;
          setDraftValue(formatNumber(nextValue, fractionDigits));
          if (onScrubPreview) {
            onScrubPreview(nextValue);
          } else {
            onValueChange(nextValue);
          }
        }}
        onPointerUp={(event) => finishScrub("commit", event.pointerId)}
      >
        {icon}
      </button>
      <Input
        {...props}
        aria-invalid={showInvalidState ? invalid : props["aria-invalid"]}
        aria-label={label}
        className={cn(
          NUMBER_INPUT_CLASS_NAME,
          "min-w-0 flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent",
          className,
        )}
        disabled={disabled}
        id={id}
        inputMode="decimal"
        max={maxValue}
        min={minValue}
        step={inputStep}
        type={displaySuffix ? "text" : "number"}
        value={displayValue}
        onBlur={(event) => {
          if (!cancelBlurCommitRef.current && draftValue !== null && !isScrubbing) {
            commitRawValue(draftValue);
          }
          cancelBlurCommitRef.current = false;
          setDraftValue(null);
          onBlur?.(event);
        }}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          const normalizedValue = displaySuffix
            ? nextValue.replace(new RegExp(`${displaySuffix}$`), "")
            : nextValue;
          if (!inputPattern.test(normalizedValue)) return;

          setDraftValue(nextValue);
          const parsedValue = parseNumber(nextValue, displaySuffix);
          if (parsedValue !== null) {
            onValueChange(constrainNumber(parsedValue, minValue, maxValue, fractionDigits));
          }
        }}
        onFocus={(event) => {
          cancelBlurCommitRef.current = false;
          setDraftValue(formattedValue);
          onFocus?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            if (sessionRef.current?.status === "active") {
              event.preventDefault();
              finishScrub("cancel");
            } else {
              cancelBlurCommitRef.current = true;
              setDraftValue(null);
              event.currentTarget.blur();
            }
          }
        }}
      />
    </div>
  );
}
