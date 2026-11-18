import './style.css';
import { makeShape } from './core/shape.js';
import { Placement } from './editor/placement.js';
import { analyze, palettes, recolor, sampleBackground } from './editor/autocolor.js';
import { Editor2D } from './editor/Editor2D.js';
import { BagPreview } from './preview/BagPreview.js';
import { SAMPLES, FABRICS } from './editor/samples.js';

// createBagBuilder(container, options)
//   options.safeIn      safe zone size in inches (default 6)
//   options.cutIn       flat fabric square in inches (default 7.5)
//   options.shape       any shape overrides (see core/shape.js DEFAULTS)
//   options.start       { top: 'denim', bottom: 'denim' }  fabric names to start with
//   options.onChange    called with the side name whenever an image changes
//   options.onSave      called with { top: Blob, bottom: Blob, series } when Submit is pressed on the Review step
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
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  updown: '<path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/>',
  chevup: '<path d="M6 15l6-6 6 6"/>',
  chevdn: '<path d="M6 9l6 6 6-6"/>'
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
      <div class="bb-rail" role="group" aria-label="Views">
        <button type="button" class="bb-rb on" data-view="both" aria-label="Both views">${ic('both')}</button>
        <button type="button" class="bb-rb" data-view="3d" aria-label="3D bag only">${ic('cube')}</button>
        <button type="button" class="bb-rb" data-view="flat" aria-label="Flat art only">${ic('image')}</button>
      </div>
      <button type="button" class="bb-ibtn bb-reset" aria-label="Reset this side">${ic('reset')}</button>
    </header>
    <div class="bb-views">
      <button type="button" class="bb-flip" aria-label="Flip to the bottom side">${ic('updown', 22)}</button>
      <section class="bb-stage bb-s3d">
        <div class="bb-3d"></div>
        <button type="button" class="bb-pip" aria-label="Edit the flat art"><canvas width="260" height="260"></canvas><span>Flat art · tap to edit</span></button>
      </section>
      <section class="bb-stage bb-sflat">
        <canvas class="bb-flat" aria-label="Flat fabric editor"></canvas>
        <div class="bb-sidelbl">Top</div>
        <button type="button" class="bb-big" aria-label="Make the viewing area bigger" hidden>${ic('chevup', 30)}</button>
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
      <div class="bb-pane" data-pane="logo">
        <div class="bb-ltabs">
          <button type="button" class="bb-lt on" data-lt="brand">Brand logo</button>
          <button type="button" class="bb-lt" data-lt="name">Series name</button>
          <button type="button" class="bb-lt" data-lt="stamp">Stamp</button>
        </div>
        <div class="bb-lc bb-lps" data-lc="brand">
          <button type="button" class="bb-lp" data-i="0" aria-label="Add a logo"><span class="bb-plus">${ic('plus', 30)}</span><canvas width="200" height="120"></canvas></button>
          <button type="button" class="bb-lp" data-i="1" aria-label="Add a logo"><span class="bb-plus">${ic('plus', 30)}</span><canvas width="200" height="120"></canvas></button>
          <button type="button" class="bb-lp" data-i="2" aria-label="Add a logo"><span class="bb-plus">${ic('plus', 30)}</span><canvas width="200" height="120"></canvas></button>
        </div>
        <div class="bb-lc" data-lc="name" hidden><div class="bb-names"></div></div>
        <div class="bb-lc bb-lps" data-lc="stamp" hidden>
          <button type="button" class="bb-sp" data-stamp="ACL"><i></i><span>ACL</span></button>
          <button type="button" class="bb-sp" data-stamp="UCL"><i></i><span>UCL</span></button>
          <button type="button" class="bb-sp" data-stamp=""><i></i><span>None</span></button>
        </div>
        <div class="bb-edit dim">
          <div class="bb-eh"><span class="bb-et">Tap a logo to edit it</span><span class="bb-ea"><button type="button" class="bb-tb bb-auto" hidden>Auto color</button><button type="button" class="bb-tb bb-remove">Remove</button></span></div>
          <div class="bb-er">
            <div class="bb-ec"><button type="button" class="bb-rl bb-rsize" aria-label="Size, tap to bring it back to the original size">Size</button><input type="range" class="bb-lsize" min="0.05" max="0.6" step="0.005" aria-label="Size"></div>
            <div class="bb-ec"><button type="button" class="bb-rl bb-rrot" aria-label="Rotate, tap to bring it back to square">Rotate</button><input type="range" class="bb-lrot" min="-180" max="180" step="1" value="0" aria-label="Rotate"></div>
          </div>
        </div>
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
        <div class="bb-sum"><span>Logos</span><b class="bb-sum-logos"></b></div>
        <button type="button" class="bb-submit">Submit</button>
      </div>
    </div>
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
  app.dataset.size = 'exp';
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
  let logosReady = false; // the logo controls are built after the first ui() call
  const cur = () => ({ group: SERIES[sel.g].group, mode: SERIES[sel.g].mode, ...SERIES[sel.g].items[sel.i] });
  const STEP_NAMES = { series: 'Series', image: 'Image', logo: 'Logo', adjust: 'Adjust', slow: 'Slow side', review: 'Review' };
  const stepIds = () => (cur().mode === 'carpet' ? ['series', 'image', 'adjust', 'logo', 'slow', 'review'] : ['series', 'image', 'adjust', 'logo', 'review']);
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
    $('.bb-flip').setAttribute('aria-label', 'Flip to the ' + other(side) + ' side');
    $('.bb-sidelbl').textContent = cap(side);
    $('.bb-upbig').hidden = imgOn || (c.mode === 'carpet' && side === 'bottom');
    $('.bb-replace').hidden = !imgOn;
    msgEl.textContent = msg || (step === 'logo' && placements[side].sel ? 'Drag to move · pinch to resize' : imgOn ? 'Drag to move · pinch to zoom · two fingers to turn' : '');
    logoUI();
    const subs = {
      series: shorter(c.name),
      image: c.mode === 'carpet' ? (has.top ? shorter(names.top) : 'No image') : (has.top ? 1 : 0) + (has.bottom ? 1 : 0) + ' of 2 added',
      logo: placements[side].layers.length ? placements[side].layers.length + ' added' : 'None',
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
    $('.bb-sum-logos').textContent = (placements.top.layers.length + placements.bottom.layers.length) ? placements.top.layers.length + placements.bottom.layers.length + ' added' : 'None';
    $('.bb-submit').disabled = !ready();
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
    if (logosReady) editUI();
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
    const reserve = 0;
    const s = Math.max(120, Math.min(w - 16 - reserve, h - 34 - (app.hasAttribute('data-big') ? 24 : 0)));
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
  $('.bb-flip').onclick = () => {
    const n = other(side);
    if (cur().mode === 'carpet') setStep(n === 'bottom' ? 'slow' : has.top ? 'adjust' : 'image');
    else showSide(n);
  };

  // ----- logos, series name and stamp: layers on top of the image -----
  const layerOf = (key) => placements[side].layers.find((l) => l.key === key);
  const aspectOf = (src) => (src.naturalHeight || src.height) / (src.naturalWidth || src.width);
  function putLayer(l) {
    const pl = placements[side];
    const old = pl.layers.findIndex((x) => x.key === l.key);
    l.w0 = (old >= 0 && pl.layers[old].w0) || l.w0 || l.w; // the starting size, the Size slider is centred on it
    if (old >= 0) pl.layers[old] = l;
    else pl.layers.push(l);
    pl.sel = l;
    editor.update();
    ui();
  }
  function dropLayer(key) {
    const pl = placements[side];
    pl.layers = pl.layers.filter((l) => l.key !== key);
    if (pl.sel && pl.sel.key === key) pl.sel = null;
    editor.update();
    ui();
  }
  // a tap adds the logo, a tap on one that is on the art selects it, a tap on the selected one takes it off
  function toggleLayer(key, make) {
    const l = layerOf(key);
    if (l && placements[side].sel === l) dropLayer(key);
    else if (l) {
      placements[side].sel = l;
      editor.update();
      ui();
    } else putLayer(make());
  }
  const brand = [null, null, null]; // { source, name } for each brand logo placard
  const NAME_STYLES = [
    { font: 'italic 900 170px Inter, system-ui, sans-serif', upper: true, ls: 8 },
    { font: 'italic 800 170px Georgia, serif', upper: false, ls: 0 },
    { font: '700 150px Inter, system-ui, sans-serif', upper: true, ls: 26 },
    { font: '900 170px Inter, system-ui, sans-serif', upper: true, ls: 6, outline: true },
    { font: '600 150px "Courier New", monospace', upper: false, ls: 0 }
  ];
  function textSource(text, st) {
    const t = st.upper ? text.toUpperCase() : text;
    const m = document.createElement('canvas').getContext('2d');
    m.font = st.font;
    m.letterSpacing = st.ls + 'px';
    const w = Math.ceil(m.measureText(t).width) + 80;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = 280;
    const g = c.getContext('2d');
    g.font = st.font;
    g.letterSpacing = st.ls + 'px';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    if (st.outline) {
      g.lineWidth = 10;
      g.strokeStyle = '#fff';
      g.strokeText(t, w / 2, 145);
    } else {
      g.lineWidth = 22;
      g.strokeStyle = '#000';
      g.strokeText(t, w / 2, 145);
      g.fillStyle = '#fff';
      g.fillText(t, w / 2, 145);
    }
    return c;
  }
  function stampSource(label) {
    const c = document.createElement('canvas');
    c.width = c.height = 400;
    const g = c.getContext('2d');
    g.beginPath();
    g.arc(200, 200, 186, 0, Math.PI * 2);
    g.fillStyle = '#0b0b0e';
    g.fill();
    g.lineWidth = 22;
    g.strokeStyle = '#fff';
    g.stroke();
    g.fillStyle = '#fff';
    g.font = '900 150px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, 200, 212);
    return c;
  }
  const nameLayer = (i) => {
    const src = textSource(cur().name, NAME_STYLES[i]);
    return { key: 'name', kind: 'name', style: i, source: src, tx: 0, ty: 0.27, w: 0.62, rot: 0, aspect: aspectOf(src) };
  };
  const nameRows = NAME_STYLES.map((st, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bb-nm';
    b.style.cssText = 'font:' + st.font.replace(/\d+px/, '21px') + ';letter-spacing:' + Math.round(st.ls / 8) + 'px' + (st.outline ? ';color:transparent;-webkit-text-stroke:1.5px #fff' : '');
    b.onclick = () => {
      const cur0 = layerOf('name');
      if (cur0 && cur0.style === i && placements[side].sel === cur0) return dropLayer('name');
      const l = nameLayer(i);
      if (cur0) Object.assign(l, { tx: cur0.tx, ty: cur0.ty, w: cur0.w, rot: cur0.rot });
      putLayer(l);
    };
    $('.bb-names').appendChild(b);
    return b;
  });
  function logoUI() {
    if (!logosReady) return;
    editUI();
    const pl = placements[side];
    $$('.bb-lp').forEach((b) => {
      const i = +b.dataset.i;
      const has = !!brand[i];
      const l = layerOf('brand' + i);
      b.classList.toggle('has', has);
      b.classList.toggle('used', !!l);
      b.classList.toggle('on', !!l && pl.sel === l);
      if (has) {
        const c = b.querySelector('canvas');
        const g = c.getContext('2d');
        g.clearRect(0, 0, c.width, c.height);
        const k = Math.min(c.width / brand[i].source.width, c.height / brand[i].source.height);
        const w = brand[i].source.width * k;
        const h = brand[i].source.height * k;
        g.drawImage(brand[i].source, (c.width - w) / 2, (c.height - h) / 2, w, h);
      }
    });
    nameRows.forEach((b, i) => {
      b.textContent = (NAME_STYLES[i].upper ? cur().name.toUpperCase() : cur().name);
      const l = layerOf('name');
      b.classList.toggle('on', !!l && l.style === i);
    });
    $$('.bb-sp').forEach((b) => {
      const l = layerOf('stamp');
      b.classList.toggle('on', l ? l.label === b.dataset.stamp : b.dataset.stamp === '');
    });
  }
  $$('.bb-lt').forEach((b) => {
    b.onclick = () => {
      $$('.bb-lt').forEach((x) => x.classList.toggle('on', x === b));
      $$('.bb-lc').forEach((c) => (c.hidden = c.dataset.lc !== b.dataset.lt));
    };
  });
  $$('.bb-sp').forEach((b) => {
    const lab = b.dataset.stamp;
    const i = b.querySelector('i');
    i.innerHTML = lab
      ? '<svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#0b0b0e" stroke="#fff" stroke-width="2.5"/><text x="20" y="25" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" font-family="Inter,sans-serif">' + lab + '</text></svg>'
      : '<svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="none" stroke="#a1a1aa" stroke-width="2.5"/><path d="M9 31L31 9" stroke="#a1a1aa" stroke-width="2.5"/></svg>';
    b.onclick = () => {
      if (!lab) return dropLayer('stamp');
      const cur0 = layerOf('stamp');
      if (cur0 && cur0.label === lab && placements[side].sel === cur0) return dropLayer('stamp');
      const src = stampSource(lab);
      const l = { key: 'stamp', kind: 'stamp', label: lab, source: src, tx: 0.3, ty: -0.3, w: 0.2, rot: 0, aspect: 1 };
      if (cur0) Object.assign(l, { tx: cur0.tx, ty: cur0.ty, w: cur0.w, rot: cur0.rot });
      putLayer(l);
    };
  });
  // ----- edit strip under the logo controls: Size, Rotate, Auto color, Remove -----
  const eSize = $('.bb-lsize');
  const eRot = $('.bb-lrot');
  const TITLES = { brand: 'Brand logo', name: 'Series name', stamp: 'Stamp' };
  function editUI() {
    const l = placements[side].sel;
    $('.bb-edit').classList.toggle('dim', !l);
    eSize.disabled = eRot.disabled = !l;
    $('.bb-et').textContent = l ? TITLES[l.kind] || 'Logo' : 'Tap a logo to edit it';
    $('.bb-remove').hidden = !l;
    const au = $('.bb-auto');
    au.hidden = !(l && (l.kind === 'brand' || l.kind === 'name'));
    if (!l) return;
    const w0 = l.w0 || l.w;
    eSize.min = 0.05;
    eSize.max = Math.min(1.2, Math.max(0.3, 2 * w0 - 0.05));
    eSize.value = l.w;
    eRot.value = Math.round((l.rot * 180) / Math.PI);
    const a = l.auto;
    au.textContent = a && a.i >= 0 && a.i < a.pals.length ? 'Auto color ' + (a.i + 1) + '/' + a.pals.length : 'Auto color';
  }
  eSize.oninput = () => {
    const l = placements[side].sel;
    if (!l) return;
    l.w = +eSize.value;
    editor.update();
  };
  eRot.oninput = () => {
    const l = placements[side].sel;
    if (!l) return;
    let v = +eRot.value;
    for (const s of [-180, -90, 0, 90, 180]) if (Math.abs(v - s) <= 4) v = s; // straight and square snap
    eRot.value = v;
    l.rot = (v * Math.PI) / 180;
    editor.update();
  };
  // tapping the words Size or Rotate puts it back: original size, or square
  $('.bb-rsize').onclick = () => {
    const l = placements[side].sel;
    if (!l) return;
    l.w = l.w0 || l.w;
    editor.update();
  };
  $('.bb-rrot').onclick = () => {
    const l = placements[side].sel;
    if (!l) return;
    l.rot = 0;
    editor.update();
  };
  $('.bb-remove').onclick = () => {
    const l = placements[side].sel;
    if (l) dropLayer(l.key);
  };
  // each tap steps to the next colorway, after the last one the original colors come back
  $('.bb-auto').onclick = () => {
    const pl = placements[side];
    const l = pl.sel;
    if (!l || !(l.kind === 'brand' || l.kind === 'name')) return;
    l.orig = l.orig || l.source;
    const pos = side + l.tx.toFixed(2) + ',' + l.ty.toFixed(2);
    if (!l.auto || l.auto.pos !== pos) {
      const n = 128;
      const c = document.createElement('canvas');
      c.width = c.height = n;
      pl.composeBase(c.getContext('2d', { willReadFrequently: true }), n);
      const bg = sampleBackground(c, 0.5 + l.tx, 0.5 + l.ty, l.w, l.w * l.aspect);
      const info = analyze(l.orig);
      l.auto = { pos, info, busy: bg.busy, pals: palettes(bg.avg, info, 5), i: -1 };
    }
    const a = l.auto;
    a.i = (a.i + 1) % (a.pals.length + 1);
    const cw = l.source.naturalWidth || l.source.width;
    const next = a.i < a.pals.length ? recolor(l.orig, a.info, a.pals[a.i], a.busy) : l.orig;
    const nw = next.naturalWidth || next.width;
    const nh = next.naturalHeight || next.height;
    l.w *= nw / cw; // the logo keeps its size on the art, even when a border adds a little room
    l.aspect = nh / nw;
    l.source = next;
    editor.update();
    editUI();
  };
  editor.onSelect = () => ui();
  logosReady = true;

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
  // the arrow in the flat window: up makes the viewing area bigger (tools fold away), down brings them back
  let big = false;
  function relayout() {
    fit();
    if (preview) requestAnimationFrame(() => preview.resize());
  }
  function setBig(v) {
    big = v;
    if (v) app.setAttribute('data-big', '');
    else app.removeAttribute('data-big');
    const b = $('.bb-big');
    b.innerHTML = ic(v ? 'chevdn' : 'chevup', 30);
    b.setAttribute('aria-label', v ? 'Show the tools again' : 'Make the viewing area bigger');
    relayout();
  }
  $('.bb-big').onclick = () => setBig(!big);
  function setStep(id) {
    step = id;
    $$('.bb-step').forEach((b) => b.classList.toggle('on', b.dataset.step === id));
    $$('.bb-pane').forEach((p) => (p.hidden = p.dataset.pane !== id));
    if (cur().mode === 'carpet') showSide(id === 'slow' ? 'bottom' : 'top');
    editor.hitTest = id === 'logo';
    // Logo and Review keep the full tools panel; the other steps give the room to the views
    app.dataset.size = id === 'logo' || id === 'review' ? 'orig' : 'exp';
    $('.bb-big').hidden = id !== 'logo';
    if (id !== 'logo') setBig(false);
    else relayout();
    ['top', 'bottom'].forEach((n) => (placements[n].sel = null));
    editor.update();
    const on = $('.bb-step.on');
    const nav = $('.bb-steps');
    if (on) nav.scrollTo({ left: on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2, behavior: 'smooth' });
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
    ['top', 'bottom'].forEach((n) => {
      const pl = placements[n];
      const k = pl.layers.findIndex((l) => l.key === 'name');
      if (k >= 0) {
        const old = pl.layers[k];
        const src = textSource(cur().name, NAME_STYLES[old.style]);
        pl.layers[k] = { ...old, source: src, aspect: aspectOf(src) };
        if (pl.sel === old) pl.sel = pl.layers[k];
      }
      if (n === side) editor.update();
      else if (preview) { render(n); preview.refresh(n); }
    });
    renderSeries();
    renderSteps();
    setStep(stepIds().includes(step) ? step : 'image');
  }
  renderSeries();
  renderSteps();
  setStep('series');

  // ----- upload sheet -----
  $$('.bb-lp').forEach((b) => {
    b.onclick = () => {
      const i = +b.dataset.i;
      if (!brand[i]) return openSheet({ slot: i });
      toggleLayer('brand' + i, () => ({ key: 'brand' + i, kind: 'brand', source: brand[i].source, tx: 0, ty: -0.3, w: 0.34, rot: 0, aspect: aspectOf(brand[i].source) }));
    };
  });
  const afterImage = () => setStep(cur().mode === 'double' && !(has.top && has.bottom) ? 'image' : 'adjust');
  $$('.bb-slot').forEach((sl) => {
    sl.onclick = () => {
      showSide(sl.dataset.side);
      if (!has[sl.dataset.side]) openSheet();
    };
  });
  const sheet = $('.bb-sheet');
  let target = null; // null = the main image, or { slot } for a brand logo placard
  function openSheet(t = null) {
    target = t;
    $('.bb-sh div').textContent = t ? 'Add a brand logo' : 'Upload your image';
    $('.bb-samples').hidden = !!t;
    sheet.hidden = false;
  }
  const closeSheet = () => (sheet.hidden = true);
  $('.bb-upbig').onclick = () => openSheet();
  $('.bb-replace').onclick = () => openSheet();
  $('.bb-open').onclick = () => openSheet();
  $('.bb-close').onclick = closeSheet;
  $('.bb-back').onclick = closeSheet;
  $$('.bb-file').forEach((inp) => {
    inp.onchange = (e) => {
      const f = e.target.files[0];
      if (f && target) {
        const slot = target.slot;
        closeSheet();
        const fr = new FileReader();
        fr.onload = () => {
          const img = new Image();
          img.onload = () => {
            brand[slot] = { source: img, name: f.name };
            putLayer({ key: 'brand' + slot, kind: 'brand', source: img, tx: 0, ty: -0.3, w: 0.34, rot: 0, aspect: aspectOf(img) });
          };
          img.onerror = () => setMsg('Could not open that image. Try a PNG.');
          img.src = fr.result;
        };
        fr.readAsDataURL(f);
      } else if (f) {
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
  $('.bb-submit').onclick = async () => {
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
