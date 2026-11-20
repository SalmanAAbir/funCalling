"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaceFilterPipeline } from "@/lib/face-filter";
import { PeerRoom, type PeerUser } from "@/lib/peer-room";
import { FILTERS, type FilterId } from "@/lib/filters";
import { VideoTile } from "./VideoTile";
import { DraggablePip } from "./DraggablePip";
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
  const [localPreview, setLocalPreview] = useState<MediaStream | null>(null);
  const [filter, setFilter] = useState<FilterId>("none");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipelineRef = useRef<FaceFilterPipeline | null>(null);
  const roomRef = useRef<PeerRoom | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const filterRef = useRef<FilterId>(filter);
  filterRef.current = filter;

  const displayName = useMemo(
    () => initialName.trim() || "Guest",
    [initialName],
  );

  const localPeer = useMemo(
    () => peers.find((p) => p.isLocal),
    [peers],
  );

  const remotePeers = useMemo(
    () => peers.filter((p) => !p.isLocal),
    [peers],
  );

  const localStream = localPeer?.stream ?? localPreview ?? undefined;
  const hasRemotes = remotePeers.length > 0;

  const remoteGrid = useMemo(() => {
    const n = remotePeers.length;
    if (n <= 1) return "grid-cols-1 grid-rows-1";
    if (n === 2)
      return "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1";
    if (n <= 4) return "grid-cols-2 grid-rows-2";
    return "grid-cols-2 grid-rows-3 md:grid-cols-3";
  }, [remotePeers.length]);

  const cleanup = useCallback(() => {
    roomRef.current?.leave();
    roomRef.current = null;
    pipelineRef.current?.destroy();
    pipelineRef.current = null;
    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    rawStreamRef.current = null;
    setLocalPreview(null);
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

        setStatus("Loading filters…");
        const pipeline = new FaceFilterPipeline(video, canvas);
        await pipeline.init();
        if (cancelled) {
          pipeline.destroy();
          return;
        }
        pipelineRef.current = pipeline;
        pipeline.setFilter("none");
        const outgoing = await pipeline.start(raw);
        if (cancelled) {
          outgoing.getTracks().forEach((t) => t.stop());
          return;
        }
        setLocalPreview(outgoing);

        setStatus("Connecting…");
        const room = new PeerRoom(roomId, displayName, {
          onPeers: (list) => setPeers(list),
          onStatus: (s) => setStatus(s),
          onError: (message) => setError(message),
        });
        roomRef.current = room;
        await room.join(outgoing, "none");
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

  const applyFilter = useCallback((next: FilterId) => {
    setFilter(next);
    pipelineRef.current?.setFilter(next);
    roomRef.current?.setFilter(next);
  }, []);

  const shiftFilter = useCallback(
    (delta: number) => {
      const index = FILTERS.findIndex((f) => f.id === filterRef.current);
      const current = index < 0 ? 0 : index;
      const next =
        FILTERS[(current + delta + FILTERS.length) % FILTERS.length];
      applyFilter(next.id);
      setFiltersOpen(true);
    },
    [applyFilter],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        shiftFilter(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        shiftFilter(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shiftFilter]);

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
    <div className="fixed inset-0 h-dvh w-screen overflow-hidden bg-black text-white">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-3 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
        <div className="pointer-events-auto min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight drop-shadow">
            FunCall{" "}
            <span className="font-normal text-white/70">/ {roomId}</span>
          </p>
          <p className="truncate text-xs text-white/60">{status}</p>
        </div>
        <div className="pointer-events-auto shrink-0 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white/80 ring-1 ring-white/15 backdrop-blur">
          {Math.max(peers.length, localPreview ? 1 : 0)}
        </div>
      </header>

      {error && (
        <div className="absolute inset-x-3 top-16 z-30 rounded-xl border border-red-400/30 bg-red-950/90 px-3 py-2 text-sm text-red-100 backdrop-blur">
          {error}
        </div>
      )}

      {/* Main stage: remotes full-bleed, or local full-screen when alone */}
      <div className="absolute inset-0">
        {hasRemotes ? (
          <div className={cn("grid h-full w-full gap-px bg-black", remoteGrid)}>
            {remotePeers.map((peer) => (
              <VideoTile
                key={peer.peerId}
                stream={peer.stream}
                name={peer.name}
                filter={peer.filter}
                className="min-h-0 min-w-0"
              />
            ))}
          </div>
        ) : (
          <VideoTile
            stream={localStream}
            name={displayName}
            filter={filter}
            isLocal
            mirrored
            audioEnabled={audioEnabled}
            videoEnabled={videoEnabled}
            className="h-full w-full"
          />
        )}
      </div>

      {/* Messenger-style floating self view when others are in the call */}
      {hasRemotes && (
        <DraggablePip
          stream={localStream}
          name={displayName}
          filter={filter}
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
        />
      )}

      {!localPreview && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
          <p className="text-sm text-slate-300">{status}</p>
        </div>
      )}

      <FilterPicker
        open={filtersOpen}
        value={filter}
        onChange={applyFilter}
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

      <video ref={hiddenVideoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
