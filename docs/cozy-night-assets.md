# Rincón nocturno

The built-in image generator produced a 1536×1024 photographic matte background; the same source is encoded as wide/portrait WebP so both views depict the same room. Object-fit cropping and camera overscan retain coverage from 0.5–2.5 zoom.

Prompt: Front-facing empty cozy midnight gaming room, softly textured petrol-blue plaster wall, subtle teal and muted lavender diffuse ambient illumination, narrow walnut trim at outer edges; matte dark walnut floor begins at exactly 60% of image height. Rectilinear camera at TV height, no tilt, ample empty central area for the live TV and movable furniture. All surfaces matte with visible natural textures. No windows, weather, TV, furniture, lamps, accessories, people, posters, text, watermark, painted TV glow, reflected screen, shiny patches or reflected streaks.

Starter objects: walnut cabinet, mushroom lamp, plant and separate lavender light behind the TV. Their placements and light properties are per-view. Video reflections remain in `src/reflections.ts` and require live frames; no reflected screen is included in the background.
