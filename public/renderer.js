import { clamp } from "./gestures.js";
export const EFFECTS = [
  { id: "thermal", name: "热感映射", en: "THERMAL", desc: "蓝橙伪彩色" },
  { id: "glitch", name: "故障扫描", en: "GLITCH", desc: "动态错位扫描线" },
  { id: "rgb", name: "色差重影", en: "RGB SPLIT", desc: "红青通道偏移" },
  { id: "negative", name: "反相负片", en: "INVERT", desc: "色彩反相" },
  { id: "wave", name: "液态波纹", en: "LIQUID", desc: "流动折射" },
  { id: "mono", name: "黑白颗粒", en: "MONO", desc: "复古胶片质感" },
];
function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
export class Renderer {
  constructor(output, guides) {
    this.output = output;
    this.ctx = output.getContext("2d", { alpha: false });
    this.guides = guides;
    this.g = guides.getContext("2d");
    this.base = canvas(1280, 720);
    this.b = this.base.getContext("2d", { alpha: false });
    this.small = canvas(480, 270);
    this.s = this.small.getContext("2d", { willReadFrequently: true });
    this.cache = new Map();
    this.lastFX = -Infinity;
  }
  demo(t) {
    const c = this.b,
      W = 1280,
      H = 720;
    c.fillStyle = "#1b2b27";
    c.fillRect(0, 0, W, H);
    const bg = c.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#435c46");
    bg.addColorStop(0.5, "#172c2c");
    bg.addColorStop(1, "#324235");
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    c.save();
    c.translate(675, 340);
    c.rotate(-0.3 + Math.sin(t * 0.0002) * 0.06);
    for (let i = 18; i >= 0; i--) {
      c.beginPath();
      c.ellipse(
        Math.sin(t * 0.0002 + i * 0.13) * 30,
        0,
        70 + i * 18,
        85 + i * 10,
        0,
        0,
        Math.PI * 2,
      );
      c.strokeStyle = `hsla(${76 + i * 2},${25 + i}%,${55 + i * 0.8}%,${0.1 + i * 0.022})`;
      c.lineWidth = 6 + i * 0.5;
      c.stroke();
    }
    c.restore();
    const glow = c.createRadialGradient(270, 220, 10, 270, 220, 420);
    glow.addColorStop(0, "#c2d49e30");
    glow.addColorStop(1, "#c2d49e00");
    c.fillStyle = glow;
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#dee9d9";
    c.font = "500 18px monospace";
    c.fillText("REFRACT / LIVE EXPERIMENT", 60, 530);
    c.font = "600 66px sans-serif";
    c.fillText("Shape the unseen.", 56, 608);
    c.font = "16px sans-serif";
    c.fillStyle = "#a9bba1";
    c.fillText("拖动窗口，发现影像的另一面。", 61, 646);
  }
  source(video, mirror, t) {
    const W = 1280,
      H = 720;
    if (!video || video.readyState < 2) {
      this.demo(t);
      return;
    }
    const c = this.b,
      s = Math.max(W / video.videoWidth, H / video.videoHeight),
      w = video.videoWidth * s,
      h = video.videoHeight * s;
    c.save();
    if (mirror) {
      c.translate(W, 0);
      c.scale(-1, 1);
    }
    c.drawImage(video, (W - w) / 2, (H - h) / 2, w, h);
    c.restore();
  }
  process(l, source, t) {
    const w = 480,
      h = 270;
    let cache = this.cache.get(l.id);
    if (!cache) {
      const c = canvas(w, h);
      cache = {
        canvas: c,
        ctx: c.getContext("2d"),
        image: new ImageData(w, h),
      };
      this.cache.set(l.id, cache);
    }
    const out = cache.image.data,
      src = source.data,
      a = l.strength;
    const stops = [
      [14, 20, 75],
      [31, 80, 168],
      [32, 181, 187],
      [239, 218, 69],
      [255, 133, 53],
      [228, 54, 66],
    ];
    for (let y = 0; y < h; y++) {
      const wave = Math.round(Math.sin(y * 0.065 + t * 0.002) * 18 * a);
      const glitch =
        Math.floor(y / 14) % 4 === Math.floor(t / 140) % 4
          ? Math.round(Math.sin(y + t * 0.01) * 28 * a)
          : 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let r = src[i],
          g = src[i + 1],
          b = src[i + 2];
        if (l.effect === "thermal") {
          const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255,
            idx = clamp(lum * 5, 0, 4.999),
            n = Math.floor(idx),
            v = idx - n;
          r = stops[n][0] + (stops[n + 1][0] - stops[n][0]) * v;
          g = stops[n][1] + (stops[n + 1][1] - stops[n][1]) * v;
          b = stops[n][2] + (stops[n + 1][2] - stops[n][2]) * v;
        } else if (l.effect === "negative") {
          r = 255 - r;
          g = 255 - g;
          b = 255 - b;
        } else if (l.effect === "mono") {
          const noise =
            ((Math.sin(x * 12.98 + y * 78.23 + Math.floor(t / 90)) *
              43758.5453) %
              1) *
            22;
          const lum = r * 0.299 + g * 0.587 + b * 0.114;
          r = g = b = clamp((lum - 128) * 1.25 + 128 + noise, 0, 255);
        } else if (l.effect === "wave") {
          const j = (y * w + clamp(x + wave, 0, w - 1)) * 4;
          r = src[j];
          g = src[j + 1];
          b = src[j + 2];
        } else if (l.effect === "rgb" || l.effect === "glitch") {
          const shift = Math.round(3 + a * 14),
            j1 = (y * w + clamp(x + shift + glitch, 0, w - 1)) * 4,
            j2 = (y * w + clamp(x - shift + glitch, 0, w - 1)) * 4;
          r = src[j1];
          g = src[j2 + 1];
          b = src[j2 + 2];
          if (l.effect === "glitch" && y % 4 < 2) {
            r *= 0.65;
            g *= 0.72;
            b *= 0.65;
          }
        }
        out[i] = src[i] + (r - src[i]) * a;
        out[i + 1] = src[i + 1] + (g - src[i + 1]) * a;
        out[i + 2] = src[i + 2] + (b - src[i + 2]) * a;
        out[i + 3] = 255;
      }
    }
    cache.ctx.putImageData(cache.image, 0, 0);
    return cache.canvas;
  }
  path(c, l) {
    const x = (l.x - l.w / 2) * 1280,
      y = (l.y - l.h / 2) * 720,
      w = l.w * 1280,
      h = l.h * 720;
    c.beginPath();
    if (l.shape === "ellipse")
      c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (l.shape === "round")
      c.roundRect(x, y, w, h, Math.min(w, h) * 0.12);
    else c.rect(x, y, w, h);
  }
  render({ video, mirror, layers, selected, showGuides, hands }, t) {
    this.source(video, mirror, t);
    const c = this.ctx;
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.drawImage(this.base, 0, 0);
    const refresh = t - this.lastFX > 40;
    if (refresh) {
      this.s.drawImage(this.base, 0, 0, 480, 270);
      this.pixels = this.s.getImageData(0, 0, 480, 270);
      this.lastFX = t;
    }
    for (const l of layers) {
      if (!l.visible) continue;
      const fx =
        refresh || !this.cache.has(l.id)
          ? this.process(l, this.pixels, t)
          : this.cache.get(l.id).canvas;
      c.save();
      this.path(c, l);
      c.clip();
      c.globalAlpha = l.opacity;
      c.globalCompositeOperation = l.blend;
      c.drawImage(fx, 0, 0, 1280, 720);
      c.restore();
    }
    for (const id of this.cache.keys())
      if (!layers.some((l) => l.id === id)) this.cache.delete(id);
    this.g.clearRect(0, 0, 1280, 720);
    if (showGuides) this.drawGuides(layers, selected, hands);
  }
  drawGuides(layers, selected, hands) {
    const c = this.g;
    for (const l of layers) {
      if (!l.visible) continue;
      const active = l.id === selected;
      this.path(c, l);
      c.strokeStyle = active ? "#e4ffac" : "#ffffff45";
      c.lineWidth = active ? 2 : 1;
      c.stroke();
      if (active) {
        const x = (l.x - l.w / 2) * 1280,
          y = (l.y - l.h / 2) * 720;
        c.fillStyle = "#d3f78b";
        c.fillRect(x, y - 24, 132, 23);
        c.font = "12px sans-serif";
        c.fillStyle = "#1d2b12";
        c.fillText(
          EFFECTS.find((e) => e.id === l.effect).name + " / 选中",
          x + 8,
          y - 8,
        );
        c.fillStyle = "#e4ffac";
        c.fillRect(x + l.w * 1280 - 6, y + l.h * 720 - 6, 12, 12);
        c.beginPath();
        c.moveTo(l.x * 1280 - 8, l.y * 720);
        c.lineTo(l.x * 1280 + 8, l.y * 720);
        c.moveTo(l.x * 1280, l.y * 720 - 8);
        c.lineTo(l.x * 1280, l.y * 720 + 8);
        c.stroke();
      }
    }
    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [0, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [5, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      [9, 13],
      [13, 14],
      [14, 15],
      [15, 16],
      [13, 17],
      [0, 17],
      [17, 18],
      [18, 19],
      [19, 20],
    ];
    for (const h of hands) {
      c.strokeStyle = h.pinch ? "#d3f78b" : "#fff9";
      c.lineWidth = 2;
      for (const [a, b] of edges) {
        c.beginPath();
        c.moveTo(h.points[a].x * 1280, h.points[a].y * 720);
        c.lineTo(h.points[b].x * 1280, h.points[b].y * 720);
        c.stroke();
      }
      for (const p of h.points) {
        c.beginPath();
        c.arc(p.x * 1280, p.y * 720, 3, 0, Math.PI * 2);
        c.fillStyle = "#dcffac";
        c.fill();
      }
      c.beginPath();
      c.arc(
        h.point.x * 1280,
        h.point.y * 720,
        h.pinch ? 12 : 7,
        0,
        Math.PI * 2,
      );
      c.stroke();
    }
  }
}
