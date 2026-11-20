"use client";

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ControlBarProps = {
  audioEnabled: boolean;
  videoEnabled: boolean;
  filtersOpen: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleFilters: () => void;
  onLeave: () => void;
  roomId: string;
};

export function ControlBar({
  audioEnabled,
  videoEnabled,
  filtersOpen,
  onToggleAudio,
  onToggleVideo,
  onToggleFilters,
  onLeave,
  roomId,
}: ControlBarProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = `${window.location.origin}/room/${roomId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 pb-6">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/85 px-3 py-2 shadow-2xl backdrop-blur-xl">
        <Button
          size="icon-lg"
          variant="secondary"
          className={cn(
            "rounded-full",
            !audioEnabled && "bg-red-500 text-white hover:bg-red-500/90",
          )}
          onClick={onToggleAudio}
          aria-label={audioEnabled ? "Mute mic" : "Unmute mic"}
        >
          {audioEnabled ? <Mic /> : <MicOff />}
        </Button>

        <Button
          size="icon-lg"
          variant="secondary"
          className={cn(
            "rounded-full",
            !videoEnabled && "bg-red-500 text-white hover:bg-red-500/90",
          )}
          onClick={onToggleVideo}
          aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"}
        >
          {videoEnabled ? <Video /> : <VideoOff />}
        </Button>

        <Button
          size="icon-lg"
          variant="secondary"
          className={cn(
            "rounded-full",
            filtersOpen && "bg-teal-400 text-slate-950 hover:bg-teal-300",
          )}
          onClick={onToggleFilters}
          aria-label="Face filters"
        >
          <Sparkles />
        </Button>

        <Button
          size="icon-lg"
          variant="secondary"
          className="rounded-full"
          onClick={copyLink}
          aria-label="Copy room link"
        >
          {copied ? <Check className="text-teal-300" /> : <Copy />}
        </Button>

        <Button
          size="icon-lg"
          className="rounded-full bg-red-500 text-white hover:bg-red-400"
          onClick={onLeave}
          aria-label="Leave call"
        >
          <PhoneOff />
        </Button>
      </div>
    </div>
  );
}
