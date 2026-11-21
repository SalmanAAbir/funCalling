import type { MediaConnection, DataConnection, Peer } from "peerjs";
import type { FilterId } from "./filters";
import { isFilterId } from "./filters";

export type PeerUser = {
  peerId: string;
  name: string;
  filter: FilterId;
  stream?: MediaStream;
  isLocal?: boolean;
};

type SignalMessage =
  | { type: "hello"; name: string; filter: FilterId }
  | {
      type: "roster";
      peers: { peerId: string; name: string; filter: FilterId }[];
    }
  | { type: "peer-joined"; peerId: string; name: string; filter: FilterId }
  | { type: "peer-left"; peerId: string }
  | { type: "name"; name: string }
  | { type: "filter"; filter: FilterId }
  | { type: "force-filter"; filter: FilterId }
  | { type: "ping"; t: number }
  | { type: "pong"; t: number };

export type RoomEvents = {
  onPeers: (peers: PeerUser[]) => void;
  onStatus: (status: string) => void;
  onError: (message: string) => void;
  /** Remote asked everyone to wear this filter */
  onForceFilter: (filter: FilterId) => void;
};

function hostPeerId(roomId: string) {
  return `funcall-${roomId}`;
}

function streamIsLive(stream?: MediaStream) {
  if (!stream) return false;
  return stream.getTracks().some((t) => t.readyState === "live");
}

export class PeerRoom {
  private peer: Peer | null = null;
  private roomId: string;
  private displayName: string;
  private localStream: MediaStream | null = null;
  private filter: FilterId = "none";
  private isHost = false;
  private mediaCalls = new Map<string, MediaConnection>();
  private dataChannels = new Map<string, DataConnection>();
  private peers = new Map<string, PeerUser>();
  private events: RoomEvents;
  private localPeerId = "";
  private destroyed = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPong = new Map<string, number>();
  private pcUnsubscribers = new Map<string, () => void>();

  constructor(roomId: string, displayName: string, events: RoomEvents) {
    this.roomId = roomId;
    this.displayName = displayName || "Guest";
    this.events = events;
  }

  async join(localStream: MediaStream, filter: FilterId) {
    this.localStream = localStream;
    this.filter = filter;

    const { default: PeerCtor } = await import("peerjs");
    const hostId = hostPeerId(this.roomId);

    this.events.onStatus("Connecting…");

    const hostPeer = new PeerCtor(hostId, { debug: 0 });

    const hostReady = await new Promise<"host" | "taken" | "error">((resolve) => {
      const timer = setTimeout(() => resolve("error"), 8000);

      hostPeer.on("open", () => {
        clearTimeout(timer);
        resolve("host");
      });

      hostPeer.on("error", (err) => {
        if (err.type === "unavailable-id") {
          clearTimeout(timer);
          hostPeer.destroy();
          resolve("taken");
        }
      });
    });

    if (this.destroyed) {
      hostPeer.destroy();
      return;
    }

    if (hostReady === "host") {
      this.peer = hostPeer;
      this.isHost = true;
      this.localPeerId = hostId;
      this.setupPeerHandlers();
      this.upsertLocal();
      this.startHeartbeat();
      this.events.onStatus("Waiting for others…");
      this.emitPeers();
      return;
    }

    if (hostReady === "error") {
      this.events.onError("Could not connect to signaling. Retry?");
      return;
    }

    const guest = new PeerCtor({ debug: 0 });
    this.peer = guest;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Peer timeout")), 10000);
      guest.on("open", (id) => {
        clearTimeout(timer);
        this.localPeerId = id;
        resolve();
      });
      guest.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    if (this.destroyed) return;

    this.setupPeerHandlers();
    this.upsertLocal();
    this.startHeartbeat();
    this.events.onStatus("Joining room…");

    const data = guest.connect(hostId, { reliable: true });
    this.wireData(data);

    data.on("open", () => {
      this.send(data, {
        type: "hello",
        name: this.displayName,
        filter: this.filter,
      });
      this.callPeer(hostId);
      this.events.onStatus("In call");
      this.emitPeers();
    });
  }

  setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    this.upsertLocal();
    for (const call of this.mediaCalls.values()) {
      const senders = call.peerConnection?.getSenders?.() ?? [];
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      for (const sender of senders) {
        if (sender.track?.kind === "video" && videoTrack) {
          void sender.replaceTrack(videoTrack);
        }
        if (sender.track?.kind === "audio" && audioTrack) {
          void sender.replaceTrack(audioTrack);
        }
      }
    }
    this.emitPeers();
  }

  setName(name: string) {
    this.displayName = name || "Guest";
    this.upsertLocal();
    this.broadcast({ type: "name", name: this.displayName });
    this.emitPeers();
  }

  /** Own filter change (label + metadata for remotes) */
  setFilter(filter: FilterId) {
    this.filter = filter;
    this.upsertLocal();
    this.broadcast({ type: "filter", filter });
    this.emitPeers();
  }

  /** Ask every other peer to apply this filter on themselves */
  forceFilterEveryone(filter: FilterId) {
    this.broadcast({ type: "force-filter", filter });
  }

  leave() {
    this.destroyed = true;
    this.stopHeartbeat();
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", this.onPageHide);
      window.removeEventListener("beforeunload", this.onPageHide);
    }
    // Best-effort notify before teardown
    this.broadcast({ type: "peer-left", peerId: this.localPeerId });

    for (const unsub of this.pcUnsubscribers.values()) unsub();
    this.pcUnsubscribers.clear();

    for (const call of this.mediaCalls.values()) {
      try {
        call.close();
      } catch {
        /* ignore */
      }
    }
    for (const data of this.dataChannels.values()) {
      try {
        data.close();
      } catch {
        /* ignore */
      }
    }
    this.mediaCalls.clear();
    this.dataChannels.clear();
    this.peers.clear();
    this.lastPong.clear();
    this.peer?.destroy();
    this.peer = null;
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.destroyed) return;
      const now = Date.now();
      this.broadcast({ type: "ping", t: now });

      // Drop peers that went silent (browser closed without clean hangup)
      for (const peerId of [...this.peers.keys()]) {
        if (peerId === this.localPeerId) continue;
        const last = this.lastPong.get(peerId) ?? 0;
        const call = this.mediaCalls.get(peerId);
        const pc = call?.peerConnection;
        const pcDead =
          pc &&
          (pc.connectionState === "failed" ||
            pc.connectionState === "closed" ||
            pc.iceConnectionState === "failed" ||
            pc.iceConnectionState === "closed");

        const peer = this.peers.get(peerId);
        const streamDead = peer?.stream ? !streamIsLive(peer.stream) : false;

        // Heartbeat miss (browser closed) or media/PC dead
        if (pcDead || streamDead || (last > 0 && now - last > 7000)) {
          this.removePeer(peerId);
        }
      }
    }, 2000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private setupPeerHandlers() {
    if (!this.peer) return;

    this.peer.on("connection", (conn) => {
      this.wireData(conn);
    });

    this.peer.on("call", (call) => {
      if (!this.localStream) return;
      call.answer(this.localStream);
      this.attachMedia(call);
    });

    this.peer.on("disconnected", () => {
      if (!this.destroyed) {
        this.events.onStatus("Reconnecting…");
        try {
          this.peer?.reconnect();
        } catch {
          /* ignore */
        }
      }
    });

    this.peer.on("error", (err) => {
      if (err.type !== "peer-unavailable") {
        this.events.onError(err.message || "Peer error");
      }
    });

    // Tab/browser close
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", this.onPageHide);
      window.addEventListener("beforeunload", this.onPageHide);
    }
  }

  private onPageHide = () => {
    if (this.destroyed) return;
    this.broadcast({ type: "peer-left", peerId: this.localPeerId });
    try {
      this.peer?.disconnect();
    } catch {
      /* ignore */
    }
  };

  private wireData(conn: DataConnection) {
    const prev = this.dataChannels.get(conn.peer);
    if (prev && prev !== conn) {
      try {
        prev.close();
      } catch {
        /* ignore */
      }
    }
    this.dataChannels.set(conn.peer, conn);
    this.lastPong.set(conn.peer, Date.now());

    conn.on("data", (raw) => {
      const msg = raw as SignalMessage;
      this.handleSignal(conn.peer, msg);
    });

    conn.on("close", () => {
      if (this.dataChannels.get(conn.peer) === conn) {
        this.removePeer(conn.peer);
      }
    });

    conn.on("error", () => {
      this.removePeer(conn.peer);
    });
  }

  private handleSignal(fromPeerId: string, msg: SignalMessage) {
    if (msg.type === "ping") {
      const conn = this.dataChannels.get(fromPeerId);
      if (conn) this.send(conn, { type: "pong", t: msg.t });
      return;
    }

    if (msg.type === "pong") {
      this.lastPong.set(fromPeerId, Date.now());
      return;
    }

    if (msg.type === "force-filter" && isFilterId(msg.filter)) {
      this.events.onForceFilter(msg.filter);
      return;
    }

    if (msg.type === "hello") {
      const existing = this.peers.get(fromPeerId);
      this.peers.set(fromPeerId, {
        peerId: fromPeerId,
        name: msg.name,
        filter: msg.filter,
        stream: existing?.stream,
        isLocal: false,
      });
      this.lastPong.set(fromPeerId, Date.now());

      if (this.isHost) {
        const roster = [...this.peers.values()]
          .filter((p) => !p.isLocal && p.peerId !== fromPeerId)
          .map((p) => ({
            peerId: p.peerId,
            name: p.name,
            filter: p.filter,
          }));

        const conn = this.dataChannels.get(fromPeerId);
        if (conn) {
          this.send(conn, { type: "roster", peers: roster });
        }

        this.broadcast(
          {
            type: "peer-joined",
            peerId: fromPeerId,
            name: msg.name,
            filter: msg.filter,
          },
          fromPeerId,
        );
      }

      this.emitPeers();
      return;
    }

    if (msg.type === "roster") {
      for (const remote of msg.peers) {
        if (remote.peerId === this.localPeerId) continue;
        const existing = this.peers.get(remote.peerId);
        this.peers.set(remote.peerId, {
          peerId: remote.peerId,
          name: remote.name,
          filter: remote.filter,
          stream: existing?.stream,
          isLocal: false,
        });
        this.ensureData(remote.peerId);
        this.callPeer(remote.peerId);
      }
      this.events.onStatus("In call");
      this.emitPeers();
      return;
    }

    if (msg.type === "peer-joined") {
      if (msg.peerId === this.localPeerId) return;
      const existing = this.peers.get(msg.peerId);
      this.peers.set(msg.peerId, {
        peerId: msg.peerId,
        name: msg.name,
        filter: msg.filter,
        stream: existing?.stream,
        isLocal: false,
      });
      this.ensureData(msg.peerId);
      this.callPeer(msg.peerId);
      this.emitPeers();
      return;
    }

    if (msg.type === "peer-left") {
      const target =
        msg.peerId && msg.peerId !== this.localPeerId
          ? msg.peerId
          : fromPeerId;
      this.removePeer(target);
      return;
    }

    if (msg.type === "name") {
      const existing = this.peers.get(fromPeerId);
      if (existing) {
        existing.name = msg.name;
        this.peers.set(fromPeerId, existing);
        this.emitPeers();
      }
      return;
    }

    if (msg.type === "filter" && isFilterId(msg.filter)) {
      const existing = this.peers.get(fromPeerId);
      if (existing) {
        existing.filter = msg.filter;
        this.peers.set(fromPeerId, existing);
        this.emitPeers();
      }
    }
  }

  private ensureData(peerId: string) {
    if (!this.peer || peerId === this.localPeerId) return;
    if (this.dataChannels.has(peerId)) return;
    const conn = this.peer.connect(peerId, { reliable: true });
    this.wireData(conn);
    conn.on("open", () => {
      this.send(conn, {
        type: "hello",
        name: this.displayName,
        filter: this.filter,
      });
    });
  }

  private callPeer(peerId: string) {
    if (!this.peer || !this.localStream) return;
    if (peerId === this.localPeerId) return;
    if (this.mediaCalls.has(peerId)) return;
    if (this.localPeerId > peerId) return;

    const call = this.peer.call(peerId, this.localStream);
    this.attachMedia(call);
  }

  private watchPeerConnection(peerId: string, call: MediaConnection) {
    this.pcUnsubscribers.get(peerId)?.();
    const pc = call.peerConnection;
    if (!pc) return;

    const onState = () => {
      const dead =
        pc.connectionState === "failed" ||
        pc.connectionState === "closed" ||
        pc.iceConnectionState === "failed" ||
        pc.iceConnectionState === "closed";
      // "disconnected" alone can be brief — heartbeat handles silent leave
      if (dead) this.removePeer(peerId);
    };

    pc.addEventListener("connectionstatechange", onState);
    pc.addEventListener("iceconnectionstatechange", onState);
    this.pcUnsubscribers.set(peerId, () => {
      pc.removeEventListener("connectionstatechange", onState);
      pc.removeEventListener("iceconnectionstatechange", onState);
    });
  }

  private attachMedia(call: MediaConnection) {
    const prev = this.mediaCalls.get(call.peer);
    if (prev && prev !== call) {
      try {
        prev.close();
      } catch {
        /* ignore */
      }
    }
    this.mediaCalls.set(call.peer, call);
    this.watchPeerConnection(call.peer, call);

    call.on("stream", (remoteStream) => {
      const existing = this.peers.get(call.peer) ?? {
        peerId: call.peer,
        name: "Guest",
        filter: "none" as FilterId,
      };
      existing.stream = remoteStream;
      existing.isLocal = false;
      this.peers.set(call.peer, existing);
      this.lastPong.set(call.peer, Date.now());

      for (const track of remoteStream.getTracks()) {
        track.addEventListener("ended", () => {
          if (!streamIsLive(remoteStream)) {
            this.removePeer(call.peer);
          }
        });
      }

      this.emitPeers();
    });

    call.on("close", () => {
      this.removePeer(call.peer);
    });

    call.on("error", () => {
      this.removePeer(call.peer);
    });
  }

  private removePeer(peerId: string) {
    if (!peerId || peerId === this.localPeerId) return;

    this.pcUnsubscribers.get(peerId)?.();
    this.pcUnsubscribers.delete(peerId);
    this.lastPong.delete(peerId);

    const call = this.mediaCalls.get(peerId);
    if (call) {
      try {
        call.close();
      } catch {
        /* ignore */
      }
      this.mediaCalls.delete(peerId);
    }

    const data = this.dataChannels.get(peerId);
    if (data) {
      try {
        data.close();
      } catch {
        /* ignore */
      }
      this.dataChannels.delete(peerId);
    }

    const had = this.peers.delete(peerId);
    this.upsertLocal();

    if (had && this.isHost) {
      this.broadcast({ type: "peer-left", peerId });
    }

    const remotes = [...this.peers.values()].filter((p) => !p.isLocal);
    this.events.onStatus(
      remotes.length === 0 ? "Waiting for others…" : "In call",
    );
    this.emitPeers();
  }

  private upsertLocal() {
    if (!this.localPeerId) return;
    this.peers.set(this.localPeerId, {
      peerId: this.localPeerId,
      name: this.displayName,
      filter: this.filter,
      stream: this.localStream ?? undefined,
      isLocal: true,
    });
  }

  private send(conn: DataConnection, msg: SignalMessage) {
    try {
      if (conn.open) conn.send(msg);
      else conn.on("open", () => conn.send(msg));
    } catch {
      /* ignore */
    }
  }

  private broadcast(msg: SignalMessage, except?: string) {
    for (const [id, conn] of this.dataChannels) {
      if (id === except) continue;
      this.send(conn, msg);
    }
  }

  private emitPeers() {
    for (const [id, p] of this.peers) {
      if (id === this.localPeerId) {
        p.isLocal = true;
        p.stream = this.localStream ?? p.stream;
      }
    }

    const list = [...this.peers.values()].sort((a, b) => {
      if (a.isLocal) return -1;
      if (b.isLocal) return 1;
      return a.name.localeCompare(b.name);
    });
    this.events.onPeers(list);
  }
}
