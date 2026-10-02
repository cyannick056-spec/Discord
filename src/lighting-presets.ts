import type { Manifest, PlacementKey } from './decorations';
import type { Mood } from './studio-model';
import { viewPresentation } from './view-state.ts';

export const lightingPresets = [
  { id: 'midnight', name: 'Madrugada azul', description: 'Azul tenue, sombras profundas y luz suave detrás de la TV.', ambient: 78, color: '#779fcd', intensity: 32, depth: 42, tvGlow: 120 },
  { id: 'lavender', name: 'Lavanda suave', description: 'Lavanda difusa y un ambiente tranquilo.', ambient: 86, color: '#b09cdb', intensity: 40, depth: 30, tvGlow: 110 },
  { id: 'amber', name: 'Ámbar acogedor', description: 'Luz cálida baja, madera suave y sombras delicadas.', ambient: 88, color: '#e5b789', intensity: 38, depth: 28, tvGlow: 105 },
  { id: 'cinema', name: 'Cine · solo pantalla', description: 'Entorno oscuro iluminado por los colores del vídeo.', ambient: 60, color: '#8da4bf', intensity: 0, depth: 48, tvGlow: 140 },
] as const;

// Presets change only lighting in the selected view. Geometry, TV model,
// background, decorations and all other views retain their settings.
export function applyLightingPreset(manifest: Manifest, key: PlacementKey, id: string) {
  const preset = lightingPresets.find(p => p.id === id);
  if (!preset) return false;
  const p = viewPresentation(manifest, key);
  const mood: Mood = { daytime: 'night', preset: 'neutral', intensity: 0, tvGlow: preset.tvGlow,
    rim: 65, cabinet: 85, floor: 55, reach: 115, transition: 450,
    depth: preset.depth, practicalLights: id !== 'cinema', backlight: { color: preset.color, intensity: preset.intensity, reach: 115 }, zones: { tv: { influence: 0 } } };
  p.ambient = preset.ambient; p.mood = mood;
  // Replace the old starter bulb with the TV-following wash in this view.
  for (const item of manifest.items) if (item.kind === 'light' && item.name === 'Luz lavanda detrás de la TV') {
    const placement = item.placements[key]; if (placement) placement.hidden = true;
  }
  return true;
}
