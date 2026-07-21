import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, RotateCcw } from "lucide-react";
import * as React from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";

const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;

const COLOR_PRESETS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#ec4899",
  "#8b5cf6",
  "#0ea5e9",
  "#10b981",
  "#84cc16",
] as const;

interface ColorPickerProps {
  children: React.ReactElement;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onReset?: () => void;
}

function normalizeColor(value: string): string {
  return HEX_COLOR_PATTERN.test(value) ? value.toLowerCase() : "#000000";
}

export function ColorPicker({
  children,
  disabled = false,
  onChange,
  onOpenChange,
  onReset,
  open,
  value: rawValue,
}: ColorPickerProps) {
  const value = normalizeColor(rawValue);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="ignore-click-outside/toolbar w-[218px] gap-3 p-3"
        data-canvas-rich-text-popup="true"
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <HexColorPicker
          aria-label="颜色选择区域"
          className={String.raw`[&.react-colorful]:h-[150px] [&.react-colorful]:w-full [&_.react-colorful\_\_hue]:mt-2 [&_.react-colorful\_\_hue]:h-2.5 [&_.react-colorful\_\_hue]:rounded-full [&_.react-colorful\_\_interactive]:rounded-[inherit] [&_.react-colorful\_\_pointer]:size-4 [&_.react-colorful\_\_pointer]:border-2 [&_.react-colorful\_\_saturation]:rounded-[6px] [&_.react-colorful\_\_saturation]:border-b-0`}
          color={value}
          onChange={onChange}
        />

        <div className="flex h-8 items-center overflow-hidden rounded-md border border-input bg-background">
          <span className="border-r border-input px-2 text-[11px] text-muted-foreground">Hex</span>
          <HexColorInput
            aria-label="Hex 颜色"
            className="min-w-0 flex-1 bg-transparent px-2 font-mono text-xs uppercase outline-none"
            color={value}
            prefixed
            onChange={onChange}
          />
          <span
            aria-hidden="true"
            className="mr-1.5 size-4 shrink-0 rounded-sm border border-black/10"
            style={{ backgroundColor: value }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">预设颜色</span>
          {onReset ? (
            <Button className="h-6 px-1.5 text-[11px]" size="xs" variant="ghost" onClick={onReset}>
              <RotateCcw aria-hidden="true" data-icon="inline-start" />
              清除
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-6 gap-2" role="group" aria-label="预设颜色">
          {COLOR_PRESETS.map((preset) => {
            const normalizedPreset = normalizeColor(preset);
            const selected = normalizedPreset === value;

            return (
              <button
                aria-label={`选择颜色 ${normalizedPreset}`}
                aria-pressed={selected}
                className="flex size-6 items-center justify-center rounded-full border border-black/5 text-white shadow-xs outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
                key={normalizedPreset}
                style={{ backgroundColor: normalizedPreset }}
                type="button"
                onClick={() => onChange(normalizedPreset)}
                onMouseDown={(event) => event.preventDefault()}
              >
                {selected ? (
                  <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
