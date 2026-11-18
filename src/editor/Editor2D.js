// The flat fabric editor: the 7.5 x 7.5 in square with guides on top.
//   gold dashed  = cut edge (bleed: art must reach every edge)
//   white        = seam line (everything inside shows on the bag)
//   teal dotted  = safe zone (keep text and logos inside)
// One finger drags the image. Two fingers zoom and rotate. Mouse wheel zooms.

const GOLD = '#F2B544';
const TEAL = '#3FB6A8';

export class Editor2D {
  constructor(canvas, shape, { size = 1024, onChange } = {}) {
    this.canvas = canvas;
    this.shape = shape;
    this.size = size;
    this.onChange = onChange || (() => {});
    this.placement = null;
    this.showGuides = true;

    canvas.width = size;
    canvas.height = size;
    canvas.style.touchAction = 'none';
    this.ctx = canvas.getContext('2d');

    // the flat fabric by itself (no guides): this is what goes onto the bag
    this.flat = document.createElement('canvas');
    this.flat.width = size;
    this.flat.height = size;
    this.fctx = this.flat.getContext('2d');

    this.pointers = new Map();
    this._bind();
  }

  setPlacement(p) {
    this.placement = p;
    this.update();
  }

  // re-draw everything after any change
  update() {
    if (this.placement) this.placement.compose(this.fctx, this.size);
    this._drawView();
    this.onChange(this.flat);
  }

  _path(ctx, pts, ppi) {
    const c = this.size / 2;
    pts.forEach((p, i) => {
      const x = c + p[0] * ppi;
      const y = c - p[1] * ppi;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
  }

  _drawView() {
    const { ctx, size, shape } = this;
    const P = shape.params;
    const ppi = size / P.cutIn;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(this.flat, 0, 0);
    if (!this.showGuides) return;

    // darken the bleed: everything outside the seam line
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    this._path(ctx, shape.outline(shape.seamHalfIn, 240), ppi);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill('evenodd');
    ctx.restore();

    const lw = size / 256;
    ctx.save();
    // cut edge
    ctx.lineWidth = lw * 1.6;
    ctx.strokeStyle = GOLD;
    ctx.setLineDash([lw * 7, lw * 4]);
    ctx.strokeRect(lw * 1.5, lw * 1.5, size - lw * 3, size - lw * 3);
    // seam line
    ctx.setLineDash([]);
    ctx.lineWidth = lw * 1.2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.beginPath();
    this._path(ctx, shape.outline(shape.seamHalfIn, 240), ppi);
    ctx.stroke();
    // safe zone
    ctx.lineWidth = lw * 1.2;
    ctx.strokeStyle = TEAL;
    ctx.lineCap = 'round';
    ctx.setLineDash([lw * 0.1, lw * 3]);
    ctx.beginPath();
    this._path(ctx, shape.outline(P.safeIn / 2, 240), ppi);
    ctx.stroke();
    ctx.restore();
  }

  // ----- touch, pen and mouse -----
  _bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this._gesture = this._snapshot();
      e.preventDefault();
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId) || !this.placement) return;
      const prev = this._snapshot();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const now = this._snapshot();
      const rect = c.getBoundingClientRect();
      const pl = this.placement;
      pl.tx += (now.cx - prev.cx) / rect.width;
      pl.ty += (now.cy - prev.cy) / rect.height;
      if (this.pointers.size >= 2 && prev.n === now.n && prev.d > 0) {
        pl.zoom *= now.d / prev.d;
        let da = now.a - prev.a;
        if (da > Math.PI) da -= Math.PI * 2;
        if (da < -Math.PI) da += Math.PI * 2;
        pl.rot += da;
        pl.clampZoom();
      }
      this.update();
      e.preventDefault();
    });
    const end = (e) => {
      this.pointers.delete(e.pointerId);
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener(
      'wheel',
      (e) => {
        if (!this.placement) return;
        e.preventDefault();
        const pl = this.placement;
        if (e.shiftKey) pl.rot += -e.deltaY * 0.002;
        else pl.zoom *= Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0012));
        pl.clampZoom();
        this.update();
      },
      { passive: false }
    );
  }

  _snapshot() {
    const pts = [...this.pointers.values()];
    const n = pts.length;
    if (!n) return { n: 0, cx: 0, cy: 0, d: 0, a: 0 };
    const cx = pts.reduce((s, p) => s + p.x, 0) / n;
    const cy = pts.reduce((s, p) => s + p.y, 0) / n;
    let d = 0;
    let a = 0;
    if (n >= 2) {
      d = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      a = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    }
    return { n, cx, cy, d, a };
  }

  // print-size export of the flat fabric, no guides. dpi 300 -> 2250 x 2250 px.
  exportCanvas(dpi = 300) {
    const px = Math.round(this.shape.params.cutIn * dpi);
    const c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    this.placement.compose(c.getContext('2d'), px);
    return c;
  }
}
