/* ============================================================
 * charts.js — 纯 SVG 可视化（无外部依赖）
 * 折线图 / 分组柱状图 / 雷达图 / 分布直方图
 * ============================================================ */
const Charts = (function () {
  const NS = 'http://www.w3.org/2000/svg';
  const COLORS = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1',
    '#76b7b2', '#edc948', '#8c6bb1', '#d17a22', '#57a0a8'];

  function svgRoot(w, h) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    s.setAttribute('width', '100%');
    s.style.display = 'block';
    return s;
  }
  function E(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function T(x, y, str, attrs) {
    const t = E('text', Object.assign({ x: x, y: y }, attrs || {}));
    t.textContent = str;
    return t;
  }
  function tip(parent, str) {
    const t = E('title');
    t.textContent = str;
    parent.appendChild(t);
  }
  function colorA(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function niceMax(v) {
    if (v <= 0) return 10;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const d = v / p;
    const m = d <= 1 ? 1 : d <= 2 ? 2 : d <= 2.5 ? 2.5 : d <= 5 ? 5 : 10;
    return m * p;
  }
  function num(v) { return Math.round(v * 10) / 10; }
  function emptyBox(el) { el.innerHTML = '<div class="chart-empty">暂无数据</div>'; }

  function legend(svg, items, W, y) {
    const pad = 10, gap = 16, sq = 10;
    let x = pad, yy = y;
    items.forEach(it => {
      const sw = 16 + it.name.length * 13;
      if (x + sw > W - pad) { x = pad; yy += 18; }
      svg.appendChild(E('rect', { x: x, y: yy - 8, width: sq, height: sq, rx: 2, fill: it.color }));
      svg.appendChild(T(x + sq + 5, yy + 1, it.name, { 'class': 'legend-text' }));
      x += sw + gap;
    });
  }

  /* ---------- 折线图 ----------
   * opts: { labels, series:[{name,color,values}], yMin, yMax, invert, legend }
   */
  function lineChart(el, opts) {
    el.innerHTML = '';
    const labels = opts.labels || [];
    const series = (opts.series || []).filter(s => s.values.some(v => v != null && v !== ''));
    if (!labels.length || !series.length) { emptyBox(el); return; }

    const W = el.clientWidth || 760, H = 320;
    const M = { t: opts.legend === false ? 16 : 38, r: 14, b: 36, l: 48 };
    const pw = W - M.l - M.r, ph = H - M.t - M.b;

    let lo = Infinity, hi = -Infinity;
    series.forEach(s => s.values.forEach(v => { if (v != null) { if (v < lo) lo = v; if (v > hi) hi = v; } }));
    if (!isFinite(lo)) { emptyBox(el); return; }
    if (opts.yMin != null) lo = opts.yMin;
    if (opts.yMax != null) hi = opts.yMax;
    if (lo === hi) { lo -= 1; hi += 1; }

    const y = v => opts.invert ? M.t + ph * ((v - lo) / (hi - lo)) : M.t + ph - ((v - lo) / (hi - lo)) * ph;
    const x = i => labels.length === 1 ? M.l + pw / 2 : M.l + i * (pw / (labels.length - 1));

    const svg = svgRoot(W, H);
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = lo + (hi - lo) * i / steps, yy = y(v);
      svg.appendChild(E('line', { x1: M.l, y1: yy, x2: M.l + pw, y2: yy, 'class': 'grid' }));
      svg.appendChild(T(M.l - 6, yy + 4, num(v), { 'class': 'axis-label', 'text-anchor': 'end' }));
    }
    svg.appendChild(E('line', { x1: M.l, y1: M.t, x2: M.l, y2: M.t + ph, stroke: '#d5d9e5' }));
    svg.appendChild(E('line', { x1: M.l, y1: M.t + ph, x2: M.l + pw, y2: M.t + ph, stroke: '#d5d9e5' }));

    const stepX = Math.ceil(labels.length / 8);
    labels.forEach((lb, i) => {
      if (i % stepX) return;
      svg.appendChild(T(x(i), H - M.b + 16, lb, { 'class': 'axis-label', 'text-anchor': 'middle' }));
    });

    series.forEach((s, si) => {
      const col = s.color || COLORS[si % COLORS.length];
      const pts = s.values.map((v, i) => v == null ? null : [x(i), y(Number(v))]);
      const d = [];
      let prevNull = true;
      pts.forEach(p => {
        if (!p) { prevNull = true; return; }
        d.push((prevNull ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1));
        prevNull = false;
      });
      svg.appendChild(E('path', { d: d.join(' '), fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      pts.forEach((p, i) => {
        if (!p) return;
        const c = E('circle', { cx: p[0], cy: p[1], r: 3.4, fill: '#fff', stroke: col, 'stroke-width': 2 });
        tip(c, s.name + ' · ' + (labels[i] || '') + '：' + s.values[i] + '分');
        svg.appendChild(c);
      });
    });

    if (series.length > 1) legend(svg, series.map((s, si) => ({ name: s.name, color: s.color || COLORS[si % COLORS.length] })), W, 18);
    el.appendChild(svg);
  }

  /* ---------- 分组柱状图 ----------
   * opts: { labels, series:[{name,color,values}], yMax, legend }
   */
  function barChart(el, opts) {
    el.innerHTML = '';
    const labels = opts.labels || [];
    const series = (opts.series || []).filter(s => s.values.some(v => v != null));
    if (!labels.length || !series.length) { emptyBox(el); return; }

    const W = el.clientWidth || 760, H = 300;
    const M = { t: opts.legend === false ? 16 : 38, r: 12, b: 40, l: 48 };
    const pw = W - M.l - M.r, ph = H - M.t - M.b;

    let maxV = 0;
    series.forEach(s => s.values.forEach(v => { if (v != null && v > maxV) maxV = v; }));
    maxV = opts.yMax != null ? opts.yMax : niceMax(maxV * 1.08);
    if (maxV <= 0) maxV = 10;
    const y = v => M.t + ph - (v / maxV) * ph;

    const svg = svgRoot(W, H);
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = maxV * i / steps, yy = y(v);
      svg.appendChild(E('line', { x1: M.l, y1: yy, x2: M.l + pw, y2: yy, 'class': 'grid' }));
      svg.appendChild(T(M.l - 6, yy + 4, num(v), { 'class': 'axis-label', 'text-anchor': 'end' }));
    }

    const groupW = pw / labels.length, slotW = groupW / series.length;
    const barW = Math.min(slotW * 0.72, 36);
    const totalBars = labels.length * series.length;

    series.forEach((s, si) => {
      const col = s.color || COLORS[si % COLORS.length];
      labels.forEach((lb, i) => {
        const v = s.values[i];
        if (v == null) return;
        const bx = M.l + i * groupW + si * slotW + (slotW - barW) / 2;
        const bh = Math.max(1, M.t + ph - y(v));
        svg.appendChild(E('rect', { x: bx, y: y(v), width: barW, height: bh, rx: Math.min(3, barW / 4), fill: col }));
        if (totalBars <= 36) svg.appendChild(T(bx + barW / 2, y(v) - 6, num(v), { 'class': 'axis-label', 'text-anchor': 'middle' }));
      });
    });

    labels.forEach((lb, i) => {
      svg.appendChild(E('line', { x1: M.l + i * groupW + groupW / 2, y1: M.t + ph, x2: M.l + i * groupW + groupW / 2, y2: M.t + ph + 4, stroke: '#d5d9e5' }));
      svg.appendChild(T(M.l + i * groupW + groupW / 2, H - M.b + 16, lb, { 'class': 'axis-label', 'text-anchor': 'middle' }));
    });

    if (series.length > 1) legend(svg, series.map((s, si) => ({ name: s.name, color: s.color || COLORS[si % COLORS.length] })), W, 18);
    el.appendChild(svg);
  }

  /* ---------- 分布直方图 ----------
   * opts: { items:[{label,count}], color }
   */
  function histogram(el, opts) {
    el.innerHTML = '';
    const items = opts.items || [];
    if (!items.length) { emptyBox(el); return; }
    const W = el.clientWidth || 760, H = 260;
    const M = { t: 16, r: 12, b: 42, l: 36 };
    const pw = W - M.l - M.r, ph = H - M.t - M.b;
    const maxC = Math.max.apply(null, items.map(i => i.count).concat([1]));

    const svg = svgRoot(W, H);
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const c = maxC * i / steps, yy = M.t + ph - (c / maxC) * ph;
      svg.appendChild(E('line', { x1: M.l, y1: yy, x2: M.l + pw, y2: yy, 'class': 'grid' }));
      svg.appendChild(T(M.l - 5, yy + 4, c, { 'class': 'axis-label', 'text-anchor': 'end' }));
    }
    const groupW = pw / items.length, barW = Math.min(groupW * 0.6, 46);
    items.forEach((it, i) => {
      const bx = M.l + i * groupW + (groupW - barW) / 2;
      const bh = Math.max(1, (it.count / maxC) * ph);
      svg.appendChild(E('rect', { x: bx, y: M.t + ph - bh, width: barW, height: bh, rx: 3, fill: opts.color || COLORS[0] }));
      svg.appendChild(T(bx + barW / 2, M.t + ph - bh - 6, it.count, { 'class': 'axis-label', 'text-anchor': 'middle' }));
      svg.appendChild(T(M.l + i * groupW + groupW / 2, H - M.b + 16, it.label, { 'class': 'axis-label', 'text-anchor': 'middle' }));
    });
    el.appendChild(svg);
  }

  /* ---------- 雷达图 ----------
   * opts: { labels, series:[{name,color,values,maxValues}], max }
   */
  function radarChart(el, opts) {
    el.innerHTML = '';
    const labels = opts.labels || [], series = opts.series || [];
    if (!labels.length || !series.length) { emptyBox(el); return; }

    const W = el.clientWidth || 560, H = 380;
    const cx = W / 2, cy = H / 2 - 8;
    const R = Math.min(W, H) / 2 - 60;
    const N = labels.length;
    const ang = i => -Math.PI / 2 + i * 2 * Math.PI / N;
    const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];

    const svg = svgRoot(W, H);
    for (let k = 1; k <= 4; k++) {
      const rr = R * k / 4, d = [];
      for (let i = 0; i < N; i++) { const p = pt(i, rr); d.push((i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)); }
      svg.appendChild(E('path', { d: d.join(' ') + 'Z', fill: 'none', stroke: '#e8ebf2' }));
    }
    for (let i = 0; i < N; i++) {
      const p = pt(i, R);
      svg.appendChild(E('line', { x1: cx, y1: cy, x2: p[0], y2: p[1], stroke: '#e8ebf2' }));
    }
    labels.forEach((lb, i) => {
      const p = pt(i, R + 18);
      const cos = Math.cos(ang(i));
      const anchor = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
      const ty = Math.abs(Math.sin(ang(i))) < 0.15 ? (cos < 0 ? p[1] - 5 : p[1] + 5) : p[1] + 4;
      svg.appendChild(T(p[0], ty, lb, { 'class': 'axis-label', 'text-anchor': anchor }));
    });

    series.forEach((s, si) => {
      const col = s.color || COLORS[si % COLORS.length];
      const d = [], pts = [];
      labels.forEach((lb, i) => {
        const maxV = (s.maxValues && s.maxValues[i]) ? s.maxValues[i] : (opts.max || 100);
        const v = Math.max(0, Math.min(maxV, s.values[i] || 0));
        const p = pt(i, R * (v / maxV));
        pts.push(p);
        d.push((i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1));
      });
      svg.appendChild(E('path', { d: d.join(' ') + 'Z', fill: colorA(col, 0.16), stroke: col, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
      pts.forEach(p => {
        const c = E('circle', { cx: p[0], cy: p[1], r: 3, fill: col });
        tip(c, s.name + ' · ' + labels[pts.indexOf(p)] + '：' + (s.values[pts.indexOf(p)] || 0) + '分');
        svg.appendChild(c);
      });
    });

    legend(svg, series.map((s, si) => ({ name: s.name, color: s.color || COLORS[si % COLORS.length] })), W, H - 14);
    el.appendChild(svg);
  }

  return { COLORS, lineChart, barChart, histogram, radarChart };
})();
