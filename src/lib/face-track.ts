import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type Point = { x: number; y: number };

export type FacePose = {
  leftEye: Point;
  rightEye: Point;
  nose: Point;
  forehead: Point;
  chin: Point;
  leftTemple: Point;
  rightTemple: Point;
  mouthTop: Point;
  mouthBottom: Point;
  mouthLeft: Point;
  mouthRight: Point;
  eyeMid: Point;
  /** Top of head estimate — where crowns / hats should sit */
  headTop: Point;
  faceW: number;
  faceH: number;
  /** Roll around Z (tilt left/right), radians */
  roll: number;
  /** Approximate pitch (look up/down), -1..1 */
  pitch: number;
  /** Approximate yaw (turn left/right), -1..1 */
  yaw: number;
  /** Unit vector pointing toward top of head in screen space */
  up: Point;
  /** Unit vector pointing toward subject's right in screen space */
  right: Point;
  center: Point;
  /** Blendshapes 0..1 */
  jawOpen: number;
  smile: number;
  browUp: number;
  eyeBlink: number;
  mouthPucker: number;
};

type BlendMap = Record<string, number>;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function lm(ls: NormalizedLandmark[], i: number, w: number, h: number): Point {
  const p = ls[i];
  return { x: p.x * w, y: p.y * h };
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function norm(p: Point): Point {
  const len = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / len, y: p.y / len };
}

function blendScore(
  categories: { categoryName?: string; displayName?: string; score: number }[] | undefined,
): BlendMap {
  const map: BlendMap = {};
  if (!categories) return map;
  for (const c of categories) {
    const name = c.categoryName || c.displayName;
    if (name) map[name] = c.score;
  }
  return map;
}

function computeRaw(
  landmarks: NormalizedLandmark[],
  w: number,
  h: number,
  blends: BlendMap,
): FacePose {
  const leftEye = mid(lm(landmarks, 33, w, h), lm(landmarks, 133, w, h));
  const rightEye = mid(lm(landmarks, 362, w, h), lm(landmarks, 263, w, h));
  const nose = lm(landmarks, 1, w, h);
  const forehead = lm(landmarks, 10, w, h);
  const chin = lm(landmarks, 152, w, h);
  const leftTemple = lm(landmarks, 234, w, h);
  const rightTemple = lm(landmarks, 454, w, h);
  const mouthTop = lm(landmarks, 13, w, h);
  const mouthBottom = lm(landmarks, 14, w, h);
  const mouthLeft = lm(landmarks, 61, w, h);
  const mouthRight = lm(landmarks, 291, w, h);
  const eyeMid = mid(leftEye, rightEye);
  const faceW = dist(leftTemple, rightTemple);
  const faceH = dist(forehead, chin);
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

  const right = { x: Math.cos(roll), y: Math.sin(roll) };
  const up = { x: Math.sin(roll), y: -Math.cos(roll) };

  // Pitch / yaw from nose offset relative to eye–chin axis
  const midFace = mid(eyeMid, chin);
  const toNose = { x: nose.x - midFace.x, y: nose.y - midFace.y };
  const yaw = Math.max(
    -1,
    Math.min(1, (toNose.x * right.x + toNose.y * right.y) / (faceW * 0.25)),
  );
  const pitch = Math.max(
    -1,
    Math.min(1, (toNose.x * up.x + toNose.y * up.y) / (faceH * 0.2)),
  );

  // Head-top sits above forehead along head-up, adjusted by pitch
  const lift = faceH * (0.42 - pitch * 0.12);
  const headTop = {
    x: forehead.x + up.x * lift,
    y: forehead.y + up.y * lift,
  };

  const jawOpen = blends.jawOpen ?? 0;
  const smile = Math.max(blends.mouthSmileLeft ?? 0, blends.mouthSmileRight ?? 0);
  const browUp = blends.browInnerUp ?? 0;
  const eyeBlink = Math.max(blends.eyeBlinkLeft ?? 0, blends.eyeBlinkRight ?? 0);
  const mouthPucker = blends.mouthPucker ?? 0;

  return {
    leftEye,
    rightEye,
    nose,
    forehead,
    chin,
    leftTemple,
    rightTemple,
    mouthTop,
    mouthBottom,
    mouthLeft,
    mouthRight,
    eyeMid,
    headTop,
    faceW,
    faceH,
    roll,
    pitch,
    yaw,
    up,
    right,
    center: mid(eyeMid, chin),
    jawOpen,
    smile,
    browUp,
    eyeBlink,
    mouthPucker,
  };
}

function smoothPose(prev: FacePose | null, next: FacePose, t: number): FacePose {
  if (!prev) return next;
  return {
    leftEye: lerpPoint(prev.leftEye, next.leftEye, t),
    rightEye: lerpPoint(prev.rightEye, next.rightEye, t),
    nose: lerpPoint(prev.nose, next.nose, t),
    forehead: lerpPoint(prev.forehead, next.forehead, t),
    chin: lerpPoint(prev.chin, next.chin, t),
    leftTemple: lerpPoint(prev.leftTemple, next.leftTemple, t),
    rightTemple: lerpPoint(prev.rightTemple, next.rightTemple, t),
    mouthTop: lerpPoint(prev.mouthTop, next.mouthTop, t),
    mouthBottom: lerpPoint(prev.mouthBottom, next.mouthBottom, t),
    mouthLeft: lerpPoint(prev.mouthLeft, next.mouthLeft, t),
    mouthRight: lerpPoint(prev.mouthRight, next.mouthRight, t),
    eyeMid: lerpPoint(prev.eyeMid, next.eyeMid, t),
    headTop: lerpPoint(prev.headTop, next.headTop, t),
    faceW: lerp(prev.faceW, next.faceW, t),
    faceH: lerp(prev.faceH, next.faceH, t),
    roll: lerp(prev.roll, next.roll, t),
    pitch: lerp(prev.pitch, next.pitch, t),
    yaw: lerp(prev.yaw, next.yaw, t),
    up: norm(lerpPoint(prev.up, next.up, t)),
    right: norm(lerpPoint(prev.right, next.right, t)),
    center: lerpPoint(prev.center, next.center, t),
    jawOpen: lerp(prev.jawOpen, next.jawOpen, Math.min(1, t * 1.4)),
    smile: lerp(prev.smile, next.smile, Math.min(1, t * 1.4)),
    browUp: lerp(prev.browUp, next.browUp, Math.min(1, t * 1.4)),
    eyeBlink: lerp(prev.eyeBlink, next.eyeBlink, Math.min(1, t * 1.6)),
    mouthPucker: lerp(prev.mouthPucker, next.mouthPucker, Math.min(1, t * 1.4)),
  };
}

/**
 * Tracks face pose with temporal smoothing for butter-smooth AR props.
 */
export class FaceTracker {
  private pose: FacePose | null = null;
  /** Higher = snappier follow; 0.35–0.5 feels Messenger-like */
  private alpha = 0.42;

  reset() {
    this.pose = null;
  }

  update(
    landmarks: NormalizedLandmark[] | null | undefined,
    width: number,
    height: number,
    blendCategories?: { categoryName?: string; displayName?: string; score: number }[],
  ): FacePose | null {
    if (!landmarks?.length) {
      // Decay slightly toward freeze — keep last pose briefly
      return this.pose;
    }
    const raw = computeRaw(landmarks, width, height, blendScore(blendCategories));
    this.pose = smoothPose(this.pose, raw, this.alpha);
    return this.pose;
  }

  get() {
    return this.pose;
  }
}

export function offsetAlong(
  origin: Point,
  dir: Point,
  amount: number,
): Point {
  return { x: origin.x + dir.x * amount, y: origin.y + dir.y * amount };
}
