"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { Video, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function roomSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function LobbyForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const suggested = useMemo(() => nanoid(8).toLowerCase(), []);

  function enter(id: string) {
    const clean = roomSlug(id) || suggested;
    const params = new URLSearchParams();
    if (name.trim()) params.set("name", name.trim());
    const qs = params.toString();
    router.push(`/room/${clean}${qs ? `?${qs}` : ""}`);
  }

  return (
    <Card className="border-white/10 bg-white/5 shadow-2xl shadow-teal-950/40 backdrop-blur-xl">
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-xl text-white">
          <Sparkles className="size-5 text-teal-300" />
          Jump into a room
        </CardTitle>
        <p className="text-sm text-slate-300">
          Name is optional. Share the link — filters sync live for everyone.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium tracking-wide text-slate-400 uppercase">
            Your name <span className="normal-case text-slate-500">(optional)</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Guest"
            className="h-11 border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500"
            maxLength={32}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium tracking-wide text-slate-400 uppercase">
            Room code
          </label>
          <Input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder={suggested}
            className="h-11 border-white/10 bg-slate-950/50 font-mono text-white placeholder:text-slate-500"
            maxLength={24}
            onKeyDown={(e) => {
              if (e.key === "Enter") enter(roomId || suggested);
            }}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            className="h-11 flex-1 bg-teal-400 text-slate-950 hover:bg-teal-300"
            onClick={() => enter(suggested)}
          >
            <Video className="size-4" />
            New room
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 flex-1 border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={() => enter(roomId || suggested)}
          >
            Join
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
