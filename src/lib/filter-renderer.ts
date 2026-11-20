import type { FacePose, Point } from "./face-track";
import { offsetAlong } from "./face-track";
import type { FilterId } from "./filters";

/** Apply head yaw foreshortening + roll for Snapchat-like stickiness */
function withHeadSpace(
  ctx: CanvasRenderingContext2D,
  f: FacePose,
  origin: Point,
  draw: () => void,
) {
  const yawScale = Math.max(0.55, 1 - Math.abs(f.yaw) * 0.45);
  const pitchSquash = Math.max(0.75, 1 - Math.abs(f.pitch) * 0.2);
  ctx.save();
  ctx.translate(origin.x, origin.y);
  ctx.rotate(f.roll);
  ctx.scale(yawScale, pitchSquash);
  // Soft contact shadow under props
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = Math.max(4, f.faceW * 0.04);
  ctx.shadowOffsetY = f.faceW * 0.01;
  draw();
  ctx.restore();
}

function emoji(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  angle = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.max(10, size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.fillText(text, 0, 0);
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

/** Shaded 3D-ish horn / ear in local head space (origin at base) */
function shadedHorn(
  ctx: CanvasRenderingContext2D,
  length: number,
  width: number,
  lean: number,
  colors: { tip: string; mid: string; base: string; inner: string },
  pointed: boolean,
) {
  ctx.save();
  ctx.rotate(lean);

  const grad = ctx.createLinearGradient(0, 0, length * 0.15, -length);
  grad.addColorStop(0, colors.base);
  grad.addColorStop(0.55, colors.mid);
  grad.addColorStop(1, colors.tip);

  ctx.beginPath();
  if (pointed) {
    ctx.moveTo(-width * 0.15, 0);
    ctx.quadraticCurveTo(-width, -length * 0.45, 0, -length);
    ctx.quadraticCurveTo(width, -length * 0.45, width * 0.15, 0);
  } else {
    ctx.ellipse(0, -length * 0.45, width * 0.85, length * 0.5, 0, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Inner glow / canal
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  if (pointed) {
    ctx.moveTo(0, -length * 0.08);
    ctx.quadraticCurveTo(-width * 0.35, -length * 0.45, 0, -length * 0.82);
    ctx.quadraticCurveTo(width * 0.35, -length * 0.45, 0, -length * 0.08);
  } else {
    ctx.ellipse(0, -length * 0.42, width * 0.4, length * 0.28, 0, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.fillStyle = colors.inner;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Specular edge
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = Math.max(1, width * 0.08);
  ctx.beginPath();
  ctx.moveTo(-width * 0.2, -length * 0.1);
  ctx.quadraticCurveTo(-width * 0.55, -length * 0.5, -width * 0.05, -length * 0.9);
  ctx.stroke();

  ctx.restore();
}

function animalEars(
  ctx: CanvasRenderingContext2D,
  f: FacePose,
  colors: { tip: string; mid: string; base: string; inner: string },
  opts: { pointed?: boolean; length?: number; flare?: number; width?: number } = {},
) {
  const pointed = opts.pointed ?? true;
  const length = (opts.length ?? 0.52) * f.faceH;
  const width = (opts.width ?? 0.22) * f.faceW;
  const flare = opts.flare ?? 0.55;

  const leftBase = offsetAlong(
    offsetAlong(f.forehead, f.right, -f.faceW * 0.32),
    f.up,
    f.faceH * 0.02,
  );
  const rightBase = offsetAlong(
    offsetAlong(f.forehead, f.right, f.faceW * 0.32),
    f.up,
    f.faceH * 0.02,
  );

  withHeadSpace(ctx, f, leftBase, () => {
    shadedHorn(ctx, length, width, -flare, colors, pointed);
  });
  withHeadSpace(ctx, f, rightBase, () => {
    shadedHorn(ctx, length, width, flare, colors, pointed);
  });
}

function whiskers(ctx: CanvasRenderingContext2D, f: FacePose) {
  ctx.save();
  ctx.strokeStyle = "rgba(20,20,20,0.55)";
  ctx.lineWidth = Math.max(1.2, f.faceW * 0.01);
  ctx.lineCap = "round";
  const reach = f.faceW * 0.38;
  for (const oy of [-0.035, 0, 0.035]) {
    const a = offsetAlong(f.nose, f.up, f.faceH * oy);
    ctx.beginPath();
    ctx.moveTo(a.x - f.right.x * f.faceW * 0.05, a.y - f.right.y * f.faceW * 0.05);
    ctx.lineTo(a.x - f.right.x * reach, a.y - f.right.y * reach);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.x + f.right.x * f.faceW * 0.05, a.y + f.right.y * f.faceW * 0.05);
    ctx.lineTo(a.x + f.right.x * reach, a.y + f.right.y * reach);
    ctx.stroke();
  }
  ctx.restore();
}

function noseDot(ctx: CanvasRenderingContext2D, f: FacePose, color: string, r = 0.045) {
  withHeadSpace(ctx, f, f.nose, () => {
    const rad = f.faceW * r;
    const g = ctx.createRadialGradient(-rad * 0.3, -rad * 0.3, 0, 0, 0, rad);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.35, color);
    g.addColorStop(1, color);
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  });
}

function snout(ctx: CanvasRenderingContext2D, f: FacePose, color: string) {
  withHeadSpace(ctx, f, f.nose, () => {
    const g = ctx.createRadialGradient(
      -f.faceW * 0.04,
      -f.faceH * 0.02,
      0,
      0,
      f.faceH * 0.02,
      f.faceW * 0.16,
    );
    g.addColorStop(0, "#fff8");
    g.addColorStop(0.4, color);
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, f.faceH * 0.02, f.faceW * 0.14, f.faceH * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.ellipse(-f.faceW * 0.035, 0, f.faceW * 0.022, f.faceH * 0.03, 0, 0, Math.PI * 2);
    ctx.ellipse(f.faceW * 0.035, 0, f.faceW * 0.022, f.faceH * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function midMouth(f: FacePose): Point {
  return {
    x: (f.mouthTop.x + f.mouthBottom.x) / 2,
    y: (f.mouthTop.y + f.mouthBottom.y) / 2,
  };
}

function dogTongue(ctx: CanvasRenderingContext2D, f: FacePose) {
  const open = Math.max(0, f.jawOpen - 0.15);
  if (open < 0.05) return;
  const length = f.faceH * (0.1 + open * 0.5);
  const width = f.faceW * (0.09 + open * 0.05);
  withHeadSpace(ctx, f, midMouth(f), () => {
    const grad = ctx.createLinearGradient(0, 0, 0, length);
    grad.addColorStop(0, "#fda4af");
    grad.addColorStop(1, "#e11d48");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-width * 0.5, 0);
    ctx.quadraticCurveTo(-width * 0.65, length * 0.5, 0, length);
    ctx.quadraticCurveTo(width * 0.65, length * 0.5, width * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(-width * 0.12, length * 0.32, width * 0.1, length * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function antlers(ctx: CanvasRenderingContext2D, f: FacePose) {
  const drawSide = (side: 1 | -1) => {
    const base = offsetAlong(f.forehead, f.right, side * f.faceW * 0.16);
    withHeadSpace(ctx, f, base, () => {
      ctx.strokeStyle = "#78350f";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(2.5, f.faceW * 0.028);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * f.faceW * 0.06, -f.faceH * 0.28, side * f.faceW * 0.16, -f.faceH * 0.48);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(side * f.faceW * 0.03, -f.faceH * 0.2);
      ctx.lineTo(side * f.faceW * 0.14, -f.faceH * 0.3);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = Math.max(1, f.faceW * 0.01);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * f.faceW * 0.05, -f.faceH * 0.28, side * f.faceW * 0.14, -f.faceH * 0.45);
      ctx.stroke();
    });
  };
  drawSide(-1);
  drawSide(1);
}

function softCheek(
  ctx: CanvasRenderingContext2D,
  f: FacePose,
  color: string,
  strength: number,
) {
  for (const side of [-1, 1] as const) {
    const p = offsetAlong(
      offsetAlong(f.nose, f.right, side * f.faceW * 0.28),
      f.up,
      -f.faceH * 0.02,
    );
    withHeadSpace(ctx, f, p, () => {
      const rx = f.faceW * 0.11;
      const ry = f.faceH * 0.07;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, color);
      g.addColorStop(1, "transparent");
      ctx.globalAlpha = strength;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }
}

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 6;
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
  ctx.fillStyle = "rgba(146,64,14,0.45)";
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
    ctx.arc(p.x, p.y, Math.max(1.2, f.faceW * 0.01), 0, Math.PI * 2);
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
    emoji(
      ctx,
      glyph,
      f.center.x + Math.cos(a) * r + f.yaw * f.faceW * 0.04,
      f.center.y + Math.sin(a) * r * 1.05 + f.pitch * f.faceH * 0.03,
      f.faceW * 0.12,
      a,
    );
  }
}

function mouthBurst(
  ctx: CanvasRenderingContext2D,
  f: FacePose,
  glyph: string,
  timeMs: number,
) {
  const open = Math.max(0, f.jawOpen - 0.2);
  if (open < 0.05) return;
  const mouth = midMouth(f);
  const n = 3 + Math.floor(open * 5);
  for (let i = 0; i < n; i++) {
    const spread = (i / Math.max(1, n - 1) - 0.5) * 1.1;
    const distAmt = f.faceH * (0.12 + open * 0.5) * (0.55 + (i % 3) * 0.2);
    const wobble = Math.sin(timeMs * 0.01 + i) * f.faceW * 0.025;
    emoji(
      ctx,
      glyph,
      mouth.x - f.up.x * distAmt + f.right.x * (spread * f.faceW * 0.22 + wobble),
      mouth.y - f.up.y * distAmt + f.right.y * (spread * f.faceW * 0.22 + wobble),
      f.faceW * (0.11 + open * 0.08),
      f.roll + spread,
    );
  }
}

function flowerCrown(ctx: CanvasRenderingContext2D, f: FacePose) {
  const flowers = ["🌸", "🌼", "🌺", "🌸", "💮", "🌼", "🌸"];
  for (let i = 0; i < flowers.length; i++) {
    const t = i / (flowers.length - 1);
    const side = (t - 0.5) * f.faceW * 0.92;
    const p = offsetAlong(f.headTop, f.right, side);
    withHeadSpace(ctx, f, p, () => {
      emoji(ctx, flowers[i], 0, 0, f.faceW * 0.2, (t - 0.5) * 0.4);
    });
  }
}

function drawnCrown(ctx: CanvasRenderingContext2D, f: FacePose) {
  withHeadSpace(ctx, f, f.headTop, () => {
    const w = f.faceW * 0.95;
    const h = f.faceH * 0.4;
    const band = h * 0.28;
    const tips = 5;
    const grad = ctx.createLinearGradient(0, -h, 0, band);
    grad.addColorStop(0, "#fef08a");
    grad.addColorStop(0.45, "#fbbf24");
    grad.addColorStop(1, "#b45309");

    ctx.fillStyle = grad;
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = Math.max(1.2, f.faceW * 0.01);

    ctx.beginPath();
    ctx.roundRect(-w / 2, -band * 0.1, w, band, band * 0.25);
    ctx.fill();
    ctx.stroke();

    for (let i = 0; i < tips; i++) {
      const x = -w / 2 + (w * i) / (tips - 1);
      const peak = i % 2 === 0 ? -h * 0.95 : -h * 0.55;
      const half = w / (tips - 1) / 2;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - half * 0.8, 0);
      ctx.lineTo(x, peak);
      ctx.lineTo(x + half * 0.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const jewel = ctx.createRadialGradient(x - 2, peak + h * 0.08, 0, x, peak + h * 0.1, f.faceW * 0.03);
      jewel.addColorStop(0, "#fff");
      jewel.addColorStop(1, i % 2 === 0 ? "#ef4444" : "#3b82f6");
      ctx.beginPath();
      ctx.arc(x, peak + h * 0.1, f.faceW * 0.028, 0, Math.PI * 2);
      ctx.fillStyle = jewel;
      ctx.fill();
    }
  });
}

function halo(ctx: CanvasRenderingContext2D, f: FacePose) {
  const c = offsetAlong(f.headTop, f.up, f.faceH * 0.1);
  withHeadSpace(ctx, f, c, () => {
    ctx.strokeStyle = "#fde047";
    ctx.shadowColor = "#facc15";
    ctx.shadowBlur = 20;
    ctx.lineWidth = Math.max(3, f.faceW * 0.03);
    ctx.beginPath();
    ctx.ellipse(0, 0, f.faceW * 0.34, f.faceH * 0.09, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function shades(ctx: CanvasRenderingContext2D, f: FacePose) {
  withHeadSpace(ctx, f, f.eyeMid, () => {
    const gw = f.faceW * 0.22;
    const gh = f.faceH * 0.12;
    ctx.fillStyle = "rgba(15,23,42,0.92)";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = Math.max(2, f.faceW * 0.016);
    for (const ox of [-f.faceW * 0.18, f.faceW * 0.18]) {
      ctx.beginPath();
      ctx.roundRect(ox - gw / 2, -gh / 2, gw, gh, gh * 0.35);
      ctx.fill();
      ctx.stroke();
      // Lens shine
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(ox - gw * 0.35, -gh * 0.35, gw * 0.35, gh * 0.25);
      ctx.fillStyle = "rgba(15,23,42,0.92)";
    }
    ctx.beginPath();
    ctx.moveTo(-f.faceW * 0.07, 0);
    ctx.lineTo(f.faceW * 0.07, 0);
    ctx.stroke();
  });
}

const CAT = { tip: "#fdba74", mid: "#f59e0b", base: "#d97706", inner: "#fb7185" };
const DOG = { tip: "#e7c9a0", mid: "#c4a574", base: "#a16207", inner: "#f5d0a9" };
const BUNNY = { tip: "#ffffff", mid: "#f1f5f9", base: "#e2e8f0", inner: "#fda4af" };
const BEAR = { tip: "#a16207", mid: "#92400e", base: "#78350f", inner: "#fdba74" };
const FOX = { tip: "#fb923c", mid: "#ea580c", base: "#c2410c", inner: "#fff7ed" };
const MOUSE = { tip: "#e7e5e4", mid: "#d6d3d1", base: "#a8a29e", inner: "#fecdd3" };
const PIG = { tip: "#fecdd3", mid: "#fda4af", base: "#fb7185", inner: "#fb7185" };
const PANDA = { tip: "#27272a", mid: "#18181b", base: "#09090b", inner: "#fafafa" };
const DEVIL = { tip: "#ef4444", mid: "#dc2626", base: "#7f1d1d", inner: "#fca5a5" };
const RACCOON = { tip: "#78716c", mid: "#57534e", base: "#44403c", inner: "#a8a29e" };

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
      animalEars(ctx, f, DOG, { pointed: false, length: 0.4, width: 0.26, flare: 0.4 });
      snout(ctx, f, "#f5d0a9");
      noseDot(ctx, f, "#1c1917", 0.05);
      dogTongue(ctx, f);
      break;
    case "cat":
      animalEars(ctx, f, CAT, { pointed: true, length: 0.55, flare: 0.7 });
      whiskers(ctx, f);
      noseDot(ctx, f, "#fb7185", 0.038);
      mouthBurst(ctx, f, "🐟", timeMs);
      break;
    case "bunny":
      animalEars(ctx, f, BUNNY, { pointed: true, length: 0.9, flare: 0.28, width: 0.16 });
      whiskers(ctx, f);
      noseDot(ctx, f, "#fb7185", 0.032);
      if (f.jawOpen > 0.35) mouthBurst(ctx, f, "🥕", timeMs);
      break;
    case "bear":
      animalEars(ctx, f, BEAR, { pointed: false, length: 0.32, width: 0.28, flare: 0.35 });
      noseDot(ctx, f, "#1c1917", 0.055);
      if (f.jawOpen > 0.4) mouthBurst(ctx, f, "🍯", timeMs);
      break;
    case "deer":
      antlers(ctx, f);
      animalEars(ctx, f, BEAR, { pointed: true, length: 0.32, flare: 0.5, width: 0.14 });
      noseDot(ctx, f, "#1c1917", 0.038);
      break;
    case "pig":
      animalEars(ctx, f, PIG, { pointed: false, length: 0.28, width: 0.22, flare: 0.4 });
      snout(ctx, f, "#fb7185");
      break;
    case "mouse":
      animalEars(ctx, f, MOUSE, { pointed: false, length: 0.42, width: 0.3, flare: 0.25 });
      whiskers(ctx, f);
      noseDot(ctx, f, "#f43f5e", 0.036);
      break;
    case "panda":
      animalEars(ctx, f, PANDA, { pointed: false, length: 0.3, width: 0.26, flare: 0.3 });
      withHeadSpace(ctx, f, f.leftEye, () => {
        ctx.fillStyle = "rgba(24,24,27,0.88)";
        ctx.beginPath();
        ctx.ellipse(0, 0, f.faceW * 0.11, f.faceH * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      withHeadSpace(ctx, f, f.rightEye, () => {
        ctx.fillStyle = "rgba(24,24,27,0.88)";
        ctx.beginPath();
        ctx.ellipse(0, 0, f.faceW * 0.11, f.faceH * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      noseDot(ctx, f, "#18181b", 0.04);
      break;
    case "fox":
      animalEars(ctx, f, FOX, { pointed: true, length: 0.55, flare: 0.75 });
      whiskers(ctx, f);
      noseDot(ctx, f, "#18181b", 0.036);
      break;
    case "raccoon":
      animalEars(ctx, f, RACCOON, { pointed: false, length: 0.28, width: 0.22, flare: 0.35 });
      withHeadSpace(ctx, f, f.leftEye, () => {
        ctx.fillStyle = "rgba(28,25,23,0.8)";
        ctx.beginPath();
        ctx.ellipse(0, 0, f.faceW * 0.13, f.faceH * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      withHeadSpace(ctx, f, f.rightEye, () => {
        ctx.fillStyle = "rgba(28,25,23,0.8)";
        ctx.beginPath();
        ctx.ellipse(0, 0, f.faceW * 0.13, f.faceH * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    case "chick":
      withHeadSpace(ctx, f, f.headTop, () => {
        emoji(ctx, "🐤", 0, f.faceH * 0.02, f.faceW * 0.65);
      });
      break;
    case "frog":
      softCheek(ctx, f, "#4ade80", 0.25);
      withHeadSpace(ctx, f, f.leftEye, () => {
        emoji(ctx, "👀", 0, -f.faceH * 0.04, f.faceW * 0.26);
      });
      withHeadSpace(ctx, f, f.rightEye, () => {
        emoji(ctx, "👀", 0, -f.faceH * 0.04, f.faceW * 0.26);
      });
      noseDot(ctx, f, "#166534", 0.03);
      if (f.jawOpen > 0.35) dogTongue(ctx, f);
      break;
    case "unicorn":
      withHeadSpace(ctx, f, f.headTop, () => {
        emoji(ctx, "🦄", 0, 0, f.faceW * 0.7);
      });
      orbit(ctx, f, "✨", 5 + Math.floor(f.jawOpen * 5), timeMs);
      if (f.jawOpen > 0.3) mouthBurst(ctx, f, "✨", timeMs);
      break;
    case "flower":
      flowerCrown(ctx, f);
      break;
    case "hearts":
      withHeadSpace(ctx, f, f.leftEye, () => {
        heart(ctx, 0, 0, f.faceW * 0.11, "#f43f5e");
      });
      withHeadSpace(ctx, f, f.rightEye, () => {
        heart(ctx, 0, 0, f.faceW * 0.11, "#f43f5e");
      });
      if (f.jawOpen > 0.25) mouthBurst(ctx, f, "💕", timeMs);
      break;
    case "stars":
      withHeadSpace(ctx, f, f.leftEye, () => {
        emoji(ctx, "⭐", 0, 0, f.faceW * 0.2);
      });
      withHeadSpace(ctx, f, f.rightEye, () => {
        emoji(ctx, "⭐", 0, 0, f.faceW * 0.2);
      });
      orbit(ctx, f, "✨", 5, timeMs);
      break;
    case "blush":
      softCheek(ctx, f, "#fb7185", 0.35 + f.smile * 0.25);
      break;
    case "freckles":
      freckleDots(ctx, f);
      break;
    case "glow":
      grade(ctx, width, height, "brightness(1.06) saturate(1.12)");
      orbit(ctx, f, "✨", 6 + Math.floor(f.jawOpen * 4), timeMs);
      break;
    case "shades":
      shades(ctx, f);
      break;
    case "bigeyes": {
      const scale = 0.26 + (1 - f.eyeBlink) * 0.08;
      withHeadSpace(ctx, f, f.leftEye, () => {
        emoji(ctx, "👁️", 0, 0, f.faceW * scale);
      });
      withHeadSpace(ctx, f, f.rightEye, () => {
        emoji(ctx, "👁️", 0, 0, f.faceW * scale);
      });
      break;
    }
    case "mustache":
      withHeadSpace(ctx, f, offsetAlong(f.nose, f.up, -f.faceH * 0.1), () => {
        ctx.fillStyle = "#292524";
        ctx.beginPath();
        ctx.ellipse(-f.faceW * 0.11, 0, f.faceW * 0.12, f.faceH * 0.04, -0.25, 0, Math.PI * 2);
        ctx.ellipse(f.faceW * 0.11, 0, f.faceW * 0.12, f.faceH * 0.04, 0.25, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    case "crown":
      drawnCrown(ctx, f);
      break;
    case "halo":
      halo(ctx, f);
      break;
    case "devil":
      animalEars(ctx, f, DEVIL, { pointed: true, length: 0.5, flare: 0.85, width: 0.16 });
      if (f.jawOpen > 0.35) mouthBurst(ctx, f, "🔥", timeMs);
      break;
    case "ghost":
      // Soft white rim only — no full-face fill
      softCheek(ctx, f, "#f8fafc", 0.2);
      withHeadSpace(ctx, f, f.leftEye, () => {
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.ellipse(0, 0, f.faceW * 0.065, f.faceH * 0.085, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      withHeadSpace(ctx, f, f.rightEye, () => {
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.ellipse(0, 0, f.faceW * 0.065, f.faceH * 0.085, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      if (f.jawOpen > 0.2) {
        withHeadSpace(ctx, f, midMouth(f), () => {
          ctx.fillStyle = "#0f172a";
          ctx.beginPath();
          ctx.ellipse(
            0,
            0,
            f.faceW * (0.05 + f.jawOpen * 0.08),
            f.faceH * (0.035 + f.jawOpen * 0.1),
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        });
      }
      break;
    case "sparkle":
      orbit(ctx, f, "💖", 8 + Math.floor(f.jawOpen * 5), timeMs);
      if (f.jawOpen > 0.25) mouthBurst(ctx, f, "✨", timeMs);
      break;
    case "rainbow":
      withHeadSpace(ctx, f, offsetAlong(f.headTop, f.up, f.faceH * 0.1), () => {
        emoji(ctx, "🌈", 0, 0, f.faceW * 0.8);
      });
      break;
    case "snow":
      grade(ctx, width, height, "saturate(0.8) brightness(1.05) hue-rotate(160deg)");
      orbit(ctx, f, "❄️", 8, timeMs);
      break;
    case "warm":
      grade(ctx, width, height, "sepia(0.3) saturate(1.2) brightness(1.04)");
      break;
    case "cool":
      grade(ctx, width, height, "saturate(0.85) hue-rotate(185deg) brightness(1.04)");
      break;
    default:
      break;
  }
}
