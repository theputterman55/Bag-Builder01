import './style.css';
import { makeShape } from './core/shape.js';
import { Placement } from './editor/placement.js';
import { Editor2D } from './editor/Editor2D.js';
import { BagPreview } from './preview/BagPreview.js';
import { SAMPLES } from './editor/samples.js';

// createBagBuilder(container, options)
//   options.safeIn      safe zone size in inches (default 6)
//   options.cutIn       flat fabric square in inches (default 7.5)
//   options.shape       any shape overrides (see core/shape.js DEFAULTS)
//   options.start       { top: 'design', bottom: 'suede' }  sample names to start with
//   options.samples     which built-in looks to offer (default all)
//   options.onChange    called with the side name whenever an image changes
//   options.onSave      called with { top: Blob, bottom: Blob } when Save design is pressed
// Returns { exportPNG(side, dpi), setImage(side, urlOrFile), destroy() }.
export function createBagBuilder(container, options = {}) {
  const shape = makeShape({ ...(options.shape || {}), ...(options.safeIn ? { safeIn: options.safeIn } : {}), ...(options.cutIn ? { cutIn: options.cutIn } : {}) });
  const P = shape.params;
  const start = { top: 'design', bottom: 'suede', ...(options.start || {}) };
  const sampleKeys = options.samples || Object.keys(SAMPLES);

  container.classList.add('bb-root');
  container.innerHTML = `
    <div class="bb-head">
      <div class="bb-title">Bag builder</div>
      <div class="bb-tabs" role="tablist">
        <button class="bb-tab on" data-side="top" role="tab">Top side</button>
        <button class="bb-tab" data-side="bottom" role="tab">Bottom side</button>
      </div>
    </div>
    <div class="bb-main">
      <section class="bb-card bb-editor">
        <h2>Place your image</h2>
        <p class="bb-sub">One finger moves it. Two fingers zoom and turn it. On a computer, drag, scroll to zoom, hold Shift and scroll to turn.</p>
        <canvas class="bb-flat" aria-label="Flat fabric editor"></canvas>
        <div class="bb-legend">
          <div><i class="bb-k cut"></i><span>Cut edge, ${P.cutIn} in. Art runs to here (bleed).</span></div>
          <div><i class="bb-k seam"></i><span>Seam line. Everything inside shows on the bag.</span></div>
          <div><i class="bb-k safe"></i><span>Safe zone, ${P.safeIn} in. Keep text and logos here.</span></div>
        </div>
        <label class="bb-row"><span>Zoom</span><input type="range" class="bb-zoom" min="0.3" max="6" step="0.01"></label>
        <label class="bb-row"><span>Turn</span><input type="range" class="bb-rot" min="-180" max="180" step="1"></label>
        <div class="bb-btns">
          <label class="bb-btn bb-loadlbl">Load image<input type="file" accept="image/*" class="bb-file"></label>
          <button class="bb-btn bb-fill">Fill to bleed</button>
          <button class="bb-btn bb-mirror">Flip image</button>
          <button class="bb-btn bb-guides">Hide guides</button>
        </div>
        <div class="bb-btns bb-samples"></div>
        <div class="bb-msg" role="status"></div>
      </section>
      <section class="bb-card bb-view">
        <h2>Your bag</h2>
        <p class="bb-sub">Drag to turn it. Pinch or scroll to zoom. It updates as you move the image.</p>
        <div class="bb-3d"></div>
        <div class="bb-btns">
          <button class="bb-btn bb-flip">Flip over</button>
          <button class="bb-btn bb-spin">Spin</button>
          <button class="bb-btn bb-v-under">Look underneath</button>
          <button class="bb-btn bb-v-pinch">Zoom to pinch</button>
          <button class="bb-btn bb-v-seam">Zoom to seam</button>
          <button class="bb-btn bb-wire">Wireframe</button>
          <button class="bb-btn bb-feel">Fabric feel: on</button>
          <button class="bb-btn bb-v-home">Reset view</button>
        </div>
      </section>
    </div>
    <div class="bb-foot"><button class="bb-btn bb-save">Save design</button></div>`;

  const $ = (sel) => container.querySelector(sel);
  const placements = { top: new Placement(), bottom: new Placement() };
  let side = 'top';
  let preview = null;

  const editor = new Editor2D($('.bb-flat'), shape, {
    onChange: (flat) => {
      if (preview) preview.refresh(side);
      syncSliders();
      if (options.onChange) options.onChange(side, flat);
    }
  });

  // each side keeps its own flat fabric canvas so the 3D bag can show both
  const flats = { top: null, bottom: null };
  const mkFlat = () => {
    const c = document.createElement('canvas');
    c.width = c.height = editor.size;
    return c;
  };
  flats.top = mkFlat();
  flats.bottom = mkFlat();

  function render(name) {
    const pl = placements[name];
    pl.compose(flats[name].getContext('2d'), editor.size);
  }
  function useSide(name) {
    side = name;
    editor.flat = flats[name];
    editor.fctx = flats[name].getContext('2d');
    editor.setPlacement(placements[name]);
    container.querySelectorAll('.bb-tab').forEach((b) => b.classList.toggle('on', b.dataset.side === name));
    syncSliders();
  }
  function syncSliders() {
    const pl = placements[side];
    $('.bb-zoom').value = pl.zoom;
    $('.bb-rot').value = Math.round((pl.rot * 180) / Math.PI);
  }
  function setSample(name, key) {
    const s = SAMPLES[key];
    if (!s) return;
    placements[name].setSource(s.make(name));
    render(name);
    if (name === side) editor.update();
    else if (preview) preview.refresh(name);
  }
  function setImage(name, src) {
    const apply = (img) => {
      placements[name].setSource(img);
      render(name);
      if (name === side) editor.update();
      else if (preview) preview.refresh(name);
    };
    const msg = $('.bb-msg');
    if (src instanceof Blob) {
      msg.textContent = 'Loading image...';
      const fr = new FileReader();
      fr.onerror = () => (msg.textContent = 'Could not read that file. Try a JPG or PNG.');
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          msg.textContent = '';
          apply(img);
        };
        img.onerror = () => (msg.textContent = 'Could not open that image. Try a JPG or PNG.');
        img.src = fr.result;
      };
      fr.readAsDataURL(src);
    } else if (typeof src === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => apply(img);
      img.src = src;
    } else apply(src);
  }

  // start images, then build the 3D bag from the flat canvases
  setSample('top', start.top);
  setSample('bottom', start.bottom);
  preview = new BagPreview($('.bb-3d'), shape, flats);
  useSide('top');

  // ----- wiring -----
  container.querySelectorAll('.bb-tab').forEach((b) => (b.onclick = () => useSide(b.dataset.side)));
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
  let guides = true;
  $('.bb-guides').onclick = (e) => {
    guides = !guides;
    editor.showGuides = guides;
    e.target.textContent = guides ? 'Hide guides' : 'Show guides';
    editor.update();
  };
  $('.bb-file').onchange = (e) => {
    const f = e.target.files[0];
    if (f) setImage(side, f);
    e.target.value = '';
  };
  const sm = $('.bb-samples');
  sampleKeys.forEach((k) => {
    const b = document.createElement('button');
    b.className = 'bb-btn';
    b.textContent = SAMPLES[k].label;
    b.onclick = () => setSample(side, k);
    sm.appendChild(b);
  });
  $('.bb-flip').onclick = () => preview.flip();
  let spin = false;
  $('.bb-spin').onclick = (e) => {
    spin = !spin;
    preview.setSpin(spin);
    e.target.textContent = spin ? 'Stop spin' : 'Spin';
  };
  $('.bb-v-under').onclick = () => preview.view('under');
  $('.bb-v-pinch').onclick = () => preview.view('pinch');
  $('.bb-v-seam').onclick = () => preview.view('seam');
  $('.bb-v-home').onclick = () => preview.view('home');
  let wire = false;
  $('.bb-wire').onclick = (e) => {
    wire = !wire;
    preview.setWireframe(wire);
    e.target.textContent = wire ? 'Hide wireframe' : 'Wireframe';
  };
  let feel = true;
  $('.bb-feel').onclick = (e) => {
    feel = !feel;
    preview.setFabricFeel(feel);
    e.target.textContent = feel ? 'Fabric feel: on' : 'Fabric feel: off';
  };

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
    setImage,
    destroy() {
      preview.dispose();
      container.innerHTML = '';
      container.classList.remove('bb-root');
    }
  };
}
