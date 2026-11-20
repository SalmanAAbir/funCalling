import type { FacePose, Point } from "./face-track";
import { offsetAlong } from "./face-track";
import type { FilterId } from "./filters";

function emoji(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  angle = 0,
  flip = false,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (flip) ctx.scale(-1, 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.max(10, size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Draw a prop locked to head pose — scales with faceW, rotates with roll */
function headProp(
  ctx: CanvasRenderingContext2D,
  f: FacePose,
  glyph: string,
  opts: {
    /** Multiplier of faceW for emoji font size */
    size?: number;
    /** Extra lift along head-up from headTop (fraction of faceH) */
    lift?: number;
    /** Shift along head-right (fraction of faceW) */
    side?: number;
  } = {},
) {
  const sizeMul = opts.size ?? 0.9;
  const lift = (opts.lift ?? 0) * f.faceH;
  const side = (opts.side ?? 0) * f.faceW;
  const pos = {
    x: f.headTop.x + f.up.x * lift + f.right.x * side,
    y: f.headTop.y + f.up.y * lift + f.right.y * side,
  };
  emoji(ctx, glyph, pos.x, pos.y, f.faceW * sizeMul, f.roll);
}

function tint(ctx: CanvasRenderingContext2D, f: FacePose, color: string, a: number) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(
    f.center.x,
    f.center.y,
    f.faceW * 0.58,
    f.faceH * 0.68,
    f.roll,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

const gradeCanvas =
  typeof document !== "undefined" ? document.createElement("canvas") : null;

function grade(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  css: string,
) {
  if (!gradeCanvas) return;
  if (gradeCanvas.width !== w || gradeCanvas.height !== h) {
    gradeCanvas.width = w;
    gradeCanvas.height = h;
  }
  const g = gradeCanvas.getContext("2d");
  if (!g) return;
  g.clearRect(0, 0, w, h);
  g.filter = css;
  g.drawImage(ctx.canvas, 0, 0);
  g.filter = "none";
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(gradeCanvas, 0, 0);
}

function drawEar(
  ctx: CanvasRenderingContext2D,
  base: Point,
  tip: Point,
  outer: string,
  inner: string,
  pointed: boolean,
) {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const width = pointed ? len * 0.45 : len * 0.7;

  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.rotate(ang);
  ctx.beginPath();
  if (pointed) {
    ctx.moveTo(0, -width * 0.15);
    ctx.quadraticCurveTo(len * 0.45, -width, len, 0);
    ctx.quadraticCurveTo(len * 0.45, width, 0, width * 0.15);
  } else {
    ctx.ellipse(len * 0.45, 0, len * 0.5, width * 0.55, 0, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.fillStyle = outer;
  ctx.fill();

  ctx.beginPath();
  if (pointed) {
    ctx.moveTo(len * 0.12, 0);
    ctx.quadraticCurveTo(len * 0.5, -width * 0.4, len * 0.85, 0);
    ctx.quadraticCurveTo(len * 0.5, width * 0.4, len * 0.12, 0);
  } else {
    ctx.ellipse(len * 0.45, 0, len * 0.28, width * 0.28, 0, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.fillStyle = inner;
  ctx.fill();
  ctx.restore();
}

function animalEars(
  ctx: CanvasRenderingContext2D,
  f: FacePose,
  outer: string,
  inner: string,
  opts: { pointed?: boolean; length?: number; spread?: number; flare?: number } = {},
) {
  const pointed = opts.pointed ?? true;
  const length = (opts.length ?? 0.55) * f.faceH;
  const spread = opts.spread ?? 0.08;
  const flare = opts.flare ?? 1.05;

  // Bases sit on upper temples; tips go along head-up ± outward
  const leftBase = offsetAlong(
    offsetAlong(f.forehead, f.right, -f.faceW * (0.28 + spread)),
    f.up,
    f.faceH * 0.02,
  );
  const rightBase = offsetAlong(
    offsetAlong(f.forehead, f.right, f.faceW * (0.28 + spread)),
    f.up,
    f.faceH * 0.02,
  );

  const leftOut = {
    x: f.up.x * length - f.right.x * length * flare * 0.35,
    y: f.up.y * length - f.right.y * length * flare * 0.35,
  };
  const rightOut = {
    x: f.up.x * length + f.right.x * length * flare * 0.35,
    y: f.up.y * length + f.right.y * length * flare * 0.35,
  };

  drawEar(
    ctx,
    leftBase,
    { x: leftBase.x + leftOut.x, y: leftBase.y + leftOut.y },
    outer,
    inner,
    pointed,
  );
  drawEar(
    ctx,
    rightBase,
    { x: rightBase.x + rightOut.x, y: rightBase.y + rightOut.y },
    outer,
    inner,
    pointed,
  );
}

function whiskers(ctx: CanvasRenderingContext2D, f: FacePose, color = "rgba(30,30,30,0.75)") {
  const reach = f.faceW * 0.4;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, f.faceW * 0.012);
  ctx.lineCap = "round";
  for (const oy of [-0.04, 0, 0.04]) {
    const off = f.faceH * oy;
    const a = offsetAlong(f.nose, f.up, off);
    ctx.beginPath();
    ctx.moveTo(a.x - f.right.x * f.faceW * 0.04, a.y - f.right.y * f.faceW * 0.04);
    ctx.lineTo(a.x - f.right.x * reach, a.y - f.right.y * reach + off * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.x + f.right.x * f.faceW * 0.04, a.y + f.right.y * f.faceW * 0.04);
    ctx.lineTo(a.x + f.right.x * reach, a.y + f.right.y * reach + off * 0.5);
    ctx.stroke();
  }
}

function noseDot(ctx: CanvasRenderingContext2D, f: FacePose, color: string, r = 0.05) {
  ctx.beginPath();
  ctx.arc(f.nose.x, f.nose.y, f.faceW * r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function snout(ctx: CanvasRenderingContext2D, f: FacePose, color: string) {
  ctx.save();
  ctx.translate(f.nose.x, f.nose.y);
  ctx.rotate(f.roll);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, f.faceH * 0.02, f.faceW * 0.14, f.faceH * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1c1917";
  ctx.beginPath();
  ctx.ellipse(-f.faceW * 0.035, 0, f.faceW * 0.025, f.faceH * 0.035, 0, 0, Math.PI * 2);
  ctx.ellipse(f.faceW * 0.035, 0, f.faceW * 0.025, f.faceH * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Messenger dog tongue — grows with jawOpen */
function dogTongue(ctx: CanvasRenderingContext2D, f: FacePose) {
  const open = Math.max(0, f.jawOpen - 0.15);
  if (open < 0.05) return;
  const length = f.faceH * (0.12 + open * 0.55);
  const width = f.faceW * (0.1 + open * 0.06);
  const mouth = midMouth(f);
  ctx.save();
  ctx.translate(mouth.x, mouth.y);
  ctx.rotate(f.roll);
  // Tongue hangs downward relative to head (opposite of up in local Y+)
  const gradient = ctx.createLinearGradient(0, 0, 0, length);
  gradient.addColorStop(0, "#fb7185");
  gradient.addColorStop(1, "#e11d48");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(-width * 0.5, 0);
  ctx.quadraticCurveTo(-width * 0.7, length * 0.55, 0, length);
  ctx.quadraticCurveTo(width * 0.7, length * 0.55, width * 0.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(-width * 0.15, length * 0.35, width * 0.12, length * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function midMouth(f: FacePose): Point {
  return {
    x: (f.mouthTop.x + f.mouthBottom.x) / 2,
    y: (f.mouthTop.y + f.mouthBottom.y) / 2,
  };
}

function antlers(ctx: CanvasRenderingContext2D, f: FacePose) {
  ctx.save();
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth = Math.max(2.5, f.faceW * 0.025);
  ctx.lineCap = "round";
  const drawSide = (side: 1 | -1) => {
    const base = offsetAlong(f.forehead, f.right, side * f.faceW * 0.18);
    const tip = offsetAlong(
      offsetAlong(base, f.up, f.faceH * 0.45),
      f.right,
      side * f.faceW * 0.18,
    );
    const branch = offsetAlong(
      offsetAlong(base, f.up, f.faceH * 0.22),
      f.right,
      side * f.faceW * 0.16,
    );
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.quadraticCurveTo(
      base.x + f.up.x * f.faceH * 0.25 + f.right.x * side * f.faceW * 0.05,
      base.y + f.up.y * f.faceH * 0.25 + f.right.y * side * f.faceW * 0.05,
      tip.x,
      tip.y,
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(
      base.x + f.up.x * f.faceH * 0.18,
      base.y + f.up.y * f.faceH * 0.18,
    );
    ctx.lineTo(branch.x, branch.y);
    ctx.stroke();
  };
  drawSide(-1);
  drawSide(1);
  ctx.restore();
}

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
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

function freckleDots(ctx: CanvasRenderingContext2D, f: FacePose) {
  ctx.fillStyle = "rgba(180,83,9,0.55)";
  const spots = [
    [-0.22, 0.02],
    [-0.16, 0.08],
    [-0.28, 0.1],
    [0.22, 0.02],
    [0.16, 0.08],
    [0.28, 0.1],
    [-0.1, 0.14],
    [0.1, 0.14],
  ];
  for (const [ox, oy] of spots) {
    const p = offsetAlong(offsetAlong(f.nose, f.right, f.faceW * ox), f.up, -f.faceH * oy);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1.5, f.faceW * 0.012), 0, Math.PI * 2);
    ctx.fill();
  }
}

function orbit(
  ctx: CanvasRenderingContext2D,
  f: FacePose,
  glyph: string,
  count: number,
  t: number,
  radiusMul = 0.58,
) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + t * 0.002;
    const r = f.faceW * (radiusMul + 0.08 * Math.sin(t * 0.004 + i));
    const x = f.center.x + Math.cos(a) * r * f.right.x * 0 + Math.cos(a) * r;
    const y = f.center.y + Math.sin(a) * r * 1.05;
    // Bias orbit with head tilt so particles feel attached
    const px = x + f.yaw * f.faceW * 0.05;
    const py = y + f.pitch * f.faceH * 0.04;
    emoji(ctx, glyph, px, py, f.faceW * 0.13, a);
  }
}

/** Hearts / sparkles burst from mouth when jaw opens */
function mouthBurst(
  ctx: CanvasRenderingContext2D,
  f: FacePose,
  glyph: string,
  timeMs: number,
) {
  const open = Math.max(0, f.jawOpen - 0.2);
  if (open < 0.05) return;
  const mouth = midMouth(f);
  const n = 3 + Math.floor(open * 6);
  for (let i = 0; i < n; i++) {
    const spread = (i / Math.max(1, n - 1) - 0.5) * 1.2;
    const distAmt = f.faceH * (0.15 + open * 0.55) * (0.6 + (i % 3) * 0.2);
    const wobble = Math.sin(timeMs * 0.01 + i) * f.faceW * 0.03;
    const p = {
      x:
        mouth.x -
        f.up.x * distAmt +
        f.right.x * (spread * f.faceW * 0.25 + wobble),
      y:
        mouth.y -
        f.up.y * distAmt +
        f.right.y * (spread * f.faceW * 0.25 + wobble),
    };
    emoji(ctx, glyph, p.x, p.y, f.faceW * (0.12 + open * 0.1), f.roll + spread);
  }
}

function flowerCrown(ctx: CanvasRenderingContext2D, f: FacePose) {
  const flowers = ["🌸", "🌼", "🌺", "🌸", "💮", "🌼", "🌸"];
  for (let i = 0; i < flowers.length; i++) {
    const t = i / (flowers.length - 1);
    const side = (t - 0.5) * f.faceW * 0.95;
    const lift = f.faceH * (0.06 + 0.1 * Math.sin(t * Math.PI));
    const p = offsetAlong(offsetAlong(f.headTop, f.right, side), f.up, -lift * 0.2);
    emoji(ctx, flowers[i], p.x, p.y, f.faceW * 0.22, f.roll + (t - 0.5) * 0.5);
  }
}

function drawnCrown(ctx: CanvasRenderingContext2D, f: FacePose) {
  const w = f.faceW * 0.95;
  const h = f.faceH * 0.4;
  const band = h * 0.28;
  const tips = 5;

  ctx.save();
  ctx.translate(f.headTop.x, f.headTop.y);
  ctx.rotate(f.roll);

  const grad = ctx.createLinearGradient(0, -h, 0, band);
  grad.addColorStop(0, "#fde047");
  grad.addColorStop(0.5, "#fbbf24");
  grad.addColorStop(1, "#d97706");

  ctx.fillStyle = grad;
  ctx.strokeStyle = "#b45309";
  ctx.lineWidth = Math.max(1.5, f.faceW * 0.01);

  ctx.beginPath();
  ctx.roundRect(-w / 2, -band * 0.15, w, band, band * 0.25);
  ctx.fill();
  ctx.stroke();

  for (let i = 0; i < tips; i++) {
    const x = -w / 2 + (w * i) / (tips - 1);
    const peak = i % 2 === 0 ? -h * 0.95 : -h * 0.55;
    const half = w / (tips - 1) / 2;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - half * 0.85, -band * 0.05);
    ctx.lineTo(x, peak);
    ctx.lineTo(x + half * 0.85, -band * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, peak + h * 0.12, f.faceW * 0.025, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? "#ef4444" : "#3b82f6";
    ctx.fill();
  }
  ctx.restore();
}

function halo(ctx: CanvasRenderingContext2D, f: FacePose) {
  const c = offsetAlong(f.headTop, f.up, f.faceH * 0.08);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(f.roll);
  ctx.strokeStyle = "#fde047";
  ctx.shadowColor = "#facc15";
  ctx.shadowBlur = 18;
  ctx.lineWidth = Math.max(3, f.faceW * 0.028);
  ctx.beginPath();
  ctx.ellipse(0, 0, f.faceW * 0.32, f.faceH * 0.09, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function renderFilter(
  ctx: CanvasRenderingContext2D,
  f: FacePose,
  filter: FilterId,
  width: number,
  height: number,
  timeMs: number,
) {
  if (filter === "none") return;

  switch (filter) {
    case "dog":
      animalEars(ctx, f, "#c4a574", "#f5d0a9", { pointed: false, length: 0.4 });
      snout(ctx, f, "#f5d0a9");
      noseDot(ctx, f, "#1c1917", 0.055);
      dogTongue(ctx, f);
      if (f.smile > 0.4) orbit(ctx, f, "🦴", 4, timeMs, 0.7);
      break;
    case "cat":
      animalEars(ctx, f, "#f59e0b", "#fb7185", { pointed: true, length: 0.52, flare: 1.15 });
      whiskers(ctx, f);
      noseDot(ctx, f, "#fb7185", 0.04);
      mouthBurst(ctx, f, "🐟", timeMs);
      break;
    case "bunny":
      animalEars(ctx, f, "#f8fafc", "#fda4af", {
        pointed: true,
        length: 0.88,
        spread: 0.02,
        flare: 0.55,
      });
      whiskers(ctx, f, "rgba(100,100,100,0.55)");
      noseDot(ctx, f, "#fb7185", 0.035);
      if (f.jawOpen > 0.35) mouthBurst(ctx, f, "🥕", timeMs);
      break;
    case "bear":
      animalEars(ctx, f, "#92400e", "#fdba74", { pointed: false, length: 0.34, flare: 0.9 });
      noseDot(ctx, f, "#1c1917", 0.06);
      if (f.jawOpen > 0.4) mouthBurst(ctx, f, "🍯", timeMs);
      break;
    case "deer":
      antlers(ctx, f);
      animalEars(ctx, f, "#b45309", "#fecdd3", { pointed: true, length: 0.34 });
      noseDot(ctx, f, "#1c1917", 0.04);
      break;
    case "pig":
      animalEars(ctx, f, "#fda4af", "#fb7185", { pointed: false, length: 0.3 });
      snout(ctx, f, "#fb7185");
      if (f.jawOpen > 0.35) {
        const m = midMouth(f);
        emoji(ctx, "💨", m.x, m.y + f.faceH * 0.15, f.faceW * 0.25 * f.jawOpen, f.roll);
      }
      break;
    case "mouse":
      animalEars(ctx, f, "#d6d3d1", "#fecdd3", { pointed: false, length: 0.42 });
      whiskers(ctx, f);
      noseDot(ctx, f, "#f43f5e", 0.04);
      break;
    case "panda":
      animalEars(ctx, f, "#18181b", "#fafafa", { pointed: false, length: 0.32 });
      ctx.fillStyle = "rgba(24,24,27,0.85)";
      for (const eye of [f.leftEye, f.rightEye]) {
        ctx.beginPath();
        ctx.ellipse(eye.x, eye.y, f.faceW * 0.12, f.faceH * 0.1, f.roll, 0, Math.PI * 2);
        ctx.fill();
      }
      noseDot(ctx, f, "#18181b", 0.045);
      break;
    case "fox":
      animalEars(ctx, f, "#ea580c", "#fff7ed", { pointed: true, length: 0.55, flare: 1.2 });
      whiskers(ctx, f);
      noseDot(ctx, f, "#18181b", 0.04);
      break;
    case "raccoon":
      animalEars(ctx, f, "#57534e", "#a8a29e", { pointed: false, length: 0.3 });
      ctx.fillStyle = "rgba(28,25,23,0.75)";
      for (const eye of [f.leftEye, f.rightEye]) {
        ctx.beginPath();
        ctx.ellipse(eye.x, eye.y, f.faceW * 0.14, f.faceH * 0.09, f.roll, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "chick":
      headProp(ctx, f, "🐤", { size: 0.7, lift: -0.05 });
      if (f.jawOpen > 0.3) mouthBurst(ctx, f, "🌽", timeMs);
      break;
    case "frog":
      tint(ctx, f, "#86efac", 0.22);
      emoji(ctx, "👀", f.leftEye.x, f.leftEye.y - f.faceH * 0.06, f.faceW * 0.28, f.roll);
      emoji(ctx, "👀", f.rightEye.x, f.rightEye.y - f.faceH * 0.06, f.faceW * 0.28, f.roll);
      noseDot(ctx, f, "#166534", 0.035);
      if (f.jawOpen > 0.35) dogTongue(ctx, f);
      break;
    case "unicorn":
      headProp(ctx, f, "🦄", { size: 0.75, lift: 0.05 });
      orbit(ctx, f, "✨", 6 + Math.floor(f.jawOpen * 6), timeMs);
      if (f.jawOpen > 0.3) mouthBurst(ctx, f, "✨", timeMs);
      break;
    case "flower":
      flowerCrown(ctx, f);
      if (f.smile > 0.45) orbit(ctx, f, "🌸", 5, timeMs, 0.65);
      break;
    case "hearts":
      heart(ctx, f.leftEye.x, f.leftEye.y, f.faceW * 0.12, "#f43f5e");
      heart(ctx, f.rightEye.x, f.rightEye.y, f.faceW * 0.12, "#f43f5e");
      if (f.jawOpen > 0.25) mouthBurst(ctx, f, "💕", timeMs);
      else if (f.smile > 0.35) orbit(ctx, f, "💕", 5, timeMs);
      break;
    case "stars":
      emoji(ctx, "⭐", f.leftEye.x, f.leftEye.y, f.faceW * 0.22, f.roll);
      emoji(ctx, "⭐", f.rightEye.x, f.rightEye.y, f.faceW * 0.22, f.roll);
      orbit(ctx, f, "✨", 5 + Math.floor(f.browUp * 5), timeMs);
      break;
    case "blush":
      tint(ctx, f, "#fb7185", 0.08 + f.smile * 0.08);
      ctx.globalAlpha = 0.4 + f.smile * 0.25;
      ctx.fillStyle = "#fb7185";
      for (const side of [-1, 1]) {
        const p = offsetAlong(f.nose, f.right, side * f.faceW * 0.28);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, f.faceW * 0.1, f.faceH * 0.06, f.roll, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    case "freckles":
      freckleDots(ctx, f);
      break;
    case "glow":
      grade(ctx, width, height, "brightness(1.08) saturate(1.15) contrast(1.05)");
      tint(ctx, f, "#fef9c3", 0.1 + f.smile * 0.08);
      orbit(ctx, f, "✨", 6 + Math.floor(f.jawOpen * 5), timeMs);
      break;
    case "shades": {
      const gw = f.faceW * 0.22;
      const gh = f.faceH * 0.12;
      ctx.save();
      ctx.translate(f.eyeMid.x, f.eyeMid.y);
      ctx.rotate(f.roll);
      ctx.fillStyle = "rgba(15,23,42,0.9)";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = Math.max(2, f.faceW * 0.018);
      for (const ox of [-f.faceW * 0.18, f.faceW * 0.18]) {
        ctx.beginPath();
        ctx.roundRect(ox - gw / 2, -gh / 2, gw, gh, gh * 0.35);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-f.faceW * 0.07, 0);
      ctx.lineTo(f.faceW * 0.07, 0);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "bigeyes": {
      const scale = 0.28 + (1 - f.eyeBlink) * 0.08;
      emoji(ctx, "👁️", f.leftEye.x, f.leftEye.y, f.faceW * scale, f.roll);
      emoji(ctx, "👁️", f.rightEye.x, f.rightEye.y, f.faceW * scale, f.roll);
      break;
    }
    case "mustache": {
      ctx.save();
      ctx.translate(f.nose.x, f.nose.y + f.faceH * 0.1);
      ctx.rotate(f.roll);
      ctx.fillStyle = "#292524";
      ctx.beginPath();
      ctx.ellipse(-f.faceW * 0.11, 0, f.faceW * 0.13, f.faceH * 0.045, -0.25, 0, Math.PI * 2);
      ctx.ellipse(f.faceW * 0.11, 0, f.faceW * 0.13, f.faceH * 0.045, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "crown":
      drawnCrown(ctx, f);
      break;
    case "halo":
      halo(ctx, f);
      tint(ctx, f, "#fef9c3", 0.08);
      break;
    case "devil":
      animalEars(ctx, f, "#7f1d1d", "#ef4444", {
        pointed: true,
        length: 0.48,
        flare: 1.25,
      });
      tint(ctx, f, "#ef4444", 0.08 + f.jawOpen * 0.1);
      if (f.jawOpen > 0.35) mouthBurst(ctx, f, "🔥", timeMs);
      break;
    case "ghost":
      tint(ctx, f, "#f8fafc", 0.32 + f.jawOpen * 0.1);
      for (const eye of [f.leftEye, f.rightEye]) {
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.ellipse(eye.x, eye.y, f.faceW * 0.07, f.faceH * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (f.jawOpen > 0.2) {
        const m = midMouth(f);
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.ellipse(
          m.x,
          m.y,
          f.faceW * (0.06 + f.jawOpen * 0.1),
          f.faceH * (0.04 + f.jawOpen * 0.12),
          f.roll,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      break;
    case "sparkle":
      orbit(ctx, f, "💖", 8 + Math.floor(f.jawOpen * 6), timeMs);
      if (f.jawOpen > 0.25) mouthBurst(ctx, f, "✨", timeMs);
      break;
    case "rainbow":
      headProp(ctx, f, "🌈", { size: 0.85, lift: 0.12 });
      tint(ctx, f, "#a78bfa", 0.08);
      if (f.jawOpen > 0.3) mouthBurst(ctx, f, "🌈", timeMs);
      break;
    case "snow":
      grade(ctx, width, height, "saturate(0.75) brightness(1.06) hue-rotate(170deg)");
      orbit(ctx, f, "❄️", 8 + Math.floor(Math.abs(f.yaw) * 4), timeMs);
      break;
    case "warm":
      grade(ctx, width, height, "sepia(0.35) saturate(1.25) brightness(1.05)");
      break;
    case "cool":
      grade(ctx, width, height, "saturate(0.85) hue-rotate(190deg) brightness(1.05)");
      break;
    default:
      break;
  }
}
