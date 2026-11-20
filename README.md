# FunCall

Meet-style video rooms with live face filters (cat, dog, mouse, bunny, ghost, and more). Filters are baked into your outgoing video, so everyone in the room sees them.

## Stack

- Next.js (App Router) + Tailwind CSS + shadcn/ui
- WebRTC via [PeerJS](https://peerjs.com) (no custom signaling server)
- Face tracking via MediaPipe Face Landmarker

## Local

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create a room, allow camera/mic, then share the room link.

## Vercel

```bash
npm i -g vercel
vercel
```

Or push to GitHub and import the repo in the Vercel dashboard. No env vars required for the basic PeerJS cloud broker.

## How it works

1. First person in a room becomes the host peer (`funcall-<roomId>`).
2. Later joiners connect to the host, get a roster, then mesh-call everyone.
3. Your camera feed is drawn to a canvas; MediaPipe landmarks drive AR overlays; `canvas.captureStream()` is what peers receive.

## Notes

- Best with 2–4 people (mesh WebRTC).
- Camera + mic require HTTPS (Vercel provides this) or localhost.
- PeerJS free cloud broker is fine for demos; swap in a self-hosted PeerServer later if needed.
