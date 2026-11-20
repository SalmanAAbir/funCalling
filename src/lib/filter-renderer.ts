import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { FilterId } from "./filters";

type Point = { x: number; y: number };

type FaceGeom = {
  leftEye: Point;
  rightEye: Point;
  nose: Point;
  forehead: Point;
  chin: Point;
  leftTemple: Point;
  rightTemple: Point;
  mouth: Point;
  eyeMid: Point;
  faceW: number;
  faceH: number;
  angle: number;
  center: Point;
};

function lm(
  landmarks: NormalizedLandmark[],
  index: number,
  w: number,
  h: number,
): Point {
  const p = landmarks[index];
  return { x: p.x * w, y: p.y * h };
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function geom(
  landmarks: NormalizedLandmark[],
  w: number,
  h: number,
): FaceGeom {
  const leftEye = lm(landmarks, 33, w, h);
  const rightEye = lm(landmarks, 263, w, h);
  const nose = lm(landmarks, 1, w, h);
  const forehead = lm(landmarks, 10, w, h);
  const chin = lm(landmarks, 152, w, h);
  const leftTemple = lm(landmarks, 234, w, h);
  const rightTemple = lm(landmarks, 454, w, h);
  const mouth = lm(landmarks, 13, w, h);
  const eyeMid = mid(leftEye, rightEye);
  return {
    leftEye,
    rightEye,
    nose,
    forehead,
    chin,
    leftTemple,
    rightTemple,
    mouth,
    eyeMid,
    faceW: dist(leftTemple, rightTemple),
    faceH: dist(forehead, chin),
    angle: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x),
    center: mid(eyeMid, chin),
  };
}

function sticker(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  x: number,
  y: number,
  size: number,
  angle = 0,
  mirrorX = false,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (mirrorX) ctx.scale(-1, 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.max(12, size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.fillText(emoji, 0, 0);
  ctx.restore();
}

function tintFace(
  ctx: CanvasRenderingContext2D,
  g: FaceGeom,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(
    g.center.x,
    g.center.y,
    g.faceW * 0.58,
    g.faceH * 0.68,
    g.angle,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

const gradeCanvas =
  typeof document !== "undefined" ? document.createElement("canvas") : null;

function colorGrade(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cssFilter: string,
) {
  if (!gradeCanvas) return;
  if (gradeCanvas.width !== w || gradeCanvas.height !== h) {
    gradeCanvas.width = w;
    gradeCanvas.height = h;
  }
  const gctx = gradeCanvas.getContext("2d");
  if (!gctx) return;
  gctx.clearRect(0, 0, w, h);
  gctx.filter = cssFilter;
  gctx.drawImage(ctx.canvas, 0, 0, w, h);
  gctx.filter = "none";
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(gradeCanvas, 0, 0);
}

function earPair(
  ctx: CanvasRenderingContext2D,
  g: FaceGeom,
  emoji: string,
  sizeMul = 0.42,
  lift = 0.12,
  spread = 0.08,
) {
  const size = g.faceW * sizeMul;
  const ly = g.forehead.y - g.faceH * lift;
  const ry = g.forehead.y - g.faceH * lift;
  sticker(
    ctx,
    emoji,
    g.leftTemple.x + g.faceW * spread,
    ly,
    size,
    g.angle - 0.35,
  );
  sticker(
    ctx,
    emoji,
    g.rightTemple.x - g.faceW * spread,
    ry,
    size,
    g.angle + 0.35,
    true,
  );
}

function eyePair(
  ctx: CanvasRenderingContext2D,
  g: FaceGeom,
  emoji: string,
  sizeMul = 0.28,
) {
  const size = g.faceW * sizeMul;
  sticker(ctx, emoji, g.leftEye.x, g.leftEye.y, size, g.angle);
  sticker(ctx, emoji, g.rightEye.x, g.rightEye.y, size, g.angle);
}

function browHat(
  ctx: CanvasRenderingContext2D,
  g: FaceGeom,
  emoji: string,
  sizeMul = 0.55,
  lift = 0.35,
) {
  sticker(
    ctx,
    emoji,
    g.forehead.x,
    g.forehead.y - g.faceH * lift,
    g.faceW * sizeMul,
    g.angle,
  );
}

function noseBit(
  ctx: CanvasRenderingContext2D,
  g: FaceGeom,
  emoji: string,
  sizeMul = 0.22,
) {
  sticker(ctx, emoji, g.nose.x, g.nose.y, g.faceW * sizeMul, g.angle);
}

function sparklesAround(
  ctx: CanvasRenderingContext2D,
  g: FaceGeom,
  emoji: string,
  count: number,
  t: number,
) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + t * 0.002;
    const r = g.faceW * (0.55 + 0.12 * Math.sin(t * 0.004 + i));
    sticker(
      ctx,
      emoji,
      g.center.x + Math.cos(a) * r,
      g.center.y + Math.sin(a) * r * 1.1,
      g.faceW * 0.14,
      a,
    );
  }
}

function cyberHud(ctx: CanvasRenderingContext2D, g: FaceGeom) {
  ctx.save();
  ctx.strokeStyle = "rgba(34,211,238,0.85)";
  ctx.lineWidth = Math.max(1.5, g.faceW * 0.012);
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.ellipse(
    g.center.x,
    g.center.y,
    g.faceW * 0.62,
    g.faceH * 0.72,
    g.angle,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(34,211,238,0.9)";
  ctx.font = `${Math.max(10, g.faceW * 0.06)}px ui-monospace, monospace`;
  ctx.fillText("TRK·OK", g.rightTemple.x + 8, g.forehead.y);
  ctx.fillText(
    `${Math.round(g.faceW)}px`,
    g.leftTemple.x - g.faceW * 0.2,
    g.chin.y,
  );
  ctx.restore();
  eyePair(ctx, g, "💠", 0.18);
}

function pixelateFace(
  ctx: CanvasRenderingContext2D,
  g: FaceGeom,
  block = 12,
) {
  const x = Math.max(0, g.center.x - g.faceW * 0.55);
  const y = Math.max(0, g.center.y - g.faceH * 0.65);
  const w = g.faceW * 1.1;
  const h = g.faceH * 1.25;
  const sw = Math.max(4, Math.floor(w / block));
  const sh = Math.max(4, Math.floor(h / block));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const tmp = document.createElement("canvas");
  tmp.width = sw;
  tmp.height = sh;
  const tctx = tmp.getContext("2d");
  if (!tctx) {
    ctx.restore();
    return;
  }
  tctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, sw, sh);
  ctx.drawImage(tmp, 0, 0, sw, sh, x, y, w, h);
  ctx.restore();
}

function comicDots(ctx: CanvasRenderingContext2D, g: FaceGeom) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  const step = Math.max(6, g.faceW * 0.04);
  const x0 = g.center.x - g.faceW * 0.55;
  const y0 = g.center.y - g.faceH * 0.65;
  const x1 = g.center.x + g.faceW * 0.55;
  const y1 = g.center.y + g.faceH * 0.65;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const dx = (x - g.center.x) / (g.faceW * 0.55);
      const dy = (y - g.center.y) / (g.faceH * 0.65);
      if (dx * dx + dy * dy > 1) continue;
      ctx.beginPath();
      ctx.arc(x, y, step * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function renderFilter(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  filter: FilterId,
  width: number,
  height: number,
  timeMs: number,
) {
  if (filter === "none") return;

  const g = geom(landmarks, width, height);

  switch (filter) {
    case "noir":
      colorGrade(ctx, width, height, "grayscale(1) contrast(1.25)");
      return;
    case "vintage":
      colorGrade(ctx, width, height, "sepia(0.55) contrast(1.1) saturate(1.2)");
      tintFace(ctx, g, "#f59e0b", 0.08);
      return;
    case "ice":
      colorGrade(ctx, width, height, "saturate(0.7) brightness(1.08) hue-rotate(180deg)");
      tintFace(ctx, g, "#67e8f9", 0.18);
      sparklesAround(ctx, g, "❄️", 8, timeMs);
      return;
    case "neon":
      tintFace(ctx, g, "#22c55e", 0.12);
      ctx.save();
      ctx.strokeStyle = "rgba(74,222,128,0.95)";
      ctx.shadowColor = "#4ade80";
      ctx.shadowBlur = 18;
      ctx.lineWidth = Math.max(3, g.faceW * 0.03);
      ctx.beginPath();
      ctx.ellipse(
        g.center.x,
        g.center.y,
        g.faceW * 0.6,
        g.faceH * 0.7,
        g.angle,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.restore();
      return;
    case "rainbow":
      tintFace(ctx, g, "#a78bfa", 0.12);
      browHat(ctx, g, "🌈", 0.7, 0.45);
      sparklesAround(ctx, g, "✨", 6, timeMs);
      return;
    case "pixel":
      pixelateFace(ctx, g, 14);
      browHat(ctx, g, "👾", 0.35, 0.4);
      return;
    case "comic":
      colorGrade(ctx, width, height, "contrast(1.4) saturate(1.6)");
      comicDots(ctx, g);
      browHat(ctx, g, "💥", 0.32, 0.5);
      return;
    case "cyber":
      colorGrade(ctx, width, height, "contrast(1.15) saturate(1.3) hue-rotate(20deg)");
      cyberHud(ctx, g);
      return;
    case "fire":
      tintFace(ctx, g, "#ef4444", 0.16);
      browHat(ctx, g, "🔥", 0.45, 0.42);
      sparklesAround(ctx, g, "🔥", 7, timeMs);
      return;
    case "sparkle":
      sparklesAround(ctx, g, "✨", 12, timeMs);
      eyePair(ctx, g, "🌟", 0.2);
      return;
    default:
      break;
  }

  // Sticker / character filters
  switch (filter) {
    case "cat":
      earPair(ctx, g, "🐱", 0.4, 0.08);
      noseBit(ctx, g, "👃", 0.16);
      break;
    case "dog":
      earPair(ctx, g, "🐶", 0.44, 0.05);
      noseBit(ctx, g, "🐽", 0.2);
      break;
    case "bunny":
      earPair(ctx, g, "🐰", 0.5, 0.22, 0.05);
      noseBit(ctx, g, "🌸", 0.14);
      break;
    case "mouse":
      earPair(ctx, g, "🐭", 0.38, 0.05);
      noseBit(ctx, g, "🩷", 0.12);
      break;
    case "bear":
      earPair(ctx, g, "🐻", 0.42, 0.02);
      break;
    case "fox":
      earPair(ctx, g, "🦊", 0.4, 0.1);
      noseBit(ctx, g, "🖤", 0.12);
      break;
    case "panda":
      earPair(ctx, g, "🐼", 0.4, 0.02);
      eyePair(ctx, g, "⚫", 0.2);
      break;
    case "frog":
      eyePair(ctx, g, "👀", 0.32);
      tintFace(ctx, g, "#86efac", 0.2);
      noseBit(ctx, g, "🟢", 0.14);
      break;
    case "pig":
      earPair(ctx, g, "🐷", 0.36, 0.02);
      noseBit(ctx, g, "🐽", 0.28);
      break;
    case "chick":
      browHat(ctx, g, "🐤", 0.55, 0.15);
      break;
    case "koala":
      earPair(ctx, g, "🐨", 0.45, 0.0);
      break;
    case "tiger":
      earPair(ctx, g, "🐯", 0.4, 0.08);
      tintFace(ctx, g, "#fb923c", 0.12);
      break;
    case "lion":
      browHat(ctx, g, "🦁", 0.85, 0.05);
      break;
    case "cow":
      earPair(ctx, g, "🐮", 0.38, 0.05);
      browHat(ctx, g, "🖤", 0.2, 0.15);
      break;
    case "unicorn":
      browHat(ctx, g, "🦄", 0.55, 0.28);
      sparklesAround(ctx, g, "✨", 8, timeMs);
      break;
    case "dragon":
      earPair(ctx, g, "🐲", 0.42, 0.12);
      browHat(ctx, g, "🔥", 0.28, 0.35);
      break;
    case "alien":
      tintFace(ctx, g, "#4ade80", 0.22);
      eyePair(ctx, g, "👁️", 0.34);
      browHat(ctx, g, "👽", 0.4, 0.35);
      break;
    case "ghost":
      tintFace(ctx, g, "#f8fafc", 0.35);
      eyePair(ctx, g, "👀", 0.26);
      browHat(ctx, g, "👻", 0.4, 0.4);
      break;
    case "robot":
      tintFace(ctx, g, "#94a3b8", 0.28);
      eyePair(ctx, g, "🟥", 0.22);
      browHat(ctx, g, "🤖", 0.45, 0.25);
      break;
    case "devil":
      earPair(ctx, g, "😈", 0.36, 0.18);
      tintFace(ctx, g, "#ef4444", 0.12);
      break;
    case "angel":
      browHat(ctx, g, "😇", 0.55, 0.35);
      sparklesAround(ctx, g, "✨", 6, timeMs);
      tintFace(ctx, g, "#fef9c3", 0.12);
      break;
    case "clown":
      noseBit(ctx, g, "🔴", 0.28);
      eyePair(ctx, g, "🔵", 0.18);
      browHat(ctx, g, "🤡", 0.45, 0.3);
      break;
    case "vampire":
      tintFace(ctx, g, "#64748b", 0.2);
      sticker(ctx, "🦷", g.mouth.x, g.mouth.y, g.faceW * 0.28, g.angle);
      browHat(ctx, g, "🧛", 0.4, 0.28);
      break;
    case "zombie":
      tintFace(ctx, g, "#84cc16", 0.28);
      eyePair(ctx, g, "🤢", 0.22);
      browHat(ctx, g, "🧟", 0.4, 0.28);
      break;
    case "witch":
      browHat(ctx, g, "🧙", 0.55, 0.3);
      noseBit(ctx, g, "🧹", 0.14);
      break;
    case "pirate":
      sticker(ctx, "🏴‍☠️", g.leftEye.x, g.leftEye.y, g.faceW * 0.32, g.angle);
      browHat(ctx, g, "🦜", 0.32, 0.4);
      break;
    case "shades":
      eyePair(ctx, g, "🕶️", 0.36);
      break;
    case "hearts":
      eyePair(ctx, g, "❤️", 0.28);
      sparklesAround(ctx, g, "💕", 6, timeMs);
      break;
    case "starry":
      eyePair(ctx, g, "⭐", 0.28);
      sparklesAround(ctx, g, "✨", 8, timeMs);
      break;
    case "mustache":
      sticker(ctx, "🥸", g.nose.x, g.nose.y + g.faceH * 0.08, g.faceW * 0.45, g.angle);
      break;
    case "crown":
      browHat(ctx, g, "👑", 0.55, 0.4);
      break;
    case "flower":
      earPair(ctx, g, "🌸", 0.32, 0.15);
      browHat(ctx, g, "🌼", 0.3, 0.35);
      break;
    case "party":
      browHat(ctx, g, "🥳", 0.55, 0.28);
      sparklesAround(ctx, g, "🎉", 7, timeMs);
      break;
    case "mask":
      sticker(ctx, "🎭", g.eyeMid.x, g.eyeMid.y, g.faceW * 0.7, g.angle);
      break;
    case "glasses":
      eyePair(ctx, g, "👓", 0.34);
      break;
    case "mono":
      sticker(ctx, "🧐", g.rightEye.x, g.rightEye.y, g.faceW * 0.38, g.angle);
      break;
    case "blush":
      sticker(ctx, "🌸", g.leftTemple.x + g.faceW * 0.12, g.nose.y, g.faceW * 0.22, 0);
      sticker(ctx, "🌸", g.rightTemple.x - g.faceW * 0.12, g.nose.y, g.faceW * 0.22, 0, true);
      tintFace(ctx, g, "#fb7185", 0.1);
      break;
    case "tears":
      sticker(ctx, "💧", g.leftEye.x, g.leftEye.y + g.faceH * 0.18, g.faceW * 0.18, 0);
      sticker(ctx, "💧", g.rightEye.x, g.rightEye.y + g.faceH * 0.18, g.faceW * 0.18, 0);
      eyePair(ctx, g, "😭", 0.26);
      break;
    default:
      browHat(ctx, g, "✨", 0.35, 0.3);
  }
}
