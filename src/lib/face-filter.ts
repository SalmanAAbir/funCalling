import {
  FaceLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { FilterId } from "./filters";
import { renderFilter } from "./filter-renderer";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";

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
    for (const audio of cameraStream.getAudioTracks()) {
      filtered.addTrack(audio);
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
        renderFilter(
          ctx,
          this.lastFace,
          this.filter,
          canvas.width,
          canvas.height,
          performance.now(),
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
