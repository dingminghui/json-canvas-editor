import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  isLeafElement,
  type CanvasElement,
  type CanvasElementPatch,
  type CanvasLeafElement,
} from "@/editor/types";
import { cn } from "@/lib/utils";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  LockKeyhole,
  SlidersHorizontal,
  TriangleRight,
} from "lucide-react";
import { memo, useId, useRef, useState } from "react";

interface PropertiesPanelProps {
  selectedElement: CanvasElement | null;
  isLocked: boolean;
  onUpdate: (patch: CanvasElementPatch) => void;
}

interface SelectOption {
  id: string;
  label: string;
}

const ELEMENT_TYPE_LABELS: Record<CanvasLeafElement["type"], string> = {
  text: "文本",
  rect: "矩形",
  circle: "圆形",
  image: "图片",
};

const TWO_DECIMAL_NUMBER_PATTERN = /^-?\d*(?:\.\d{0,2})?$/;
const PROPERTY_LABEL_CLASS_NAME = "text-xs font-[550] text-muted-foreground";
const PROPERTY_CONTROL_CLASS_NAME =
  "rounded-[calc(var(--radius-sm)-3px)] border-transparent bg-[color-mix(in_oklch,var(--muted)_76%,var(--card))] text-xs shadow-none focus-visible:border-ring md:text-xs";
const COMPACT_FIELD_GROUP_CLASS_NAME = "gap-2.5";

function roundToTwoDecimals(value: number) {
  const rounded = Math.round((value + Math.sign(value) * Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function formatPropertyNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return roundToTwoDecimals(value)
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function EditorSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <Field>
      <FieldLabel className={PROPERTY_LABEL_CLASS_NAME} htmlFor={id}>
        {label}
      </FieldLabel>
      <Select disabled={disabled} value={value} onValueChange={onChange}>
        <SelectTrigger className={PROPERTY_CONTROL_CLASS_NAME} id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border border-[color-mix(in_oklch,var(--border)_54%,transparent)] shadow-[0_8px_22px_color-mix(in_oklch,var(--foreground)_6%,transparent)]">
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function PropertyNumberField({
  label,
  value,
  disabled,
  minValue,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  minValue?: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const displayValue = draftValue ?? formatPropertyNumber(value);

  function commitValue(rawValue: string) {
    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue)) return;

    const constrainedValue = minValue === undefined ? nextValue : Math.max(minValue, nextValue);
    onChange(roundToTwoDecimals(constrainedValue));
  }

  return (
    <Field>
      <FieldLabel className={PROPERTY_LABEL_CLASS_NAME} htmlFor={id}>
        {label}
      </FieldLabel>
      <Input
        className={cn(
          PROPERTY_CONTROL_CLASS_NAME,
          "font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none",
        )}
        disabled={disabled}
        id={id}
        min={minValue}
        step={0.01}
        type="number"
        value={displayValue}
        onBlur={() => {
          if (draftValue !== null) commitValue(draftValue);
          setDraftValue(null);
        }}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          if (!TWO_DECIMAL_NUMBER_PATTERN.test(nextValue)) return;
          setDraftValue(nextValue);
          commitValue(nextValue);
        }}
        onFocus={() => setDraftValue(formatPropertyNumber(value))}
      />
    </Field>
  );
}

function RotationField({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const cancelCommitRef = useRef(false);
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const displayValue = draftValue ?? `${formatPropertyNumber(value)}°`;

  function commitValue(rawValue: string) {
    const normalizedValue = rawValue.trim().replace(/°$/, "").trim();
    if (normalizedValue === "") return;

    const nextValue = Number(normalizedValue);
    if (!Number.isFinite(nextValue)) return;

    onChange(roundToTwoDecimals(nextValue));
  }

  return (
    <Field className="relative">
      <FieldLabel className="sr-only" htmlFor={id}>
        旋转
      </FieldLabel>
      <TriangleRight
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-[9px] z-[1] size-3.5 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.75}
      />
      <Input
        className={cn(PROPERTY_CONTROL_CLASS_NAME, "pl-[30px] font-mono")}
        disabled={disabled}
        id={id}
        inputMode="decimal"
        type="text"
        value={displayValue}
        onBlur={() => {
          if (!cancelCommitRef.current && draftValue !== null) commitValue(draftValue);
          cancelCommitRef.current = false;
          setDraftValue(null);
        }}
        onChange={(event) => setDraftValue(event.currentTarget.value)}
        onFocus={() => {
          cancelCommitRef.current = false;
          setDraftValue(formatPropertyNumber(value));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            cancelCommitRef.current = true;
            event.currentTarget.blur();
          }
        }}
      />
    </Field>
  );
}

function ColorControl({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <Field>
      <FieldLabel className={PROPERTY_LABEL_CLASS_NAME} htmlFor={id}>
        {label}
      </FieldLabel>
      <label
        className="flex h-8 cursor-pointer items-center gap-2 rounded-[calc(var(--radius-sm)-3px)] bg-[color-mix(in_oklch,var(--muted)_76%,var(--card))] px-2 py-1 font-mono text-xs text-muted-foreground"
        htmlFor={id}
      >
        <Input
          aria-label={`${label}选择器`}
          className="size-[22px] cursor-pointer overflow-hidden rounded-[5px] p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0"
          disabled={disabled}
          id={id}
          type="color"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        <span>{value.toUpperCase()}</span>
      </label>
    </Field>
  );
}

function TextAlignmentControl({
  value,
  disabled,
  onChange,
}: {
  value: "left" | "center" | "right";
  disabled: boolean;
  onChange: (value: "left" | "center" | "right") => void;
}) {
  return (
    <Field>
      <FieldLabel className={PROPERTY_LABEL_CLASS_NAME}>对齐</FieldLabel>
      <ToggleGroup
        aria-label="文本对齐"
        className="grid w-full grid-cols-3"
        disabled={disabled}
        spacing={0}
        type="single"
        value={value}
        variant="outline"
        onValueChange={(nextValue) => {
          if (nextValue === "left" || nextValue === "center" || nextValue === "right") {
            onChange(nextValue);
          }
        }}
      >
        <ToggleGroupItem
          aria-label="左对齐"
          className="w-full border-transparent bg-[color-mix(in_oklch,var(--muted)_76%,var(--card))] data-[state=on]:bg-accent data-[state=on]:text-primary"
          value="left"
        >
          <AlignLeft aria-hidden="true" />
        </ToggleGroupItem>
        <ToggleGroupItem
          aria-label="居中对齐"
          className="w-full border-transparent bg-[color-mix(in_oklch,var(--muted)_76%,var(--card))] data-[state=on]:bg-accent data-[state=on]:text-primary"
          value="center"
        >
          <AlignCenter aria-hidden="true" />
        </ToggleGroupItem>
        <ToggleGroupItem
          aria-label="右对齐"
          className="w-full border-transparent bg-[color-mix(in_oklch,var(--muted)_76%,var(--card))] data-[state=on]:bg-accent data-[state=on]:text-primary"
          value="right"
        >
          <AlignRight aria-hidden="true" />
        </ToggleGroupItem>
      </ToggleGroup>
    </Field>
  );
}

function ElementSpecificFields({
  element,
  disabled,
  onUpdate,
}: {
  element: CanvasLeafElement;
  disabled: boolean;
  onUpdate: (patch: CanvasElementPatch) => void;
}) {
  const textId = useId();

  switch (element.type) {
    case "text":
      return (
        <FieldGroup className={COMPACT_FIELD_GROUP_CLASS_NAME}>
          <Field>
            <FieldLabel className={PROPERTY_LABEL_CLASS_NAME} htmlFor={textId}>
              文本内容
            </FieldLabel>
            <Textarea
              className={cn(PROPERTY_CONTROL_CLASS_NAME, "min-h-[72px] resize-y")}
              disabled={disabled}
              id={textId}
              rows={4}
              value={element.text}
              onChange={(event) => onUpdate({ text: event.currentTarget.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <PropertyNumberField
              disabled={disabled}
              label="字号"
              minValue={8}
              value={element.fontSize}
              onChange={(fontSize) => onUpdate({ fontSize })}
            />
            <EditorSelect
              disabled={disabled}
              label="字重"
              options={[
                { id: "400", label: "常规" },
                { id: "500", label: "中等" },
                { id: "600", label: "半粗" },
                { id: "700", label: "粗体" },
                { id: "800", label: "特粗" },
              ]}
              value={element.fontWeight}
              onChange={(fontWeight) =>
                onUpdate({ fontWeight: fontWeight as typeof element.fontWeight })
              }
            />
          </div>
          <TextAlignmentControl
            disabled={disabled}
            value={element.align}
            onChange={(align) => onUpdate({ align })}
          />
          <ColorControl
            disabled={disabled}
            label="文字颜色"
            value={element.fill}
            onChange={(fill) => onUpdate({ fill })}
          />
        </FieldGroup>
      );
    case "rect":
      return (
        <FieldGroup className={COMPACT_FIELD_GROUP_CLASS_NAME}>
          <ColorControl
            disabled={disabled}
            label="填充颜色"
            value={element.fill}
            onChange={(fill) => onUpdate({ fill })}
          />
          <PropertyNumberField
            disabled={disabled}
            label="圆角"
            minValue={0}
            value={element.cornerRadius}
            onChange={(cornerRadius) => onUpdate({ cornerRadius })}
          />
        </FieldGroup>
      );
    case "circle":
      return (
        <ColorControl
          disabled={disabled}
          label="填充颜色"
          value={element.fill}
          onChange={(fill) => onUpdate({ fill })}
        />
      );
    case "image":
      return (
        <EditorSelect
          disabled={disabled}
          label="图片填充"
          options={[
            { id: "cover", label: "裁切填充" },
            { id: "contain", label: "完整显示" },
          ]}
          value={element.fit}
          onChange={(fit) => onUpdate({ fit: fit as typeof element.fit })}
        />
      );
    default: {
      const exhaustiveElement: never = element;
      return exhaustiveElement;
    }
  }
}

export const PropertiesPanel = memo(function PropertiesPanel({
  selectedElement,
  isLocked,
  onUpdate,
}: PropertiesPanelProps) {
  const nameId = useId();

  if (!selectedElement || !isLeafElement(selectedElement)) {
    return (
      <Empty className="h-full rounded-none border-0">
        <EmptyHeader>
          <EmptyMedia>
            <SlidersHorizontal aria-hidden="true" strokeWidth={1.6} />
          </EmptyMedia>
          <EmptyTitle>选择一个元素</EmptyTitle>
          <EmptyDescription className="max-w-[205px] text-xs leading-[1.6]">
            在画布或图层中选择元素，即可调整位置、尺寸和外观。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 min-h-12 flex-none items-center justify-between border-b border-border px-3.5">
        <h2 className="m-0 max-w-[210px] overflow-hidden text-xs font-[650] text-ellipsis whitespace-nowrap">
          {selectedElement.name}
        </h2>
        <Badge className="text-xs" variant="secondary">
          {ELEMENT_TYPE_LABELS[selectedElement.type]}
        </Badge>
      </div>

      {isLocked ? (
        <div
          className="flex min-h-[34px] items-center gap-[7px] border-b border-border bg-secondary px-3.5 py-[7px] text-xs text-secondary-foreground"
          role="status"
        >
          <LockKeyhole aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
          <span>该元素或所属分组已锁定</span>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <section className="flex flex-col gap-3 p-3.5">
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-xs font-bold">位置与尺寸</h3>
          </div>
          <FieldGroup className={COMPACT_FIELD_GROUP_CLASS_NAME}>
            <Field>
              <FieldLabel className={PROPERTY_LABEL_CLASS_NAME} htmlFor={nameId}>
                名称
              </FieldLabel>
              <Input
                className={PROPERTY_CONTROL_CLASS_NAME}
                disabled={isLocked}
                id={nameId}
                value={selectedElement.name}
                onChange={(event) => onUpdate({ name: event.currentTarget.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <PropertyNumberField
                disabled={isLocked}
                label="X"
                value={selectedElement.x}
                onChange={(x) => onUpdate({ x })}
              />
              <PropertyNumberField
                disabled={isLocked}
                label="Y"
                value={selectedElement.y}
                onChange={(y) => onUpdate({ y })}
              />
              <PropertyNumberField
                disabled={isLocked}
                label="宽"
                minValue={8}
                value={selectedElement.width}
                onChange={(width) => onUpdate({ width: Math.max(8, width) })}
              />
              <PropertyNumberField
                disabled={isLocked}
                label="高"
                minValue={8}
                value={selectedElement.height}
                onChange={(height) => onUpdate({ height: Math.max(8, height) })}
              />
            </div>

            <RotationField
              disabled={isLocked}
              value={selectedElement.rotation}
              onChange={(rotation) => onUpdate({ rotation })}
            />
          </FieldGroup>
        </section>

        <Separator />

        <section className="flex flex-col gap-3 p-3.5">
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-xs font-bold">外观</h3>
            <span className="font-mono text-xs text-muted-foreground">
              {Math.round(selectedElement.opacity * 100)}%
            </span>
          </div>
          <FieldGroup className={COMPACT_FIELD_GROUP_CLASS_NAME}>
            <Field>
              <FieldLabel className={PROPERTY_LABEL_CLASS_NAME}>透明度</FieldLabel>
              <Slider
                aria-label="透明度"
                disabled={isLocked}
                max={100}
                min={0}
                step={1}
                value={[Math.round(selectedElement.opacity * 100)]}
                onValueChange={([opacity]) => onUpdate({ opacity: opacity / 100 })}
              />
            </Field>
          </FieldGroup>
        </section>

        <Separator />

        <section className="flex flex-col gap-3 p-3.5">
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-xs font-bold">
              {selectedElement.type === "text" ? "文字" : "元素样式"}
            </h3>
          </div>
          <ElementSpecificFields
            disabled={isLocked}
            element={selectedElement}
            onUpdate={onUpdate}
          />
        </section>
      </ScrollArea>
    </div>
  );
});
