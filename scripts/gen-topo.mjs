import fs from "fs";
import path from "path";

// Canvas dimensions and fine grid resolution
const W = 1600;
const H = 1000;
const S = 4; // Fine grid step size: 400x250 cells (100,651 vertices)
const nx = Math.floor(W / S) + 1;
const ny = Math.floor(H / S) + 1;

// Deterministic PRNG for reproducible, beautiful terrain
let seed = 7;
function rnd() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

// Low-frequency sinusoids for natural, sweeping topographic ridges and valleys
const waves = [];
for (let i = 0; i < 16; i++) {
  const angle = rnd() * Math.PI * 2;
  const f = 0.0014 + rnd() * 0.0032; // Wavelength ~280 to ~650 units
  waves.push({
    kx: Math.cos(angle) * f * Math.PI * 2,
    ky: Math.sin(angle) * f * Math.PI * 2,
    phase: rnd() * Math.PI * 2,
    amp: 1 / (1 + f * 400),
  });
}

// Compute field values on the fine grid
let f = new Float32Array(nx * ny);
for (let j = 0; j < ny; j++) {
  const y = j * S;
  const rowOffset = j * nx;
  for (let i = 0; i < nx; i++) {
    const x = i * S;
    let v = 0;
    for (const w of waves) {
      v += w.amp * Math.sin(w.kx * x + w.ky * y + w.phase);
    }
    f[rowOffset + i] = v;
  }
}

// Separable Gaussian blur (radius = 6 cells = 24 canvas units) to guarantee C^inf smoothness
function gaussianBlur(src, r) {
  const sigma = r / 2;
  const k = [];
  let sumK = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v);
    sumK += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sumK;

  const temp = new Float32Array(src.length);
  const out = new Float32Array(src.length);

  // Horizontal blur pass
  for (let j = 0; j < ny; j++) {
    const row = j * nx;
    for (let i = 0; i < nx; i++) {
      let sum = 0;
      for (let d = -r; d <= r; d++) {
        const ni = Math.min(nx - 1, Math.max(0, i + d));
        sum += src[row + ni] * k[d + r];
      }
      temp[row + i] = sum;
    }
  }

  // Vertical blur pass
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let sum = 0;
      for (let d = -r; d <= r; d++) {
        const nj = Math.min(ny - 1, Math.max(0, j + d));
        sum += temp[nj * nx + i] * k[d + r];
      }
      out[j * nx + i] = sum;
    }
  }

  return out;
}

f = gaussianBlur(f, 6);

// Find field range
let minVal = Infinity;
let maxVal = -Infinity;
for (const v of f) {
  if (v < minVal) minVal = v;
  if (v > maxVal) maxVal = v;
}

// Extract contours using marching squares with linear interpolation and asymptotic decider
function extractContours(isovalue) {
  const ptMap = new Map();
  const adj = new Map();

  function getHPoint(i, j) {
    const key = `H_${i}_${j}`;
    if (!ptMap.has(key)) {
      const v0 = f[j * nx + i];
      const v1 = f[j * nx + i + 1];
      const u = (isovalue - v0) / (v1 - v0);
      ptMap.set(key, [(i + u) * S, j * S]);
    }
    return key;
  }

  function getVPoint(i, j) {
    const key = `V_${i}_${j}`;
    if (!ptMap.has(key)) {
      const v0 = f[j * nx + i];
      const v1 = f[(j + 1) * nx + i];
      const u = (isovalue - v0) / (v1 - v0);
      ptMap.set(key, [i * S, (j + u) * S]);
    }
    return key;
  }

  function addSegment(k1, k2) {
    if (k1 === k2) return;
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1).push(k2);
    adj.get(k2).push(k1);
  }

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const v0 = f[j * nx + i];
      const v1 = f[j * nx + i + 1];
      const v2 = f[(j + 1) * nx + i + 1];
      const v3 = f[(j + 1) * nx + i];

      const b0 = v0 > isovalue ? 8 : 0;
      const b1 = v1 > isovalue ? 4 : 0;
      const b2 = v2 > isovalue ? 2 : 0;
      const b3 = v3 > isovalue ? 1 : 0;
      const code = b0 | b1 | b2 | b3;
      if (code === 0 || code === 15) continue;

      const top = () => getHPoint(i, j);
      const right = () => getVPoint(i + 1, j);
      const bottom = () => getHPoint(i, j + 1);
      const left = () => getVPoint(i, j);

      switch (code) {
        case 1:  addSegment(bottom(), left()); break;
        case 2:  addSegment(right(), bottom()); break;
        case 3:  addSegment(left(), right()); break;
        case 4:  addSegment(top(), right()); break;
        case 5: {
          const vc = (v0 + v1 + v2 + v3) * 0.25;
          if (vc > isovalue) {
            addSegment(top(), right());
            addSegment(bottom(), left());
          } else {
            addSegment(top(), left());
            addSegment(right(), bottom());
          }
          break;
        }
        case 6:  addSegment(top(), bottom()); break;
        case 7:  addSegment(top(), left()); break;
        case 8:  addSegment(top(), left()); break;
        case 9:  addSegment(top(), bottom()); break;
        case 10: {
          const vc = (v0 + v1 + v2 + v3) * 0.25;
          if (vc > isovalue) {
            addSegment(top(), left());
            addSegment(right(), bottom());
          } else {
            addSegment(top(), right());
            addSegment(bottom(), left());
          }
          break;
        }
        case 11: addSegment(top(), right()); break;
        case 12: addSegment(left(), right()); break;
        case 13: addSegment(right(), bottom()); break;
        case 14: addSegment(bottom(), left()); break;
      }
    }
  }

  const visited = new Set();
  const polylines = [];

  // Trace open paths (starting at boundary degree 1 nodes)
  for (const [k, nbrs] of adj.entries()) {
    if (nbrs.length === 1 && !visited.has(k)) {
      const line = [ptMap.get(k)];
      visited.add(k);
      let curr = k;
      let prev = null;
      while (true) {
        const nexts = adj.get(curr).filter(n => n !== prev && !visited.has(n));
        if (nexts.length === 0) break;
        const next = nexts[0];
        visited.add(next);
        line.push(ptMap.get(next));
        prev = curr;
        curr = next;
      }
      polylines.push({ points: line, closed: false });
    }
  }

  // Trace closed loops (remaining degree 2 cycles)
  for (const [k, nbrs] of adj.entries()) {
    if (!visited.has(k)) {
      const loop = [ptMap.get(k)];
      visited.add(k);
      let curr = k;
      let prev = null;
      while (true) {
        const nexts = adj.get(curr).filter(n => n !== prev && !visited.has(n));
        if (nexts.length === 0) break;
        const next = nexts[0];
        visited.add(next);
        loop.push(ptMap.get(next));
        prev = curr;
        curr = next;
      }
      polylines.push({ points: loop, closed: true });
    }
  }

  return polylines;
}

// Resample each polyline at even arc-length spacing (~18 units) & drop tiny fragments
function resamplePolyline(poly, targetSpacing = 18, minLength = 60) {
  const pts = poly.points;
  const closed = poly.closed;
  const n = pts.length;
  if (n < 2) return null;

  const s = [0];
  for (let i = 1; i < n; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    s.push(s[i - 1] + Math.hypot(dx, dy));
  }
  let totalLen = s[n - 1];
  if (closed) {
    const dx = pts[0][0] - pts[n - 1][0];
    const dy = pts[0][1] - pts[n - 1][1];
    totalLen += Math.hypot(dx, dy);
  }

  // Drop tiny fragments / isolated noise loops
  if (totalLen < minLength) return null;

  const numSegs = Math.max(closed ? 8 : 2, Math.round(totalLen / targetSpacing));
  const step = totalLen / numSegs;

  const resampled = [];
  let currIdx = 0;

  function getPointAt(dist) {
    if (dist <= 0) return pts[0];
    if (!closed && dist >= totalLen) return pts[n - 1];

    if (closed && dist > s[n - 1]) {
      const segLen = totalLen - s[n - 1];
      const u = (dist - s[n - 1]) / segLen;
      return [
        pts[n - 1][0] + u * (pts[0][0] - pts[n - 1][0]),
        pts[n - 1][1] + u * (pts[0][1] - pts[n - 1][1]),
      ];
    }

    while (currIdx < n - 1 && s[currIdx + 1] < dist) {
      currIdx++;
    }
    const segLen = s[currIdx + 1] - s[currIdx];
    if (segLen < 1e-9) return pts[currIdx];
    const u = (dist - s[currIdx]) / segLen;
    return [
      pts[currIdx][0] + u * (pts[currIdx + 1][0] - pts[currIdx][0]),
      pts[currIdx][1] + u * (pts[currIdx + 1][1] - pts[currIdx][1]),
    ];
  }

  const count = closed ? numSegs : numSegs + 1;
  for (let i = 0; i < count; i++) {
    resampled.push(getPointAt(i * step));
  }

  return { points: resampled, closed };
}

// 3 passes of Gaussian/Laplacian moving average smoothing
function smoothPolyline(poly, passes = 3) {
  let pts = poly.points;
  const closed = poly.closed;
  const n = pts.length;
  if (n < 3) return poly;

  for (let p = 0; p < passes; p++) {
    const next = [];
    if (closed) {
      for (let i = 0; i < n; i++) {
        const pPrev = pts[(i - 1 + n) % n];
        const pCurr = pts[i];
        const pNext = pts[(i + 1) % n];
        next.push([
          0.18 * pPrev[0] + 0.64 * pCurr[0] + 0.18 * pNext[0],
          0.18 * pPrev[1] + 0.64 * pCurr[1] + 0.18 * pNext[1],
        ]);
      }
    } else {
      next.push(pts[0]); // Keep boundary endpoints pinned exactly
      for (let i = 1; i < n - 1; i++) {
        const pPrev = pts[i - 1];
        const pCurr = pts[i];
        const pNext = pts[i + 1];
        next.push([
          0.18 * pPrev[0] + 0.64 * pCurr[0] + 0.18 * pNext[0],
          0.18 * pPrev[1] + 0.64 * pCurr[1] + 0.18 * pNext[1],
        ]);
      }
      next.push(pts[n - 1]); // Keep boundary endpoints pinned exactly
    }
    pts = next;
  }
  return { points: pts, closed };
}

// Format coordinates to 2 decimal places, stripping unnecessary trailing zeros
function formatCoord(v) {
  const rounded = Math.round(v * 100) / 100;
  return rounded.toString();
}

// Convert polyline to centripetal Catmull-Rom -> cubic Bezier path string
function polylineToPath(poly) {
  const pts = poly.points;
  const closed = poly.closed;
  const n = pts.length;
  if (n < 2) return "";

  const segCount = closed ? n : n - 1;

  function getPt(idx) {
    if (closed) {
      return pts[(idx % n + n) % n];
    } else {
      if (idx < 0) return [2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1]];
      if (idx >= n) return [2 * pts[n - 1][0] - pts[n - 2][0], 2 * pts[n - 1][1] - pts[n - 2][1]];
      return pts[idx];
    }
  }

  let d = `M${formatCoord(pts[0][0])} ${formatCoord(pts[0][1])}`;

  for (let i = 0; i < segCount; i++) {
    const p0 = getPt(i - 1);
    const p1 = getPt(i);
    const p2 = getPt(i + 1);
    const p3 = getPt(i + 2);

    // Centripetal Catmull-Rom (alpha = 0.5) parameterization prevents cusps and self-intersection
    const d1 = Math.sqrt(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])) || 1e-4;
    const d2 = Math.sqrt(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) || 1e-4;
    const d3 = Math.sqrt(Math.hypot(p3[0] - p2[0], p3[1] - p2[1])) || 1e-4;

    const v1x = (p2[0] - p1[0]) / d2 + (p1[0] - p0[0]) / d1 - (p2[0] - p0[0]) / (d1 + d2);
    const v1y = (p2[1] - p1[1]) / d2 + (p1[1] - p0[1]) / d1 - (p2[1] - p0[1]) / (d1 + d2);

    const v2x = (p3[0] - p2[0]) / d3 + (p2[0] - p1[0]) / d2 - (p3[0] - p1[0]) / (d2 + d3);
    const v2y = (p3[1] - p2[1]) / d3 + (p2[1] - p1[1]) / d2 - (p3[1] - p1[1]) / (d2 + d3);

    const cp1x = p1[0] + (d2 / 3) * v1x;
    const cp1y = p1[1] + (d2 / 3) * v1y;
    const cp2x = p2[0] - (d2 / 3) * v2x;
    const cp2y = p2[1] - (d2 / 3) * v2y;

    d += `C${formatCoord(cp1x)} ${formatCoord(cp1y)} ${formatCoord(cp2x)} ${formatCoord(cp2y)} ${formatCoord(p2[0])} ${formatCoord(p2[1])}`;
  }

  if (closed) d += "Z";
  return d;
}

// Generate the 3 opacity groups
const N = 26;
const layers = {
  index: [], // opacity 0.55, width 0.45
  mid: [],   // opacity 0.30, width 0.30
  faint: [], // opacity 0.16, width 0.30
};

let totalBezierSegments = 0;
let totalPathsCount = 0;

for (let l = 1; l < N; l++) {
  const isovalue = minVal + (maxVal - minVal) * (l / N);
  const rawPolys = extractContours(isovalue);

  // Cartographic elevation hierarchy: every 5th contour is an index contour
  const group = (l % 5 === 0) ? "index" : (l % 2 === 0 ? "mid" : "faint");

  for (const raw of rawPolys) {
    const resampled = resamplePolyline(raw, 18, 60);
    if (!resampled) continue;

    const smoothed = smoothPolyline(resampled, 3);
    const pathD = polylineToPath(smoothed);

    layers[group].push(pathD);
    totalPathsCount++;
    totalBezierSegments += smoothed.closed ? smoothed.points.length : smoothed.points.length - 1;
  }
}

// Assemble final SVG preserving exact soft multi-opacity styling, sage-grey color, and edge mask
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="f"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity=".45"/></radialGradient><mask id="m"><rect width="${W}" height="${H}" fill="url(#f)"/></mask></defs><g mask="url(#m)" fill="none" stroke="#7d8a78" stroke-linecap="round" stroke-linejoin="round"><path stroke-width="0.45" stroke-opacity="0.55" d="${layers.index.join("")}"/><path stroke-width="0.3" stroke-opacity="0.3" d="${layers.mid.join("")}"/><path stroke-width="0.3" stroke-opacity="0.16" d="${layers.faint.join("")}"/></g></svg>\n`;

const outputPath = path.resolve("public/topo.svg");
fs.writeFileSync(outputPath, svgContent);

const fileSizeKB = (Buffer.byteLength(svgContent) / 1024).toFixed(1);
console.log(`Successfully generated public/topo.svg:`);
console.log(`- File size: ${fileSizeKB} KB (${Buffer.byteLength(svgContent)} bytes)`);
console.log(`- Contours: ${totalPathsCount} paths, ${totalBezierSegments} cubic Bezier segments`);
console.log(`- Index paths: ${layers.index.length}, Mid paths: ${layers.mid.length}, Faint paths: ${layers.faint.length}`);
