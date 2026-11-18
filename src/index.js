import './style.css';
import { makeShape } from './core/shape.js';
import { Placement } from './editor/placement.js';
import { Editor2D } from './editor/Editor2D.js';
import { BagPreview } from './preview/BagPreview.js';
import { SAMPLES, FABRICS } from './editor/samples.js';

// createBagBuilder(container, options)
//   options.safeIn      safe zone size in inches (default 6)
//   options.cutIn       flat fabric square in inches (default 7.5)
//   options.shape       any shape overrides (see core/shape.js DEFAULTS)
//   options.start       { top: 'denim', bottom: 'denim' }  fabric names to start with
//   options.onChange    called with the side name whenever an image changes
//   options.onSave      called with { top: Blob, bottom: Blob, series } when Save design is pressed
//   options.title       name shown at the top (default "Bag builder")
//   options.series      [{ group, mode: 'carpet'|'double', items: [{ name, speed }] }]  the series the maker offers
//                       carpet = one printed side + a slow side color, double = an image on each side
// The page is built for a phone: 3D bag on top, flat fabric below, steps, one big action.
// Give the container a height, or it fills the screen (set --bb-h to change that).
// Returns { exportPNG(side, dpi), setImage(side, urlOrFile), destroy() }.

const IC = {
  both: '<rect x="4" y="3" width="16" height="8" rx="2"/><rect x="4" y="13" width="16" height="8" rx="2"/>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-8 9"/>',
  flip: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  reset: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
  file: '<path d="M6 3h8l5 5v13H6zM14 3v5h5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};
const ic = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

export function createBagBuilder(container, options = {}) {
  const shape = makeShape({ ...(options.shape || {}), ...(options.safeIn ? { safeIn: options.safeIn } : {}), ...(options.cutIn ? { cutIn: options.cutIn } : {}) });
  const P = shape.params;
  const start = { top: 'denim', bottom: 'denim', ...(options.start || {}) };
  const fabricLabel = (k) => (SAMPLES[k] ? SAMPLES[k].label : '');

  container.classList.add('bb-root');
  container.innerHTML = `
  <div class="bb-app" data-view="both">
    <header class="bb-bar">
      <div class="bb-title">${options.title || 'Bag builder'}</div>
      <button type="button" class="bb-ibtn bb-reset" aria-label="Reset this side">${ic('reset')}</button>
    </header>
    <div class="bb-views">
      <div class="bb-rail" role="group" aria-label="Views">
        <button type="button" class="bb-rb on" data-view="both" aria-label="Both views">${ic('both')}</button>
        <button type="button" class="bb-rb" data-view="3d" aria-label="3D bag only">${ic('cube')}</button>
        <button type="button" class="bb-rb" data-view="flat" aria-label="Flat art only">${ic('image')}</button>
      </div>
      <button type="button" class="bb-chip bb-flipchip">${ic('flip', 20)}<span>Flip · Top</span></button>
      <section class="bb-stage bb-s3d">
        <div class="bb-3d"></div>
        <button type="button" class="bb-pip" aria-label="Edit the flat art"><canvas width="260" height="260"></canvas><span>Flat art · tap to edit</span></button>
      </section>
      <section class="bb-stage bb-sflat">
        <canvas class="bb-flat" aria-label="Flat fabric editor"></canvas>
        <div class="bb-sidelbl">Top</div>
        <button type="button" class="bb-upbig">${ic('image', 24)}<span>Upload image</span></button>
        <div class="bb-hint" role="status"></div>
      </section>
    </div>
    <nav class="bb-steps" role="tablist"></nav>
    <div class="bb-panel">
      <div class="bb-pane bb-series" data-pane="series"></div>
      <div class="bb-pane" data-pane="image">
        <div class="bb-ttl"><span class="bb-ttl-g"></span><span><b class="bb-ttl-n"></b><i class="bb-ttl-s"></i></span></div>
        <button type="button" class="bb-wide bb-open">${ic('image', 22)}<span>Upload image</span></button>
        <div class="bb-slots">
          <button type="button" class="bb-slot" data-side="top"><canvas width="88" height="88"></canvas><span><b>Image 1</b><small>Top · Add image</small></span></button>
          <button type="button" class="bb-slot" data-side="bottom"><canvas width="88" height="88"></canvas><span><b>Image 2</b><small>Bottom · Add image</small></span></button>
        </div>
        <div class="bb-note bb-imgnote"></div>
      </div>
      <div class="bb-pane" data-pane="adjust">
        <label class="bb-row"><span>Zoom</span><input type="range" class="bb-zoom" min="0.3" max="6" step="0.01"></label>
        <label class="bb-row"><span>Turn</span><input type="range" class="bb-rot" min="-180" max="180" step="1"></label>
        <div class="bb-two"><button type="button" class="bb-btn bb-mirror">Flip image</button><button type="button" class="bb-btn bb-fill">Fill to bleed</button><button type="button" class="bb-btn bb-replace">Replace</button></div>
      </div>
      <div class="bb-pane" data-pane="slow">
        <div class="bb-fabhead"><b>Slow side color</b><span>Carpet for the bottom</span></div>
        <div class="bb-fabrics"></div>
      </div>
      <div class="bb-pane" data-pane="review">
        <div class="bb-sum"><span>Series</span><b class="bb-sum-series"></b></div>
        <div class="bb-sum"><span>Top side</span><b class="bb-sum-top"></b></div>
        <div class="bb-sum"><span>Bottom side</span><b class="bb-sum-bottom"></b></div>
      </div>
    </div>
    <footer class="bb-bottom">
      <div class="bb-bt"><div class="bb-bn">My design</div><div class="bb-bs"></div></div>
      <button type="button" class="bb-save">Save design ${ic('arrow', 20)}</button>
    </footer>
    <div class="bb-sheet" hidden>
      <div class="bb-back"></div>
      <div class="bb-card" role="dialog" aria-label="Upload your image">
        <div class="bb-grab"></div>
        <div class="bb-sh"><div>Upload your image</div><button type="button" class="bb-ibtn bb-close" aria-label="Close">${ic('x')}</button></div>
        <label class="bb-opt">${ic('image', 26)}<span><b>Photo library</b><small>Pick from your phone gallery</small></span><input type="file" accept="image/*" class="bb-file"></label>
        <label class="bb-opt">${ic('cam', 26)}<span><b>Take photo</b><small>Use the camera</small></span><input type="file" accept="image/*" capture="environment" class="bb-file"></label>
        <label class="bb-opt">${ic('file', 26)}<span><b>Files</b><small>Downloads and cloud folders</small></span><input type="file" accept="image/png,image/jpeg,image/webp,image/*" class="bb-file"></label>
        <div class="bb-samples"><span>Samples</span><button type="button" class="bb-btn bb-sample">Test design</button></div>
      </div>
    </div>
  </div>`;

  const $ = (sel) => container.querySelector(sel);
  const $$ = (sel) => [...container.querySelectorAll(sel)];
  const app = $('.bb-app');
  const placements = { top: new Placement(), bottom: new Placement() };
  const has = { top: false, bottom: false };
  const names = { top: '', bottom: '' };
  const fab = { top: fabricLabel(start.top), bottom: fabricLabel(start.bottom) };
  let side = 'top';
  let preview = null;
  const SERIES = options.series || [
    { group: 'Carpet', mode: 'carpet', items: [{ name: "Power Draggin'", speed: '6/9' }, { name: 'XTRA', speed: '5/8' }, { name: "Double Draggin' X", speed: '5/10' }] },
    { group: 'Double Fast', mode: 'double', items: [{ name: 'WGCB', speed: '8/10' }] }
  ];
  const sel = { g: 0, i: 0 };
  const cur = () => ({ group: SERIES[sel.g].group, mode: SERIES[sel.g].mode, ...SERIES[sel.g].items[sel.i] });
  const STEP_NAMES = { series: 'Series', image: 'Image', adjust: 'Adjust', slow: 'Slow side', review: 'Review' };
  const stepIds = () => (cur().mode === 'carpet' ? ['series', 'image', 'adjust', 'slow', 'review'] : ['series', 'image', 'adjust', 'review']);
  let step = 'series';

  const pip = $('.bb-pip canvas');
  const pctx = pip.getContext('2d');
  const drawPip = () => {
    pctx.clearRect(0, 0, pip.width, pip.height);
    pctx.drawImage(editor.canvas, 0, 0, pip.width, pip.height);
  };

  const editor = new Editor2D($('.bb-flat'), shape, {
    onChange: (flat) => {
      if (preview) preview.refresh(side);
      drawPip();
      syncSliders();
      if (options.onChange) options.onChange(side, flat);
    }
  });

  // each side keeps its own flat fabric canvas so the 3D bag shows both
  const mkFlat = () => {
    const c = document.createElement('canvas');
    c.width = c.height = editor.size;
    return c;
  };
  const flats = { top: mkFlat(), bottom: mkFlat() };

  const msgEl = $('.bb-hint');
  let msg = '';
  const setMsg = (t) => {
    msg = t;
    ui();
  };

  // ----- one place that updates every label and button from the state -----
  const other = (n) => (n === 'top' ? 'bottom' : 'top');
  const cap = (n) => (n === 'top' ? 'Top' : 'Bottom');
  const shorter = (t) => (t.length > 9 ? t.slice(0, 8) + '…' : t);
  const short = (t) => (t.length > 13 ? t.slice(0, 11) + '…' : t);
  const ready = () => (cur().mode === 'carpet' ? has.top : has.top && has.bottom);
  function drawSlot(slot, n) {
    const c = slot.querySelector('canvas');
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    if (has[n]) g.drawImage(flats[n], 0, 0, c.width, c.height);
    else {
      g.strokeStyle = '#38bdf8';
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(44, 28); g.lineTo(44, 60); g.moveTo(28, 44); g.lineTo(60, 44);
      g.stroke();
    }
  }
  function ui() {
    const c = cur();
    const imgOn = has[side];
    $('.bb-flipchip span').textContent = 'Flip · ' + cap(side);
    $('.bb-sidelbl').textContent = cap(side);
    $('.bb-upbig').hidden = imgOn || (c.mode === 'carpet' && side === 'bottom');
    $('.bb-replace').hidden = !imgOn;
    msgEl.textContent = msg || (imgOn ? 'Drag to move · pinch to zoom · two fingers to turn' : '');
    const subs = {
      series: shorter(c.name),
      image: c.mode === 'carpet' ? (has.top ? shorter(names.top) : 'No image') : (has.top ? 1 : 0) + (has.bottom ? 1 : 0) + ' of 2 added',
      adjust: 'Move, zoom',
      slow: fab.bottom || 'Custom',
      review: ready() ? 'Ready' : 'Not ready'
    };
    $$('.bb-step').forEach((b) => (b.querySelector('span').textContent = subs[b.dataset.step]));
    $('.bb-ttl-g').textContent = c.group;
    $('.bb-ttl-n').textContent = c.name;
    $('.bb-ttl-s').textContent = c.speed;
    const dbl = c.mode === 'double';
    $('.bb-open').hidden = dbl;
    $('.bb-slots').hidden = !dbl;
    $('.bb-open span').textContent = has.top ? 'Replace image' : 'Upload image';
    $$('.bb-slot').forEach((sl) => {
      const n = sl.dataset.side;
      sl.classList.toggle('on', side === n);
      sl.querySelector('small').textContent = cap(n) + ' · ' + (has[n] ? short(names[n]) : 'Add image');
      drawSlot(sl, n);
    });
    $('.bb-imgnote').textContent = dbl
      ? (ready() ? 'Tap a slot to switch sides.' : 'Add both images, top and bottom.')
      : 'Pick a photo from your gallery or take one. It shows on the flat art and on the bag.';
    $('.bb-sum-series').textContent = c.group + ' · ' + c.name + ' · ' + c.speed;
    const label = (n) => (has[n] ? names[n] : fab[n] || 'Fabric');
    $('.bb-sum-top').textContent = label('top');
    $('.bb-sum-bottom').textContent = label('bottom');
    $('.bb-bs').textContent = 'Top: ' + short(label('top')) + ' · Bottom: ' + short(label('bottom'));
    $('.bb-save').disabled = !ready();
    $$('.bb-fab').forEach((b) => b.classList.toggle('on', !has.bottom && fab.bottom === b.dataset.label));
  }

  function render(name) {
    placements[name].compose(flats[name].getContext('2d'), editor.size);
  }
  function useSide(name) {
    side = name;
    editor.flat = flats[name];
    editor.fctx = flats[name].getContext('2d');
    editor.setPlacement(placements[name]);
    syncSliders();
    ui();
  }
  function syncSliders() {
    const pl = placements[side];
    $('.bb-zoom').value = pl.zoom;
    $('.bb-rot').value = Math.round((pl.rot * 180) / Math.PI);
  }
  function applySource(name, src) {
    placements[name].setSource(src);
    render(name);
    if (name === side) editor.update();
    else if (preview) preview.refresh(name);
  }
  function setFabric(name, key) {
    const s = SAMPLES[key];
    if (!s) return;
    has[name] = false;
    names[name] = '';
    fab[name] = s.label;
    applySource(name, s.make(name));
    ui();
  }
  function setImage(name, src, label, after) {
    const done = (img) => {
      has[name] = true;
      names[name] = label || 'Your image';
      applySource(name, img);
      setMsg('');
      if (after) after();
    };
    if (src instanceof Blob) {
      setMsg('Loading image...');
      const fr = new FileReader();
      fr.onerror = () => setMsg('Could not read that file. Try a JPG or PNG.');
      fr.onload = () => {
        const img = new Image();
        img.onload = () => done(img);
        img.onerror = () => setMsg('Could not open that image. Try a JPG or PNG.');
        img.src = fr.result;
      };
      fr.readAsDataURL(src);
    } else if (typeof src === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => done(img);
      img.src = src;
    } else done(src);
  }

  // start with plain fabric on both sides, then build the 3D bag from the flat canvases
  setFabric('top', start.top);
  setFabric('bottom', start.bottom);
  preview = new BagPreview($('.bb-3d'), shape, flats);
  useSide('top');

  // ----- keep the flat square sized to its box -----
  const sflat = $('.bb-sflat');
  const fit = () => {
    const w = sflat.clientWidth;
    const h = sflat.clientHeight;
    const reserve = app.dataset.view === 'flat' ? 56 : 0;
    const s = Math.max(120, Math.min(w - 16 - reserve, h - 34));
    const c = $('.bb-flat');
    c.style.width = c.style.height = s + 'px';
    sflat.style.paddingLeft = reserve + 'px';
    const up = $('.bb-upbig');
    up.style.left = 'calc(50% + ' + reserve / 2 + 'px)';
  };
  const ro = new ResizeObserver(fit);
  ro.observe(sflat);
  fit();

  // ----- views: both / 3D only / flat only -----
  function setView(v) {
    app.dataset.view = v;
    $$('.bb-rb').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
    fit();
    drawPip();
    if (preview) requestAnimationFrame(() => { preview.resize(); if (v !== 'flat') { preview.view('home'); if (side === 'bottom') preview.flip(); } });
  }
  $$('.bb-rb').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
  $('.bb-pip').onclick = () => setView('both');
  function showSide(n) {
    if (side !== n) {
      useSide(n);
      preview.flip();
    }
  }
  $('.bb-flipchip').onclick = () => {
    const n = other(side);
    if (cur().mode === 'carpet') setStep(n === 'bottom' ? 'slow' : has.top ? 'adjust' : 'image');
    else showSide(n);
  };

  // ----- series and steps -----
  function renderSeries() {
    const p = $('.bb-series');
    p.innerHTML = '';
    SERIES.forEach((g, gi) => {
      const d = document.createElement('div');
      d.className = 'bb-grp';
      const t = document.createElement('div');
      t.className = 'bb-gt';
      t.textContent = g.group;
      const row = document.createElement('div');
      row.className = 'bb-gi';
      g.items.forEach((it, ii) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bb-sn' + (gi === sel.g && ii === sel.i ? ' on' : '');
        b.append(it.name + ' ', Object.assign(document.createElement('i'), { textContent: '– ' + it.speed }));
        b.onclick = () => pickSeries(gi, ii);
        row.appendChild(b);
      });
      d.append(t, row);
      p.appendChild(d);
    });
  }
  function renderSteps() {
    const nav = $('.bb-steps');
    nav.innerHTML = '';
    stepIds().forEach((id) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bb-step';
      b.dataset.step = id;
      b.setAttribute('role', 'tab');
      b.innerHTML = '<b>' + STEP_NAMES[id] + '</b><span></span>';
      b.onclick = () => setStep(id);
      nav.appendChild(b);
    });
  }
  function setStep(id) {
    step = id;
    $$('.bb-step').forEach((b) => b.classList.toggle('on', b.dataset.step === id));
    $$('.bb-pane').forEach((p) => (p.hidden = p.dataset.pane !== id));
    if (cur().mode === 'carpet') showSide(id === 'slow' ? 'bottom' : 'top');
    ui();
  }
  function pickSeries(gi, ii) {
    const was = cur().mode;
    sel.g = gi;
    sel.i = ii;
    if (cur().mode === 'carpet' && was === 'double') {
      if (has.bottom) setFabric('bottom', start.bottom);
      showSide('top');
    }
    renderSeries();
    renderSteps();
    setStep(stepIds().includes(step) ? step : 'image');
  }
  renderSeries();
  renderSteps();
  setStep('series');

  // ----- upload sheet -----
  const afterImage = () => setStep(cur().mode === 'double' && !(has.top && has.bottom) ? 'image' : 'adjust');
  $$('.bb-slot').forEach((sl) => {
    sl.onclick = () => {
      showSide(sl.dataset.side);
      if (!has[sl.dataset.side]) openSheet();
    };
  });
  const sheet = $('.bb-sheet');
  function openSheet() {
    sheet.hidden = false;
  }
  const closeSheet = () => (sheet.hidden = true);
  $('.bb-upbig').onclick = openSheet;
  $('.bb-replace').onclick = openSheet;
  $('.bb-open').onclick = openSheet;
  $('.bb-close').onclick = closeSheet;
  $('.bb-back').onclick = closeSheet;
  $$('.bb-file').forEach((inp) => {
    inp.onchange = (e) => {
      const f = e.target.files[0];
      if (f) {
        closeSheet();
        setImage(side, f, f.name.replace(/\.[^.]+$/, '') + (f.name.includes('.') ? '.' + f.name.split('.').pop().toLowerCase() : ''), afterImage);
      }
      e.target.value = '';
    };
  });
  $('.bb-sample').onclick = () => {
    closeSheet();
    setImage(side, SAMPLES.design.make(side), 'Test design', afterImage);
  };

  // ----- adjust -----
  $('.bb-zoom').oninput = (e) => {
    placements[side].zoom = parseFloat(e.target.value);
    editor.update();
  };
  $('.bb-rot').oninput = (e) => {
    placements[side].rot = (parseFloat(e.target.value) * Math.PI) / 180;
    editor.update();
  };
  $('.bb-fill').onclick = () => {
    placements[side].reset();
    editor.update();
  };
  $('.bb-mirror').onclick = () => {
    placements[side].flipX = !placements[side].flipX;
    editor.update();
  };
  $('.bb-reset').onclick = () => {
    placements[side].reset();
    editor.update();
  };

  // ----- fabric swatches -----
  const fh = $('.bb-fabrics');
  FABRICS.forEach((f) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bb-fab';
    b.dataset.label = f.label;
    const t = document.createElement('canvas');
    t.width = t.height = 72;
    const g = t.getContext('2d');
    g.fillStyle = f.base;
    g.fillRect(0, 0, 72, 72);
    for (let y = 0; y < 72; y += 3) for (let x = (y / 3) % 2 ? 0 : 3; x < 72; x += 6) {
      g.fillStyle = 'rgba(0,0,0,.16)';
      g.fillRect(x, y, 3, 3);
    }
    b.append(t, Object.assign(document.createElement('span'), { textContent: f.label }));
    b.onclick = () => setFabric('bottom', f.key);
    fh.appendChild(b);
  });
  ui();

  // ----- save -----
  function exportPNG(name, dpi = 300) {
    const c = document.createElement('canvas');
    const px = Math.round(P.cutIn * dpi);
    c.width = c.height = px;
    placements[name].compose(c.getContext('2d'), px);
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }
  $('.bb-save').onclick = async () => {
    const out = { top: await exportPNG('top'), bottom: await exportPNG('bottom'), series: cur() };
    if (options.onSave) return options.onSave(out);
    ['top', 'bottom'].forEach((n) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(out[n]);
      a.download = 'bag-' + n + '-' + P.cutIn + 'in.png';
      a.click();
    });
  };

  return {
    shape,
    exportPNG,
    setImage: (name, src, label) => setImage(name, src, label),
    destroy() {
      ro.disconnect();
      preview.dispose();
      container.innerHTML = '';
      container.classList.remove('bb-root');
    }
  };
}
