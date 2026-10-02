# Complete night room assets

Mode: built-in image generation for three photographic backgrounds and two transparent lamp cutouts; targeted built-in image edit for the floor lamp. WebP encoding and table-lamp downsampling are export preparation. No external image API or reference image was used.

## Background prompts and outputs

Shared prompt direction: a front-facing, empty, photorealistic midnight room at TV height with coherent wall returns, architectural recesses, soft ambient occlusion and matte wood flooring. Keep the central area free for a live CRT and independently editable furniture. Request the floor seam at 60% of image height. No TV, furniture, lamps, accessories, windows, rain, weather, people, text, watermark, painted TV illumination, reflected screen or glossy reflected streaks. Only neutral low ambient illumination and architectural shadow should be baked into the plate.

The individual scene directions were:

- **Madrugada clásica**: deep blue slate plaster recessed wall, dark walnut floor, narrow left return wall creating a believable corner, a subtle recessed panel outline, dark muted petrol accents.
- **Noche de nogal**: warm dark walnut wall panels alternating with taupe plaster, a central broad recessed alcove, wood grain detail, dark walnut floor, comfortable quiet night mood.
- **Rincón violeta**: dusty muted mauve plaster, a broad shallow arched niche centered on the wall with visible inner return and soft architectural occlusion, charcoal oak floor, muted slate blue side walls.

Sources (1536×1024): `exec-00261755-071c-489b-858f-2e6697ad71e1.png`, `exec-a53a83dc-49cd-44a6-9166-9d0d6fae95e8.png`, `exec-a03d5628-19d3-4da3-ad06-554b5c67a980.png` respectively.

Final repository paths: `public/rooms/midnight-den-{wide,portrait}.webp`, `public/rooms/walnut-den-{wide,portrait}.webp`, `public/rooms/violet-den-{wide,portrait}.webp`. Each pair uses the same room photograph, with view-specific object composition and camera cropping. Measured wall/floor seams are approximately 66%, 66%, 65%; `room-catalog.mjs` supplies these boundaries to runtime light/reflection clipping.

## Lamp prompts and outputs

Table lamp direction: a photorealistic isolated warm linen-shade table lamp with a compact dark walnut base, viewed straight on with a slight view of the top, matching a cozy night gaming room. Transparent background, complete silhouette, no furniture, no cast exterior glow, no painted reflection or surrounding environment. Shade may show intrinsic warm bulb illumination.

Floor lamp direction: a photorealistic isolated tall slim dark walnut/brass floor lamp with a warm linen shade and stable small base, matching the same room scale and camera. Transparent background, complete silhouette, no room, floor, exterior halo, cast shadow, reflection or props. The targeted edit reiterated removal of illumination beyond the physical lamp while retaining the lamp and transparency. Alpha pixels away from the silhouette were checked as zero.

Sources: table lamp `exec-5c908aeb-d133-4202-9906-02b67ff6afdc.png`; final edited floor lamp `exec-60762345-6711-4aa1-9ce7-3c405451f120.png` (initial source `exec-81e24924-52f3-4f07-8d65-a503fa0f8871.png`).

Final paths: `public/rooms/props/linen-lamp.webp` (680×800 RGBA), `public/rooms/props/linen-floor-lamp.webp` (1024×1536 RGBA). Runtime practical light settings are authored separately in `room-compositions.mjs`. Screen light and video reflections continue sampling the visible stream; no fixed screen reflection is included in these images.
