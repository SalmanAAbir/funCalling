import {
  FaceLandmarker,
  FilesetResolver,
  type Category,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { FilterId } from "./filters";
import { renderFilter } from "./filter-renderer";
import { FaceTracker } from "./face-track";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";

function waitForVideoSize(video: HTMLVideoElement): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        video.removeEventListener("loadedmetadata", done);
        video.removeEventListener("resize", done);
        resolve();
      }
    };
    video.addEventListener("loadedmetadata", done);
    video.addEventListener("resize", done);
    // Fallback if events already fired
    requestAnimationFrame(done);
  });
}

export class FaceFilterPipeline {
  private landmarker: FaceLandmarker | null = null;
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private running = false;
  private filter: FilterId = "none";
  private tracker = new FaceTracker();
  private lastLandmarks: NormalizedLandmark[] | null = null;
  private lastBlends: Category[] | undefined;
  private lastDetect = 0;
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
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
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
    if (filter === "none") this.tracker.reset();
  }

  getFilter() {
    return this.filter;
  }

  async start(cameraStream: MediaStream): Promise<MediaStream> {
    this.stopLoop();
    this.video.srcObject = cameraStream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
    await waitForVideoSize(this.video);

    // Match canvas exactly to the camera frame — never stretch
    this.syncCanvasSize();

    this.running = true;
    this.loop();

    const filtered = this.canvas.captureStream(30);
    for (const audio of cameraStream.getAudioTracks()) {
      filtered.addTrack(audio);
    }
    this.outputStream = filtered;
    return filtered;
  }

  getOutputStream() {
    return this.outputStream;
  }

  private syncCanvasSize() {
    const { video, canvas } = this;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);

    const { video, canvas, ctx } = this;
    if (video.readyState < 2 || !video.videoWidth) return;

    this.syncCanvasSize();

    // 1:1 copy — same aspect as the camera
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (!this.landmarker || this.filter === "none") return;

    const now = performance.now();
    if (now - this.lastDetect >= 32) {
      this.lastDetect = now;
      const result = this.landmarker.detectForVideo(video, now);
      this.lastLandmarks = result.faceLandmarks[0] ?? null;
      this.lastBlends = result.faceBlendshapes?.[0]?.categories;
    }

    const pose = this.tracker.update(
      this.lastLandmarks,
      canvas.width,
      canvas.height,
      this.lastBlends,
    );

    if (pose) {
      renderFilter(ctx, pose, this.filter, canvas.width, canvas.height, now);
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
    this.tracker.reset();
    this.outputStream?.getTracks().forEach((t) => t.stop());
    this.outputStream = null;
  }
}
