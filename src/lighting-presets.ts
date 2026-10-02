import type { Manifest, PlacementKey } from './decorations';
import type { Mood } from './studio-model';
import { viewPresentation } from './view-state.ts';

export const lightingPresets = [
  { id: 'midnight', name: 'Madrugada azul', description: 'Azul tenue, sombras profundas y luz suave detrás de la TV.', ambient: 78, color: '#779fcd', intensity: 32, depth: 42, tvGlow: 120 },
  { id: 'lavender', name: 'Lavanda suave', description: 'Lavanda difusa y un ambiente tranquilo.', ambient: 86, color: '#b09cdb', intensity: 40, depth: 30, tvGlow: 110 },
  { id: 'amber', name: 'Ámbar acogedor', description: 'Luz cálida baja, madera suave y sombras delicadas.', ambient: 88, color: '#e5b789', intensity: 38, depth: 28, tvGlow: 105 },
  { id: 'cinema', name: 'Cine · solo pantalla', description: 'Entorno oscuro iluminado por los colores del vídeo.', ambient: 60, color: '#8da4bf', intensity: 0, depth: 48, tvGlow: 140 },
  { id:'amber-petrol', name:'Ámbar y petróleo', description:'Lámparas cálidas, pared azul suave y suelo en penumbra.', ambient:64, color:'#688dac', intensity:28, depth:52, tvGlow:120,
    zones:{wall:{temperature:-12,saturation:92,contrast:104},cabinet:{temperature:16,contrast:106},floor:{exposure:-8,saturation:88}} },
  { id:'midnight-lilac', name:'Lavanda de madrugada', description:'Noche profunda, lavanda detrás de la TV y contornos suaves.', ambient:56, color:'#a18acb', intensity:32, depth:60, tvGlow:130,
    zones:{wall:{temperature:-16,contrast:108,saturation:90},cabinet:{temperature:8},floor:{exposure:-10,contrast:106,saturation:82}} },
  { id:'rose-copper', name:'Rosa y cobre', description:'Rosa empolvado, madera cálida y sombras acogedoras.', ambient:68, color:'#d5a0aa', intensity:30, depth:44, tvGlow:112,
    zones:{wall:{temperature:8,saturation:90},cabinet:{temperature:22,contrast:104},floor:{temperature:12,exposure:-6,saturation:90}} },
  { id:'sage-night', name:'Salvia nocturna', description:'Verde suave con luz ámbar y una oscuridad tranquila.', ambient:63, color:'#9db5a3', intensity:27, depth:50, tvGlow:118,
    zones:{wall:{temperature:-8,saturation:88,contrast:104},cabinet:{temperature:12},floor:{exposure:-8,saturation:85}} },
] satisfies {id:string;name:string;description:string;ambient:number;color:string;intensity:number;depth:number;tvGlow:number;zones?:Mood['zones']}[];

// Presets change only lighting in the selected view. Geometry, TV model,
// background, decorations and all other views retain their settings.
export function applyLightingPreset(manifest: Manifest, key: PlacementKey, id: string) {
  const preset = lightingPresets.find(p => p.id === id);
  if (!preset) return false;
  const p = viewPresentation(manifest, key);
  const mood: Mood = { daytime: 'night', preset: 'neutral', intensity: 0, tvGlow: preset.tvGlow,
    rim: 65, cabinet: 85, floor: 55, reach: 115, transition: 450,
    depth: preset.depth, practicalLights: id !== 'cinema', backlight: { color: preset.color, intensity: preset.intensity, reach: 115 }, zones: { ...structuredClone(preset.zones), tv: { influence: 0 } } };
  p.ambient = preset.ambient; p.mood = mood;
  // Replace the old starter bulb with the TV-following wash in this view.
  for (const item of manifest.items) if (item.kind === 'light' && item.name === 'Luz lavanda detrás de la TV') {
    const placement = item.placements[key]; if (placement) placement.hidden = true;
  }
  return true;
}
