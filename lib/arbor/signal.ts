import type { Analysis, Box, MotionSample, SpectrumBin } from "./types";

export function mean(values: number[]) { return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length); }
export function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : 0;
}
export function detrend(values: number[]) {
  const n = values.length, center = (n - 1) / 2, avg = mean(values);
  let numerator = 0, denominator = 0;
  values.forEach((v, i) => { numerator += (i - center) * (v - avg); denominator += (i - center) ** 2; });
  const slope = denominator ? numerator / denominator : 0;
  return values.map((v, i) => v - avg - slope * (i - center));
}
export function spectrum(values: number[], sampleRate: number): SpectrumBin[] {
  const n = values.length;
  if (n < 12 || sampleRate <= 0) return [];
  const centered = detrend(values).map((v, i) => v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))));
  const bins: SpectrumBin[] = [];
  for (let k = 1; k <= Math.min(Math.floor(n / 2), Math.ceil(n * 3 / sampleRate)); k++) {
    let re = 0, im = 0;
    centered.forEach((v, i) => { const angle = 2 * Math.PI * k * i / n; re += v * Math.cos(angle); im -= v * Math.sin(angle); });
    bins.push({ hz: k * sampleRate / n, power: (re * re + im * im) / (n * n) });
  }
  return bins;
}
export function summarize(samples: MotionSample[], width: number, height: number, treeBox: Box, referenceBox: Box, extraWarnings: string[] = []): Analysis {
  const duration = samples.length > 1 ? samples[samples.length - 1].t - samples[0].t : 0;
  const sampleRate = duration > 0 ? (samples.length - 1) / duration : 0;
  const x = detrend(samples.map(s => s.x)), y = detrend(samples.map(s => s.y));
  const axis = mean(x.map(v => v * v)) >= mean(y.map(v => v * v)) ? x : y;
  const bins = spectrum(axis, sampleRate), candidates = bins.filter(b => b.hz >= 0.1 && b.hz <= 2);
  const peak = candidates.reduce<SpectrumBin | null>((a, b) => !a || b.power > a.power ? b : a, null);
  const sum = bins.reduce((a, b) => a + b.power, 0);
  const concentration = peak && sum > 0 ? bins.filter(b => Math.abs(b.hz - peak.hz) < sampleRate / Math.max(1, samples.length) * 1.1).reduce((a, b) => a + b.power, 0) / sum : 0;
  const coverage = mean(samples.map(s => s.quality));
  const rms = Math.sqrt(mean(axis.map(v => v * v)));
  const camera = detrend(samples.map(s => s.cameraX));
  const cameraY = detrend(samples.map(s => s.cameraY));
  const cameraRms = Math.sqrt(mean(camera.map((v, i) => v * v + cameraY[i] * cameraY[i])));
  const amplitude = axis.length ? Math.max(...axis) - Math.min(...axis) : 0;
  const warnings = [...extraWarnings];
  if (duration < 10) warnings.push("Short capture: use at least 20–30 seconds for better frequency resolution.");
  if (coverage < 0.65) warnings.push("Insufficient stable tracks. Recapture with a clear crown and a textured stationary reference.");
  if (rms < 0.35) warnings.push("Motion is near the pixel noise floor. A reliable oscillation frequency cannot be reported.");
  if (cameraRms > 5) warnings.push("Substantial camera motion. Translation correction does not remove rotation or parallax.");
  if (concentration < 0.3) warnings.push("No concentrated oscillation peak; wind response may be irregular.");
  const usable = duration >= 6 && coverage >= 0.65 && cameraRms <= 5;
  const frequency = usable && rms >= 0.35 && concentration >= 0.3 && peak && peak.hz * duration >= 3 ? peak.hz : null;
  if (peak && rms >= 0.35 && peak.hz * duration < 3) warnings.push("Fewer than three cycles observed. Record longer before interpreting frequency.");
  return { schemaVersion: "1.0", engine: "PhysicsLens / sparse patch tracking v1", duration, sampleRate, width, height, samples, spectrum: bins, frequency, spectralConcentration: concentration, amplitude, rms, cameraRms, coverage, usable, warnings: [...new Set(warnings)], treeBox, referenceBox };
}
