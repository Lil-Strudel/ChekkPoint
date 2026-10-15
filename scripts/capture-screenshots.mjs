import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const outDir = path.resolve("screenshots");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// 1. Full page at 1440x900 on localhost:3001
console.log("Capturing 1440x900 page screenshot...");
execSync(`/usr/bin/chromium --headless --disable-gpu --window-size=1440,900 --screenshot="${path.join(outDir, "page_1440.png")}" http://localhost:3001/`);

// 2. Direct standalone viewer HTML for raw SVG inspection
const htmlViewer = `<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; padding: 0; background: #f4f1ea; display: flex; align-items: center; justify-content: center; width: 1600px; height: 1000px; overflow: hidden; }
  img { width: 1600px; height: 1000px; display: block; }
</style>
</head>
<body>
  <img src="file://${path.resolve("public/topo.svg")}" />
</body>
</html>`;

const viewerPath = path.resolve("/tmp/topo_viewer.html");
fs.writeFileSync(viewerPath, htmlViewer);

console.log("Capturing full 1600x1000 raw topo screenshot...");
execSync(`/usr/bin/chromium --headless --disable-gpu --window-size=1600,1000 --screenshot="${path.join(outDir, "topo_raw_1600.png")}" "file://${viewerPath}"`);

// 3. Zoomed crop at Device Scale Factor 3 (scale 3x, center region: x=600..1000, y=300..700)
const zoomHtmlCenter = `<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; padding: 0; background: #f4f1ea; width: 600px; height: 600px; overflow: hidden; }
  .wrapper { position: absolute; left: -600px; top: -300px; width: 1600px; height: 1000px; }
  img { width: 1600px; height: 1000px; display: block; }
</style>
</head>
<body>
  <div class="wrapper">
    <img src="file://${path.resolve("public/topo.svg")}" />
  </div>
</body>
</html>`;

const zoomCenterPath = path.resolve("/tmp/topo_zoom_center.html");
fs.writeFileSync(zoomCenterPath, zoomHtmlCenter);

console.log("Capturing 3x zoomed crop (center)...");
execSync(`/usr/bin/chromium --headless --disable-gpu --force-device-scale-factor=3 --window-size=600,600 --screenshot="${path.join(outDir, "topo_zoom_center_dpr3.png")}" "file://${zoomCenterPath}"`);

// 4. Zoomed crop at Device Scale Factor 3 (region with tight loops: x=900..1500, y=100..700)
const zoomHtmlLoops = `<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; padding: 0; background: #f4f1ea; width: 600px; height: 600px; overflow: hidden; }
  .wrapper { position: absolute; left: -950px; top: -150px; width: 1600px; height: 1000px; }
  img { width: 1600px; height: 1000px; display: block; }
</style>
</head>
<body>
  <div class="wrapper">
    <img src="file://${path.resolve("public/topo.svg")}" />
  </div>
</body>
</html>`;

const zoomLoopsPath = path.resolve("/tmp/topo_zoom_loops.html");
fs.writeFileSync(zoomLoopsPath, zoomHtmlLoops);

console.log("Capturing 3x zoomed crop (concentric loops)...");
execSync(`/usr/bin/chromium --headless --disable-gpu --force-device-scale-factor=3 --window-size=600,600 --screenshot="${path.join(outDir, "topo_zoom_loops_dpr3.png")}" "file://${zoomLoopsPath}"`);

console.log("All screenshots captured in screenshots/ directory.");
