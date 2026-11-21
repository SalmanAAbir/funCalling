"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaceFilterPipeline } from "@/lib/face-filter";
import { PeerRoom, type PeerUser } from "@/lib/peer-room";
import { FILTERS, type FilterId } from "@/lib/filters";
import { VideoTile } from "./VideoTile";
import { DraggablePip } from "./DraggablePip";
import { ControlBar } from "./ControlBar";
import { FilterPicker, type FilterScope } from "./FilterPicker";
import { cn } from "@/lib/utils";

type RoomClientProps = {
  roomId: string;
  initialName: string;
};

function hasLiveVideo(stream?: MediaStream) {
  return Boolean(
    stream?.getVideoTracks().some((t) => t.readyState === "live"),
  );
}

export function RoomClient({ roomId, initialName }: RoomClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState("Starting camera…");
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<PeerUser[]>([]);
  const [localPreview, setLocalPreview] = useState<MediaStream | null>(null);
  const [filter, setFilter] = useState<FilterId>("none");
  const [filterScope, setFilterScope] = useState<FilterScope>("self");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [swapped, setSwapped] = useState(false);

  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipelineRef = useRef<FaceFilterPipeline | null>(null);
  const roomRef = useRef<PeerRoom | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const filterRef = useRef<FilterId>(filter);
  const scopeRef = useRef<FilterScope>(filterScope);
  filterRef.current = filter;
  scopeRef.current = filterScope;

  const displayName = useMemo(
    () => initialName.trim() || "Guest",
    [initialName],
  );

  const localStream =
    peers.find((p) => p.isLocal)?.stream ?? localPreview ?? undefined;

  const activeRemotes = useMemo(
    () =>
      peers.filter((p) => !p.isLocal && p.peerId && hasLiveVideo(p.stream)),
    [peers],
  );

  const remoteCount = activeRemotes.length;
  const participantCount = remoteCount + (localStream ? 1 : 0);
  const isOneOnOne = remoteCount === 1;
  const isGroup = remoteCount >= 2;
  const isAlone = remoteCount === 0;

  // When back to alone / group, clear 1:1 swap
  useEffect(() => {
    if (!isOneOnOne && swapped) setSwapped(false);
  }, [isOneOnOne, swapped]);

  const groupTiles = useMemo(() => {
    if (!isGroup) return [];
    const localTile: PeerUser = {
      peerId: "local",
      name: displayName,
      filter,
      stream: localStream,
      isLocal: true,
    };
    return [localTile, ...activeRemotes];
  }, [isGroup, displayName, filter, localStream, activeRemotes]);

  const groupGridClass = useMemo(() => {
    const n = groupTiles.length;
    if (n <= 1) return "grid-cols-1 grid-rows-1";
    if (n === 2) return "grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1";
    if (n === 3) return "grid-cols-2 grid-rows-2 [&>*:first-child]:col-span-2";
    if (n === 4) return "grid-cols-2 grid-rows-2";
    return "grid-cols-2 grid-rows-3 md:grid-cols-3 md:auto-rows-fr";
  }, [groupTiles.length]);

  const applyLocalFilter = useCallback((next: FilterId) => {
    setFilter(next);
    pipelineRef.current?.setFilter(next);
    roomRef.current?.setFilter(next);
  }, []);

  const cleanup = useCallback(() => {
    roomRef.current?.leave();
    roomRef.current = null;
    pipelineRef.current?.destroy();
    pipelineRef.current = null;
    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    rawStreamRef.current = null;
    setLocalPreview(null);
    setPeers([]);
    setSwapped(false);
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
          onForceFilter: (forced) => {
            // Someone chose "For everyone" — apply on our camera
            applyLocalFilter(forced);
          },
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
  }, [applyLocalFilter, cleanup, displayName, roomId]);

  const selectFilter = useCallback(
    (next: FilterId) => {
      applyLocalFilter(next);
      if (scopeRef.current === "everyone") {
        roomRef.current?.forceFilterEveryone(next);
      }
      setFiltersOpen(true);
    },
    [applyLocalFilter],
  );

  const shiftFilter = useCallback(
    (delta: number) => {
      const index = FILTERS.findIndex((f) => f.id === filterRef.current);
      const current = index < 0 ? 0 : index;
      const next =
        FILTERS[(current + delta + FILTERS.length) % FILTERS.length];
      selectFilter(next.id);
    },
    [selectFilter],
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

  const remote = activeRemotes[0];

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
          {Math.max(participantCount, localPreview ? 1 : 0)}
        </div>
      </header>

      {error && (
        <div className="absolute inset-x-3 top-16 z-30 rounded-xl border border-red-400/30 bg-red-950/90 px-3 py-2 text-sm text-red-100 backdrop-blur">
          {error}
        </div>
      )}

      <div className="absolute inset-0">
        {/* Alone → your camera fullscreen (Messenger) */}
        {isAlone && (
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

        {/* 1:1 — swap toggles who is large */}
        {isOneOnOne && remote && (
          <VideoTile
            key={swapped ? "local-main" : remote.peerId}
            stream={swapped ? localStream : remote.stream}
            name={swapped ? displayName : remote.name}
            filter={swapped ? filter : remote.filter}
            isLocal={swapped}
            mirrored={swapped}
            audioEnabled={swapped ? audioEnabled : true}
            videoEnabled={swapped ? videoEnabled : true}
            className="h-full w-full"
          />
        )}

        {isGroup && (
          <div
            className={cn("grid h-full w-full gap-0.5 bg-black", groupGridClass)}
          >
            {groupTiles.map((peer) => (
              <VideoTile
                key={peer.peerId}
                stream={peer.stream}
                name={peer.name}
                filter={peer.isLocal ? filter : peer.filter}
                isLocal={peer.isLocal}
                mirrored={Boolean(peer.isLocal)}
                audioEnabled={peer.isLocal ? audioEnabled : true}
                videoEnabled={peer.isLocal ? videoEnabled : true}
                className="min-h-0 min-w-0"
              />
            ))}
          </div>
        )}
      </div>

      {/* PiP — double-click / double-tap to switch */}
      {isOneOnOne && remote && (
        <DraggablePip
          stream={swapped ? remote.stream : localStream}
          name={swapped ? remote.name : displayName}
          filter={swapped ? remote.filter : filter}
          isLocal={!swapped}
          mirrored={!swapped}
          audioEnabled={swapped ? true : audioEnabled}
          videoEnabled={swapped ? true : videoEnabled}
          defaultCorner="tr"
          onSwap={() => setSwapped((v) => !v)}
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
        onChange={selectFilter}
        scope={filterScope}
        onScopeChange={setFilterScope}
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
