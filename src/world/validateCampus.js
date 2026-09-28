import { recipes } from "./buildings.js";

const requiredArrays = ["tasks", "landmarks", "memories", "regions"];

/** Validate the map contract used by the pixel-campus skill before building meshes. */
export function validateCampus(campus) {
  if (!campus || typeof campus !== "object") throw new TypeError("Campus must be an object");
  for (const key of requiredArrays) {
    if (!Array.isArray(campus[key])) throw new TypeError(`Campus.${key} must be an array`);
  }
  if (!campus.bounds?.width || !campus.bounds?.depth) throw new TypeError("Campus.bounds needs width and depth");
  if (!campus.spawn || !Number.isFinite(campus.spawn.x) || !Number.isFinite(campus.spawn.z)) {
    throw new TypeError("Campus.spawn needs numeric x and z");
  }
  const taskIds = new Set(campus.tasks.map((task) => task.id));
  for (const mark of campus.landmarks) {
    if (!mark.id || !mark.title || !mark.quote || !mark.speech) throw new TypeError(`Landmark ${mark.id || "?"} is missing copy`);
    if (mark.taskId && !taskIds.has(mark.taskId)) throw new TypeError(`Landmark ${mark.id} references unknown task ${mark.taskId}`);
  }
  for (const region of campus.regions) {
    if (!region.id || !region.type) throw new TypeError("Every region needs id and type");
    if (["building", "prop-row"].includes(region.type) && !Number.isFinite(region.x)) {
      throw new TypeError(`Region ${region.id} needs a numeric x coordinate`);
    }
    if (region.type === "building" && !recipes[region.recipe]) throw new TypeError(`Unknown building recipe: ${region.recipe}`);
  }
  return campus;
}
