// Mount-once uPlot panel: 3 acceleration charts + lazy "Mais canais" group (4 charts).
// The charts are built once; render(ctx) only swaps data (setData(..., false) keeps the user's zoom).
import { h } from '../dom.js';
import { T } from '../i18n.js';
import { infoBtn } from '../info.js';
import { fmtTime } from '../format.js';
import { paramsKey } from '../state.js';
import {
  SYNC_KEY, CHANNELS, chartFrame, axisSeries, thresholdLines, channelSeries, zoomWindow,
} from '../../core/series.js';

const TZ = 'America/Sao_Paulo';
const AXIS_COLOR = ['#1f4e79', '#2b7a78', '#5b3a8c'];
const TEMP_COLOR = '#8d6e63';
const GREY = '#b0b6bf';
const AXIS_H = 170;
const CHANNEL_H = 140;
const AXIS_NAMES = [T.axAX, T.axAY, T.axAZ];

function block(title, extra) {
  const container = h('div', { class: 'chart' });
  return { el: h('div', { class: 'chart-block' }, h('p', { class: 'chart-title' }, title, extra), container), container };
}

export function mountCharts(el, link, run) {
  // Canvas cannot use var(): resolve class colours once.
  const css = getComputedStyle(document.documentElement);
  const CLASS_COLORS = {
    1: css.getPropertyValue('--leve').trim() || '#f9a825',
    2: css.getPropertyValue('--moderado').trim() || '#ef6c00',
    3: css.getPropertyValue('--severo').trim() || '#c62828',
    4: css.getPropertyValue('--critico').trim() || '#6a1b9a',
  };

  let frame = null;
  let frameKey = null;
  let dataKey = null;
  let channelKey = null;
  const axisBlocks = AXIS_NAMES.map((name) => block(name));
  const lines = [[], [], []];
  const isolated = [[], [], []];
  const axisCharts = [];
  const channelCharts = [];
  let channelsBuilt = false;

  const resetBtn = h('button', { type: 'button', class: 'ctl-reset chart-reset', onClick: resetZoom }, T.resetZoom);
  const channelBody = h('div', { class: 'channel-body' });
  const details = h('details', { class: 'more-channels' }, h('summary', null, T.maisCanais), infoBtn('maisCanais', T.maisCanais), channelBody);
  el.appendChild(h('div', { class: 'panel' },
    h('div', { class: 'chart-head' },
      h('h2', null, T.secCharts, infoBtn('charts', T.secCharts)),
      h('span', null, resetBtn, infoBtn('resetZoom', T.resetZoom))),
    axisBlocks.map((b) => b.el),
    details));

  function allCharts() {
    return [...axisCharts, ...channelCharts].map((c) => c.u);
  }

  function makeChart(container, seriesDefs, height, range) {
    const opts = {
      width: container.clientWidth || 800,
      height,
      tzDate: (ts) => uPlot.tzDate(new Date(ts * 1e3), TZ),
      scales: { x: { time: true }, y: { range } },
      axes: [
        { values: (u, ticks) => ticks.map((t) => fmtTime(new Date(t * 1000))) },
        { size: 60 },
      ],
      cursor: { sync: { key: SYNC_KEY, scales: ['x', null] }, drag: { x: true, y: false } },
      legend: { show: false },
      series: [{}, ...seriesDefs],
      hooks: {
        setCursor: [(u) => {
          const i = u.cursor.idx;
          const row = i == null || !frame ? null : frame.rowOfIdx[i];
          link.hover(row == null || row < 0 ? null : row);
        }],
        draw: [],
      },
    };
    return opts;
  }

  function drawThresholds(u, k) {
    const { ctx } = u;
    const { left, top, width, height } = u.bbox;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, width, height);
    ctx.clip();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = devicePixelRatio;
    for (const { cls, value } of lines[k]) {
      const y = u.valToPos(value, 'y', true);
      if (y < top || y > top + height) continue;
      ctx.strokeStyle = CLASS_COLORS[cls] || '#888';
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function buildAxisCharts(data) {
    for (let k = 0; k < 3; k++) {
      const range = (u, min, max) => {
        const lv = lines[k].filter((l) => l.cls === 1).map((l) => l.value);
        let lo = Math.min(min ?? 0, ...lv);
        let hi = Math.max(max ?? 0, ...lv);
        const pad = (hi - lo) * 0.05 || 0.01;
        return [lo - pad, hi + pad];
      };
      const opts = makeChart(axisBlocks[k].container, [
        { label: T.foraFiltro, stroke: GREY, width: 1, show: false },
        {
          label: AXIS_NAMES[k], stroke: AXIS_COLOR[k], width: 1.25,
          points: { show: false, size: 4, fill: AXIS_COLOR[k], stroke: AXIS_COLOR[k], filter: () => isolated[k] },
        },
      ], AXIS_H, range);
      opts.hooks.draw.push((u) => drawThresholds(u, k));
      axisCharts.push({ u: new uPlot(opts, data[k], axisBlocks[k].container), height: AXIS_H, container: axisBlocks[k].container });
    }
  }

  function buildChannelCharts() {
    channelsBuilt = true;
    channelKey = null;
    for (const def of CHANNELS) {
      const b = block(`${def.label} (${def.unit})`);
      channelBody.appendChild(b.el);
      const cs = channelSeries(run, def.key, frame);
      if (!cs || !cs.series.length) {
        b.container.appendChild(h('p', { class: 'muted' }, T.semDados));
        continue;
      }
      const colors = def.key === 'temp' ? [TEMP_COLOR] : AXIS_COLOR;
      const defs = cs.series.map((s, i) => ({ label: s.name, stroke: colors[i % colors.length], width: 1.25 }));
      const opts = makeChart(b.container, defs, CHANNEL_H, undefined);
      const data = [frame.x, ...cs.series.map((s) => s.values)];
      channelCharts.push({ u: new uPlot(opts, data, b.container), height: CHANNEL_H, container: b.container, key: def.key });
    }
    channelKey = frameKey;
  }

  function refreshChannels() {
    if (!channelsBuilt || channelKey === frameKey) return;
    for (const c of channelCharts) {
      const cs = channelSeries(run, c.key, frame);
      c.u.setData([frame.x, ...cs.series.map((s) => s.values)], false);
    }
    channelKey = frameKey;
  }

  function resetZoom() {
    if (!frame) return;
    const min = frame.x[0];
    const max = frame.x[frame.x.length - 1];
    for (const u of allCharts()) u.setScale('x', { min, max });
  }

  function focusRow(row) {
    if (!frame || row == null || row < 0 || row >= frame.idxOfRow.length) return;
    const x = frame.x[frame.idxOfRow[row]];
    const win = zoomWindow(x);
    const charts = allCharts();
    for (const u of charts) u.setScale('x', win);
    requestAnimationFrame(() => {
      for (const u of charts) {
        u.setCursor({ left: u.valToPos(x, 'x'), top: u.bbox.height / devicePixelRatio / 2 });
      }
    });
  }

  link.onSelect(focusRow);

  details.addEventListener('toggle', () => {
    if (!details.open || !frame) return;
    if (!channelsBuilt) buildChannelCharts();
    else for (const c of channelCharts) c.u.setSize({ width: c.container.clientWidth || 800, height: c.height });
  });

  new ResizeObserver(() => {
    for (const c of [...axisCharts, ...channelCharts]) {
      const w = c.container.clientWidth;
      if (w > 0) c.u.setSize({ width: w, height: c.height });
    }
  }).observe(el);

  function render(ctx) {
    const t0 = performance.now();
    const { analysis, view, state } = ctx;
    const mode = state.display.valueMode;
    if (frameKey !== state.params.maxJumpMs || !frame) {
      frame = chartFrame(run, state.params.maxJumpMs);
      frameKey = state.params.maxJumpMs;
      dataKey = null;
    }
    const key = paramsKey(state.params) + '|' + JSON.stringify(state.filters) + '|' + mode;
    if (key !== dataKey) {
      dataKey = key;
      const data = [];
      for (let k = 0; k < 3; k++) {
        const s = axisSeries(run, analysis, view.mask, mode, k, frame);
        lines[k] = thresholdLines(analysis, mode, k);
        isolated[k] = s.isolated;
        data.push([frame.x, s.all, s.masked]);
      }
      if (!axisCharts.length) buildAxisCharts(data);
      for (let k = 0; k < 3; k++) {
        const u = axisCharts[k].u;
        u.setData(data[k], false);
        u.setSeries(1, { show: view.isFiltered });
      }
    }
    refreshChannels();
    console.debug('charts ms', (performance.now() - t0).toFixed(1));
  }

  return { render };
}
