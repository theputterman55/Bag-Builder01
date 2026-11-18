// Shared bag shape. No browser or three.js code in here, so it runs anywhere
// (the standalone app, the plugin build, and the node tests).
//
// Units are inches. The bag is a 6 x 6 in squircle, 1 in thick, built from two
// panels (top and bottom) that meet at an open seam. Each panel has a flat face,
// a tight shoulder roll and a short wall. The front edge has a pinch with a
// zigzag stitch.
//
// The flat fabric is a CUT square (default 7.5 x 7.5 in). Every vertex of the
// bag has a spot in that square (its UV), so an image placed in the square lands
// on the bag. The square is laid out like unfolded fabric: surface length is
// preserved, so the roll and wall are not stretched.

export const DEFAULTS = {
  cutIn: 7.5, // flat fabric square, bleed included
  safeIn: 6, // safe zone drawn in the editor (text and logos stay inside)
  halfWidthIn: 3, // half of the 6 in footprint
  cornerExp: 6.5, // squircle corner exponent (higher = squarer)
  thicknessIn: 1, // total thickness
  shoulderIn: 0.4, // shoulder roll radius
  pinchDepthIn: 0.14, // how far the front pinch goes in
  pinchHalfIn: 1.5, // half width of the pinch zone along the front edge
  seamGapIn: 0.016 // how far the seam crease sits in from the edge
};

const LOW_WALL = [0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02];
const cl = (v) => Math.min(1, Math.max(0, v));
const ss = (t) => {
  const u = cl(t);
  return u * u * (3 - 2 * u);
};

export function makeShape(opts = {}) {
  const P = { ...DEFAULTS, ...opts };
  const A = P.halfWidthIn;
  const N = P.cornerExp;
  const HALF = P.thicknessIn / 2;
  const R = Math.min(P.shoulderIn, HALF);
  const WALL = HALF - R;
  const DM = P.pinchDepthIn;

  // point on the unit squircle outline of half width A, at angle th
  const sc = (th) => {
    const c = Math.cos(th);
    const s = Math.sin(th);
    const k = A / Math.pow(Math.pow(Math.abs(c), N) + Math.pow(Math.abs(s), N), 1 / N);
    return [c * k, s * k];
  };

  // 0..1 window over the front edge (by < 0): 1 inside the pinch, tapering out
  const pinchW = (th) => {
    const [bx, by] = sc(th);
    if (by >= 0) return 0;
    return ss((P.pinchHalfIn - Math.abs(bx)) / 0.5);
  };

  const hAt = (z) => (z >= WALL ? A - R * (1 - Math.sqrt(Math.max(0, 1 - Math.pow((z - WALL) / R, 2)))) : A);
  const span = Math.max(HALF - 0.1, 0.1);
  const dep = (z) => DM * ss((HALF - z) / span) * ss((z - 0.03) / 0.07);

  // Rings from the end of the flat face out to the seam, for one angle.
  // Each entry is [h, z]: h scales the outline, z is the height above the seam plane.
  function levels(th, pOv) {
    const p = pOv === undefined ? pinchW(th) : pOv;
    return levelsP(p);
  }
  function levelsP(p, NS = 40) {
    const out = [[A - R, HALF]];
    for (let i = 1; i <= NS; i++) {
      const psi = (i / NS) * (Math.PI / 2);
      const z = WALL + R * Math.cos(psi);
      out.push([A - R * (1 - Math.sin(psi)) - dep(z) * p, z]);
    }
    LOW_WALL.filter((z) => z < WALL - 0.002).forEach((z) => out.push([hAt(z) - dep(z) * p, z]));
    out.push([A - P.seamGapIn, 0]);
    return out;
  }

  // Layout of the nominal (no pinch) profile in the flat fabric: distance from
  // the center of the square, measured along the surface.
  const flatHalfWidths = (NS) => {
    const nom = levelsP(0, NS);
    const cum = [0];
    for (let i = 1; i < nom.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(nom[i][0] - nom[i - 1][0], nom[i][1] - nom[i - 1][1]));
    }
    return cum.map((c) => A - R + c); // flat-fabric "half width" at each ring
  };
  const seamHalfIn = flatHalfWidths(160).pop(); // half width of the seam line in the flat square

  // bag (x, y, z) -> three.js (x, z, -y): the front edge faces the camera
  const P3 = (th, h, z) => {
    const [bx, by] = sc(th);
    return [(bx * h) / A, z, (-by * h) / A];
  };

  // Build one panel. side = +1 (top) or -1 (bottom).
  function buildSide(side, { NA = 720, NS = 40 } = {}) {
    const rows = [];
    for (let j = 0; j < NA; j++) rows.push(levelsP(pinchW((j / NA) * Math.PI * 2), NS));
    const nL = rows[0].length;
    const huFlat = flatHalfWidths(NS);
    const position = new Float32Array((1 + NA * nL) * 3);
    const uv = new Float32Array((1 + NA * nL) * 2);
    position[1] = side * HALF;
    uv[0] = 0.5;
    uv[1] = 0.5;
    let vi = 1;
    for (let j = 0; j < NA; j++) {
      const th = (j / NA) * Math.PI * 2;
      const [bx, by] = sc(th);
      for (let i = 0; i < nL; i++) {
        const [h, z] = rows[j][i];
        const p = P3(th, h, side * z);
        position.set(p, vi * 3);
        // flat-fabric spot: outline scaled to the surface distance, in a square of cutIn
        const hu = huFlat[i];
        uv[vi * 2] = 0.5 + (bx * hu) / A / P.cutIn;
        uv[vi * 2 + 1] = 0.5 + (side * by * hu) / A / P.cutIn;
        vi++;
      }
    }
    const idx = (j, i) => 1 + (j % NA) * nL + i;
    const index = new Uint32Array(NA * (3 + (nL - 1) * 6));
    let k = 0;
    for (let j = 0; j < NA; j++) {
      if (side > 0) {
        index[k++] = 0; index[k++] = idx(j + 1, 0); index[k++] = idx(j, 0);
      } else {
        index[k++] = 0; index[k++] = idx(j, 0); index[k++] = idx(j + 1, 0);
      }
      for (let i = 0; i < nL - 1; i++) {
        const a = idx(j, i), b = idx(j + 1, i), c = idx(j + 1, i + 1), d = idx(j, i + 1);
        if (side > 0) {
          index[k++] = a; index[k++] = d; index[k++] = b;
          index[k++] = b; index[k++] = d; index[k++] = c;
        } else {
          index[k++] = a; index[k++] = b; index[k++] = d;
          index[k++] = b; index[k++] = c; index[k++] = d;
        }
      }
    }
    return { position, uv, index, ringsPerAngle: nL, angles: NA };
  }

  // Black zigzag stitch on the lower lip, kept inside the divot. Points in three.js coords.
  function zigzag(side, { from = 230, to = 310, step = 0.125 } = {}) {
    const pts = [];
    const n = Math.round((to - from) / step);
    for (let k = 0; k <= n; k++) {
      const th = ((from + k * step) * Math.PI) / 180;
      const pw = pinchW(th);
      if (pw < 0.97) continue;
      const z = k % 2 === 0 ? 0.075 : 0.045;
      pts.push(P3(th, hAt(z) - dep(z) * pw + 0.004, side * z));
    }
    return pts;
  }

  // Outline of the squircle at a given half width (inches), as [x, y] with y up.
  function outline(halfIn, steps = 200) {
    const out = [];
    for (let i = 0; i < steps; i++) {
      const [bx, by] = sc((i / steps) * Math.PI * 2);
      out.push([(bx * halfIn) / A, (by * halfIn) / A]);
    }
    return out;
  }

  return {
    params: P,
    A, N, HALF, R, WALL,
    seamHalfIn,
    sc, pinchW, hAt, dep, levels, P3,
    buildSide, zigzag, outline
  };
}
