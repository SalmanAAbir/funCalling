"use client";

import { useEffect, useRef } from "react";
import { MicOff, VideoOff } from "lucide-react";
import { FILTERS, type FilterId } from "@/lib/filters";
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
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const filterMeta = FILTERS.find((f) => f.id === filter);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
  }, [stream]);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10",
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
            "h-full w-full object-cover",
            mirrored && "scale-x-[-1]",
          )}
        />
      ) : (
        <div className="flex h-full min-h-40 w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
          <div className="flex size-16 items-center justify-center rounded-full bg-teal-500/20 text-2xl font-semibold text-teal-200">
            {(name || "G").slice(0, 1).toUpperCase()}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3 pt-10">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {name}
              {isLocal ? " (you)" : ""}
            </p>
            {filter !== "none" && (
              <p className="truncate text-xs text-teal-200/90">
                {filterMeta?.emoji} {filterMeta?.label}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!audioEnabled && (
              <span className="rounded-full bg-red-500/90 p-1.5 text-white">
                <MicOff className="size-3.5" />
              </span>
            )}
            {!videoEnabled && (
              <span className="rounded-full bg-red-500/90 p-1.5 text-white">
                <VideoOff className="size-3.5" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
