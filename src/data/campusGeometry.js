// Pure contract helpers shared by rendering and server validation.
export const campusRecipes = new Set(['teaching-block','library','business-school','ceremonial-gate','small-gate','classical-hall','twin-tower','clock-tower','shop','white-house','academic','wayfinding']);
export function regionFootprint(r) {
 const c=Math.abs(Math.cos(r.rotation||0)),s=Math.abs(Math.sin(r.rotation||0));
 return {w:c*(r.w||12)+s*(r.d||8),d:s*(r.w||12)+c*(r.d||8)};
}
