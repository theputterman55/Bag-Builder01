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
//   options.onSave      called with { top: Blob, bottom: Blob } when Save design is pressed
//   options.title       name shown at the top (default "Bag builder")
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
        <button type="button" class="bb-upbig">${ic('image', 24)}<span>Upload image</span></button>
        <div class="bb-hint" role="status"></div>
      </section>
    </div>
    <nav class="bb-steps" role="tablist">
      <button type="button" class="bb-step on" data-step="0" role="tab"><b>Upload</b><span></span></button>
      <button type="button" class="bb-step" data-step="1" role="tab"><b>Adjust</b><span></span></button>
      <button type="button" class="bb-step" data-step="2" role="tab"><b>Fabric</b><span></span></button>
      <button type="button" class="bb-step" data-step="3" role="tab"><b>Review</b><span></span></button>
    </nav>
    <div class="bb-panel">
      <div class="bb-pane" data-pane="0">
        <button type="button" class="bb-wide bb-open">${ic('image', 22)}<span>Upload image</span></button>
        <div class="bb-note">Pick a photo from your gallery or take one. It shows on the flat art and on the bag.</div>
      </div>
      <div class="bb-pane" data-pane="1">
        <label class="bb-row"><span>Zoom</span><input type="range" class="bb-zoom" min="0.3" max="6" step="0.01"></label>
        <label class="bb-row"><span>Turn</span><input type="range" class="bb-rot" min="-180" max="180" step="1"></label>
        <div class="bb-two"><button type="button" class="bb-btn bb-mirror">Flip image</button><button type="button" class="bb-btn bb-fill">Fill to bleed</button><button type="button" class="bb-btn bb-replace">Replace</button></div>
      </div>
      <div class="bb-pane" data-pane="2">
        <div class="bb-fabhead"><b class="bb-fabside">Top side</b><span>Fabric</span></div>
        <div class="bb-fabrics"></div>
      </div>
      <div class="bb-pane" data-pane="3">
        <div class="bb-sum"><span>Top side</span><b class="bb-sum-top"></b></div>
        <div class="bb-sum"><span>Bottom side</span><b class="bb-sum-bottom"></b></div>
        <div class="bb-sum"><span>Bag</span><b>${P.halfWidthIn * 2} × ${P.halfWidthIn * 2} in · ${P.thicknessIn} in thick</b></div>
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
  let step = 0;

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
  const short = (t) => (t.length > 13 ? t.slice(0, 11) + '…' : t);
  function ui() {
    const imgOn = has[side];
    $('.bb-flipchip span').textContent = 'Flip · ' + cap(side);
    $('.bb-upbig').hidden = imgOn;
    $('.bb-replace').hidden = !imgOn;
    msgEl.textContent = msg || (imgOn ? 'Drag to move · pinch to zoom · two fingers to turn' : '');
    const sp = $$('.bb-step span');
    sp[0].textContent = imgOn ? short(names[side]) : 'No image';
    sp[1].textContent = 'Move, zoom';
    sp[2].textContent = fab[side] || 'Custom';
    sp[3].textContent = has.top || has.bottom ? 'Ready' : 'Not ready';
    $('.bb-fabside').textContent = cap(side) + ' side';
    $('.bb-sum-top').textContent = has.top ? names.top : fab.top || 'Fabric';
    $('.bb-sum-bottom').textContent = has.bottom ? names.bottom : fab.bottom || 'Fabric';
    const label = (n) => (has[n] ? names[n] : fab[n] || 'Fabric');
    $('.bb-bs').textContent = 'Top: ' + short(label('top')) + ' · Bottom: ' + short(label('bottom'));
    $('.bb-save').disabled = !(has.top || has.bottom);
    $$('.bb-fab').forEach((b) => b.classList.toggle('on', !has[side] && fab[side] === b.dataset.label));
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
  function setImage(name, src, label) {
    const done = (img) => {
      has[name] = true;
      names[name] = label || 'Your image';
      applySource(name, img);
      setMsg('');
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
    if (preview) requestAnimationFrame(() => { preview.resize(); if (v !== 'flat') preview.view('home'); });
  }
  $$('.bb-rb').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
  $('.bb-pip').onclick = () => setView('both');
  $('.bb-flipchip').onclick = () => {
    useSide(other(side));
    preview.flip();
  };

  // ----- steps -----
  function setStep(n) {
    step = n;
    $$('.bb-step').forEach((b) => b.classList.toggle('on', +b.dataset.step === n));
    $$('.bb-pane').forEach((p) => (p.hidden = +p.dataset.pane !== n));
  }
  $$('.bb-step').forEach((b) => (b.onclick = () => setStep(+b.dataset.step)));
  setStep(0);

  // ----- upload sheet -----
  const sheet = $('.bb-sheet');
  const openSheet = () => (sheet.hidden = false);
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
        setImage(side, f, f.name.replace(/\.[^.]+$/, '') + (f.name.includes('.') ? '.' + f.name.split('.').pop().toLowerCase() : ''));
        setStep(1);
      }
      e.target.value = '';
    };
  });
  $('.bb-sample').onclick = () => {
    closeSheet();
    setImage(side, SAMPLES.design.make(side), 'Test design');
    setStep(1);
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
    b.onclick = () => setFabric(side, f.key);
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
    const out = { top: await exportPNG('top'), bottom: await exportPNG('bottom') };
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
