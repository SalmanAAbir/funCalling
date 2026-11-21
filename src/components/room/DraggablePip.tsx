"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VideoTile } from "./VideoTile";
import type { FilterId } from "@/lib/filters";
import { cn } from "@/lib/utils";

type Corner = "tl" | "tr" | "bl" | "br";

type DraggablePipProps = {
  stream?: MediaStream;
  name: string;
  filter: FilterId;
  audioEnabled: boolean;
  videoEnabled: boolean;
  defaultCorner?: Corner;
};

const PAD = 12;
const PIP_W = 120;
const PIP_H = 160;

function cornerPos(
  corner: Corner,
  vw: number,
  vh: number,
): { x: number; y: number } {
  switch (corner) {
    case "tl":
      return { x: PAD, y: PAD + 52 };
    case "tr":
      return { x: vw - PIP_W - PAD, y: PAD + 52 };
    case "bl":
      return { x: PAD, y: vh - PIP_H - PAD - 88 };
    case "br":
    default:
      return { x: vw - PIP_W - PAD, y: vh - PIP_H - PAD - 88 };
  }
}

function nearestCorner(x: number, y: number, vw: number, vh: number): Corner {
  const cx = x + PIP_W / 2;
  const cy = y + PIP_H / 2;
  const corners: Corner[] = ["tl", "tr", "bl", "br"];
  let best: Corner = "tr";
  let bestDist = Infinity;
  for (const c of corners) {
    const p = cornerPos(c, vw, vh);
    const d = Math.hypot(cx - (p.x + PIP_W / 2), cy - (p.y + PIP_H / 2));
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

export function DraggablePip({
  stream,
  name,
  filter,
  audioEnabled,
  videoEnabled,
  defaultCorner = "tr",
}: DraggablePipProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const posRef = useRef(pos);
  posRef.current = pos;

  const placeDefault = useCallback(() => {
    setPos(cornerPos(defaultCorner, window.innerWidth, window.innerHeight));
    setReady(true);
  }, [defaultCorner]);

  useEffect(() => {
    placeDefault();
    function onResize() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const corner = nearestCorner(posRef.current.x, posRef.current.y, vw, vh);
      setPos(cornerPos(corner, vw, vh));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [placeDefault]);

  function clamp(x: number, y: number) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: Math.min(Math.max(PAD, x), vw - PIP_W - PAD),
      y: Math.min(Math.max(PAD, y), vh - PIP_H - PAD),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    offset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    setPos(clamp(e.clientX - offset.current.x, e.clientY - offset.current.y));
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    const corner = nearestCorner(
      pos.x,
      pos.y,
      window.innerWidth,
      window.innerHeight,
    );
    setPos(cornerPos(corner, window.innerWidth, window.innerHeight));
  }

  if (!ready) return null;

  return (
    <div
      className={cn(
        "absolute z-40 touch-none select-none overflow-hidden rounded-2xl shadow-2xl ring-2 ring-white/35",
        "cursor-grab active:cursor-grabbing",
      )}
      style={{
        left: pos.x,
        top: pos.y,
        width: PIP_W,
        height: PIP_H,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <VideoTile
        stream={stream}
        name={name}
        filter={filter}
        isLocal
        mirrored
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        className="h-full w-full rounded-2xl"
        compact
      />
    </div>
  );
}
