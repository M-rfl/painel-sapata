// PDF map raster from data only: never touches the live Leaflet map. Pure maths exported for tests;
// renderMapImage takes its browser dependencies injected.

export const MAX_TILES = 64;
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const MAX_LAT = 85.0511287798;

// Web-Mercator world pixels (256-px tiles) at zoom z.
export function project(lat, lon, z) {
  const la = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const scale = 256 * Math.pow(2, z);
  const x = ((lon + 180) / 360) * scale;
  const s = Math.sin((la * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function fitView(points, w, h, pad = 20, maxZ = 18) {
  if (!points || !points.length) return { zoom: 1, cx: 128, cy: 128 };
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (const [lat, lon] of points) {
    const p = project(lat, lon, 0);
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (!(bw > 0) && !(bh > 0)) return { zoom: 15, cx, cy };
  const sx = bw > 0 ? (w - 2 * pad) / bw : Infinity;
  const sy = bh > 0 ? (h - 2 * pad) / bh : Infinity;
  const zoom = Math.max(0, Math.min(maxZ, Math.log2(Math.min(sx, sy))));
  return { zoom, cx, cy };
}

// Canvas pixel of a lat/lon for a view; W, H are canvas pixels.
export function toCanvas(lat, lon, view, W, H, ratio) {
  const p = project(lat, lon, view.zoom);
  const k = Math.pow(2, view.zoom);
  return { x: (p.x - view.cx * k) * ratio + W / 2, y: (p.y - view.cy * k) * ratio + H / 2 };
}

function planAt(view, W, H, ratio, z) {
  const k = Math.pow(2, view.zoom);
  const ts = 256 * Math.pow(2, view.zoom - z); // tile size in view-zoom world px
  const size = ts * ratio;
  const left = (-W / 2) / ratio + view.cx * k;
  const right = (W / 2) / ratio + view.cx * k;
  const top = (-H / 2) / ratio + view.cy * k;
  const bottom = (H / 2) / ratio + view.cy * k;
  const tx0 = Math.floor(left / ts);
  const tx1 = Math.max(tx0, Math.ceil(right / ts) - 1);
  const ty0 = Math.floor(top / ts);
  const ty1 = Math.max(ty0, Math.ceil(bottom / ts) - 1);
  const n = Math.pow(2, z);
  const tiles = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = tx0; tx <= tx1; tx++) {
      tiles.push({
        z,
        x: ((tx % n) + n) % n,
        y: ty,
        dx: (tx * ts - view.cx * k) * ratio + W / 2,
        dy: (ty * ts - view.cy * k) * ratio + H / 2,
      });
    }
  }
  return { z, size, tiles };
}

export function tilePlan(view, W, H, ratio, maxTiles = MAX_TILES) {
  let z = Math.max(0, Math.min(19, Math.round(view.zoom + Math.log2(ratio))));
  let plan = planAt(view, W, H, ratio, z);
  while (plan.tiles.length > maxTiles && z > 0) {
    z -= 1;
    plan = planAt(view, W, H, ratio, z);
  }
  return plan;
}

// Mirrors leaflet.heat _redraw grid merge (pane offset 0, weight factor 1). r = radius + blur in canvas px.
export function mergeHeat(pts, r, max, W, H) {
  const g = r / 2;
  const grid = new Map();
  for (const [x, y, w] of pts) {
    if (!(x >= -r && x <= W + r && y >= -r && y <= H + r)) continue;
    const i = Math.floor(y / g) + 2;
    const j = Math.floor(x / g) + 2;
    let row = grid.get(i);
    if (!row) { row = new Map(); grid.set(i, row); }
    const c = row.get(j);
    if (!c) {
      row.set(j, [x, y, w]);
    } else {
      const w0 = c[2];
      c[0] = (x * w + c[0] * w0) / (w0 + w);
      c[1] = (y * w + c[1] * w0) / (w0 + w);
      c[2] = w0 + w;
    }
  }
  const out = [];
  for (const i of [...grid.keys()].sort((a, b) => a - b)) {
    const row = grid.get(i);
    for (const j of [...row.keys()].sort((a, b) => a - b)) {
      const c = row.get(j);
      out.push([Math.round(c[0]), Math.round(c[1]), Math.min(c[2], max)]);
    }
  }
  return out;
}

// Browser-only defaults (never executed by tests).
function defaultCanvas(w, h) {
  const c = globalThis.document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function loadTile(url, ms = 8000) {
  return new Promise((resolve) => {
    const img = new globalThis.Image();
    let done = false;
    const finish = (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => { img.src = ''; finish(null); }, ms);
    img.crossOrigin = 'anonymous';
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = url;
  });
}

async function loadAll(tiles, loadImage, concurrency) {
  const imgs = new Array(tiles.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < tiles.length) {
      const i = next++;
      const t = tiles[i];
      const url = TILE_URL.replace('{z}', t.z).replace('{x}', t.x).replace('{y}', t.y);
      try { imgs[i] = (await loadImage(url)) || null; } catch { imgs[i] = null; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tiles.length) }, worker));
  return imgs;
}

export async function renderMapImage(input, {
  size = { w: 1000, h: 420 }, ratio = 2, createCanvas = defaultCanvas, loadImage = loadTile,
  simpleheat = globalThis.simpleheat, concurrency = 6,
} = {}) {
  const W = size.w * ratio;
  const H = size.h * ratio;
  const view = fitView(input.points || [], size.w, size.h, 20);
  const plan = tilePlan(view, W, H, ratio);
  const imgs = await loadAll(plan.tiles, loadImage, concurrency);
  const requested = plan.tiles.length;
  const loaded = imgs.filter(Boolean).length;
  let basemapFailed = requested === 0 || loaded * 2 < requested;
  let heatMissing = false;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const heatOpts = input.heatOpts || { radius: 25, blur: 15, minOpacity: 0.3, max: 1 };
  const px = (lat, lon) => toCanvas(lat, lon, view, W, H, ratio);

  function draw(withTiles) {
    heatMissing = false;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    if (withTiles) {
      plan.tiles.forEach((t, i) => {
        if (imgs[i]) {
          ctx.drawImage(imgs[i], t.dx, t.dy, plan.size, plan.size);
        } else {
          ctx.fillStyle = '#eeeeee';
          ctx.fillRect(t.dx, t.dy, plan.size, plan.size);
        }
      });
    }

    const single = input.lineCount === 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const f of input.routes || []) {
      const s2 = f.properties && f.properties.sentido === 2;
      const col = (input.sentidoColors || [])[((f.properties.sentido - 1) % 2 + 2) % 2];
      ctx.strokeStyle = col;
      ctx.lineWidth = (single ? 5 : 3) * ratio;
      ctx.globalAlpha = single ? 0.55 : 0.3;
      ctx.setLineDash(s2 ? [10 * ratio, 6 * ratio] : []);
      for (const seg of (f.geometry && f.geometry.coordinates) || []) {
        if (!seg.length) continue;
        ctx.beginPath();
        seg.forEach(([lon, lat], k) => {
          const p = px(lat, lon);
          if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    for (const [lat, lon] of input.stations || []) {
      const p = px(lat, lon);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 * ratio, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#37474f';
      ctx.lineWidth = 1.5 * ratio;
      ctx.stroke();
    }

    for (const m of input.markers || []) {
      const p = px(m.lat, m.lon);
      ctx.beginPath();
      ctx.arc(p.x, p.y, (5 + 1.5 * m.cls) * ratio, 0, Math.PI * 2);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = (input.classColors || [])[m.cls];
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1 * ratio;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (typeof simpleheat === 'function') {
      const hc = createCanvas(W, H);
      const projected = (input.heat || []).map(([lat, lon, w]) => {
        const p = px(lat, lon);
        return [p.x, p.y, w];
      });
      const merged = mergeHeat(projected, (heatOpts.radius + heatOpts.blur) * ratio, heatOpts.max, W, H);
      simpleheat(hc).radius(heatOpts.radius * ratio, heatOpts.blur * ratio).max(heatOpts.max)
        .data(merged).draw(heatOpts.minOpacity);
      ctx.drawImage(hc, 0, 0);
    } else {
      heatMissing = true;
    }

    const text = input.attribution || '';
    if (text) {
      ctx.font = `${11 * ratio}px sans-serif`;
      const bw = text.length * 6 * ratio + 8 * ratio;
      const bh = 16 * ratio;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(W - bw, H - bh, bw, bh);
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'right';
      ctx.fillText(text, W - 4 * ratio, H - 4 * ratio);
    }
  }

  draw(!basemapFailed);
  let dataUrl;
  try {
    dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    basemapFailed = true;
    draw(false);
    dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  }
  const out = { dataUrl, format: 'JPEG', width: W, height: H, basemapFailed, tiles: { requested, loaded } };
  if (heatMissing) out.heatMissing = true;
  return out;
}
