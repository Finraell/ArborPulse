import { median, summarize } from "./signal";
import type { Analysis, Box, MotionSample } from "./types";

type GrayFrame = { data: Uint8Array; width: number; height: number };
type Point = { x: number; y: number; ox: number; oy: number };
export type ScanResult = { analysis: Analysis; frames: string[] };
const PATCH = 3, SEARCH = 6;

function gray(image: ImageData): GrayFrame {
  const data = new Uint8Array(image.width * image.height);
  for (let i = 0; i < data.length; i++) data[i] = Math.round(image.data[i * 4] * .299 + image.data[i * 4 + 1] * .587 + image.data[i * 4 + 2] * .114);
  return { data, width: image.width, height: image.height };
}
function features(frame: GrayFrame, box: Box, max: number): Point[] {
  const { data, width: w, height: h } = frame;
  const candidates: { x: number; y: number; score: number }[] = [];
  const border = PATCH + SEARCH + 2;
  for (let y = Math.max(border, Math.round(box.y * h)); y < Math.min(h - border, (box.y + box.height) * h); y += 4) {
    for (let x = Math.max(border, Math.round(box.x * w)); x < Math.min(w - border, (box.x + box.width) * w); x += 4) {
      let xx = 0, yy = 0, xy = 0;
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
        const at = (y + j) * w + x + i;
        const dx = data[at + 1] - data[at - 1], dy = data[at + w] - data[at - w];
        xx += dx * dx; yy += dy * dy; xy += dx * dy;
      }
      const score = (xx + yy - Math.sqrt((xx - yy) ** 2 + 4 * xy * xy)) / 2;
      if (score > 400) candidates.push({ x, y, score });
    }
  }
  const points: Point[] = [];
  for (const p of candidates.sort((a, b) => b.score - a.score)) {
    if (points.every(q => Math.hypot(q.x - p.x, q.y - p.y) > 12)) points.push({ x: p.x, y: p.y, ox: p.x, oy: p.y });
    if (points.length >= max) break;
  }
  return points;
}

function match(previous: GrayFrame, next: GrayFrame, x: number, y: number) {
  const w = previous.width, h = previous.height, ix = Math.round(x), iy = Math.round(y);
  if (ix < PATCH || iy < PATCH || ix >= w - PATCH || iy >= h - PATCH) return null;
  const patch: number[] = [];
  for (let j = -PATCH; j <= PATCH; j++) for (let i = -PATCH; i <= PATCH; i++) patch.push(previous.data[(iy + j) * w + ix + i]);
  const avg = patch.reduce((a, b) => a + b, 0) / patch.length;
  const centered = patch.map(v => v - avg), energy = centered.reduce((a, b) => a + b * b, 0);
  if (energy < 250) return null;
  let best = -1, bestX = ix, bestY = iy;
  for (let dy = -SEARCH; dy <= SEARCH; dy++) for (let dx = -SEARCH; dx <= SEARCH; dx++) {
    const nx = ix + dx, ny = iy + dy;
    if (nx < PATCH || ny < PATCH || nx >= w - PATCH || ny >= h - PATCH) continue;
    let sum = 0, squares = 0, dot = 0, k = 0;
    for (let j = -PATCH; j <= PATCH; j++) for (let i = -PATCH; i <= PATCH; i++) {
      const value = next.data[(ny + j) * w + nx + i];
      sum += value; squares += value * value; dot += value * centered[k++];
    }
    const denominator = Math.sqrt(energy * Math.max(0, squares - sum * sum / patch.length));
    const score = denominator > 0 ? dot / denominator : -1;
    if (score > best) { best = score; bestX = nx; bestY = ny; }
  }
  return best >= .8 ? { x: bestX, y: bestY, score: best } : null;
}

function track(previous: GrayFrame, next: GrayFrame, points: Point[]): Point[] {
  const tracked: Point[] = [];
  for (const p of points) {
    const forward = match(previous, next, p.x, p.y);
    if (!forward) continue;
    const back = match(next, previous, forward.x, forward.y);
    if (!back || Math.hypot(back.x - p.x, back.y - p.y) > 1.5) continue;
    tracked.push({ ...p, x: forward.x, y: forward.y });
  }
  return tracked;
}

export function boxesOverlap(a: Box, b: Box) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function eventOnce(video: HTMLVideoElement, event: string, signal: AbortSignal, action?: () => void) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); video.removeEventListener(event, done); video.removeEventListener("error", error); signal.removeEventListener("abort", abort); };
    const done = () => { cleanup(); resolve(); };
    const error = () => { cleanup(); reject(new Error("This video cannot be decoded. Try an H.264 MP4 or a WebM recording.")); };
    const abort = () => { cleanup(); reject(new DOMException("Scan cancelled", "AbortError")); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("Video decoding timed out. Try a shorter MP4 recording.")); }, 15000);
    video.addEventListener(event, done, { once: true }); video.addEventListener("error", error, { once: true }); signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort(); else action?.();
  });
}

/** Samples the clip locally. No video or image leaves the browser in this function. */
export async function scanVideo(source: string, treeBox: Box, referenceBox: Box, signal: AbortSignal, onProgress: (p: number) => void): Promise<ScanResult> {
  if (boxesOverlap(treeBox, referenceBox)) throw new Error("Tree and reference regions overlap. Select a separate stationary background.");
  const video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.preload = "auto";
  try {
    await eventOnce(video, "loadeddata", signal, () => { video.src = source; video.load(); });
    if (!Number.isFinite(video.duration) || video.duration < 6) throw new Error("Use a video at least 6 seconds long; 20–30 seconds is recommended.");
    const width = Math.min(512, video.videoWidth), height = Math.round(video.videoHeight * width / video.videoWidth);
    if (width < 160 || height < 120) throw new Error("The video is too small to track. Use at least 320 × 240 pixels.");
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    const fps = 12, duration = Math.min(video.duration - 1 / fps, 30), count = Math.floor(duration * fps) + 1;
    const samples: MotionSample[] = [], frames: string[] = [];
    let previous: GrayFrame | null = null, tree: Point[] = [], background: Point[] = [], nTree = 0, nBackground = 0;
    let lastTreeX = 0, lastTreeY = 0, lastCameraX = 0, lastCameraY = 0;
    for (let index = 0; index < count; index++) {
      if (signal.aborted) throw new DOMException("Scan cancelled", "AbortError");
      const t = index / fps;
      if (Math.abs(video.currentTime - t) > .001) await eventOnce(video, "seeked", signal, () => { video.currentTime = t; });
      ctx.drawImage(video, 0, 0, width, height);
      if ([0, Math.floor(count / 2), count - 1].includes(index)) frames.push(canvas.toDataURL("image/jpeg", .65));
      const current = gray(ctx.getImageData(0, 0, width, height));
      if (!previous) {
        tree = features(current, treeBox, 18); background = features(current, referenceBox, 12);
        nTree = tree.length; nBackground = background.length;
        if (nTree < 4 || nBackground < 4) throw new Error("Not enough trackable texture. Select a branch junction and a textured stationary wall, post, or ground patch.");
      } else {
        tree = track(previous, current, tree); background = track(previous, current, background);
      }
      const quality = Math.min(tree.length / nTree, background.length / nBackground);
      if (tree.length >= 3) { lastTreeX = median(tree.map(p => p.x - p.ox)); lastTreeY = median(tree.map(p => p.y - p.oy)); }
      if (background.length >= 3) { lastCameraX = median(background.map(p => p.x - p.ox)); lastCameraY = median(background.map(p => p.y - p.oy)); }
      samples.push({ t, treeX: lastTreeX, treeY: lastTreeY, cameraX: lastCameraX, cameraY: lastCameraY, x: lastTreeX - lastCameraX, y: lastTreeY - lastCameraY, quality: tree.length >= 3 && background.length >= 3 ? quality : 0 });
      previous = current; onProgress((index + 1) / count);
      if (index % 4 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    const warnings = video.duration > 30 ? ["Only the first 30 seconds were sampled."] : [];
    const analysis = summarize(samples, width, height, treeBox, referenceBox, warnings);
    return { analysis, frames };
  } finally { video.removeAttribute("src"); video.load(); }
}
