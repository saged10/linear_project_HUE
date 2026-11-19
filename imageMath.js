/*
 * imageMath.js — pure pixel mathematics (no DOM, no Canvas).
 *
 * Layout of ImageData.data (row-major, 4 channels per pixel):
 *     R G B A | R G B A | ...
 * Index of pixel (x, y) in an image of width W:
 *     i = 4 * (y * W + x)
 * Coordinates are zero-based; x grows to the right, y grows downward.
 */
(function (root) {
  'use strict';

  // clip(z,0,255) = 0 if z<0 ; z if 0<=z<=255 ; 255 if z>255
  function clip(z, lo, hi) {
    if (lo === undefined) lo = 0;
    if (hi === undefined) hi = 255;
    return z < lo ? lo : (z > hi ? hi : z);
  }

  // Rounding rule used everywhere (web, Python, C++): round half up = floor(z + 0.5)
  // (Python's round() is banker's rounding, so we never call it for pixel math.)
  function roundHalfUp(z) { return Math.floor(z + 0.5); }

  // Gray = 0.299 R + 0.587 G + 0.114 B  (ITU-R BT.601 luma weights)
  function gray(r, g, b) { return roundHalfUp(0.299 * r + 0.587 * g + 0.114 * b); }

  // i = 4 * (y * W + x)
  function index(x, y, W) { return 4 * (y * W + x); }

  function defaults() {
    return { mode: 'original', beta: 0, T: 128, flipH: false, flipV: false };
  }

  /*
   * Pipeline (always computed from the untouched source buffer):
   *   1. colour mode  : original | gray (R'=G'=B'=Gray)
   *   2. brightness   : C' = clip(C + beta, 0, 255)       (when beta != 0)
   *   3. threshold    : BW = 255 if Gray >= T else 0      (mode 'bw')
   *   4. flips        : x' = W-1-x  and/or  y' = H-1-y
   * Alpha is copied unchanged. `src` is never modified.
   */
  function process(src, W, H, s) {
    var out = new Uint8ClampedArray(src.length);
    var beta = s.beta | 0;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var i = index(x, y, W);
        var r = src[i], g = src[i + 1], b = src[i + 2], a = src[i + 3];

        if (s.mode === 'gray') { r = g = b = gray(r, g, b); }

        if (beta !== 0) { r = clip(r + beta); g = clip(g + beta); b = clip(b + beta); }

        if (s.mode === 'bw') { r = g = b = (gray(r, g, b) >= s.T ? 255 : 0); }

        var xp = s.flipH ? W - 1 - x : x;
        var yp = s.flipV ? H - 1 - y : y;
        var j = index(xp, yp, W);
        out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = a;
      }
    }
    return out;
  }

  var api = { clip: clip, roundHalfUp: roundHalfUp, gray: gray, index: index, defaults: defaults, process: process };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ImageMath = api;
})(typeof window !== 'undefined' ? window : this);
