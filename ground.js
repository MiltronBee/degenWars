// degenWars ground plane (2.5D). The battlefield painting has a perspective ground; units live on it.
// Calibrated per painting in lab/ground.html and saved to data/ground.json:
//   quad  = image-normalised corners of the playable ground [far-left, far-right, near-right, near-left]
//   nearH = how tall a Grunt stands (figure height, as a fraction of the image height) on the near edge
//   horizon = image-normalised y of the horizon line (sets how fast units shrink with distance)
// Everything else follows from the geometry: a unit's on-screen size is proportional to the ground's
// width at its depth (true perspective), and it can only stand inside the quad.
window.Ground = (() => {
  const BASE = document.currentScript ? document.currentScript.src : location.href; // resolve data/ next to this file
  const GRUNT_M = 2.57; // Grunt figure height in metres (soldier sheet: (foot-head)*frameHeight/ppm)
  const DEF = {
    field: { img: 'art/field.webp', iw: 1600, ih: 893, posY: 0.6, nearH: 0.22,
      quad: [[0.04, 0.50], [0.96, 0.50], [1.35, 0.96], [-0.35, 0.96]] },
    tall: { img: 'art/field-tall.webp', iw: 1000, ih: 1241, posY: 0.4, nearH: 0.16,
      quad: [[0.02, 0.30], [0.98, 0.30], [1.6, 0.96], [-0.6, 0.96]] },
  };
  const C = JSON.parse(JSON.stringify(DEF));
  const ready = fetch(new URL('data/ground.json', BASE), { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null))
    .then(j => { if (j) for (const k in j) if (C[k]) Object.assign(C[k], j[k]); }).catch(() => {});

  // projective map of the unit square onto a quad (Heckbert): (0,0) far-left, (1,0) far-right, (1,1) near-right, (0,1) near-left
  function homog(q) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    let g = 0, h = 0;
    if (Math.abs(dx3) > 1e-12 || Math.abs(dy3) > 1e-12) {
      const den = dx1 * dy2 - dx2 * dy1;
      g = (dx3 * dy2 - dx2 * dy3) / den; h = (dx1 * dy3 - dx3 * dy1) / den;
    }
    return { a: x1 - x0 + g * x1, b: x3 - x0 + h * x3, c: x0, d: y1 - y0 + g * y1, e: y3 - y0 + h * y3, f: y0, g, h };
  }
  const fwd = (H, u, v) => { const w = H.g * u + H.h * v + 1; return [(H.a * u + H.b * v + H.c) / w, (H.d * u + H.e * v + H.f) / w]; };
  const inv = (H, x, y) => {
    const A = H.a - H.g * x, B = H.b - H.h * x, P = x - H.c, D = H.d - H.g * y, E = H.e - H.h * y, Q = y - H.f, det = A * E - B * D;
    return [(P * E - B * Q) / det, (A * Q - P * D) / det];
  };

  // Default horizon: where the quad's side edges meet if they converge; otherwise one that makes far units half the near size.
  function horizonOf(c) {
    if (Number.isFinite(c.horizon)) return c.horizon;
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = c.quad, yf = (y0 + y1) / 2, yn = (y2 + y3) / 2;
    const wf = Math.abs(x1 - x0), wn = Math.abs(x2 - x3);
    if (wn > wf * 1.05) return yf - (yn - yf) * wf / (wn - wf); // vanishing line of the converging sides
    return 2 * yf - yn;                                         // far = 50% of near
  }
  // frame(key, W, H): the ground as seen in a W x H box whose background is the painting (CSS cover, posY).
  // Pinhole camera over a flat ground: screen distance below the horizon is proportional to 1/depth, so
  // equal steps of world depth bunch up toward the horizon and a unit's size is proportional to (y - horizon).
  // Across, a unit at fraction a sits between the quad's left and right edges at its screen row.
  function frame(key, W, Hh) {
    const c = C[key] || C.field, s = Math.max(W / c.iw, Hh / c.ih), dw = c.iw * s, dh = c.ih * s;
    const ox = (W - dw) / 2, oy = (Hh - dh) * c.posY;
    const quad = c.quad.map(([u, v]) => [ox + u * dw, oy + v * dh]);
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
    const yf = (y0 + y1) / 2, yn = (y2 + y3) / 2;
    let yh = oy + Math.min(horizonOf(c), (yf - oy) / dh - 0.005) * dh;  // horizon must stay above the far edge
    const r = (yn - yh) / (yf - yh);                                    // far depth / near depth
    const Z = b => r + (1 - r) * b, yOf = b => yh + (yn - yh) / Z(b);
    const t = y => (y - yf) / (yn - yf), L = y => x0 + (x3 - x0) * t(y), Rr = y => x1 + (x2 - x1) * t(y);
    const pxmNear = (c.nearH * dh) / GRUNT_M;
    return {
      W, H: Hh, quad, key, horizon: yh, farScale: 1 / r,
      toScreen: (a, b) => { const y = yOf(b); return [L(y) + (Rr(y) - L(y)) * a, y]; },  // a: 0..1 across, b: 0 far .. 1 near
      toGround: (x, y) => { const z = (yn - yh) / (y - yh), b = (z - r) / (1 - r); return [(x - L(y)) / (Rr(y) - L(y)), y > yh ? b : -1]; },
      pxPerM: b => pxmNear / Z(b),
      scale: b => 1 / Z(b),
    };
  }
  return { ready, C, DEF, frame, horizonOf, homog, fwd, inv, GRUNT_M };
})();
