import type { Manifest, Decoration, PlacementKey } from './decorations';
import type { Presentation } from './presentation-model';
export function viewPresentation(manifest: Manifest, key: PlacementKey): Presentation {
  return (manifest.presentations ??= {})[key] ??= {};
}
export function viewMood(manifest: Manifest, key: PlacementKey) {
  return viewPresentation(manifest,key).mood ??= structuredClone(manifest.mood ?? {preset:'neutral',intensity:0,tvGlow:100});
}
export function removeFromView(item: Decoration, key: PlacementKey) {
  const placement=item.placements[key];
  if(placement) placement.hidden=true;
}
export function duplicateInView(item: Decoration, key: PlacementKey): Decoration {
  const copy=structuredClone(item);copy.id=crypto.randomUUID();delete copy.group;
  copy.placements=item.placements[key] ? {[key]:structuredClone(item.placements[key])} : {};
  return copy;
}
// Commit only the selected view, preserving all other saved placements and
// presentations. Draft edits to other views remain available for a later save.
export function saveView(saved: Manifest, draft: Manifest, key: PlacementKey): Manifest {
  const result=structuredClone(saved);
  const p=draft.presentations?.[key];
  if(p) { viewPresentation(result,key); result.presentations![key]=structuredClone(p); }
  for(const edited of draft.items) {
    const placement=edited.placements[key];if(!placement) continue;
    let item=result.items.find(i=>i.id===edited.id);
    if(!item) {item={...structuredClone(edited),placements:{}};result.items.push(item);}
    item.placements[key]=structuredClone(placement);
    // Names and catalog labels identify the asset, while its visual settings
    // and visibility are stored exclusively in its per-view placement.
    item.name=edited.name;item.category=edited.category;item.favorite=edited.favorite;
  }
  for(const collection of ['library','profiles','versions'] as const) {
    if(draft[collection]) (result as Record<string, unknown>)[collection]=structuredClone(draft[collection]);
  }
  return result;
}
