// Mount-once Leaflet panel: OSM tiles, OSM route relations of the run's line (background, per sentido), stations,
// ponto markers with DOM popups, optional fixed-scale heat layer and a chart-driven position marker.
// Map content comes only from core/geo.js; render(ctx) never moves the view.
import { h } from '../dom.js';
import { T, semGpsNote, nImpactosNote } from '../i18n.js';
import { infoBtn } from '../info.js';
import { fmtDate, fmtTime, fmtG } from '../format.js';
import { paramsKey } from '../state.js';
import { CLASS_NAMES } from '../../core/defaults.js';
import { pontoMarkers, unplacedCounts, heatPoints, hoverPosition } from '../../core/geo.js';

const SENTIDO_COLORS = ['#1565c0', '#5d4037'];
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function popupNode(m) {
  const dl = h('dl', null);
  const add = (k, v) => { dl.appendChild(h('dt', null, k)); dl.appendChild(h('dd', null, v)); };
  const when = new Date(m.tEpochMs);
  add(T.popHora, fmtDate(when) + ' ' + fmtTime(when));
  add(T.popTrecho, m.trecho);
  add(T.popSentido, m.sentido);
  add(T.popAxDin, fmtG(m.ax, 3) + ' g');
  add(T.popAyDin, fmtG(m.ay, 3) + ' g');
  add(T.popAzDin, fmtG(m.az, 3) + ' g');
  add(T.popClasse, m.className);
  return h('div', { class: 'map-popup' },
    h('strong', null, m.className),
    dl,
    h('p', null, nImpactosNote(m.nImpactos)),
    h('a', { href: m.url, target: '_blank', rel: 'noopener noreferrer' }, T.popGoogle));
}

export function mountMap(el, link, run) {
  const css = getComputedStyle(document.documentElement);
  const CLASS_COLORS = ['--normal', '--leve', '--moderado', '--severo', '--critico']
    .map((v, i) => css.getPropertyValue(v).trim() || ['#2e7d32', '#f9a825', '#ef6c00', '#c62828', '#6a1b9a'][i]);

  const canvas = h('div', { class: 'map-canvas' });
  const note = h('p', { class: 'map-note muted' });
  el.appendChild(h('div', { class: 'panel' }, h('h2', null, T.secMap, infoBtn('map', T.secMap)), canvas, note));

  const map = L.map(canvas, { preferCanvas: true, zoomControl: true });
  L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);

  // Initial view, set once and never touched by render().
  const pts = [];
  for (let f = 0; f < run.fixLat.length; f++) {
    if (!Number.isNaN(run.fixLat[f]) && !Number.isNaN(run.fixLon[f])) pts.push([run.fixLat[f], run.fixLon[f]]);
  }
  for (const s of run.stations || []) pts.push([s.lat, s.lon]);
  if (pts.length) map.fitBounds(pts, { padding: [20, 20] });
  else map.fitWorld();
  requestAnimationFrame(() => map.invalidateSize());

  const routeLayer = L.layerGroup().addTo(map);
  const stationLayer = L.layerGroup().addTo(map);
  const markerLayer = L.layerGroup().addTo(map);
  for (const s of run.stations || []) {
    L.circleMarker([s.lat, s.lon], { radius: 4, color: '#37474f', weight: 1.5, fillColor: '#ffffff', fillOpacity: 1 })
      .bindTooltip(s.name).addTo(stationLayer);
  }

  // Routes: static OSM relation geometry of the run's line, loaded once; never snapped to, never interactive.
  map.createPane('routes').style.zIndex = 350;
  const routeRenderer = L.canvas({ pane: 'routes' });
  const sentidoBox = h('div', null);
  function legendRow(i, text) {
    return h('div', null, h('span', { class: 'swatch', style: { background: SENTIDO_COLORS[i % SENTIDO_COLORS.length] } }), text);
  }
  function setLegend(rows) {
    sentidoBox.replaceChildren(...rows);
  }
  setLegend((run.sentidos || []).map((s, i) => legendRow(i, s.name)));
  const lineId = run.meta?.line?.id;
  const lines = lineId && !run.meta.line.ambiguous ? [lineId] : [1, 2, 3, 4];
  Promise.all(lines.flatMap((ln) => [1, 2].map((sn) =>
    fetch(`data/routes/linha-${ln}-sentido-${sn}.geojson`).then((r) => (r.ok ? r.json() : null)).catch(() => null))))
    .then((feats) => {
      const ok = feats.filter(Boolean);
      for (const f of ok) {
        const i = f.properties.sentido - 1;
        L.geoJSON(f, {
          pane: 'routes',
          renderer: routeRenderer,
          interactive: false,
          style: { color: SENTIDO_COLORS[i % SENTIDO_COLORS.length], weight: lines.length === 1 ? 5 : 3, opacity: lines.length === 1 ? 0.55 : 0.3, dashArray: i ? '10 6' : null },
        }).addTo(routeLayer);
      }
      if (lines.length === 1 && ok.length) {
        setLegend(ok.map((f) => legendRow(f.properties.sentido - 1, `Sentido ${f.properties.sentido}: ${f.properties.name}`)));
      }
    });

  // Legend
  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => {
    const box = h('div', { class: 'map-legend' },
      h('strong', null, T.legSentidos),
      sentidoBox,
      h('strong', null, T.legClasses),
      CLASS_NAMES.slice(1).map((name, i) => h('div', null,
        h('span', { class: 'dot', style: { background: CLASS_COLORS[i + 1] } }), name)));
    L.DomEvent.disableClickPropagation(box);
    return box;
  };
  legend.addTo(map);

  // Heat layer (created lazily, off by default; toggle state is local to the panel)
  let heat = null;
  let heatOn = false;
  let heatKey = null;
  let last = null;

  function heatOptions(display) {
    return { radius: display.radius, blur: Math.round(display.radius * 0.6), max: 1, maxZoom: 0, minOpacity: 0.3 };
  }

  function updateHeat(ctx) {
    const { run: r, analysis, view, state } = ctx;
    const d = state.display;
    if (!heat) heat = L.heatLayer([], heatOptions(d));
    if (!heatOn || !map.getSize().x) return false;
    if (!map.hasLayer(heat)) heat.addTo(map);
    heat.setOptions(heatOptions(d));
    heat.setLatLngs(heatPoints(r, analysis, view.mask, d.heatMetric, d.intensity));
    return true;
  }

  const checkbox = h('input', {
    type: 'checkbox',
    onChange: (ev) => {
      heatOn = ev.target.checked;
      if (heatOn) {
        heatKey = null;
        if (last) { updateHeat(last); heatKey = 'on'; }
      } else if (heat && map.hasLayer(heat)) {
        map.removeLayer(heat);
      }
    },
  });
  const toggle = L.control({ position: 'topright' });
  toggle.onAdd = () => {
    const box = h('label', { class: 'map-heat-toggle' }, checkbox, ' ', T.mapCalor, infoBtn('mapCalor', T.mapCalor));
    L.DomEvent.disableClickPropagation(box);
    return box;
  };
  toggle.addTo(map);

  // Position marker driven by chart hover
  let pos = null;
  let pendingRow;
  let rafId = 0;
  function applyHover() {
    rafId = 0;
    const p = hoverPosition(run, pendingRow);
    if (!p) {
      if (pos && map.hasLayer(pos)) map.removeLayer(pos);
      return;
    }
    if (!pos) pos = L.circleMarker([p.lat, p.lon], { radius: 7, weight: 3, interactive: false });
    pos.setLatLng([p.lat, p.lon]);
    pos.setStyle(p.noGps
      ? { color: '#9e9e9e', fillColor: '#9e9e9e', fillOpacity: 0, dashArray: '3 3' }
      : { color: '#000000', fillColor: '#ffffff', fillOpacity: 0.9, dashArray: null });
    if (!map.hasLayer(pos)) pos.addTo(map);
    pos.bringToFront();
  }
  link.onHover((row) => {
    pendingRow = row;
    if (!rafId) rafId = requestAnimationFrame(applyHover);
  });

  let viewKey = null;

  function drawMarkers(analysis, view) {
    markerLayer.clearLayers();
    for (const m of pontoMarkers(run, analysis, view)) {
      const mk = L.circleMarker([m.lat, m.lon], {
        radius: 5 + 1.5 * m.cls, color: '#ffffff', weight: 1, fillColor: CLASS_COLORS[m.cls], fillOpacity: 0.95,
      });
      mk.bindPopup(popupNode(m));
      mk.on('click', () => link.select(m.row));
      mk.addTo(markerLayer);
    }
  }

  function render(ctx) {
    const t0 = performance.now();
    last = ctx;
    const { analysis, view, state } = ctx;
    const vk = paramsKey(state.params) + '|' + JSON.stringify(state.filters);
    if (vk !== viewKey) {
      viewKey = vk;
      drawMarkers(analysis, view);
      const u = unplacedCounts(run, analysis, view);
      note.textContent = semGpsNote(u.pontos, u.eventos);
    }
    const d = state.display;
    const hk = vk + '|' + d.heatMetric + '|' + d.radius + '|' + d.intensity;
    if (hk !== heatKey) {
      if (heatOn) {
        if (updateHeat(ctx)) heatKey = hk;
      } else {
        heatKey = hk;
      }
    }
    console.debug('map ms', (performance.now() - t0).toFixed(1));
  }

  return { render };
}
