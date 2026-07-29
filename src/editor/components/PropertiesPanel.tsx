import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
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
  ScrubbableNumberInput,
  type ScrubDirection,
} from "@/components/ui/scrubbable-number-input";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChartFields, TableFields } from "@/editor/components/SemanticElementFields";
import { CANVAS_FONT_FAMILIES, isCanvasFontFamily } from "@/editor/fonts";
import { markdownToPlainText } from "@/editor/markdown";
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
  AlignVerticalSpaceAround,
  ArrowLeftRight,
  Hash,
  LockKeyhole,
  MoveRight,
  PenLine,
  Radius,
  RulerDimensionLine,
  SlidersHorizontal,
  SquareRoundCorner,
  TriangleRight,
  Type,
} from "lucide-react";
import { memo, useId, type ReactNode } from "react";

interface PropertiesPanelProps {
  selectedElement: CanvasElement | null;
  isLocked: boolean;
  onUpdate: (patch: CanvasElementPatch) => void;
  onPreview?: (patch: CanvasElementPatch | null) => void;
}

interface SelectOption {
  id: string;
  label: string;
  fontFamily?: string;
}

const ELEMENT_TYPE_LABELS: Record<CanvasLeafElement["type"], string> = {
  text: "文本",
  rect: "矩形",
  circle: "圆形",
  ellipse: "椭圆",
  line: "直线",
  arrow: "箭头",
  polygon: "多边形",
  star: "星形",
  image: "图片",
  chart: "图表",
  table: "表格",
};

const PROPERTY_LABEL_CLASS_NAME = "text-xs text-muted-foreground";
const PROPERTY_CONTROL_CLASS_NAME =
  "rounded-[calc(var(--radius-sm)-3px)] border-transparent bg-[color-mix(in_oklch,var(--muted)_76%,var(--card))] text-xs shadow-none focus-visible:border-ring md:text-xs";
const COMPACT_FIELD_GROUP_CLASS_NAME = "gap-2.5";

function LetterScrubIcon({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="font-mono text-xs leading-none font-semibold">
      {children}
    </span>
  );
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
                <span style={option.fontFamily ? { fontFamily: option.fontFamily } : undefined}>
                  {option.label}
                </span>
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
  icon,
  value,
  disabled,
  minValue,
  scrubDirection,
  scrubSensitivity,
  onChange,
  onPreview,
  onPreviewEnd,
}: {
  label: string;
  icon: ReactNode;
  value: number;
  disabled: boolean;
  minValue?: number;
  scrubDirection: ScrubDirection;
  scrubSensitivity: number;
  onChange: (value: number) => void;
  onPreview?: (value: number) => void;
  onPreviewEnd?: () => void;
}) {
  const id = useId();

  return (
    <Field>
      <FieldLabel className={PROPERTY_LABEL_CLASS_NAME} htmlFor={id}>
        {label}
      </FieldLabel>
      <ScrubbableNumberInput
        className="font-mono"
        containerClassName={PROPERTY_CONTROL_CLASS_NAME}
        disabled={disabled}
        icon={icon}
        id={id}
        inputStep={0.01}
        label={label}
        minValue={minValue}
        scrubDirection={scrubDirection}
        scrubSensitivity={scrubSensitivity}
        value={value}
        onScrubCancel={onPreviewEnd}
        onScrubCommit={
          onPreview
            ? (nextValue) => {
                onChange(nextValue);
                onPreviewEnd?.();
              }
            : undefined
        }
        onScrubPreview={onPreview}
        onValueChange={onChange}
      />
    </Field>
  );
}

function RotationField({
  value,
  disabled,
  onChange,
  onPreview,
  onPreviewEnd,
}: {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
  onPreview?: (value: number) => void;
  onPreviewEnd?: () => void;
}) {
  const id = useId();

  return (
    <Field>
      <FieldLabel className={PROPERTY_LABEL_CLASS_NAME} htmlFor={id}>
        角度
      </FieldLabel>
      <ScrubbableNumberInput
        allowUnlimitedFractionDigits
        className="font-mono text-xs"
        containerClassName={PROPERTY_CONTROL_CLASS_NAME}
        disabled={disabled}
        displaySuffix="°"
        icon={<TriangleRight aria-hidden="true" />}
        id={id}
        label="角度"
        scrubDirection="horizontal"
        scrubSensitivity={1}
        value={value}
        onScrubCancel={onPreviewEnd}
        onScrubCommit={
          onPreview
            ? (nextValue) => {
                onChange(nextValue);
                onPreviewEnd?.();
              }
            : undefined
        }
        onScrubPreview={onPreview}
        onValueChange={onChange}
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
      <ColorPicker disabled={disabled} value={value} onChange={onChange}>
        <Button
          aria-label={`${label}选择器`}
          className="h-8 w-full justify-start gap-2 rounded-[calc(var(--radius-sm)-3px)] border-transparent bg-[color-mix(in_oklch,var(--muted)_76%,var(--card))] px-2 font-mono text-xs text-muted-foreground shadow-none"
          disabled={disabled}
          id={id}
          type="button"
          variant="outline"
        >
          <span
            aria-hidden="true"
            className="size-[22px] shrink-0 rounded-[5px] border border-black/10"
            style={{ backgroundColor: value }}
          />
          <span>{value.toUpperCase()}</span>
        </Button>
      </ColorPicker>
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
  onPreview,
  onPreviewEnd,
}: {
  element: CanvasLeafElement;
  disabled: boolean;
  onUpdate: (patch: CanvasElementPatch) => void;
  onPreview?: (patch: CanvasElementPatch) => void;
  onPreviewEnd?: () => void;
}) {
  const textId = useId();

  switch (element.type) {
    case "text":
      return (
        <FieldGroup className={COMPACT_FIELD_GROUP_CLASS_NAME}>
          <Field>
            <FieldLabel className={PROPERTY_LABEL_CLASS_NAME} id={`${textId}-label`}>
              文本内容
            </FieldLabel>
            <div
              aria-labelledby={`${textId}-label`}
              aria-readonly="true"
              className={cn(
                PROPERTY_CONTROL_CLASS_NAME,
                "flex min-h-8 items-start overflow-x-hidden px-2.5 py-1.5 text-xs leading-5 whitespace-pre-wrap break-words",
                disabled && "cursor-not-allowed opacity-50",
              )}
              id={textId}
              role="textbox"
              tabIndex={0}
            >
              <span className="block min-w-0 flex-1">
                {markdownToPlainText(element.text) || ""}
              </span>
            </div>
          </Field>
          <EditorSelect
            disabled={disabled}
            label="字体"
            options={CANVAS_FONT_FAMILIES.map((font) => ({
              id: font.id,
              label: font.label,
              fontFamily: font.cssFamily,
            }))}
            value={element.fontFamily}
            onChange={(fontFamily) => {
              if (isCanvasFontFamily(fontFamily)) onUpdate({ fontFamily });
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <PropertyNumberField
              disabled={disabled}
              icon={<Type aria-hidden="true" />}
              label="字号"
              minValue={8}
              scrubDirection="horizontal"
              scrubSensitivity={1}
              value={element.fontSize}
              onChange={(fontSize) => onUpdate({ fontSize })}
              onPreview={(fontSize) => onPreview?.({ fontSize })}
              onPreviewEnd={onPreviewEnd}
            />
            <EditorSelect
              disabled={disabled}
              label="字重"
              options={[
                { id: "400", label: "400" },
                { id: "500", label: "500" },
                { id: "600", label: "600" },
                { id: "700", label: "700" },
                { id: "800", label: "800" },
              ]}
              value={element.fontWeight}
              onChange={(fontWeight) =>
                onUpdate({ fontWeight: fontWeight as typeof element.fontWeight })
              }
            />
          </div>
          <PropertyNumberField
            disabled={disabled}
            icon={<AlignVerticalSpaceAround aria-hidden="true" />}
            label="行高"
            minValue={0.5}
            scrubDirection="vertical"
            scrubSensitivity={0.01}
            value={element.lineHeight}
            onChange={(lineHeight) => onUpdate({ lineHeight })}
            onPreview={(lineHeight) => onPreview?.({ lineHeight })}
            onPreviewEnd={onPreviewEnd}
          />
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
          <ColorControl
            disabled={disabled}
            label="描边颜色"
            value={element.stroke}
            onChange={(stroke) => onUpdate({ stroke })}
          />
          <PropertyNumberField
            disabled={disabled}
            icon={<PenLine aria-hidden="true" />}
            label="描边宽度"
            minValue={0}
            scrubDirection="horizontal"
            scrubSensitivity={0.1}
            value={element.strokeWidth}
            onChange={(strokeWidth) => onUpdate({ strokeWidth })}
            onPreview={(strokeWidth) => onPreview?.({ strokeWidth })}
            onPreviewEnd={onPreviewEnd}
          />
          <PropertyNumberField
            disabled={disabled}
            icon={<SquareRoundCorner aria-hidden="true" />}
            label="圆角"
            minValue={0}
            scrubDirection="horizontal"
            scrubSensitivity={1}
            value={element.cornerRadius}
            onChange={(cornerRadius) => onUpdate({ cornerRadius })}
            onPreview={(cornerRadius) => onPreview?.({ cornerRadius })}
            onPreviewEnd={onPreviewEnd}
          />
        </FieldGroup>
      );
    case "circle":
    case "ellipse":
      return (
        <FieldGroup className={COMPACT_FIELD_GROUP_CLASS_NAME}>
          <ColorControl
            disabled={disabled}
            label="填充颜色"
            value={element.fill}
            onChange={(fill) => onUpdate({ fill })}
          />
          <ColorControl
            disabled={disabled}
            label="描边颜色"
            value={element.stroke}
            onChange={(stroke) => onUpdate({ stroke })}
          />
          <PropertyNumberField
            disabled={disabled}
            icon={<PenLine aria-hidden="true" />}
            label="描边宽度"
            minValue={0}
            scrubDirection="horizontal"
            scrubSensitivity={0.1}
            value={element.strokeWidth}
            onChange={(strokeWidth) => onUpdate({ strokeWidth })}
            onPreview={(strokeWidth) => onPreview?.({ strokeWidth })}
            onPreviewEnd={onPreviewEnd}
          />
        </FieldGroup>
      );
    case "line":
      return (
        <FieldGroup className={COMPACT_FIELD_GROUP_CLASS_NAME}>
          <ColorControl
            disabled={disabled}
            label="描边颜色"
            value={element.stroke}
            onChange={(stroke) => onUpdate({ stroke })}
          />
          <PropertyNumberField
            disabled={disabled}
            icon={<PenLine aria-hidden="true" />}
            label="描边宽度"
            minValue={0}
            scrubDirection="horizontal"
            scrubSensitivity={0.1}
            value={element.strokeWidth}
            onChange={(strokeWidth) => onUpdate({ strokeWidth })}
            onPreview={(strokeWidth) => onPreview?.({ strokeWidth })}
            onPreviewEnd={onPreviewEnd}
          />
        </FieldGroup>
      );
    case "arrow":
      return (
        <FieldGroup className={COMPACT_FIELD_GROUP_CLASS_NAME}>
          <ColorControl
            disabled={disabled}
            label="描边颜色"
            value={element.stroke}
            onChange={(stroke) => onUpdate({ stroke })}
          />
          <PropertyNumberField
            disabled={disabled}
            icon={<PenLine aria-hidden="true" />}
            label="描边宽度"
            minValue={0}
            scrubDirection="horizontal"
            scrubSensitivity={0.1}
            value={element.strokeWidth}
            onChange={(strokeWidth) => onUpdate({ strokeWidth })}
            onPreview={(strokeWidth) => onPreview?.({ strokeWidth })}
            onPreviewEnd={onPreviewEnd}
          />
          <div className="grid grid-cols-2 gap-2">
            <PropertyNumberField
              disabled={disabled}
              icon={<MoveRight aria-hidden="true" />}
              label="箭头长度"
              minValue={1}
              scrubDirection="horizontal"
              scrubSensitivity={1}
              value={element.pointerLength}
              onChange={(pointerLength) => onUpdate({ pointerLength })}
              onPreview={(pointerLength) => onPreview?.({ pointerLength })}
              onPreviewEnd={onPreviewEnd}
            />
            <PropertyNumberField
              disabled={disabled}
              icon={<ArrowLeftRight aria-hidden="true" />}
              label="箭头宽度"
              minValue={1}
              scrubDirection="horizontal"
              scrubSensitivity={1}
              value={element.pointerWidth}
              onChange={(pointerWidth) => onUpdate({ pointerWidth })}
              onPreview={(pointerWidth) => onPreview?.({ pointerWidth })}
              onPreviewEnd={onPreviewEnd}
            />
          </div>
        </FieldGroup>
      );
    case "polygon":
      return (
        <FieldGroup className={COMPACT_FIELD_GROUP_CLASS_NAME}>
          <ColorControl
            disabled={disabled}
            label="填充颜色"
            value={element.fill}
            onChange={(fill) => onUpdate({ fill })}
          />
          <ColorControl
            disabled={disabled}
            label="描边颜色"
            value={element.stroke}
            onChange={(stroke) => onUpdate({ stroke })}
          />
          <PropertyNumberField
            disabled={disabled}
            icon={<PenLine aria-hidden="true" />}
            label="描边宽度"
            minValue={0}
            scrubDirection="horizontal"
            scrubSensitivity={0.1}
            value={element.strokeWidth}
            onChange={(strokeWidth) => onUpdate({ strokeWidth })}
            onPreview={(strokeWidth) => onPreview?.({ strokeWidth })}
            onPreviewEnd={onPreviewEnd}
          />
          <div className="grid grid-cols-2 gap-2">
            <PropertyNumberField
              disabled={disabled}
              icon={<Hash aria-hidden="true" />}
              label="边数"
              minValue={3}
              scrubDirection="horizontal"
              scrubSensitivity={0.125}
              value={element.sides}
              onChange={(sides) => onUpdate({ sides: Math.round(sides) })}
              onPreview={(sides) => onPreview?.({ sides: Math.round(sides) })}
              onPreviewEnd={onPreviewEnd}
            />
            <PropertyNumberField
              disabled={disabled}
              icon={<SquareRoundCorner aria-hidden="true" />}
              label="圆角"
              minValue={0}
              scrubDirection="horizontal"
              scrubSensitivity={1}
              value={element.cornerRadius}
              onChange={(cornerRadius) => onUpdate({ cornerRadius })}
              onPreview={(cornerRadius) => onPreview?.({ cornerRadius })}
              onPreviewEnd={onPreviewEnd}
            />
          </div>
        </FieldGroup>
      );
    case "star":
      return (
        <FieldGroup className={COMPACT_FIELD_GROUP_CLASS_NAME}>
          <ColorControl
            disabled={disabled}
            label="填充颜色"
            value={element.fill}
            onChange={(fill) => onUpdate({ fill })}
          />
          <ColorControl
            disabled={disabled}
            label="描边颜色"
            value={element.stroke}
            onChange={(stroke) => onUpdate({ stroke })}
          />
          <PropertyNumberField
            disabled={disabled}
            icon={<PenLine aria-hidden="true" />}
            label="描边宽度"
            minValue={0}
            scrubDirection="horizontal"
            scrubSensitivity={0.1}
            value={element.strokeWidth}
            onChange={(strokeWidth) => onUpdate({ strokeWidth })}
            onPreview={(strokeWidth) => onPreview?.({ strokeWidth })}
            onPreviewEnd={onPreviewEnd}
          />
          <PropertyNumberField
            disabled={disabled}
            icon={<Hash aria-hidden="true" />}
            label="角数"
            minValue={2}
            scrubDirection="horizontal"
            scrubSensitivity={0.125}
            value={element.numPoints}
            onChange={(numPoints) => onUpdate({ numPoints: Math.round(numPoints) })}
            onPreview={(numPoints) => onPreview?.({ numPoints: Math.round(numPoints) })}
            onPreviewEnd={onPreviewEnd}
          />
          <div className="grid grid-cols-2 gap-2">
            <PropertyNumberField
              disabled={disabled}
              icon={<Radius aria-hidden="true" />}
              label="内半径"
              minValue={1}
              scrubDirection="horizontal"
              scrubSensitivity={1}
              value={element.innerRadius}
              onChange={(innerRadius) => onUpdate({ innerRadius })}
              onPreview={(innerRadius) => onPreview?.({ innerRadius })}
              onPreviewEnd={onPreviewEnd}
            />
            <PropertyNumberField
              disabled={disabled}
              icon={<Radius aria-hidden="true" />}
              label="外半径"
              minValue={1}
              scrubDirection="horizontal"
              scrubSensitivity={1}
              value={element.outerRadius}
              onChange={(outerRadius) =>
                onUpdate({ outerRadius, width: outerRadius * 2, height: outerRadius * 2 })
              }
              onPreview={(outerRadius) =>
                onPreview?.({ outerRadius, width: outerRadius * 2, height: outerRadius * 2 })
              }
              onPreviewEnd={onPreviewEnd}
            />
          </div>
        </FieldGroup>
      );
    case "image":
      return (
        <FieldGroup className={COMPACT_FIELD_GROUP_CLASS_NAME}>
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
          <PropertyNumberField
            disabled={disabled}
            icon={<SquareRoundCorner aria-hidden="true" />}
            label="圆角"
            minValue={0}
            scrubDirection="horizontal"
            scrubSensitivity={1}
            value={element.cornerRadius}
            onChange={(cornerRadius) => onUpdate({ cornerRadius })}
            onPreview={(cornerRadius) => onPreview?.({ cornerRadius })}
            onPreviewEnd={onPreviewEnd}
          />
        </FieldGroup>
      );
    case "chart":
      return <ChartFields disabled={disabled} element={element} onUpdate={onUpdate} />;
    case "table":
      return (
        <TableFields
          disabled={disabled}
          element={element}
          onPreview={onPreview}
          onPreviewEnd={onPreviewEnd}
          onUpdate={onUpdate}
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
  onPreview,
}: PropertiesPanelProps) {
  const nameId = useId();
  const canRotate = selectedElement?.type !== "chart" && selectedElement?.type !== "table";

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
        <h2 className="m-0 max-w-[210px] overflow-hidden text-xs text-ellipsis whitespace-nowrap">
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
            <h3 className="m-0 text-xs">位置与尺寸</h3>
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
                icon={<LetterScrubIcon>X</LetterScrubIcon>}
                label="X"
                scrubDirection="horizontal"
                scrubSensitivity={1}
                value={selectedElement.x}
                onChange={(x) => onUpdate({ x })}
                onPreview={(x) => onPreview?.({ x })}
                onPreviewEnd={() => onPreview?.(null)}
              />
              <PropertyNumberField
                disabled={isLocked}
                icon={<LetterScrubIcon>Y</LetterScrubIcon>}
                label="Y"
                scrubDirection="vertical"
                scrubSensitivity={1}
                value={selectedElement.y}
                onChange={(y) => onUpdate({ y })}
                onPreview={(y) => onPreview?.({ y })}
                onPreviewEnd={() => onPreview?.(null)}
              />
              <PropertyNumberField
                disabled={isLocked}
                icon={<RulerDimensionLine aria-hidden="true" />}
                label="宽"
                minValue={8}
                scrubDirection="horizontal"
                scrubSensitivity={1}
                value={selectedElement.width}
                onChange={(width) => onUpdate({ width: Math.max(8, width) })}
                onPreview={(width) => onPreview?.({ width: Math.max(8, width) })}
                onPreviewEnd={() => onPreview?.(null)}
              />
              <PropertyNumberField
                disabled={isLocked}
                icon={<RulerDimensionLine aria-hidden="true" className="rotate-90" />}
                label="高"
                minValue={8}
                scrubDirection="vertical"
                scrubSensitivity={1}
                value={selectedElement.height}
                onChange={(height) => onUpdate({ height: Math.max(8, height) })}
                onPreview={(height) => onPreview?.({ height: Math.max(8, height) })}
                onPreviewEnd={() => onPreview?.(null)}
              />
            </div>

            {canRotate ? (
              <RotationField
                disabled={isLocked}
                value={selectedElement.rotation}
                onChange={(rotation) => onUpdate({ rotation })}
                onPreview={(rotation) => onPreview?.({ rotation })}
                onPreviewEnd={() => onPreview?.(null)}
              />
            ) : null}
          </FieldGroup>
        </section>

        <Separator />

        <section className="flex flex-col gap-3 p-3.5">
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-xs">外观</h3>
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
            <h3 className="m-0 text-xs">
              {selectedElement.type === "text"
                ? "文字"
                : selectedElement.type === "chart" || selectedElement.type === "table"
                  ? "数据"
                  : "元素样式"}
            </h3>
          </div>
          <ElementSpecificFields
            key={selectedElement.id}
            disabled={isLocked}
            element={selectedElement}
            onUpdate={onUpdate}
            onPreview={(patch) => onPreview?.(patch)}
            onPreviewEnd={() => onPreview?.(null)}
          />
        </section>
      </ScrollArea>
    </div>
  );
});
