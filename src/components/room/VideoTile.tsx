"use client";

import { useEffect, useRef } from "react";
import { MicOff, VideoOff } from "lucide-react";
import { getFilter, type FilterId } from "@/lib/filters";
import { cn } from "@/lib/utils";

type VideoTileProps = {
  stream?: MediaStream;
  name: string;
  filter: FilterId;
  isLocal?: boolean;
  mirrored?: boolean;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  className?: string;
  compact?: boolean;
};

export function VideoTile({
  stream,
  name,
  filter,
  isLocal,
  mirrored = false,
  audioEnabled = true,
  videoEnabled = true,
  className,
  compact = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const filterMeta = getFilter(filter);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
  }, [stream]);

  return (
    <div
      className={cn(
        "relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-black",
        className,
      )}
    >
      {stream && videoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn(
            "absolute inset-0 size-full object-contain",
            mirrored && "scale-x-[-1]",
          )}
        />
      ) : (
        <div className="absolute inset-0 flex size-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
          <div
            className={cn(
              "flex items-center justify-center rounded-full bg-teal-500/20 font-semibold text-teal-200",
              compact ? "size-10 text-base" : "size-20 text-3xl",
            )}
          >
            {(name || "G").slice(0, 1).toUpperCase()}
          </div>
        </div>
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent",
          compact
            ? "p-1.5 pt-6"
            : "p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-12",
        )}
      >
        <div className="flex items-end justify-between gap-1">
          <div className="min-w-0">
            <p
              className={cn(
                "truncate font-medium text-white drop-shadow",
                compact ? "text-[10px]" : "text-sm",
              )}
            >
              {name}
              {isLocal ? " (you)" : ""}
            </p>
            {!compact && filter !== "none" && (
              <p className="truncate text-xs text-white/80">
                {filterMeta.emoji} {filterMeta.label}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!audioEnabled && (
              <span className="rounded-full bg-red-500/90 p-1 text-white">
                <MicOff className={compact ? "size-2.5" : "size-3.5"} />
              </span>
            )}
            {!videoEnabled && (
              <span className="rounded-full bg-red-500/90 p-1 text-white">
                <VideoOff className={compact ? "size-2.5" : "size-3.5"} />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
