// Shared bag shape. No browser or three.js code in here, so it runs anywhere
// (the standalone app, the plugin build, and the node tests).
//
// Units are inches. The bag is a 6 x 6 in squircle, 1 in thick, built from two
// panels (top and bottom) that meet at a seam. Each panel has a slightly crowned
// top, then a rounded edge that tapers in to the seam (a half-dome feel, not a
// bull nose), and the seam crease tucks in a hair. The front edge has a pinch
// with a zigzag stitch.
//
// The edge is built from rings that sit an EVEN distance in from the seam outline
// all the way round, so the edge cross section is the same at every angle.
//
// The flat fabric is a CUT square (default 7.5 x 7.5 in). Every vertex of the
// bag has a spot in that square (its UV), so an image placed in the square lands
// on the bag. The square is laid out like unfolded fabric: the top is 1:1 and the
// edge is unrolled outward from the junction, so surface length is preserved.

export const DEFAULTS = {
  cutIn: 7.5, // flat fabric square, bleed included
  safeIn: 6, // safe zone drawn in the editor (text and logos stay inside)
  halfWidthIn: 3, // half of the 6 in footprint
  cornerExp: 6.5, // squircle corner exponent (higher = squarer)
  thicknessIn: 1, // total thickness
  shoulderIn: 0.4, // radius of the old round dome the end is blended from
  endBlend: 0.5, // 0 = round dome end, 1 = fully tapered end
  taperStartIn: 2.1, // where the fully tapered end would leave the top
  taperPower: 1.8, // how pointed the tapered end is (2 = ellipse)
  crownIn: 0.06, // how far the middle of the top rises above the edge line (about 1.5 mm)
  pinchDepthIn: 0.14, // how far the front pinch goes in
  pinchHalfIn: 1.5, // half width of the pinch zone along the front edge
  seamGapIn: 0.016 // how far the seam crease tucks in from the widest point
};

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
  const CROWN = P.crownIn;

  // point on the unit squircle outline of half width a, at angle th
  const scA = (th, a) => {
    const c = Math.cos(th);
    const s = Math.sin(th);
    const k = a / Math.pow(Math.pow(Math.abs(c), N) + Math.pow(Math.abs(s), N), 1 / N);
    return [c * k, s * k];
  };
  const sc = (th) => scA(th, A);
  // outward normal of the seam outline at angle th
  const nrm = (th) => {
    const [x, y] = sc(th);
    const nx = Math.pow(Math.abs(x), N - 1) * Math.sign(x);
    const ny = Math.pow(Math.abs(y), N - 1) * Math.sign(y);
    const l = Math.hypot(nx, ny) || 1;
    return [nx / l, ny / l];
  };

  // 0..1 window over the front edge (by < 0): 1 inside the pinch, tapering out
  const pinchW = (th) => {
    const [bx, by] = sc(th);
    if (by >= 0) return 0;
    return ss((P.pinchHalfIn - Math.abs(bx)) / 0.5);
  };
  const span = Math.max(HALF - 0.1, 0.1);
  const dep = (z) => DM * ss((HALF - z) / span) * ss((z - 0.03) / 0.07);

  // ----- the edge profile: distance out from the center (x) at each height (z), then the seam tuck
  const xDome = (z) => (z >= WALL ? A - R * (1 - Math.sqrt(Math.max(0, 1 - Math.pow((z - WALL) / R, 2)))) : A);
  const xTaper = (z) => P.taperStartIn + (A - P.taperStartIn) * Math.pow(Math.max(0, 1 - Math.pow(cl(z / HALF), P.taperPower)), 1 / P.taperPower);
  const xEdge = (z) => {
    const x = (1 - P.endBlend) * xDome(z) + P.endBlend * xTaper(z);
    return x - P.seamGapIn * Math.pow(cl(1 - z / 0.04), 2);
  };
  const dEdge = (z) => A - xEdge(z); // inset from the seam outline
  const junctionIn = dEdge(HALF); // how far in the top meets the edge (about 0.65 in)

  // Edge rings from the junction down to the seam, spaced evenly by surface length.
  // Each ring: d = inset from the seam outline, z = height above the seam plane, s = surface distance from the junction.
  function edgeRings(NS = 40) {
    const M = 4000;
    const zs = [];
    const cum = [0];
    for (let i = 0; i <= M; i++) zs.push(HALF * (1 - i / M));
    for (let i = 1; i <= M; i++) cum.push(cum[i - 1] + Math.hypot(dEdge(zs[i]) - dEdge(zs[i - 1]), zs[i] - zs[i - 1]));
    const out = [];
    let m = 0;
    for (let k = 0; k <= NS; k++) {
      const target = (k / NS) * cum[M];
      while (m < M && cum[m + 1] < target) m++;
      const t = m >= M ? 1 : (target - cum[m]) / Math.max(cum[m + 1] - cum[m], 1e-12);
      const z = m >= M ? 0 : zs[m] + (zs[m + 1] - zs[m]) * t;
      out.push({ d: dEdge(z), z, s: target });
    }
    out[out.length - 1].z = 0;
    return out;
  }
  const edgeLen = edgeRings(80).pop().s; // surface distance from the junction to the seam
  // the flat fabric seam sits this far outside the seam outline (the unrolled edge is longer than the inset)
  const unroll = edgeLen - junctionIn;
  const seamHalfIn = A + unroll; // half width of the seam line in the flat square, middle of an edge

  // top face: z at a fraction s (0..1) of the way from the center to the junction
  const crownZ = (s) => HALF + CROWN * (1 - s * s);

  // seam line in the flat fabric: the seam outline pushed outward by the unroll distance. Points [x, y], y up.
  function seamOutline(steps = 240) {
    const out = [];
    for (let i = 0; i < steps; i++) {
      const th = (i / steps) * Math.PI * 2;
      const [x, y] = sc(th);
      const [nx, ny] = nrm(th);
      out.push([x + nx * unroll, y + ny * unroll]);
    }
    return out;
  }

  // bag (x, y, z) -> three.js (x, z, -y): the front edge faces the camera
  const P3 = (x, y, z) => [x, z, -y];

  // Build one panel. side = +1 (top) or -1 (bottom).
  function buildSide(side, { NA = 720, NS = 40, NT = 12 } = {}) {
    const edge = edgeRings(NS);
    const nL = NT - 1 + edge.length; // rings per angle: crowned top rings, then the edge rings
    const position = new Float32Array((1 + NA * nL) * 3);
    const uv = new Float32Array((1 + NA * nL) * 2);
    position.set(P3(0, 0, side * (HALF + CROWN)), 0);
    uv[0] = 0.5;
    uv[1] = 0.5;
    let vi = 1;
    for (let j = 0; j < NA; j++) {
      const th = (j / NA) * Math.PI * 2;
      const [px, py] = sc(th);
      const [nx, ny] = nrm(th);
      const pw = pinchW(th);
      // the junction outline point for this angle
      const jx = px - junctionIn * nx;
      const jy = py - junctionIn * ny;
      for (let i = 0; i < nL; i++) {
        let x, y, z, fx, fy;
        if (i < NT - 1) {
          const s = (i + 1) / NT;
          x = jx * s; y = jy * s; z = crownZ(s);
          fx = x; fy = y;
        } else {
          const e = edge[i - (NT - 1)];
          const dd = e.d + dep(e.z) * pw;
          x = px - dd * nx; y = py - dd * ny; z = e.z;
          fx = jx + nx * e.s; fy = jy + ny * e.s; // unrolled flat fabric
        }
        position.set(P3(x, y, side * z), vi * 3);
        uv[vi * 2] = 0.5 + fx / P.cutIn;
        uv[vi * 2 + 1] = 0.5 + (side * fy) / P.cutIn;
        vi++;
      }
    }
    const idx = (j, i) => 1 + (j % NA) * nL + i;
    const index = new Uint32Array(NA * (3 + (nL - 1) * 6));
    let k = 0;
    for (let j = 0; j < NA; j++) {
      if (side > 0) {
        index[k++] = 0; index[k++] = idx(j, 0); index[k++] = idx(j + 1, 0);
      } else {
        index[k++] = 0; index[k++] = idx(j + 1, 0); index[k++] = idx(j, 0);
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
      const [px, py] = sc(th);
      const [nx, ny] = nrm(th);
      const dd = dEdge(z) + dep(z) * pw - 0.004;
      pts.push(P3(px - dd * nx, py - dd * ny, side * z));
    }
    return pts;
  }

  // Outline of the squircle at a given half width (inches), as [x, y] with y up.
  function outline(halfIn, steps = 200) {
    const out = [];
    for (let i = 0; i < steps; i++) out.push(scA((i / steps) * Math.PI * 2, halfIn));
    return out;
  }

  return {
    params: P,
    A, N, HALF, R, WALL,
    seamHalfIn, junctionIn, unroll,
    sc, nrm, pinchW, dep, xEdge, dEdge, crownZ, edgeRings,
    buildSide, zigzag, outline, seamOutline
  };
}
