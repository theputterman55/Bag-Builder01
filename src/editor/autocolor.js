// Auto color: look at the art behind a logo and the logo itself, then make a few colorways
// that stand out from the background and still look good. Plain color math, runs on the phone.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function toHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}
function fromHsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
function lum([r, g, b]) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a, b) {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const css = (c) => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';

// Average color (and how busy it is) of the art under a rectangle, from a small copy of the art.
export function sampleBackground(canvas, cx, cy, w, h) {
  const n = canvas.width;
  const x0 = clamp(Math.floor((cx - w / 2) * n), 0, n - 1);
  const y0 = clamp(Math.floor((cy - h / 2) * n), 0, n - 1);
  const x1 = clamp(Math.ceil((cx + w / 2) * n), x0 + 1, n);
  const y1 = clamp(Math.ceil((cy + h / 2) * n), y0 + 1, n);
  const d = canvas.getContext('2d').getImageData(x0, y0, x1 - x0, y1 - y0).data;
  let r = 0, g = 0, b = 0, k = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i]; g += d[i + 1]; b += d[i + 2]; k++;
  }
  const avg = [Math.round(r / k), Math.round(g / k), Math.round(b / k)];
  let dev = 0;
  for (let i = 0; i < d.length; i += 4) dev += Math.abs(lum([d[i], d[i + 1], d[i + 2]]) - lum(avg));
  return { avg, busy: dev / k > 0.12 };
}

// What kind of logo is this: one color, two colors (fill + border), or full color.
export function analyze(source) {
  const sw = source.naturalWidth || source.width;
  const sh = source.naturalHeight || source.height;
  const k = Math.min(1, 72 / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * k));
  c.height = Math.max(1, Math.round(sh * k));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(source, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const px = [];
  const bins = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    px.push([d[i], d[i + 1], d[i + 2]]);
    const key = (d[i] >> 5) * 64 + (d[i + 1] >> 5) * 8 + (d[i + 2] >> 5);
    bins.set(key, (bins.get(key) || 0) + 1);
  }
  if (!px.length) return { kind: 'single', cents: [[255, 255, 255]] };
  const big = [...bins.values()].filter((v) => v / px.length > 0.04).length;
  // k-means with two centres, seeded by the darkest and lightest pixel
  let sorted = px.slice().sort((a, b) => lum(a) - lum(b));
  let cents = [sorted[0], sorted[sorted.length - 1]];
  const area = [0, 0];
  for (let it = 0; it < 8; it++) {
    const sum = [[0, 0, 0, 0], [0, 0, 0, 0]];
    for (const p of px) {
      const a = dist(p, cents[0]) <= dist(p, cents[1]) ? 0 : 1;
      sum[a][0] += p[0]; sum[a][1] += p[1]; sum[a][2] += p[2]; sum[a][3]++;
    }
    for (let a = 0; a < 2; a++) {
      area[a] = sum[a][3];
      if (sum[a][3]) cents[a] = [sum[a][0] / sum[a][3], sum[a][1] / sum[a][3], sum[a][2] / sum[a][3]];
    }
  }
  const apart = Math.sqrt(dist(cents[0], cents[1]));
  if (big > 4) return { kind: 'full', cents };
  if (apart < 60 || Math.min(...area) / px.length < 0.05) return { kind: 'single', cents: [cents[area[0] >= area[1] ? 0 : 1]] };
  // bigger area is the fill, smaller is the border
  return { kind: 'two', cents: area[0] >= area[1] ? [cents[0], cents[1]] : [cents[1], cents[0]] };
}
function dist(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

// Move a color's lightness until it clears a contrast ratio against the background.
function fit(hue, sat, bg, min) {
  const bl = lum(bg);
  const goLight = bl < 0.3; // dark art: go light; light art: go dark
  let best = null;
  for (let l = goLight ? 0.55 : 0.45; goLight ? l <= 0.97 : l >= 0.03; l += goLight ? 0.03 : -0.03) {
    const c = fromHsl(hue, sat, l);
    best = c;
    if (contrast(c, bg) >= min) return c;
  }
  return best;
}

// Up to n colorways: { fill, outline } as [r,g,b]. Colors stand out from the background first.
export function palettes(bg, info, n = 5) {
  const [h, s] = toHsl(bg);
  const sat = clamp(Math.max(s, 0.55), 0.55, 0.95);
  const min = info.kind === 'full' ? 3 : 4.5;
  const dark = [14, 14, 18];
  const light = [250, 250, 250];
  const cands = [
    { name: 'complement', fill: fit(h + 180, sat, bg, min) },
    { name: 'split a', fill: fit(h + 150, sat, bg, min) },
    { name: 'split b', fill: fit(h + 210, sat, bg, min) },
    { name: 'triad a', fill: fit(h + 120, sat, bg, min) },
    { name: 'triad b', fill: fit(h + 240, sat, bg, min) },
    { name: 'gold', fill: fit(44, 0.9, bg, min) },
    { name: 'white', fill: lum(bg) < 0.3 ? light : dark },
    { name: 'neutral', fill: lum(bg) < 0.3 ? [255, 236, 190] : [30, 40, 70] }
  ];
  const list = [];
  for (const c of cands) {
    if (contrast(c.fill, bg) < 3) continue;
    // border colour: black or white, whichever clears the fill, or the complement of the fill
    const [fh, fs] = toHsl(c.fill);
    const alt = fit(fh + 180, clamp(fs, 0.5, 0.9), c.fill, 3);
    const out = [dark, light, alt].map((o) => ({ o, k: contrast(o, c.fill) })).sort((a, b) => b.k - a.k)[0].o;
    list.push({ fill: c.fill, outline: out, hue: fh });
  }
  // pick colorways that look different from each other
  const pick = [];
  for (const c of list) {
    if (pick.every((p) => Math.sqrt(dist(p.fill, c.fill)) > 70)) pick.push(c);
    if (pick.length >= n) break;
  }
  for (const c of list) {
    if (pick.length >= n) break;
    if (!pick.includes(c)) pick.push(c);
  }
  return pick;
}

// Paint the logo again in a colorway. Keeps the shape and the soft edges.
export function recolor(source, info, pal, busy) {
  const sw = source.naturalWidth || source.width;
  const sh = source.naturalHeight || source.height;
  const pad = info.kind === 'full' ? Math.round(Math.max(sw, sh) * 0.04) : 0;
  const c = document.createElement('canvas');
  c.width = sw + pad * 2;
  c.height = sh + pad * 2;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (info.kind === 'full') {
    // keep the logo as it is and put a border colour around it
    const o = document.createElement('canvas');
    o.width = c.width; o.height = c.height;
    const og = o.getContext('2d');
    for (let a = 0; a < 16; a++) {
      og.drawImage(source, pad + Math.cos((a / 16) * Math.PI * 2) * pad, pad + Math.sin((a / 16) * Math.PI * 2) * pad, sw, sh);
    }
    og.globalCompositeOperation = 'source-in';
    og.fillStyle = css(pal.fill);
    og.fillRect(0, 0, o.width, o.height);
    g.drawImage(o, 0, 0);
    g.drawImage(source, pad, pad, sw, sh);
    return c;
  }
  g.drawImage(source, 0, 0, sw, sh);
  const img = g.getImageData(0, 0, sw, sh);
  const d = img.data;
  const two = info.kind === 'two';
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let col = pal.fill;
    if (two) {
      const p = [d[i], d[i + 1], d[i + 2]];
      col = dist(p, info.cents[0]) <= dist(p, info.cents[1]) ? pal.fill : pal.outline;
    }
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2];
  }
  g.putImageData(img, 0, 0);
  if (busy && !two) {
    // busy art behind a one colour logo: add a thin border so it stays readable
    const r = Math.max(2, Math.round(Math.max(sw, sh) * 0.025));
    const o = document.createElement('canvas');
    o.width = sw + r * 2; o.height = sh + r * 2;
    const og = o.getContext('2d');
    for (let a = 0; a < 16; a++) og.drawImage(c, r + Math.cos((a / 16) * Math.PI * 2) * r, r + Math.sin((a / 16) * Math.PI * 2) * r);
    og.globalCompositeOperation = 'source-in';
    og.fillStyle = css(pal.outline);
    og.fillRect(0, 0, o.width, o.height);
    og.globalCompositeOperation = 'source-over';
    og.drawImage(c, r, r);
    return o;
  }
  return c;
}
