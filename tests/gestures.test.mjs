import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyHand,
  mapPoint,
  contains,
  scaledLayer,
  keepInFrame,
} from "../public/gestures.js";
test("cover crop and mirrored camera coordinates agree with canvas", () => {
  assert.deepEqual(mapPoint({ x: 0.25, y: 0.5 }, 1280, 720, 1280, 720, false), {
    x: 0.25,
    y: 0.5,
  });
  assert.deepEqual(mapPoint({ x: 0.25, y: 0.5 }, 1280, 720, 1280, 720, true), {
    x: 0.75,
    y: 0.5,
  });
  assert.deepEqual(mapPoint({ x: 0.5, y: 0.5 }, 640, 480, 1280, 720, false), {
    x: 0.5,
    y: 0.5,
  });
  assert.ok(mapPoint({ x: 0.5, y: 0 }, 640, 480, 1280, 720, false).y < 0);
});
test("hit testing respects transparent shape boundaries and hidden layers", () => {
  const l = { x: 0.5, y: 0.5, w: 0.4, h: 0.4, visible: true, shape: "ellipse" };
  assert.ok(contains(l, { x: 0.5, y: 0.5 }));
  assert.ok(!contains(l, { x: 0.69, y: 0.69 }));
  assert.ok(!contains({ ...l, visible: false }, { x: 0.5, y: 0.5 }));
});
test("two hand scale preserves ratio and clamps size and bounds", () => {
  const l = { x: 0.5, y: 0.5, w: 0.4, h: 0.2 };
  const s = scaledLayer(l, 100, { x: 2, y: -2 });
  assert.ok(Math.abs(s.w - 0.95) < 1e-9);
  assert.ok(Math.abs(s.h - 0.475) < 1e-9);
  assert.ok(s.x + s.w / 2 <= 1);
  assert.ok(s.y - s.h / 2 >= 0);
  const tiny = scaledLayer(l, 0.001, { x: 0.5, y: 0.5 });
  assert.equal(tiny.h, 0.12);
  assert.equal(tiny.w / tiny.h, 2);
});
test("pinch uses palm normalized thresholds and hysteresis", () => {
  const p = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  p[9] = { x: 0, y: 1 };
  p[4] = { x: 0, y: 0 };
  p[8] = { x: 0.35, y: 0 };
  assert.equal(classifyHand(p, false).pinch, false);
  assert.equal(classifyHand(p, true).pinch, true);
  p[8] = { x: 0.2, y: 0 };
  assert.equal(classifyHand(p, false).pinch, true);
  p[8] = { x: 0.5, y: 0 };
  assert.equal(classifyHand(p, true).pinch, false);
});
test("V pose requires extended index and middle, folded other fingers", () => {
  const p = Array.from({ length: 21 }, () => ({ x: 0, y: 0.5 }));
  p[0] = { x: 0, y: 0 };
  p[9] = { x: 0, y: 1 };
  p[4] = { x: -1, y: 0.2 };
  p[8] = { x: 0.1, y: 1 };
  p[12] = { x: 0.3, y: 1 };
  assert.equal(classifyHand(p).victory, true);
  p[16] = { x: 0.5, y: 1 };
  assert.equal(classifyHand(p).victory, false);
});
test("drag cannot lose a layer outside the image", () => {
  const l = keepInFrame({ x: -4, y: 8, w: 0.3, h: 0.5 });
  assert.equal(l.x, 0.15);
  assert.equal(l.y, 0.75);
});
