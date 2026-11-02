// Run with:  node test.js
const assert = require('assert');
const M = require('./imageMath.js');

const mk = (W, H, px) => new Uint8ClampedArray(px.flat());   // px = [[r,g,b,a], ...]
const run = (src, W, H, over) => M.process(src, W, H, Object.assign(M.defaults(), over));
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

test('index formula i = 4(yW + x)', () => assert.strictEqual(M.index(2, 1, 4), 24));

test('clip bounds', () => {
  assert.deepStrictEqual([M.clip(-5), M.clip(0), M.clip(200), M.clip(255), M.clip(300)], [0, 0, 200, 255, 255]);
});

test('grayscale weights, rounding, alpha preserved', () => {
  const src = mk(1, 1, [[100, 150, 200, 77]]);               // 29.9 + 88.05 + 22.8 = 140.75 -> 141
  assert.deepStrictEqual([...run(src, 1, 1, { mode: 'gray' })], [141, 141, 141, 77]);
  assert.strictEqual(M.gray(255, 255, 255), 255);
  assert.strictEqual(M.gray(0, 0, 0), 0);
});

test('brightness clips at both ends and keeps alpha', () => {
  const src = mk(2, 1, [[250, 10, 100, 9], [5, 0, 255, 255]]);
  assert.deepStrictEqual([...run(src, 2, 1, { beta: 20 })], [255, 30, 120, 9, 25, 20, 255, 255]);
  assert.deepStrictEqual([...run(src, 2, 1, { beta: -20 })], [230, 0, 80, 9, 0, 0, 235, 255]);
});

test('threshold: Gray >= T gives 255, below gives 0', () => {
  const src = mk(2, 1, [[128, 128, 128, 255], [127, 127, 127, 255]]);
  assert.deepStrictEqual([...run(src, 2, 1, { mode: 'bw', T: 128 })], [255, 255, 255, 255, 0, 0, 0, 255]);
});

test('horizontal and vertical flips move pixels correctly', () => {
  const a = [1, 0, 0, 255], b = [2, 0, 0, 255], c = [3, 0, 0, 255], d = [4, 0, 0, 255];
  const src = mk(2, 2, [a, b, c, d]);
  assert.deepStrictEqual([...run(src, 2, 2, { flipH: true })], [...b, ...a, ...d, ...c]);
  assert.deepStrictEqual([...run(src, 2, 2, { flipV: true })], [...c, ...d, ...a, ...b]);
});

test('flips are their own inverse', () => {
  const src = mk(3, 2, [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20], [21, 22, 23, 24]]);
  const once = run(src, 3, 2, { flipH: true, flipV: true });
  assert.deepStrictEqual([...run(once, 3, 2, { flipH: true, flipV: true })], [...src]);
});

test('source buffer is never modified (reset + tab isolation basis)', () => {
  const src = mk(2, 1, [[10, 20, 30, 255], [200, 210, 220, 255]]);
  const copy = Uint8ClampedArray.from(src);
  run(src, 2, 1, { mode: 'bw', beta: 50, flipH: true });
  assert.deepStrictEqual([...src], [...copy]);
  // "reset" = process with defaults -> identical to the original
  assert.deepStrictEqual([...run(src, 2, 1, {})], [...copy]);
});

console.log(n + ' tests passed');
