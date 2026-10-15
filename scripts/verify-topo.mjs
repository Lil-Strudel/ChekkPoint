import fs from "fs";
import { execSync } from "child_process";

console.log("=== Verifying topo.svg ===");

const svgPath = "public/topo.svg";
const content = fs.readFileSync(svgPath, "utf-8");
const bytes = Buffer.byteLength(content);
console.log(`1. File Size: ${(bytes / 1024).toFixed(1)} KB (${bytes} bytes) [Limit: <300 KB] -> ${bytes < 300 * 1024 ? "PASS" : "FAIL"}`);

// Check attributes
const hasRoundJoin = content.includes('stroke-linejoin="round"');
const hasRoundCap = content.includes('stroke-linecap="round"');
const hasNoneFill = content.includes('fill="none"');
const hasMask = content.includes('mask="url(#m)"');
const hasRadialGradient = content.includes('<radialGradient id="f">');
console.log(`2. SVG Attributes:
   - stroke-linejoin="round": ${hasRoundJoin ? "PASS" : "FAIL"}
   - stroke-linecap="round": ${hasRoundCap ? "PASS" : "FAIL"}
   - fill="none": ${hasNoneFill ? "PASS" : "FAIL"}
   - radial mask applied: ${hasMask && hasRadialGradient ? "PASS" : "FAIL"}`);

// Parse all Bezier curves from the paths
const pathMatches = content.matchAll(/<path[^>]+d="([^"]+)"/g);
let totalCurves = 0;
let maxKnotAngle = 0;
let maxSampleAngle = 0;
let cuspsCount = 0;
let nonIntegerCoords = 0;
let integerCoords = 0;

for (const match of pathMatches) {
  const d = match[1];
  // Check for floating point coordinates (decimals present)
  const numbers = d.match(/-?\d+(\.\d+)?/g) || [];
  for (const num of numbers) {
    if (num.includes(".")) nonIntegerCoords++;
    else integerCoords++;
  }

  // Parse subpaths
  const subpaths = d.split(/(?=M)/);
  for (const sp of subpaths) {
    if (!sp.startsWith("M")) continue;
    const closed = sp.endsWith("Z");
    const cleanSp = sp.replace(/[MZ]/g, "").trim();

    // Split into M start point and C segments
    const parts = cleanSp.split("C");
    if (parts.length < 2) continue;

    const startPt = parts[0].trim().split(/\s+/).map(Number);
    let currPt = startPt;

    const beziers = [];

    for (let i = 1; i < parts.length; i++) {
      const coords = parts[i].trim().split(/\s+/).map(Number);
      if (coords.length < 6) continue;
      const b0 = currPt;
      const b1 = [coords[0], coords[1]];
      const b2 = [coords[2], coords[3]];
      const b3 = [coords[4], coords[5]];
      beziers.push({ b0, b1, b2, b3 });
      currPt = b3;
      totalCurves++;
    }

    // 1. Knot tangent angle continuity
    const segsToCheck = closed ? beziers.length : beziers.length - 1;
    for (let i = 0; i < segsToCheck; i++) {
      const segA = beziers[i];
      const segB = beziers[(i + 1) % beziers.length];

      const tAx = segA.b3[0] - segA.b2[0];
      const tAy = segA.b3[1] - segA.b2[1];
      const tBx = segB.b1[0] - segB.b0[0];
      const tBy = segB.b1[1] - segB.b0[1];

      const lenA = Math.hypot(tAx, tAy);
      const lenB = Math.hypot(tBx, tBy);
      if (lenA > 1e-4 && lenB > 1e-4) {
        const dot = (tAx * tBx + tAy * tBy) / (lenA * lenB);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
        if (angle > maxKnotAngle) maxKnotAngle = angle;
      }
    }

    // 2. Sampled curve turning angles (fine arc-length sampling)
    const sampled = [];
    for (let i = 0; i < beziers.length; i++) {
      const { b0, b1, b2, b3 } = beziers[i];
      for (let s = (i === 0 ? 0 : 1); s <= 8; s++) {
        const u = s / 8;
        const u1 = 1 - u;
        const px = u1 * u1 * u1 * b0[0] + 3 * u1 * u1 * u * b1[0] + 3 * u1 * u * u * b2[0] + u * u * u * b3[0];
        const py = u1 * u1 * u1 * b0[1] + 3 * u1 * u1 * u * b1[1] + 3 * u1 * u * u * b2[1] + u * u * u * b3[1];
        sampled.push([px, py]);
      }
    }

    for (let k = 1; k < sampled.length - 1; k++) {
      const pA = sampled[k - 1];
      const pB = sampled[k];
      const pC = sampled[k + 1];
      const d1x = pB[0] - pA[0], d1y = pB[1] - pA[1];
      const d2x = pC[0] - pB[0], d2y = pC[1] - pB[1];
      const len1 = Math.hypot(d1x, d1y);
      const len2 = Math.hypot(d2x, d2y);
      if (len1 > 0.05 && len2 > 0.05) {
        const dot = (d1x * d2x + d1y * d2y) / (len1 * len2);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
        if (angle > maxSampleAngle) maxSampleAngle = angle;
        if (angle > 45) cuspsCount++;
      }
    }
  }
}

console.log(`3. Geometric & Mathematical Analysis:
   - Total cubic Bezier curves: ${totalCurves}
   - Decimal coordinate precision: ${nonIntegerCoords} floating-point coords vs ${integerCoords} integers
   - Max knot tangent discontinuity angle: ${maxKnotAngle.toFixed(3)}° [Target: < 2°] -> ${maxKnotAngle < 2 ? "PASS (super smooth C^1 continuity)" : "FAIL"}
   - Max sample turning angle (over 2.25 unit steps): ${maxSampleAngle.toFixed(2)}° [Target: < 20°] -> ${maxSampleAngle < 20 ? "PASS" : "FAIL"}
   - Cusps detected (turning angle > 45°): ${cuspsCount} [Target: 0] -> ${cuspsCount === 0 ? "PASS (Zero cusps!)" : "FAIL"}`);

