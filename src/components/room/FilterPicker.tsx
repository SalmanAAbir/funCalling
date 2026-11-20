"use client";

import { useMemo, useState } from "react";
import {
  FILTERS,
  FILTER_CATEGORIES,
  type FilterCategory,
  type FilterId,
} from "@/lib/filters";
import { cn } from "@/lib/utils";

type FilterPickerProps = {
  value: FilterId;
  onChange: (id: FilterId) => void;
  open: boolean;
  onClose: () => void;
};

export function FilterPicker({
  value,
  onChange,
  open,
  onClose,
}: FilterPickerProps) {
  const [category, setCategory] = useState<FilterCategory | "all">("all");

  const items = useMemo(() => {
    if (category === "all") return FILTERS;
    return FILTERS.filter((f) => f.category === category || f.id === "none");
  }, [category]);

  if (!open) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 animate-in slide-in-from-bottom-4 duration-200">
      <button
        type="button"
        className="absolute inset-x-0 -top-[40vh] h-[40vh]"
        aria-label="Close filters"
        onClick={onClose}
      />
      <div className="rounded-t-3xl border border-white/10 border-b-0 bg-slate-950/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-xl">
        <div className="flex justify-center pt-2">
          <div className="h-1 w-10 rounded-full bg-white/25" />
        </div>
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <p className="text-sm font-semibold text-white">
            Filters{" "}
            <span className="font-normal text-slate-400">
              · {FILTERS.length - 1}
            </span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-teal-300"
          >
            Done
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-3 pb-3 scrollbar-none">
          {FILTER_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                category === c.id
                  ? "bg-teal-400 text-slate-950"
                  : "bg-white/8 text-slate-300",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="max-h-[42vh] overflow-y-auto overscroll-contain px-3 pb-3">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {items.map((filter) => {
              const active = value === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => onChange(filter.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl px-1.5 py-3 text-center transition active:scale-95",
                    active
                      ? "bg-teal-400/20 ring-2 ring-teal-300"
                      : "bg-white/5",
                  )}
                >
                  <span className="text-[1.75rem] leading-none">
                    {filter.emoji}
                  </span>
                  <span className="text-[10px] font-medium text-slate-200">
                    {filter.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
