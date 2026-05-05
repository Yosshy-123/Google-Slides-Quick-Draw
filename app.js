import { APP_NAME, DEFAULTS, MAX_SIZE, STORAGE_KEY } from './config.js';
import { createIcon } from './icons.js';

const UI = {
  canvas: null,
  ctx: null,
  toolbar: null,
  pen: null,
  eraser: null,
  clear: null,
  copy: null,
  size: null,
  color: null,
};

const state = { ...DEFAULTS };
let booting = false;
let activePointerId = null;
let drawing = false;
let syncQueued = false;
let lastSize = { width: 0, height: 0 };
let disabledSnapshot = null;
let toastTimer = null;
let toastEl = null;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function normalizeState(raw) {
  return {
    enabled: Boolean(raw?.enabled),
    tool: raw?.tool === 'eraser' ? 'eraser' : 'pen',
    size: clamp(Number(raw?.size) || DEFAULTS.size, 1, MAX_SIZE),
    color: typeof raw?.color === 'string' ? raw.color : DEFAULTS.color,
  };
}

async function storageGet() {
  const result = await chrome.storage.local.get({ [STORAGE_KEY]: DEFAULTS });
  return normalizeState(result[STORAGE_KEY]);
}

async function storageSet(nextState) {
  await chrome.storage.local.set({ [STORAGE_KEY]: nextState });
}

function viewport() {
  return {
    width: Math.max(1, Math.round(window.innerWidth || 1)),
    height: Math.max(1, Math.round(window.innerHeight || 1)),
  };
}

function snapshotCanvas(source) {
  if (!source?.width || !source?.height) return null;
  const copy = document.createElement('canvas');
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext('2d').drawImage(source, 0, 0);
  return copy;
}

function restoreSnapshot(target, snapshot) {
  if (!snapshot || !target.width || !target.height) return;
  const ctx = target.getContext('2d');
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, target.width, target.height);
}

function syncCanvasGeometry() {
  if (!UI.canvas || !UI.ctx) return;

  const { width, height } = viewport();
  if (width === lastSize.width && height === lastSize.height) return;

  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  const old = snapshotCanvas(UI.canvas);

  UI.canvas.style.width = `${width}px`;
  UI.canvas.style.height = `${height}px`;
  UI.canvas.width = Math.max(1, Math.round(width * dpr));
  UI.canvas.height = Math.max(1, Math.round(height * dpr));

  UI.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  UI.ctx.lineCap = 'round';
  UI.ctx.lineJoin = 'round';
  UI.ctx.imageSmoothingEnabled = true;

  if (old) {
    UI.ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, width, height);
  }

  lastSize = { width, height };
}

function scheduleSyncCanvasGeometry() {
  if (syncQueued) return;
  syncQueued = true;
  requestAnimationFrame(() => {
    syncQueued = false;
    syncCanvasGeometry();
  });
}

function setEnabled(enabled, persist = true, previousEnabled = state.enabled) {
  const nextEnabled = Boolean(enabled);

  if (!nextEnabled) {
    if (previousEnabled && !disabledSnapshot) {
      disabledSnapshot = snapshotCanvas(UI.canvas);
    }
    cancelActiveStroke();
    clearCanvas(true);
  }

  state.enabled = nextEnabled;
  UI.canvas.style.pointerEvents = nextEnabled ? 'auto' : 'none';
  UI.toolbar.hidden = !nextEnabled;

  if (nextEnabled && disabledSnapshot) {
    restoreSnapshot(UI.canvas, disabledSnapshot);
    disabledSnapshot = null;
  }

  if (persist) storageSet(state).catch(console.error);
  if (nextEnabled) scheduleSyncCanvasGeometry();
}

function setTool(tool, persist = true) {
  state.tool = tool === 'eraser' ? 'eraser' : 'pen';
  UI.pen.classList.toggle('is-active', state.tool === 'pen');
  UI.eraser.classList.toggle('is-active', state.tool === 'eraser');
  if (persist) storageSet(state).catch(console.error);
}

function setSize(size, persist = true) {
  state.size = clamp(Number(size) || DEFAULTS.size, 1, MAX_SIZE);
  UI.size.value = String(state.size);
  if (persist) storageSet(state).catch(console.error);
}

function setColor(color, persist = true) {
  state.color = typeof color === 'string' && color ? color : DEFAULTS.color;
  UI.color.value = state.color;
  if (persist) storageSet(state).catch(console.error);
}

function createCanvas() {
  UI.canvas = document.createElement('canvas');
  UI.canvas.id = 'canvas';
  UI.canvas.setAttribute('aria-hidden', 'true');
  UI.ctx = UI.canvas.getContext('2d', { willReadFrequently: true });
  document.body.appendChild(UI.canvas);
}

function ensureToast() {
  if (toastEl) return toastEl;
  toastEl = document.createElement('div');
  toastEl.id = 'toast';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  toastEl.hidden = true;
  document.body.appendChild(toastEl);
  return toastEl;
}

function notify(message) {
  const el = ensureToast();
  el.textContent = message;
  el.hidden = false;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.classList.remove('is-visible');
    el.hidden = true;
  }, 1600);
}

function buildToolbar() {
  const toolbar = document.createElement('section');
  toolbar.id = 'toolbar';
  toolbar.hidden = true;
  toolbar.setAttribute('aria-label', APP_NAME);

  toolbar.innerHTML = `
    <div class="row">
      <button type="button" id="pen" class="btn" aria-label="ペン" title="ペン"></button>
      <button type="button" id="eraser" class="btn" aria-label="消しゴム" title="消しゴム"></button>
      <button type="button" id="clear" class="btn" aria-label="クリア" title="クリア"></button>
      <button type="button" id="copy" class="btn" aria-label="コピー" title="コピー"></button>
    </div>
    <div class="row input-wrap">
      <input type="color" id="color" aria-label="色" value="${state.color}">
      <input type="range" id="size" min="1" max="${MAX_SIZE}" value="${state.size}" aria-label="線の太さ">
    </div>
  `;

  UI.toolbar = toolbar;
  UI.pen = toolbar.querySelector('#pen');
  UI.eraser = toolbar.querySelector('#eraser');
  UI.clear = toolbar.querySelector('#clear');
  UI.copy = toolbar.querySelector('#copy');
  UI.size = toolbar.querySelector('#size');
  UI.color = toolbar.querySelector('#color');

  UI.pen.appendChild(createIcon('pen'));
  UI.eraser.appendChild(createIcon('eraser'));
  UI.clear.appendChild(createIcon('trash'));
  UI.copy.appendChild(createIcon('copy'));

  UI.pen.addEventListener('click', () => setTool('pen'));
  UI.eraser.addEventListener('click', () => setTool('eraser'));
  UI.clear.addEventListener('click', () => clearCanvas());
  UI.copy.addEventListener('click', () => copyCanvas().catch((error) => {
    console.error(`[${APP_NAME}] copy failed:`, error);
  }));
  UI.size.addEventListener('input', (event) => setSize(event.target.value));
  UI.color.addEventListener('input', (event) => setColor(event.target.value));

  document.body.appendChild(toolbar);
}

function pointFromEvent(event) {
  const rect = UI.canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function applyStrokeStyle() {
  UI.ctx.lineWidth = state.size;
  UI.ctx.strokeStyle = state.color;
  UI.ctx.globalCompositeOperation = state.tool === 'eraser' ? 'destination-out' : 'source-over';
}

function beginStroke(event) {
  if (!state.enabled || event.button !== 0) return;
  drawing = true;
  activePointerId = event.pointerId;
  UI.canvas.setPointerCapture?.(event.pointerId);
  applyStrokeStyle();
  const point = pointFromEvent(event);
  UI.ctx.beginPath();
  UI.ctx.moveTo(point.x, point.y);
  UI.ctx.lineTo(point.x, point.y);
  UI.ctx.stroke();
  event.preventDefault();
}

function continueStroke(event) {
  if (!drawing || event.pointerId !== activePointerId || !state.enabled) return;
  applyStrokeStyle();
  const point = pointFromEvent(event);
  UI.ctx.lineTo(point.x, point.y);
  UI.ctx.stroke();
  event.preventDefault();
}

function endStroke(event) {
  if (event && event.pointerId !== activePointerId) return;
  cancelActiveStroke();
}

function clearCanvas(preserveSnapshot = false) {
  if (!preserveSnapshot) disabledSnapshot = null;
  UI.ctx.clearRect(0, 0, UI.canvas.width, UI.canvas.height);
}

function cancelActiveStroke() {
  drawing = false;
  activePointerId = null;
  UI.ctx.closePath();
  UI.ctx.globalCompositeOperation = 'source-over';
}

function attachCanvasEvents() {
  UI.canvas.addEventListener('pointerdown', beginStroke);
  UI.canvas.addEventListener('pointermove', continueStroke);
  UI.canvas.addEventListener('pointerup', endStroke);
  UI.canvas.addEventListener('pointercancel', endStroke);
  UI.canvas.addEventListener('lostpointercapture', endStroke);
}

function cropCanvas(sourceCanvas) {
  const ctx = sourceCanvas.getContext('2d');
  const { width, height } = sourceCanvas;
  const { data } = ctx.getImageData(0, 0, width, height);

  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right < left || bottom < top) return null;

  const pad = 1;
  const cropLeft = Math.max(0, left - pad);
  const cropTop = Math.max(0, top - pad);
  const cropRight = Math.min(width - 1, right + pad);
  const cropBottom = Math.min(height - 1, bottom + pad);

  const cropped = document.createElement('canvas');
  cropped.width = cropRight - cropLeft + 1;
  cropped.height = cropBottom - cropTop + 1;
  cropped.getContext('2d').drawImage(
    sourceCanvas,
    cropLeft,
    cropTop,
    cropped.width,
    cropped.height,
    0,
    0,
    cropped.width,
    cropped.height,
  );
  return cropped;
}

async function copyCanvas() {
  const trimmed = cropCanvas(UI.canvas);
  if (!trimmed) {
    notify('コピーする描画がありません');
    return;
  }

  const blob = await new Promise((resolve, reject) => {
    trimmed.toBlob((next) => (next ? resolve(next) : reject(new Error('PNG conversion failed'))), 'image/png');
  });

  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    notify('コピーしました');
  } catch {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'google-slides-quick-draw.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('画像を保存しました');
  }
}

function applyState(nextState, persist = false) {
  const previousEnabled = state.enabled;
  const normalized = normalizeState(nextState);
  Object.assign(state, normalized);
  setTool(state.tool, persist);
  setSize(state.size, persist);
  setColor(state.color, persist);
  setEnabled(state.enabled, persist, previousEnabled);
}

function observeState() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
    applyState(changes[STORAGE_KEY].newValue, false);
  });
}

function attachObservers() {
  window.addEventListener('resize', scheduleSyncCanvasGeometry, { passive: true });
  const observer = new MutationObserver(() => {
    if (!document.body.contains(UI.canvas)) document.body.appendChild(UI.canvas);
    if (!document.body.contains(UI.toolbar)) document.body.appendChild(UI.toolbar);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

export async function bootSlidesQuickDraw() {
  if (booting) return;
  booting = true;

  try {
    if (!document.body) {
      await new Promise((resolve) => window.addEventListener('DOMContentLoaded', resolve, { once: true }));
    }

    const persisted = await storageGet();
    Object.assign(state, persisted);

    document.getElementById('canvas')?.remove();
    document.getElementById('toolbar')?.remove();

    createCanvas();
    buildToolbar();
    attachCanvasEvents();
    observeState();
    attachObservers();
    applyState(state, false);
    if (!state.enabled) {
      UI.canvas.style.pointerEvents = 'none';
      UI.toolbar.hidden = true;
    }
    scheduleSyncCanvasGeometry();
  } finally {
    booting = false;
  }
}
