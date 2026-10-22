// Pure geometry: testable independently of a webcam and MediaPipe.
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function classifyHand(p, wasPinching = false) {
  const palm = Math.max(distance(p[0], p[9]), 0.025);
  const ratio = distance(p[4], p[8]) / palm;
  const pinch = ratio < (wasPinching ? 0.43 : 0.3); // hysteresis avoids grab/release flicker
  const extended = (tip, pip) =>
    distance(p[tip], p[0]) > distance(p[pip], p[0]) * 1.25;
  const victory =
    !pinch &&
    extended(8, 6) &&
    extended(12, 10) &&
    !extended(16, 14) &&
    !extended(20, 18);
  return {
    pinch,
    victory,
    point: { x: (p[4].x + p[8].x) / 2, y: (p[4].y + p[8].y) / 2 },
  };
}
export function mapPoint(p, vw, vh, W, H, mirror) {
  const scale = Math.max(W / vw, H / vh),
    x = (p.x * vw * scale - (vw * scale - W) / 2) / W;
  return {
    x: mirror ? 1 - x : x,
    y: (p.y * vh * scale - (vh * scale - H) / 2) / H,
  };
}
export function keepInFrame(l) {
  l.w = clamp(l.w, 0.12, 0.95);
  l.h = clamp(l.h, 0.12, 0.95);
  l.x = clamp(l.x, l.w / 2, 1 - l.w / 2);
  l.y = clamp(l.y, l.h / 2, 1 - l.h / 2);
  return l;
}
export function contains(l, p) {
  if (!l.visible) return false;
  const x = (p.x - l.x) / (l.w / 2),
    y = (p.y - l.y) / (l.h / 2);
  return l.shape === "ellipse"
    ? x * x + y * y <= 1
    : Math.abs(x) <= 1 && Math.abs(y) <= 1;
}
export function scaledLayer(start, ratio, center) {
  const s = clamp(
    ratio,
    Math.max(0.12 / start.w, 0.12 / start.h),
    Math.min(0.95 / start.w, 0.95 / start.h),
  );
  return keepInFrame({
    ...start,
    w: start.w * s,
    h: start.h * s,
    x: center.x,
    y: center.y,
  });
}
