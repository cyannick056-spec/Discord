// Restore the photograph, keeping decorations and independent composition.
export function restoreOriginalRoom(room) {
  room.ambient = 66;
  room.mood = { daytime: 'night', preset: 'neutral', intensity: 65, tvGlow: 100, rim: 0, zones: { tv: { influence: 0 } } };
  for (const [key, presentation] of Object.entries(room.presentations ?? {})) {
    if (!key.startsWith('home-')) continue;
    presentation.style = 'classic';
    delete presentation.environment;
    delete presentation.tvModel;
    delete presentation.background;
    delete presentation.tvPaint;
  }
  return room;
}
