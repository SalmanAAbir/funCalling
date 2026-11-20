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
        "relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-zinc-950",
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
            "absolute inset-0 size-full object-cover",
            mirrored && "scale-x-[-1]",
          )}
        />
      ) : (
        <div className="absolute inset-0 flex size-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
          <div className="flex size-20 items-center justify-center rounded-full bg-teal-500/20 text-3xl font-semibold text-teal-200">
            {(name || "G").slice(0, 1).toUpperCase()}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-12">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white drop-shadow">
              {name}
              {isLocal ? " (you)" : ""}
            </p>
            {filter !== "none" && (
              <p className="truncate text-xs text-teal-200/95">
                {filterMeta.emoji} {filterMeta.label}
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
