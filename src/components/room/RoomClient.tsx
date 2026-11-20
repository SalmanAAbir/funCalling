"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaceFilterPipeline } from "@/lib/face-filter";
import { PeerRoom, type PeerUser } from "@/lib/peer-room";
import type { FilterId } from "@/lib/filters";
import { VideoTile } from "./VideoTile";
import { ControlBar } from "./ControlBar";
import { FilterPicker } from "./FilterPicker";
import { cn } from "@/lib/utils";

type RoomClientProps = {
  roomId: string;
  initialName: string;
};

export function RoomClient({ roomId, initialName }: RoomClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState("Starting camera…");
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<PeerUser[]>([]);
  const [filter, setFilter] = useState<FilterId>("none");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipelineRef = useRef<FaceFilterPipeline | null>(null);
  const roomRef = useRef<PeerRoom | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);

  const displayName = useMemo(
    () => initialName.trim() || "Guest",
    [initialName],
  );

  const gridClass = useMemo(() => {
    const count = Math.max(peers.length, 1);
    if (count === 1) return "grid-cols-1 max-w-3xl mx-auto";
    if (count === 2) return "grid-cols-1 md:grid-cols-2";
    if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
    return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
  }, [peers.length]);

  const cleanup = useCallback(() => {
    roomRef.current?.leave();
    roomRef.current = null;
    pipelineRef.current?.destroy();
    pipelineRef.current = null;
    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    rawStreamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const raw = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          raw.getTracks().forEach((t) => t.stop());
          return;
        }
        rawStreamRef.current = raw;

        const video = hiddenVideoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) throw new Error("Media elements missing");

        setStatus("Loading face filters…");
        const pipeline = new FaceFilterPipeline(video, canvas);
        await pipeline.init();
        if (cancelled) {
          pipeline.destroy();
          return;
        }
        pipelineRef.current = pipeline;
        pipeline.setFilter("none");
        const outgoing = pipeline.start(raw);

        setStatus("Connecting to room…");
        const room = new PeerRoom(roomId, displayName, {
          onPeers: (list) => setPeers(list),
          onStatus: (s) => setStatus(s),
          onError: (message) => setError(message),
        });
        roomRef.current = room;
        await room.join(outgoing, "none");
        if (!cancelled) setReady(true);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not start camera or join room",
          );
          setStatus("Failed");
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [cleanup, displayName, roomId]);

  function applyFilter(next: FilterId) {
    setFilter(next);
    pipelineRef.current?.setFilter(next);
    roomRef.current?.setFilter(next);
  }

  function toggleAudio() {
    const next = !audioEnabled;
    setAudioEnabled(next);
    const stream = pipelineRef.current?.getOutputStream();
    stream?.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    rawStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
  }

  function toggleVideo() {
    const next = !videoEnabled;
    setVideoEnabled(next);
    const stream = pipelineRef.current?.getOutputStream();
    stream?.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    rawStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
  }

  function leave() {
    cleanup();
    router.push("/");
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-[#0f1419] text-white">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div>
          <p className="text-sm font-semibold tracking-tight">
            FunCall{" "}
            <span className="font-normal text-slate-400">/ {roomId}</span>
          </p>
          <p className="text-xs text-slate-400">{status}</p>
        </div>
        <div className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10">
          {peers.length} in call
        </div>
      </header>

      {error && (
        <div className="mx-4 mb-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100 sm:mx-6">
          {error}
        </div>
      )}

      <main className="relative flex flex-1 flex-col px-3 pb-28 sm:px-5">
        <div className={cn("grid flex-1 gap-3", gridClass)}>
          {peers.map((peer) => (
            <VideoTile
              key={peer.peerId}
              stream={peer.stream}
              name={peer.name}
              filter={peer.filter}
              isLocal={peer.isLocal}
              mirrored={Boolean(peer.isLocal)}
              audioEnabled={peer.isLocal ? audioEnabled : true}
              videoEnabled={peer.isLocal ? videoEnabled : true}
              className="min-h-[220px] sm:min-h-[280px]"
            />
          ))}
          {!ready && peers.length === 0 && (
            <div className="flex min-h-[280px] items-center justify-center rounded-2xl bg-slate-900/80 ring-1 ring-white/10">
              <p className="text-sm text-slate-400">{status}</p>
            </div>
          )}
        </div>
      </main>

      <FilterPicker
        open={filtersOpen}
        value={filter}
        onChange={(id) => {
          applyFilter(id);
        }}
      />

      <ControlBar
        roomId={roomId}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        filtersOpen={filtersOpen}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
        onLeave={leave}
      />

      {/* Hidden capture targets for the filter pipeline */}
      <video ref={hiddenVideoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
