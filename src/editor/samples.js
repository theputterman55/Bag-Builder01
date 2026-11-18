// Built-in test images and fabric looks, drawn in code so there are no files to ship.

const mk = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const rng = (seed) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

export function designSample(label, c1, c2) {
  const c = mk(1024, 1024);
  const g = c.getContext('2d');
  g.fillStyle = c1;
  g.fillRect(0, 0, 1024, 1024);
  g.save();
  g.translate(512, 512);
  g.rotate(-Math.PI / 4);
  for (let i = -12; i < 12; i++) {
    g.fillStyle = i % 2 ? c2 : 'rgba(255,255,255,.08)';
    g.fillRect(-900, i * 90, 1800, 45);
  }
  g.restore();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(512, 512, 300, 0, 7);
  g.fill();
  g.fillStyle = c1;
  g.beginPath();
  g.arc(512, 512, 270, 0, 7);
  g.fill();
  g.fillStyle = '#fff';
  g.font = 'bold 150px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, 512, 500);
  g.font = 'bold 80px sans-serif';
  g.fillText('↑ UP', 512, 650);
  return c;
}

export function fabricSample(kind, base) {
  const c = mk(1024, 1024);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 1024, 1024);
  const im = g.getImageData(0, 0, 1024, 1024);
  const d = im.data;
  const r = rng(7);
  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 1024; x++) {
      const i = (y * 1024 + x) * 4;
      const k =
        kind === 'carpet'
          ? 0.82 + 0.18 * (((x >> 2) + (y >> 2)) % 2 ? 1 : 0.55) * (0.7 + 0.3 * r())
          : 0.88 + 0.24 * r();
      d[i] *= k;
      d[i + 1] *= k;
      d[i + 2] *= k;
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

// the fabrics offered on the Fabric step: name, weave look, base color
export const FABRICS = [
  { key: 'denim', label: 'Denim', kind: 'carpet', base: '#6f7f94' },
  { key: 'sand', label: 'Sand', kind: 'suede', base: '#9b8f78' },
  { key: 'blueCarpet', label: 'Blue', kind: 'carpet', base: '#1c3f78' },
  { key: 'gray', label: 'Gray', kind: 'carpet', base: '#8d9097' },
  { key: 'redCarpet', label: 'Red', kind: 'carpet', base: '#a3262a' },
  { key: 'suede', label: 'Suede', kind: 'suede', base: '#b08a5a' },
  { key: 'gold', label: 'Gold', kind: 'carpet', base: '#e0a21e' },
  { key: 'natural', label: 'Natural', kind: 'suede', base: '#e6dfd0' },
  { key: 'black', label: 'Black', kind: 'carpet', base: '#2a2a2e' }
];

export const SAMPLES = {
  design: { label: 'Test design', make: (side) => designSample(side === 'bottom' ? 'BOTTOM' : 'TOP', side === 'bottom' ? '#5c1f12' : '#12335c', side === 'bottom' ? '#3fb6a8' : '#f2b544') },
  ...Object.fromEntries(FABRICS.map((f) => [f.key, { label: f.label, make: () => fabricSample(f.kind, f.base) }]))
};

// fine weave used as a bump map so fabric catches light
export function weaveBump() {
  const c = mk(128, 128);
  const g = c.getContext('2d');
  const im = g.getImageData(0, 0, 128, 128);
  const r = rng(11);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const v = 120 + 54 * (((x >> 1) + (y >> 1)) % 2) + 40 * r();
      const i = (y * 128 + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}
