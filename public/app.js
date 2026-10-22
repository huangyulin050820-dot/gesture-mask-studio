import { Renderer, EFFECTS } from "./renderer.js";
import {
  clamp,
  distance,
  classifyHand,
  mapPoint,
  keepInFrame,
  contains,
  scaledLayer,
} from "./gestures.js";
// 启动守卫依赖此标记：index.html 中的内联脚本用它判断页面脚本是否真正开始运行。
window.__REFRACT_STARTED__ = true;
const $ = (id) => document.getElementById(id);
const output = $("output"),
  video = $("camera"),
  renderer = new Renderer(output, $("guides"));
const state = {
  layers: [],
  selected: null,
  mirror: true,
  guides: true,
  stream: null,
  hands: [],
  tracking: false,
  model: null,
  loading: null,
  grab: null,
  recorder: null,
  recording: false,
  items: [],
  cameraBusy: false,
  facing: "user",
};
let uid = 0,
  toastTimer,
  lastDetection = 0,
  lastVideoTime = -1,
  lastFrame = 0,
  fpsCount = 0,
  fpsSince = 0,
  vSince = 0,
  vLatched = false,
  pinchHistory = {},
  lastHandSeen = 0,
  recStart = 0;
const selected = () => state.layers.find((l) => l.id === state.selected);
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 4200);
}
function syncInspector() {
  const l = selected();
  $("inspector")
    .querySelectorAll("input,select,button")
    .forEach((e) => (e.disabled = !l));
  $("selectedLabel").textContent = l
    ? EFFECTS.find((e) => e.id === l.effect).en
    : "未选择";
  if (!l) return;
  $("opacity").value = Math.round(l.opacity * 100);
  $("opacityValue").value = Math.round(l.opacity * 100) + "%";
  $("strength").value = Math.round(l.strength * 100);
  $("strengthValue").value = Math.round(l.strength * 100) + "%";
  $("shape").value = l.shape;
  $("blend").value = l.blend;
}
function renderLayers() {
  $("layerCount").textContent =
    String(state.layers.length).padStart(2, "0") + " / 06";
  $("layerList").replaceChildren();
  if (!state.layers.length) {
    $("layerList").innerHTML =
      '<div class="empty-layers">点击上方特效，添加第一层蒙版。</div>';
  }
  for (const l of [...state.layers].reverse()) {
    const e = EFFECTS.find((e) => e.id === l.effect),
      row = document.createElement("div");
    row.className =
      "layer-row" +
      (l.id === state.selected ? " selected" : "") +
      (!l.visible ? " hidden-layer" : "");
    row.innerHTML = `<button class="layer-select" aria-pressed="${l.id === state.selected}"><span class="thumb ${e.id}"></span><span><b>${e.name}</b><small>${Math.round(l.opacity * 100)}% · ${l.visible ? "可见" : "隐藏"}</small></span></button><div class="layer-tools"><button data-action="visible" title="${l.visible ? "隐藏" : "显示"}图层">${l.visible ? "◉" : "○"}</button><button data-action="up" title="上移一层">↑</button><button data-action="down" title="下移一层">↓</button><button data-action="delete" title="删除图层">×</button></div>`;
    row.querySelector(".layer-select").onclick = () => {
      state.selected = l.id;
      state.grab = null;
      renderLayers();
    };
    row.querySelector("[data-action=up]").disabled =
      state.layers.indexOf(l) === state.layers.length - 1;
    row.querySelector("[data-action=down]").disabled =
      state.layers.indexOf(l) === 0;
    row.querySelectorAll("[data-action]").forEach(
      (btn) =>
        (btn.onclick = () => {
          const i = state.layers.indexOf(l);
          switch (btn.dataset.action) {
            case "visible":
              l.visible = !l.visible;
              break;
            case "up":
              if (i < state.layers.length - 1)
                [state.layers[i], state.layers[i + 1]] = [
                  state.layers[i + 1],
                  state.layers[i],
                ];
              break;
            case "down":
              if (i > 0)
                [state.layers[i], state.layers[i - 1]] = [
                  state.layers[i - 1],
                  state.layers[i],
                ];
              break;
            case "delete":
              state.layers.splice(i, 1);
              if (state.selected === l.id)
                state.selected = state.layers.at(-1)?.id ?? null;
              break;
          }
          state.grab = null;
          renderLayers();
        }),
    );
    $("layerList").append(row);
  }
  syncInspector();
}
function addLayer(effect, quiet = false) {
  if (state.layers.length >= 6) {
    toast("最多叠加 6 层，请先删除一层。");
    return;
  }
  const i = state.layers.length,
    l = {
      id: ++uid,
      effect,
      x: 0.48 + (i % 3) * 0.035,
      y: 0.47 + (i % 2) * 0.035,
      w: i === 0 ? 0.54 : 0.36,
      h: i === 0 ? 0.54 : 0.65,
      opacity: 0.6,
      strength: 0.75,
      shape: "rect",
      blend: "source-over",
      visible: true,
    };
  state.layers.push(l);
  state.selected = l.id;
  renderLayers();
  if (!quiet)
    toast(
      "已添加" +
        EFFECTS.find((e) => e.id === effect).name +
        "，捏合或拖动来调整",
    );
}
for (const e of EFFECTS) {
  const b = document.createElement("button");
  b.className = "effect-card";
  b.title = "添加" + e.name + "：" + e.desc;
  b.innerHTML = `<span class="swatch ${e.id}"></span><b>${e.name}</b><small>${e.en}</small>`;
  b.onclick = () => addLayer(e.id);
  $("effectGrid").append(b);
}
addLayer("thermal", true);
addLayer("rgb", true);
// Initial composition is deliberately offset so transparency is visible immediately.
state.layers[0].x = 0.48;
state.layers[0].y = 0.44;
state.layers[1].x = 0.65;
state.layers[1].y = 0.5;
state.layers[1].w = 0.27;
state.layers[1].h = 0.57;
$("clearBtn").onclick = () => {
  state.layers = [];
  state.selected = null;
  state.grab = null;
  renderLayers();
};
for (const id of ["opacity", "strength"]) {
  $(id).oninput = () => {
    const l = selected();
    if (!l) return;
    l[id] = Number($(id).value) / 100;
    $(id + "Value").value = $(id).value + "%";
  };
  $(id).onchange = renderLayers;
}
for (const id of ["shape", "blend"])
  $(id).onchange = () => {
    if (selected()) selected()[id] = $(id).value;
  };
function resizeSelected(s) {
  const l = selected();
  if (l) Object.assign(l, scaledLayer(l, s, { x: l.x, y: l.y }));
}
$("smallerBtn").onclick = () => resizeSelected(0.9);
$("largerBtn").onclick = () => resizeSelected(1.1);
$("centerBtn").onclick = () => {
  if (selected()) {
    selected().x = 0.5;
    selected().y = 0.5;
  }
};
$("mirrorBtn").onclick = () => {
  state.mirror = !state.mirror;
  state.grab = null;
  state.hands = [];
  $("mirrorBtn").setAttribute("aria-pressed", state.mirror);
};
$("guideBtn").onclick = () => {
  state.guides = !state.guides;
  $("guideBtn").setAttribute("aria-pressed", state.guides);
};
$("fullscreenBtn").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($("stage").requestFullscreen) await $("stage").requestFullscreen();
    else toast("当前浏览器不支持元素全屏，请横屏查看。");
  } catch {
    toast("此浏览器暂时无法进入全屏。");
  }
};
for (const id of ["helpBtn"]) $(id).onclick = () => $("help").showModal();
for (const id of ["closeHelp", "understood"])
  $(id).onclick = () => $("help").close();
$("help").onclick = (e) => {
  if (e.target === $("help")) {
    const r = $("help").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      $("help").close();
  }
};
// Pointer coordinates include fullscreen letterboxing.
function pointer(e) {
  const r = output.getBoundingClientRect(),
    scale = Math.min(r.width / 1280, r.height / 720),
    w = 1280 * scale,
    h = 720 * scale;
  return {
    x: (e.clientX - r.left - (r.width - w) / 2) / w,
    y: (e.clientY - r.top - (r.height - h) / 2) / h,
  };
}
let drag = null;
output.addEventListener("pointerdown", (e) => {
  const p = pointer(e);
  let l = selected();
  const nearCorner =
    l &&
    l.visible &&
    distance(
      { x: (l.x + l.w / 2) * 1280, y: (l.y + l.h / 2) * 720 },
      { x: p.x * 1280, y: p.y * 720 },
    ) < 32;
  if (!nearCorner) l = [...state.layers].reverse().find((l) => contains(l, p));
  if (!l) return;
  state.selected = l.id;
  state.grab = null;
  drag = {
    pointer: e.pointerId,
    id: l.id,
    p,
    start: { ...l },
    resize: nearCorner,
  };
  output.setPointerCapture(e.pointerId);
  renderLayers();
});
output.addEventListener("pointermove", (e) => {
  if (!drag || drag.pointer !== e.pointerId) return;
  const p = pointer(e),
    l = selected();
  if (!l || l.id !== drag.id) return;
  const dx = p.x - drag.p.x,
    dy = p.y - drag.p.y;
  if (drag.resize) {
    const left = drag.start.x - drag.start.w / 2,
      top = drag.start.y - drag.start.h / 2;
    l.w = clamp(drag.start.w + dx, 0.12, Math.min(0.95, 1 - left));
    l.h = clamp(drag.start.h + dy, 0.12, Math.min(0.95, 1 - top));
    l.x = left + l.w / 2;
    l.y = top + l.h / 2;
  } else {
    l.x = drag.start.x + dx;
    l.y = drag.start.y + dy;
  }
  keepInFrame(l);
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  output.addEventListener(event, () => {
    drag = null;
  });
output.addEventListener(
  "wheel",
  (e) => {
    if (!selected()) return;
    e.preventDefault();
    resizeSelected(e.deltaY > 0 ? 0.94 : 1.06);
  },
  { passive: false },
);
async function loadModel() {
  if (state.model) return state.model;
  if (state.loading) return state.loading;
  state.loading = (async () => {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") || probe.getContext("webgl");
    if (!gl) throw new Error("WEBGL_UNAVAILABLE");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    const { HandLandmarker, FilesetResolver } = await import(
      "./vendor/vision_bundle.mjs"
    );
    const files = await FilesetResolver.forVisionTasks(
      new URL("./vendor/wasm", import.meta.url).href,
    );
    const opts = {
      baseOptions: {
        modelAssetPath: new URL(
          "./vendor/hand_landmarker.task",
          import.meta.url,
        ).href,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    };
    try {
      state.model = await HandLandmarker.createFromOptions(files, opts);
    } catch {
      opts.baseOptions.delegate = "CPU";
      state.model = await HandLandmarker.createFromOptions(files, opts);
    }
    return state.model;
  })();
  try {
    return await state.loading;
  } finally {
    state.loading = null;
  }
}
function updateTracking() {
  const active = state.tracking && !!state.model && !!state.stream;
  $("trackingBtn").textContent = state.loading
    ? "识别模型加载中…"
    : active
      ? "手势识别：已开启"
      : "手势识别：未开启";
  $("trackingBtn").setAttribute("aria-pressed", active);
}
async function enableTracking() {
  state.tracking = true;
  const promise = loadModel();
  updateTracking();
  try {
    await promise;
    if (state.stream && state.tracking)
      toast("手势已就绪：拇指与食指捏合，试着移动蒙版。");
  } catch (e) {
    state.tracking = false;
    console.error("Model init:", e);
    const httpLike =
      location.protocol === "http:" || location.protocol === "https:";
    toast(
      e.message === "WEBGL_UNAVAILABLE"
        ? "手势识别需要 WebGL，请启用浏览器图形加速后重启。鼠标操作仍可使用。"
        : !httpLike
          ? "手势模型无法在 file:// 方式下加载：请改用 Live Server 或 npm run dev 以 http://localhost 打开本页。"
          : "手势初始化失败，请检查浏览器图形加速及 vendor 文件完整性。鼠标操作仍可使用。",
    );
  }
  updateTracking();
}
$("trackingBtn").onclick = () => {
  if (!state.stream) {
    toast("请先开启摄像头。");
    return;
  }
  if (state.tracking) {
    state.tracking = false;
    state.hands = [];
    state.grab = null;
    updateTracking();
  } else enableTracking();
};
function resetHands() {
  state.hands = [];
  state.grab = null;
  pinchHistory = {};
  vSince = 0;
  vLatched = false;
  lastVideoTime = -1;
}
function releaseCamera() {
  if (state.recording) stopRecording();
  state.stream?.getTracks().forEach((t) => t.stop());
  state.stream = null;
  video.srcObject = null;
  resetHands();
  $("cameraBtn").textContent = "◉ 开启摄像头";
  $("sourceStatus").textContent = "演示画布";
  $("liveDot").classList.remove("live");
  $("modeTag").textContent = "DEMO / 可直接拖动蒙版体验";
  $("switchBtn").disabled = true;
  updateTracking();
}
async function startCamera() {
  if (state.cameraBusy) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    toast("请通过 localhost 或 HTTPS 打开网页，然后使用摄像头。");
    return;
  }
  state.cameraBusy = true;
  $("cameraBtn").disabled = true;
  $("cameraBtn").textContent = "连接中…";
  $("switchBtn").disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: { ideal: state.facing },
      },
      audio: false,
    });
    state.stream = stream;
    video.srcObject = stream;
    await video.play();
    stream.getVideoTracks()[0].addEventListener("ended", () => {
      if (state.stream === stream) {
        releaseCamera();
        toast("摄像头已断开，请重新开启。");
      }
    });
    $("cameraBtn").textContent = "◉ 关闭摄像头";
    $("sourceStatus").textContent = "实时画面";
    $("liveDot").classList.add("live");
    $("modeTag").textContent = "LIVE / 本机实时合成";
    $("switchBtn").disabled = false;
    enableTracking();
  } catch (e) {
    releaseCamera();
    const messages = {
      NotAllowedError: "未获得摄像头权限，请在浏览器地址栏允许摄像头访问。",
      NotFoundError: "没有找到摄像头，请连接摄像头后重试。",
      NotReadableError: "摄像头被其他程序占用，请关闭占用程序后重试。",
      OverconstrainedError: "摄像头不支持当前设置，请切换设备。",
    };
    toast(messages[e.name] || "摄像头启动失败，请检查设备和浏览器权限。");
  } finally {
    state.cameraBusy = false;
    $("cameraBtn").disabled = false;
  }
}
$("cameraBtn").onclick = () => (state.stream ? releaseCamera() : startCamera());
$("switchBtn").onclick = async () => {
  if (state.recording) {
    toast("请先停止录制，再切换摄像头。");
    return;
  }
  state.facing = state.facing === "user" ? "environment" : "user";
  releaseCamera();
  await startCamera();
};
function useHands(result, t) {
  const previous = state.hands;
  state.hands = result.landmarks.map((p, i) => {
    const key = result.handedness[i]?.[0]?.categoryName || String(i),
      h = classifyHand(p, pinchHistory[key]);
    pinchHistory[key] = h.pinch;
    let point = mapPoint(
      h.point,
      video.videoWidth,
      video.videoHeight,
      1280,
      720,
      state.mirror,
    );
    const prev = previous.find((h) => h.key === key);
    if (prev)
      point = {
        x: prev.point.x * 0.4 + point.x * 0.6,
        y: prev.point.y * 0.4 + point.y * 0.6,
      };
    return {
      ...h,
      key,
      point,
      points: p.map((p) =>
        mapPoint(
          p,
          video.videoWidth,
          video.videoHeight,
          1280,
          720,
          state.mirror,
        ),
      ),
    };
  });
  const hands = state.hands;
  if (hands.length) lastHandSeen = t;
  else {
    if (t - lastHandSeen > 180) {
      state.grab = null;
      pinchHistory = {};
    }
    $("gestureStatus").textContent = "将双手放入画面 · 拇指与食指捏合";
    vSince = 0;
    vLatched = false;
    return;
  }
  if (drag) return;
  const pinches = hands.filter((h) => h.pinch),
    l = selected();
  if (pinches.length === 2 && l && l.visible) {
    const [a, b] = pinches,
      center = {
        x: (a.point.x + b.point.x) / 2,
        y: (a.point.y + b.point.y) / 2,
      },
      dist = distance(a.point, b.point);
    if (state.grab?.type !== "two" || state.grab.id !== l.id)
      state.grab = {
        type: "two",
        id: l.id,
        start: { ...l },
        center,
        dist: Math.max(dist, 0.03),
      };
    const g = state.grab;
    Object.assign(
      l,
      scaledLayer(g.start, dist / g.dist, {
        x: g.start.x + center.x - g.center.x,
        y: g.start.y + center.y - g.center.y,
      }),
    );
    $("gestureStatus").textContent = "双手缩放中 · 靠近缩小，拉开放大";
  } else if (pinches.length === 1) {
    const h = pinches[0];
    if (state.grab?.type !== "one" || state.grab.key !== h.key) {
      const hit = [...state.layers].reverse().find((l) => contains(l, h.point));
      state.grab = hit
        ? {
            type: "one",
            key: h.key,
            id: hit.id,
            dx: hit.x - h.point.x,
            dy: hit.y - h.point.y,
          }
        : { type: "miss", key: h.key };
      if (hit && state.selected !== hit.id) {
        state.selected = hit.id;
        renderLayers();
      }
    }
    const g = state.grab,
      target = state.layers.find((l) => l.id === g.id);
    if (target) {
      target.x = h.point.x + g.dx;
      target.y = h.point.y + g.dy;
      keepInFrame(target);
      $("gestureStatus").textContent = "已抓住蒙版 · 松开手指放下";
    } else $("gestureStatus").textContent = "在蒙版范围内捏合，即可抓取";
  } else {
    state.grab = null;
    $("gestureStatus").textContent =
      `已识别 ${hands.length} 只手 · 捏合拖动 / V 手势拍照`;
  }
  const victory = hands.some((h) => h.victory) && pinches.length === 0;
  if (victory) {
    if (!vSince) vSince = t;
    if (!vLatched) {
      const progress = clamp((t - vSince) / 1000, 0, 1);
      $("gestureStatus").textContent =
        `V 手势拍照 ${Math.round(progress * 100)}% · 保持不动`;
      if (progress >= 1) {
        vLatched = true;
        takePhoto();
      }
    }
  } else {
    vSince = 0;
    vLatched = false;
  }
}
function capacity() {
  if (
    state.items.length >= 12 ||
    state.items.reduce((s, x) => s + x.size, 0) > 140 * 1024 * 1024
  ) {
    toast("作品区暂存已满，请先下载并删除部分作品。");
    return false;
  }
  return true;
}
function filename(ext) {
  return (
    "REFRACT-" + new Date().toISOString().replace(/[:.]/g, "-") + "." + ext
  );
}
function addCapture(blob, type) {
  const item = {
    url: URL.createObjectURL(blob),
    size: blob.size,
    type,
    name: filename(
      type === "photo" ? "png" : blob.type.includes("mp4") ? "mp4" : "webm",
    ),
  };
  state.items.unshift(item);
  renderGallery();
}
function renderGallery() {
  const gallery = $("gallery");
  gallery.replaceChildren();
  $("galleryCount").textContent = "本次会话 · " + state.items.length + " 项";
  if (!state.items.length) {
    gallery.innerHTML =
      '<div class="gallery-empty">◎ <span>你的第一张作品，从一次快门开始。<small>拍摄后在这里预览、下载；刷新前记得保存。</small></span></div>';
    return;
  }
  for (const item of state.items) {
    const card = document.createElement("article");
    card.className = "capture-card";
    const media = document.createElement(
      item.type === "photo" ? "img" : "video",
    );
    media.src = item.url;
    if (item.type === "photo") {
      media.alt = "已拍摄的合成画面";
    } else {
      media.controls = true;
      media.playsInline = true;
      media.preload = "metadata";
    }
    const caption = document.createElement("div");
    caption.className = "caption";
    const label = document.createElement("span");
    label.textContent =
      (item.type === "photo" ? "PNG" : "VIDEO") +
      " · " +
      (item.size / 1024 / 1024).toFixed(1) +
      " MB";
    const a = document.createElement("a");
    a.href = item.url;
    a.download = item.name;
    a.textContent = "下载 ↓";
    const remove = document.createElement("button");
    remove.textContent = "×";
    remove.title = "移除本次会话中的作品";
    remove.onclick = () => {
      if (!confirm("请先下载需要保留的作品。确定从本次会话移除？")) return;
      if (media.tagName === "VIDEO") media.pause();
      URL.revokeObjectURL(item.url);
      state.items = state.items.filter((x) => x !== item);
      renderGallery();
    };
    caption.append(label, a, remove);
    card.append(media, caption);
    gallery.append(card);
  }
}
let photoBusy = false;
function takePhoto() {
  if (photoBusy || !capacity()) return;
  photoBusy = true;
  output.toBlob((blob) => {
    photoBusy = false;
    if (!blob) {
      toast("拍照失败，请重试。");
      return;
    }
    addCapture(blob, "photo");
    $("flash").classList.remove("fire");
    void $("flash").offsetWidth;
    $("flash").classList.add("fire");
    toast("已拍下合成画面，在「灵感留存」下载 PNG。");
  }, "image/png");
}
$("photoBtn").onclick = takePhoto;
function recorderUI(active) {
  $("recordBtn").classList.toggle("recording", active);
  $("recordBtn").querySelector("span").textContent = active
    ? "停止录制"
    : "开始录制";
  $("recBadge").hidden = !active;
}
function stopRecording() {
  if (state.recorder && state.recorder.state !== "inactive") {
    state.recorder.stop();
  }
  state.recording = false;
  recorderUI(false);
}
function startRecording() {
  if (!capacity()) return;
  if (!output.captureStream || !window.MediaRecorder) {
    toast("此浏览器不支持画布录像，请使用桌面版 Chrome 或 Edge。");
    return;
  }
  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t));
  let stream;
  try {
    stream = output.captureStream(30);
    const rec = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 2500000,
      }),
      chunks = [];
    let bytes = 0;
    state.recorder = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size) {
        chunks.push(e.data);
        bytes += e.data.size;
        if (bytes > 70 * 1024 * 1024 && state.recording) {
          stopRecording();
          toast("已达到单段容量上限，正在保存。");
        }
      }
    };
    rec.onerror = (e) => {
      toast("录制出现错误，正在保留已录制内容。");
      if (rec.state !== "inactive") rec.stop();
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      state.recording = false;
      state.recorder = null;
      recorderUI(false);
      $("recordBtn").disabled = false;
      if (chunks.length) {
        addCapture(
          new Blob(chunks, { type: rec.mimeType || mimeType || "video/webm" }),
          "video",
        );
        toast("录像已生成，可在「灵感留存」预览并下载。");
      } else toast("没有获得视频数据，请重新录制。");
    };
    rec.start(1000);
    state.recording = true;
    recStart = performance.now();
    $("recTime").textContent = "00:00";
    recorderUI(true);
  } catch (e) {
    stream?.getTracks().forEach((t) => t.stop());
    state.recorder = null;
    state.recording = false;
    recorderUI(false);
    toast("无法启动录像，请尝试 Chrome 或 Edge。");
  }
}
$("recordBtn").onclick = () => {
  if (state.recording) {
    $("recordBtn").disabled = true;
    stopRecording();
  } else if (!state.recorder) startRecording();
};
document.addEventListener("keydown", (e) => {
  if (
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A"].includes(
      document.activeElement?.tagName,
    ) ||
    $("help").open
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    takePhoto();
  }
  if (e.key.toLowerCase() === "r") $("recordBtn").click();
  if (e.key === "Delete" && selected()) {
    state.layers = state.layers.filter((l) => l.id !== state.selected);
    state.selected = state.layers.at(-1)?.id ?? null;
    renderLayers();
  }
});
document.addEventListener("visibilitychange", () => {
  resetHands();
  if (document.hidden && state.recording) {
    stopRecording();
    toast("页面进入后台，录像已自动结束并保存到作品区。");
  }
});
window.addEventListener("beforeunload", (e) => {
  if (state.recording || state.items.length) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("pagehide", () => {
  state.stream?.getTracks().forEach((t) => t.stop());
  if (state.recorder?.state === "recording") state.recorder.stop();
  state.items.forEach((x) => URL.revokeObjectURL(x.url));
});
function frame(t) {
  requestAnimationFrame(frame);
  if (document.hidden || t - lastFrame < 30) return;
  lastFrame = t;
  if (
    state.stream &&
    state.tracking &&
    state.model &&
    video.readyState >= 2 &&
    t - lastDetection > 75 &&
    video.currentTime !== lastVideoTime
  ) {
    lastDetection = t;
    lastVideoTime = video.currentTime;
    try {
      useHands(state.model.detectForVideo(video, t), t);
    } catch (e) {
      console.error("Hand detection:", e);
      state.tracking = false;
      resetHands();
      updateTracking();
      toast("手势识别暂时中断，可点击识别按钮重试。");
    }
  }
  if (!state.stream)
    $("gestureStatus").textContent = "演示模式 · 拖动窗口体验透明叠加";
  else if (!state.tracking)
    $("gestureStatus").textContent = "鼠标 / 触屏操作中 · 可开启手势识别";
  else if (!state.model)
    $("gestureStatus").textContent = "正在初始化手势模型，画面可正常操作…";
  renderer.render(
    {
      video: state.stream ? video : null,
      mirror: state.mirror,
      layers: state.layers,
      selected: state.selected,
      showGuides: state.guides,
      hands: state.hands,
    },
    t,
  );
  fpsCount++;
  if (t - fpsSince > 1000) {
    $("fps").textContent =
      Math.round((fpsCount * 1000) / (t - fpsSince)) + " FPS";
    fpsCount = 0;
    fpsSince = t;
  }
  if (state.recording) {
    const s = Math.floor((t - recStart) / 1000);
    $("recTime").textContent =
      String(Math.floor(s / 60)).padStart(2, "0") +
      ":" +
      String(s % 60).padStart(2, "0");
    if (s >= 180) {
      stopRecording();
      toast("已达到 3 分钟上限，录像已结束。");
    }
  }
}
requestAnimationFrame(frame);
