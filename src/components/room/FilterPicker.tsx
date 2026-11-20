"use client";

import { FILTERS, type FilterId } from "@/lib/filters";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type FilterPickerProps = {
  value: FilterId;
  onChange: (id: FilterId) => void;
  open: boolean;
};

export function FilterPicker({ value, onChange, open }: FilterPickerProps) {
  if (!open) return null;

  return (
    <div className="absolute bottom-24 left-1/2 z-30 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
      <p className="mb-2 px-1 text-xs font-medium tracking-wide text-slate-400 uppercase">
        Face filters
      </p>
      <ScrollArea className="w-full">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {FILTERS.map((filter) => {
            const active = value === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => onChange(filter.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-center transition",
                  active
                    ? "bg-teal-400/20 ring-2 ring-teal-300/70"
                    : "bg-white/5 hover:bg-white/10",
                )}
                title={filter.description}
              >
                <span className="text-2xl leading-none">{filter.emoji}</span>
                <span className="text-[10px] font-medium text-slate-200">
                  {filter.label}
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
