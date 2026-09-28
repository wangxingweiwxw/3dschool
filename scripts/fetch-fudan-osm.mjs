import fs from "node:fs";

const origin = { lat: 31.3000, lon: 121.5030 };
const metersPerUnit = 8;
const bounds = { width: 108, depth: 92 };
const latScale = 111320;
const lonScale = 111320 * Math.cos(origin.lat * Math.PI / 180);

function project(point) {
  return {
    x: (point.lon - origin.lon) * lonScale / metersPerUnit,
    z: (origin.lat - point.lat) * latScale / metersPerUnit,
  };
}
function inside(x, z, pad = 0) {
  return Math.abs(x) <= bounds.width / 2 + pad && Math.abs(z) <= bounds.depth / 2 + pad;
}
function pointsOf(way) {
  return (way.geometry || []).map((p) => project({ lat: p.lat, lon: p.lon }));
}
function extent(points) {
  return {
    minX: Math.min(...points.map((p) => p.x)), maxX: Math.max(...points.map((p) => p.x)),
    minZ: Math.min(...points.map((p) => p.z)), maxZ: Math.max(...points.map((p) => p.z)),
  };
}
function regionId(prefix, id) { return `osm-${prefix}-${id}`; }
function centerFromExtent(e) { return { x: (e.minX + e.maxX) / 2, z: (e.minZ + e.maxZ) / 2 }; }

const buildings = JSON.parse(fs.readFileSync("src/data/fudanOsmBuildings.json", "utf8")).elements;
const features = JSON.parse(fs.readFileSync("src/data/fudanOsmFeatures.json", "utf8")).elements;
const regions = [];

for (const way of buildings) {
  const points = pointsOf(way);
  if (points.length < 3) continue;
  const e = extent(points);
  const center = centerFromExtent(e);
  const w = Math.max(1.8, e.maxX - e.minX);
  const d = Math.max(1.8, e.maxZ - e.minZ);
  if (!inside(center.x, center.z) || w * d < 8) continue;
  const levels = Number.parseFloat(way.tags?.["building:levels"] || "") || (way.tags?.building === "yes" ? 2 : 3);
  regions.push({
    id: regionId("building", way.id), type: "building", recipe: "academic",
    x: Number(center.x.toFixed(2)), z: Number(center.z.toFixed(2)),
    w: Number(Math.min(w, 16).toFixed(2)), d: Number(Math.min(d, 16).toFixed(2)),
    h: Number(Math.max(2.8, Math.min(levels * 2.5, 12)).toFixed(1)), solid: false,
    label: way.tags?.name || way.tags?.["name:en"] || "OSM building",
  });
}

const roadWidth = { primary: 3.2, secondary: 2.8, tertiary: 2.4, residential: 1.8, service: 1.2, pedestrian: 1.1, footway: 0.8, path: 0.7, cycleway: 0.8, living_street: 1.4 };
for (const way of features) {
  const kind = way.tags?.highway;
  if (!kind || !roadWidth[kind]) continue;
  const points = pointsOf(way);
  if (points.length < 2) continue;
  const first = points[0]; const last = points[points.length - 1];
  const center = points[Math.floor(points.length / 2)];
  if (!inside(center.x, center.z, 2)) continue;
  const length = Math.hypot(last.x - first.x, last.z - first.z);
  if (length < 2) continue;
  regions.push({
    id: regionId("road", way.id), type: "path", x: Number(center.x.toFixed(2)), z: Number(center.z.toFixed(2)),
    w: Number(Math.min(length, 40).toFixed(2)), d: roadWidth[kind],
    rotation: Number(Math.atan2(last.z - first.z, last.x - first.x).toFixed(4)),
  });
}

for (const way of features) {
  const tag = way.tags?.natural === "water" ? "water" : way.tags?.landuse === "grass" ? "lawn" : null;
  if (!tag) continue;
  const points = pointsOf(way);
  if (points.length < 3) continue;
  const e = extent(points); const center = centerFromExtent(e);
  if (!inside(center.x, center.z)) continue;
  regions.push({ id: regionId(tag, way.id), type: tag, x: Number(center.x.toFixed(2)), z: Number(center.z.toFixed(2)), w: Number(Math.max(2, Math.min(e.maxX - e.minX, 24)).toFixed(2)), d: Number(Math.max(2, Math.min(e.maxZ - e.minZ, 24)).toFixed(2)), tint: tag === "lawn" ? 0x5aa83b : undefined, solid: tag === "water" });
}

const clean = regions.map((r) => Object.fromEntries(Object.entries(r).filter(([, value]) => value !== undefined)));
const output = `// Generated from OpenStreetMap via scripts/fetch-fudan-osm.mjs. Data © OpenStreetMap contributors (ODbL).\nexport const fudanOsmRegions = ${JSON.stringify(clean, null, 2)};\n`;
fs.writeFileSync("src/data/fudanOsmRegions.js", output);
console.log(`Generated ${clean.length} regions (${clean.filter((r) => r.type === "building").length} buildings, ${clean.filter((r) => r.type === "path").length} roads).`);
