// Where an image sits inside the flat fabric square.
// zoom 1 = the image just covers the whole square (no empty fabric).
// tx, ty are the move, as a fraction of the square. rot is in radians.

export class Placement {
  constructor() {
    this.source = null; // canvas or image
    this.base = '#1b2430'; // fabric color showing where the image doesn't reach
    // logos, series name and stamp sit on top of the image: { key, kind, source, tx, ty, w, rot, aspect }
    // tx, ty = centre as a fraction of the square, w = width as a fraction of the square
    this.layers = [];
    this.sel = null; // the layer the finger moves; null = the finger moves the image
    this.reset();
  }

  reset() {
    this.zoom = 1;
    this.rot = 0;
    this.tx = 0;
    this.ty = 0;
    this.flipX = false;
  }

  setSource(src) {
    this.source = src;
    this.reset();
  }

  size() {
    const s = this.source;
    if (!s) return [1, 1];
    return [s.naturalWidth || s.width, s.naturalHeight || s.height];
  }

  clampZoom() {
    this.zoom = Math.min(6, Math.max(0.3, this.zoom));
  }

  // Draw the placed image into a size x size canvas context (the flat fabric).
  compose(ctx, size) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.base;
    ctx.fillRect(0, 0, size, size);
    if (this.source) {
      const [w, h] = this.size();
      const s = (size / Math.min(w, h)) * this.zoom;
      ctx.translate(size / 2 + this.tx * size, size / 2 + this.ty * size);
      ctx.rotate(this.rot);
      ctx.scale(this.flipX ? -s : s, s);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.source, -w / 2, -h / 2);
    }
    ctx.restore();
    for (const l of this.layers) {
      const lw = l.w * size;
      const lh = lw * l.aspect;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(size / 2 + l.tx * size, size / 2 + l.ty * size);
      ctx.rotate(l.rot);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(l.source, -lw / 2, -lh / 2, lw, lh);
      ctx.restore();
    }
  }
}
