import {
  FaceLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { FilterId } from "./filters";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";

type Point = { x: number; y: number };

function lm(
  landmarks: NormalizedLandmark[],
  index: number,
  width: number,
  height: number,
): Point {
  const point = landmarks[index];
  return { x: point.x * width, y: point.y * height };
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function faceAngle(landmarks: NormalizedLandmark[], w: number, h: number) {
  const left = lm(landmarks, 33, w, h);
  const right = lm(landmarks, 263, w, h);
  return Math.atan2(right.y - left.y, right.x - left.x);
}

function drawEar(
  ctx: CanvasRenderingContext2D,
  tip: Point,
  base: Point,
  color: string,
  inner: string,
  scale = 1,
) {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const angle = Math.atan2(dy, dx);
  const length = Math.hypot(dx, dy) * scale;
  const width = length * 0.55;

  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(length * 0.55, -width, length, 0);
  ctx.quadraticCurveTo(length * 0.55, width, 0, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(length * 0.12, 0);
  ctx.quadraticCurveTo(length * 0.55, -width * 0.45, length * 0.88, 0);
  ctx.quadraticCurveTo(length * 0.55, width * 0.45, length * 0.12, 0);
  ctx.closePath();
  ctx.fillStyle = inner;
  ctx.fill();
  ctx.restore();
}

function drawWhiskers(
  ctx: CanvasRenderingContext2D,
  nose: Point,
  faceW: number,
  color = "rgba(40,40,40,0.85)",
) {
  const reach = faceW * 0.42;
  const offsets = [-14, 0, 14];
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, faceW * 0.015);
  ctx.lineCap = "round";

  for (const oy of offsets) {
    ctx.beginPath();
    ctx.moveTo(nose.x - faceW * 0.05, nose.y + oy);
    ctx.lineTo(nose.x - reach, nose.y + oy * 1.4);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(nose.x + faceW * 0.05, nose.y + oy);
    ctx.lineTo(nose.x + reach, nose.y + oy * 1.4);
    ctx.stroke();
  }
}

function drawNoseDot(
  ctx: CanvasRenderingContext2D,
  nose: Point,
  radius: number,
  color: string,
) {
  ctx.beginPath();
  ctx.arc(nose.x, nose.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.3);
  ctx.bezierCurveTo(-size, -size * 0.3, -size * 0.5, -size, 0, -size * 0.45);
  ctx.bezierCurveTo(size * 0.5, -size, size, -size * 0.3, 0, size * 0.3);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function applyFilter(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  filter: FilterId,
  width: number,
  height: number,
) {
  if (filter === "none") return;

  const leftEye = lm(landmarks, 33, width, height);
  const rightEye = lm(landmarks, 263, width, height);
  const nose = lm(landmarks, 1, width, height);
  const forehead = lm(landmarks, 10, width, height);
  const leftTemple = lm(landmarks, 234, width, height);
  const rightTemple = lm(landmarks, 454, width, height);
  const chin = lm(landmarks, 152, width, height);
  const faceW = dist(leftTemple, rightTemple);
  const faceH = dist(forehead, chin);
  const angle = faceAngle(landmarks, width, height);
  const eyeMid = mid(leftEye, rightEye);

  if (filter === "cat" || filter === "dog" || filter === "mouse" || filter === "bunny") {
    const earLen =
      filter === "bunny"
        ? faceH * 0.85
        : filter === "dog"
          ? faceH * 0.55
          : faceH * 0.48;
    const leftBase = {
      x: leftTemple.x + faceW * 0.08,
      y: forehead.y + faceH * 0.05,
    };
    const rightBase = {
      x: rightTemple.x - faceW * 0.08,
      y: forehead.y + faceH * 0.05,
    };
    const leftTip = {
      x: leftBase.x - Math.cos(angle - 0.9) * earLen,
      y: leftBase.y - Math.sin(angle - 0.9) * earLen - earLen * 0.2,
    };
    const rightTip = {
      x: rightBase.x + Math.cos(angle + 0.9) * earLen,
      y: rightBase.y - Math.sin(angle + 0.9) * earLen - earLen * 0.2,
    };

    const outer =
      filter === "cat"
        ? "#f59e0b"
        : filter === "dog"
          ? "#a16207"
          : filter === "bunny"
            ? "#f8fafc"
            : "#e2e8f0";
    const inner =
      filter === "cat"
        ? "#fb7185"
        : filter === "dog"
          ? "#fde68a"
          : filter === "bunny"
            ? "#fda4af"
            : "#fecdd3";

    drawEar(ctx, leftTip, leftBase, outer, inner, 1);
    drawEar(ctx, rightTip, rightBase, outer, inner, 1);

    if (filter === "cat" || filter === "mouse") {
      drawWhiskers(ctx, nose, faceW);
      drawNoseDot(
        ctx,
        nose,
        faceW * 0.045,
        filter === "cat" ? "#fb7185" : "#f43f5e",
      );
    }

    if (filter === "dog") {
      drawNoseDot(ctx, nose, faceW * 0.06, "#1c1917");
    }

    if (filter === "bunny") {
      drawNoseDot(ctx, nose, faceW * 0.04, "#fb7185");
      drawWhiskers(ctx, nose, faceW * 0.85, "rgba(100,100,100,0.7)");
    }
  }

  if (filter === "ghost") {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.ellipse(
      mid(eyeMid, chin).x,
      mid(eyeMid, chin).y,
      faceW * 0.55,
      faceH * 0.62,
      angle,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();

    for (const eye of [leftEye, rightEye]) {
      ctx.beginPath();
      ctx.ellipse(eye.x, eye.y, faceW * 0.08, faceW * 0.11, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#0f172a";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eye.x, eye.y - faceW * 0.02, faceW * 0.03, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
  }

  if (filter === "sunglasses") {
    const glassW = faceW * 0.22;
    const glassH = faceH * 0.12;
    ctx.save();
    ctx.translate(eyeMid.x, eyeMid.y);
    ctx.rotate(angle);
    ctx.fillStyle = "rgba(15,23,42,0.88)";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = Math.max(2, faceW * 0.02);

    const drawLens = (ox: number) => {
      ctx.beginPath();
      ctx.roundRect(ox - glassW / 2, -glassH / 2, glassW, glassH, glassH * 0.35);
      ctx.fill();
      ctx.stroke();
    };

    drawLens(-faceW * 0.18);
    drawLens(faceW * 0.18);

    ctx.beginPath();
    ctx.moveTo(-faceW * 0.07, 0);
    ctx.lineTo(faceW * 0.07, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-faceW * 0.29, -glassH * 0.1);
    ctx.lineTo(-faceW * 0.48, -glassH * 0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(faceW * 0.29, -glassH * 0.1);
    ctx.lineTo(faceW * 0.48, -glassH * 0.35);
    ctx.stroke();
    ctx.restore();
  }

  if (filter === "hearts") {
    const size = faceW * 0.12;
    drawHeart(ctx, leftEye.x, leftEye.y, size, "#f43f5e");
    drawHeart(ctx, rightEye.x, rightEye.y, size, "#f43f5e");
  }
}

export class FaceFilterPipeline {
  private landmarker: FaceLandmarker | null = null;
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private running = false;
  private filter: FilterId = "none";
  private lastDetect = 0;
  private lastFace: NormalizedLandmark[] | null = null;
  private outputStream: MediaStream | null = null;

  constructor(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
    this.video = video;
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not get canvas context");
    this.ctx = ctx;
  }

  async init() {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    const options = {
      runningMode: "VIDEO" as const,
      numFaces: 1,
    };
    try {
      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      });
    } catch {
      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
      });
    }
  }

  setFilter(filter: FilterId) {
    this.filter = filter;
  }

  getFilter() {
    return this.filter;
  }

  start(cameraStream: MediaStream): MediaStream {
    this.stopLoop();
    this.video.srcObject = cameraStream;
    void this.video.play();

    const track = cameraStream.getVideoTracks()[0];
    const settings = track?.getSettings();
    this.canvas.width = settings?.width || 640;
    this.canvas.height = settings?.height || 480;

    this.running = true;
    this.loop();

    const filtered = this.canvas.captureStream(30);
    const audioTracks = cameraStream.getAudioTracks();
    for (const audio of audioTracks) {
      filtered.addTrack(audio);
    }
    this.outputStream = filtered;
    return filtered;
  }

  replaceCamera(cameraStream: MediaStream): MediaStream {
    const audioEnabled = this.outputStream
      ?.getAudioTracks()
      .some((t) => t.enabled);
    const videoEnabled = this.outputStream
      ?.getVideoTracks()
      .some((t) => t.enabled);

    this.video.srcObject = cameraStream;
    void this.video.play();

    const filtered = this.canvas.captureStream(30);
    for (const audio of cameraStream.getAudioTracks()) {
      filtered.addTrack(audio);
    }

    if (typeof audioEnabled === "boolean") {
      filtered.getAudioTracks().forEach((t) => {
        t.enabled = audioEnabled;
      });
    }
    if (typeof videoEnabled === "boolean") {
      filtered.getVideoTracks().forEach((t) => {
        t.enabled = videoEnabled;
      });
    }

    this.outputStream = filtered;
    return filtered;
  }

  getOutputStream() {
    return this.outputStream;
  }

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);

    const { video, canvas, ctx } = this;
    if (video.readyState < 2) return;

    if (canvas.width !== video.videoWidth && video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (this.landmarker && this.filter !== "none") {
      const now = performance.now();
      if (now - this.lastDetect > 33) {
        this.lastDetect = now;
        const result = this.landmarker.detectForVideo(video, now);
        this.lastFace = result.faceLandmarks[0] ?? null;
      }
      if (this.lastFace) {
        applyFilter(
          ctx,
          this.lastFace,
          this.filter,
          canvas.width,
          canvas.height,
        );
      }
    }
  };

  private stopLoop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.stopLoop();
    this.landmarker?.close();
    this.landmarker = null;
    this.outputStream?.getTracks().forEach((t) => t.stop());
    this.outputStream = null;
  }
}
