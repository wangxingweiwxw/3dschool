import fs from "node:fs";

const queries = {
  fudanOsmSnapshot: `[out:json][timeout:60];(way["building"](31.294,121.494,31.305,121.512);way["highway"](31.294,121.494,31.305,121.512);way["natural"="water"](31.294,121.494,31.305,121.512);way["landuse"="grass"](31.294,121.494,31.305,121.512););out center tags;`,
  fudanOsmBuildings: `[out:json][timeout:90];way["building"](31.296,121.497,31.304,121.509);out geom tags;`,
  fudanOsmFeatures: `[out:json][timeout:90];(way["highway"](31.296,121.497,31.304,121.509);way["natural"="water"](31.296,121.497,31.304,121.509);way["landuse"="grass"](31.296,121.497,31.304,121.509););out geom tags;`,
};
const endpoint = "https://overpass-api.de/api/interpreter?data=";
for (const [name, query] of Object.entries(queries)) {
  const response = await fetch(endpoint + encodeURIComponent(query), { headers: { "User-Agent": "3Dschool/1.0 (OpenStreetMap importer)" } });
  if (!response.ok) throw new Error(`Overpass request failed for ${name}: ${response.status}`);
  fs.writeFileSync(`src/data/${name}.json`, await response.text());
  console.log(`Downloaded ${name}.json`);
}
await import("./fetch-fudan-osm.mjs");
