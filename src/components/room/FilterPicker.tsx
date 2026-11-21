"use client";

import { useEffect, useRef } from "react";
import { FILTERS, type FilterId } from "@/lib/filters";
import { cn } from "@/lib/utils";

export type FilterScope = "self" | "everyone";

type FilterPickerProps = {
  value: FilterId;
  onChange: (id: FilterId) => void;
  open: boolean;
  scope: FilterScope;
  onScopeChange: (scope: FilterScope) => void;
};

export function FilterPicker({
  value,
  onChange,
  open,
  scope,
  onScopeChange,
}: FilterPickerProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const active = FILTERS.find((f) => f.id === value) ?? FILTERS[0];

  useEffect(() => {
    if (!open) return;
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [open, value]);

  return (
    <>
      {value !== "none" && (
        <div className="pointer-events-none absolute left-1/2 top-[max(3.5rem,env(safe-area-inset-top)+2.75rem)] z-30 -translate-x-1/2">
          <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur-md">
            <span>{active.emoji}</span>
            <span>{active.label}</span>
            <span className="text-white/50">·</span>
            <span className="text-white/70">
              {scope === "everyone" ? "Everyone" : "Me"}
            </span>
          </div>
        </div>
      )}

      {open && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[5.75rem] z-30 pb-[env(safe-area-inset-bottom)] sm:bottom-28">
          <div className="pointer-events-auto mx-auto w-full max-w-full space-y-2">
            <div className="flex justify-center px-4">
              <div className="inline-flex rounded-full bg-black/60 p-1 ring-1 ring-white/15 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => onScopeChange("self")}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-semibold transition",
                    scope === "self"
                      ? "bg-white text-black"
                      : "text-white/70 hover:text-white",
                  )}
                >
                  For myself
                </button>
                <button
                  type="button"
                  onClick={() => onScopeChange("everyone")}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-semibold transition",
                    scope === "everyone"
                      ? "bg-teal-400 text-slate-950"
                      : "text-white/70 hover:text-white",
                  )}
                >
                  For everyone
                </button>
              </div>
            </div>

            <div
              className="flex items-center gap-3 overflow-x-auto overscroll-x-contain px-4 py-2 scrollbar-none"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {FILTERS.map((filter) => {
                const isActive = value === filter.id;
                return (
                  <button
                    key={filter.id}
                    ref={isActive ? activeRef : undefined}
                    type="button"
                    aria-label={filter.label}
                    aria-pressed={isActive}
                    title={filter.label}
                    onClick={() => onChange(filter.id)}
                    className={cn(
                      "relative flex size-14 shrink-0 items-center justify-center rounded-full transition active:scale-95",
                      isActive
                        ? "ring-[3px] ring-white ring-offset-2 ring-offset-black"
                        : "ring-1 ring-white/20",
                    )}
                    style={{ backgroundColor: filter.swatch }}
                  >
                    <span className="text-[1.65rem] leading-none drop-shadow-sm">
                      {filter.id === "none" ? (
                        <span className="text-lg font-semibold text-white/90">
                          ∅
                        </span>
                      ) : (
                        filter.emoji
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
