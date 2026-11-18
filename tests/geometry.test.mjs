import { makeShape } from '../src/core/shape.js';
import assert from 'node:assert/strict';

const shape = makeShape();
const fail = [];
const ok = (cond, msg) => { if (!cond) fail.push(msg); };

for (const side of [1, -1]) {
  const g = shape.buildSide(side, { NA: 180, NS: 40 });
  const nV = g.position.length / 3;
  ok(g.uv.length / 2 === nV, 'uv count matches vertex count');
  ok(g.position.every(Number.isFinite), 'positions are finite');
  ok(g.uv.every(Number.isFinite), 'uvs are finite');
  ok(g.index.every((i) => i < nV), 'indices in range');

  // every spot on the bag lands inside the flat cut square
  let umin = 9, umax = -9, vmin = 9, vmax = -9;
  for (let i = 0; i < g.uv.length; i += 2) {
    umin = Math.min(umin, g.uv[i]); umax = Math.max(umax, g.uv[i]);
    vmin = Math.min(vmin, g.uv[i + 1]); vmax = Math.max(vmax, g.uv[i + 1]);
  }
  ok(umin >= 0 && umax <= 1 && vmin >= 0 && vmax <= 1, 'uvs inside the cut square (side ' + side + ')');
  // the seam line reaches the middle of each edge at seamHalfIn
  const expected = 0.5 + shape.seamHalfIn / shape.params.cutIn;
  ok(Math.abs(umax - expected) < 1e-3, 'seam reaches seamHalfIn along the edge');

  // height: top panel above the seam plane, bottom below, 0.5 in at the face
  let ymax = -9, ymin = 9;
  for (let i = 1; i < g.position.length; i += 3) { ymax = Math.max(ymax, g.position[i]); ymin = Math.min(ymin, g.position[i]); }
  if (side > 0) ok(Math.abs(ymax - 0.5) < 1e-6 && ymin >= -1e-9, 'top panel spans 0..0.5 in');
  else ok(Math.abs(ymin + 0.5) < 1e-6 && ymax <= 1e-9, 'bottom panel spans -0.5..0 in');
}

// panels meet at the seam: same outline ring height 0 on both sides
const lv = shape.levels(0);
ok(lv[lv.length - 1][1] === 0, 'seam ring sits at z = 0');

// stitch stays inside the divot
const zz = shape.zigzag(1);
ok(zz.length > 100, 'zigzag has points');
ok(zz.every((p) => p[0] > -1.6 && p[0] < 1.6), 'zigzag stays within the pinch zone');

// seam half width: footprint minus roll plus surface arc
ok(shape.seamHalfIn > 3.1 && shape.seamHalfIn < 3.6, 'seam half width is sensible: ' + shape.seamHalfIn.toFixed(3));
ok(shape.seamHalfIn * 2 < shape.params.cutIn, 'seam line fits inside the cut square');
ok(shape.params.safeIn === 6, 'safe zone defaults to 6 in');

if (fail.length) { console.error('FAIL\n' + fail.join('\n')); process.exit(1); }
console.log('geometry ok. seam line across the flat fabric: ' + (shape.seamHalfIn * 2).toFixed(2) + ' in, cut square: ' + shape.params.cutIn + ' in');
