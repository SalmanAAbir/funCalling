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
  | { type: "roster"; peers: { peerId: string; name: string; filter: FilterId }[] }
  | { type: "peer-joined"; peerId: string; name: string; filter: FilterId }
  | { type: "peer-left"; peerId: string }
  | { type: "name"; name: string }
  | { type: "filter"; filter: FilterId };

export type RoomEvents = {
  onPeers: (peers: PeerUser[]) => void;
  onStatus: (status: string) => void;
  onError: (message: string) => void;
};

function hostPeerId(roomId: string) {
  return `funcall-${roomId}`;
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

  constructor(
    roomId: string,
    displayName: string,
    events: RoomEvents,
  ) {
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

    // Try to become host first
    const hostPeer = new PeerCtor(hostId, {
      debug: 0,
    });

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
      this.events.onStatus("Waiting for others…");
      this.emitPeers();
      return;
    }

    if (hostReady === "error") {
      this.events.onError("Could not connect to signaling. Retry?");
      return;
    }

    // Join as guest
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

  setFilter(filter: FilterId) {
    this.filter = filter;
    this.upsertLocal();
    this.broadcast({ type: "filter", filter });
    this.emitPeers();
  }

  leave() {
    this.destroyed = true;
    for (const call of this.mediaCalls.values()) call.close();
    for (const data of this.dataChannels.values()) data.close();
    this.mediaCalls.clear();
    this.dataChannels.clear();
    this.peers.clear();
    this.peer?.destroy();
    this.peer = null;
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
      if (!this.destroyed) this.events.onStatus("Reconnecting…");
    });

    this.peer.on("error", (err) => {
      if (err.type !== "peer-unavailable") {
        this.events.onError(err.message || "Peer error");
      }
    });
  }

  private wireData(conn: DataConnection) {
    this.dataChannels.set(conn.peer, conn);

    conn.on("data", (raw) => {
      const msg = raw as SignalMessage;
      this.handleSignal(conn.peer, msg);
    });

    conn.on("close", () => {
      this.removePeer(conn.peer);
    });

    conn.on("open", () => {
      if (this.isHost) {
        // Wait for hello from guest
      }
    });
  }

  private handleSignal(fromPeerId: string, msg: SignalMessage) {
    if (msg.type === "hello") {
      this.peers.set(fromPeerId, {
        peerId: fromPeerId,
        name: msg.name,
        filter: msg.filter,
      });

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
        this.peers.set(remote.peerId, {
          peerId: remote.peerId,
          name: remote.name,
          filter: remote.filter,
        });
        this.ensureData(remote.peerId);
        this.callPeer(remote.peerId);
      }
      this.events.onStatus("In call");
      this.emitPeers();
      return;
    }

    if (msg.type === "peer-joined") {
      this.peers.set(msg.peerId, {
        peerId: msg.peerId,
        name: msg.name,
        filter: msg.filter,
      });
      this.ensureData(msg.peerId);
      this.callPeer(msg.peerId);
      this.emitPeers();
      return;
    }

    if (msg.type === "peer-left") {
      this.removePeer(msg.peerId);
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
    if (this.dataChannels.has(peerId) || !this.peer) return;
    if (peerId === this.localPeerId) return;
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
    // Only one side dials to avoid glare / double-call races
    if (this.localPeerId > peerId) return;

    const call = this.peer.call(peerId, this.localStream);
    this.attachMedia(call);
  }

  private attachMedia(call: MediaConnection) {
    this.mediaCalls.set(call.peer, call);

    call.on("stream", (remoteStream) => {
      const existing = this.peers.get(call.peer) ?? {
        peerId: call.peer,
        name: "Guest",
        filter: "none" as FilterId,
      };
      existing.stream = remoteStream;
      this.peers.set(call.peer, existing);
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
    this.mediaCalls.get(peerId)?.close();
    this.mediaCalls.delete(peerId);
    this.dataChannels.get(peerId)?.close();
    this.dataChannels.delete(peerId);
    if (this.peers.delete(peerId)) {
      if (this.isHost) {
        this.broadcast({ type: "peer-left", peerId });
      }
      this.emitPeers();
    }
  }

  private upsertLocal() {
    this.peers.set(this.localPeerId || "local", {
      peerId: this.localPeerId || "local",
      name: this.displayName,
      filter: this.filter,
      stream: this.localStream ?? undefined,
      isLocal: true,
    });
  }

  private send(conn: DataConnection, msg: SignalMessage) {
    if (conn.open) conn.send(msg);
    else conn.on("open", () => conn.send(msg));
  }

  private broadcast(msg: SignalMessage, except?: string) {
    for (const [id, conn] of this.dataChannels) {
      if (id === except) continue;
      this.send(conn, msg);
    }
  }

  private emitPeers() {
    const list = [...this.peers.values()].sort((a, b) => {
      if (a.isLocal) return -1;
      if (b.isLocal) return 1;
      return a.name.localeCompare(b.name);
    });
    this.events.onPeers(list);
  }
}
