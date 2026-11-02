/* app.js — UI, tabs, rendering. All pixel math lives in imageMath.js */
(() => {
  'use strict';
  const M = window.ImageMath;
  const $ = (id) => document.getElementById(id);
  const cOrig = $('cOrig'), cProc = $('cProc'), cmp = $('cmp');

  // Each tab owns: its original pixels (never written after import), settings, output, split position.
  const tabs = [];
  let active = null, counter = 0, raf = 0;

  /* ---------- tabs ---------- */
  function newTab() {
    const t = { id: ++counter, name: 'Untitled ' + counter, W: 0, H: 0, orig: null, out: null, s: M.defaults(), split: 50 };
    tabs.push(t);
    select(t);
    return t;
  }

  function select(t) {
    active = t;
    renderTabs();
    syncUI();
    showImage();
  }

  function closeTab(t) {
    const idx = tabs.indexOf(t);
    tabs.splice(idx, 1);
    if (!tabs.length) newTab();
    else if (t === active) select(tabs[Math.max(0, idx - 1)]);
    else renderTabs();
  }

  function renderTabs() {
    const list = $('tabList');
    list.textContent = '';
    tabs.forEach((t) => {
      const el = document.createElement('div');
      el.className = 'tab' + (t === active ? ' on' : '');
      el.setAttribute('role', 'tab');
      el.setAttribute('aria-selected', t === active);
      el.tabIndex = 0;
      el.innerHTML = '<span class="tn"></span><button class="x" aria-label="Close tab">×</button>';
      el.firstChild.textContent = t.name;
      el.onclick = (e) => (e.target.classList.contains('x') ? closeTab(t) : select(t));
      el.onkeydown = (e) => { if (e.key === 'Enter') select(t); };
      list.appendChild(el);
    });
  }

  /* ---------- import ---------- */
  async function load(file) {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const bmp = await createImageBitmap(file);
      if (bmp.width * bmp.height > 25e6) { alert('This image is larger than 25 megapixels. Choose a smaller one.'); return; }
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0);
      const t = active.orig ? newTab() : active;           // fill an empty tab, otherwise open a new one
      t.name = file.name; t.W = c.width; t.H = c.height;
      t.orig = ctx.getImageData(0, 0, t.W, t.H).data;      // independent RGBA copy of the original
      t.s = M.defaults(); t.split = 50; t.out = null;
      select(t);
    } catch (err) {
      alert('This file could not be read as an image. Try a PNG, JPEG or WebP file.');
    }
  }

  /* ---------- rendering ---------- */
  function showImage() {
    const t = active, has = !!t.orig;
    $('empty').hidden = has;
    cmp.hidden = !has;
    $('probe').hidden = !has;
    if (!has) return;
    cOrig.width = cProc.width = t.W;
    cOrig.height = cProc.height = t.H;
    cOrig.getContext('2d').putImageData(new ImageData(t.orig, t.W, t.H), 0, 0);
    fit();
    drawProcessed();
    applySplit();
  }

  function drawProcessed() {
    const t = active;
    if (!t.orig) return;
    t.out = M.process(t.orig, t.W, t.H, t.s);              // always recomputed from the original
    cProc.getContext('2d').putImageData(new ImageData(t.out, t.W, t.H), 0, 0);
  }

  function schedule() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(drawProcessed);
  }

  function fit() {
    const t = active;
    if (!t || !t.orig) return;
    const ws = $('workspace');
    const aw = Math.max(120, ws.clientWidth - 34);
    const ah = Math.max(200, window.innerHeight * 0.62);
    const k = Math.min(aw / t.W, ah / t.H, 1.5);
    cmp.style.width = Math.round(t.W * k) + 'px';
    cmp.style.height = Math.round(t.H * k) + 'px';
  }
  window.addEventListener('resize', fit);

  /* ---------- controls <-> state ---------- */
  function syncUI() {
    const t = active, s = t.s;
    document.querySelectorAll('#modeSeg button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === s.mode));
    $('beta').value = s.beta; $('betaOut').textContent = (s.beta > 0 ? '+' : '') + s.beta;
    $('thr').value = s.T; $('tOut').textContent = s.T;
    $('tRow').hidden = s.mode !== 'bw';
    $('flipH').setAttribute('aria-pressed', s.flipH);
    $('flipV').setAttribute('aria-pressed', s.flipV);
    $('panel').classList.toggle('off', !t.orig);
    $('iName').textContent = t.orig ? t.name : '—';
    $('iW').textContent = t.orig ? t.W + ' px' : '—';
    $('iH').textContent = t.orig ? t.H + ' px' : '—';
    $('iN').textContent = t.orig ? (t.W * t.H).toLocaleString() : '—';
    $('iL').textContent = t.orig ? (4 * t.W * t.H).toLocaleString() : '—';
  }

  function change(fn) { fn(active.s); syncUI(); schedule(); }

  document.querySelectorAll('#modeSeg button').forEach((b) => b.addEventListener('click', () => change((s) => { s.mode = b.dataset.mode; })));
  $('beta').addEventListener('input', (e) => change((s) => { s.beta = +e.target.value; }));
  $('thr').addEventListener('input', (e) => change((s) => { s.T = +e.target.value; }));
  $('flipH').addEventListener('click', () => change((s) => { s.flipH = !s.flipH; }));
  $('flipV').addEventListener('click', () => change((s) => { s.flipV = !s.flipV; }));
  $('btnReset').addEventListener('click', () => {            // resets the ACTIVE tab only
    active.s = M.defaults(); active.split = 50;
    syncUI(); applySplit(); drawProcessed();
  });

  /* ---------- before / after slider + pixel probe ---------- */
  let dragging = false;
  function applySplit() {
    const p = active.split;
    cProc.style.clipPath = 'inset(0 0 0 ' + p + '%)';       // right of the divider = processed
    $('divider').style.left = p + '%';
  }
  function setSplit(e) {
    const r = cmp.getBoundingClientRect();
    active.split = M.clip((e.clientX - r.left) / r.width * 100, 0, 100);
    applySplit();
  }
  cmp.addEventListener('pointerdown', (e) => { dragging = true; cmp.setPointerCapture(e.pointerId); setSplit(e); });
  cmp.addEventListener('pointermove', (e) => { if (dragging) setSplit(e); probe(e); });
  cmp.addEventListener('pointerup', () => { dragging = false; });
  cmp.addEventListener('pointercancel', () => { dragging = false; });
  $('handle').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      active.split = M.clip(active.split + (e.key === 'ArrowLeft' ? -2 : 2), 0, 100);
      applySplit();
    }
  });

  function probe(e) {
    const t = active, r = cmp.getBoundingClientRect();
    const x = M.clip(Math.floor((e.clientX - r.left) / r.width * t.W), 0, t.W - 1);
    const y = M.clip(Math.floor((e.clientY - r.top) / r.height * t.H), 0, t.H - 1);
    const i = M.index(x, y, t.W);
    const px = (d) => '(' + d[i] + ', ' + d[i + 1] + ', ' + d[i + 2] + ', ' + d[i + 3] + ')';
    $('probe').textContent = 'x=' + x + ', y=' + y + '  |  i = 4·(' + y + '·' + t.W + ' + ' + x + ') = ' + i +
      '  |  before ' + px(t.orig) + '  |  after ' + px(t.out);
  }

  /* ---------- save as PNG ---------- */
  async function save() {
    const t = active;
    if (!t.orig) { alert('Import an image first.'); return; }
    const c = document.createElement('canvas');
    c.width = t.W; c.height = t.H;
    c.getContext('2d').putImageData(new ImageData(t.out, t.W, t.H), 0, 0);   // PNG keeps alpha
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    const name = t.name.replace(/\.[^.]+$/, '') + '-edited.png';
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }] });
        const w = await h.createWritable(); await w.write(blob); await w.close();
        return;
      } catch (err) { if (err.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- wiring ---------- */
  const fileInput = $('file');
  const pick = () => fileInput.click();
  $('btnImport').addEventListener('click', pick);
  $('btnEmptyImport').addEventListener('click', pick);
  $('btnAddTab').addEventListener('click', () => { newTab(); pick(); });
  $('btnSave').addEventListener('click', save);
  fileInput.addEventListener('change', () => { load(fileInput.files[0]); fileInput.value = ''; });

  const ws = $('workspace');
  ws.addEventListener('dragover', (e) => { e.preventDefault(); ws.classList.add('drag'); });
  ws.addEventListener('dragleave', () => ws.classList.remove('drag'));
  ws.addEventListener('drop', (e) => { e.preventDefault(); ws.classList.remove('drag'); load(e.dataTransfer.files[0]); });

  newTab();
})();
