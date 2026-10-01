# TVs, lámparas y zoom por vista

Recursos finales: `public/tvs/{projection,crt-silver2000,crt-champagne,crt-black2000,lcd2005,flat-modern}.webp` y `public/rooms/props/{floor-lamp,mushroom-lamp,desk-lamp,lava-lamp}.webp`.

Modo: herramienta integrada imagegen, diez imágenes nuevas con transparencia. Conversión WebP conserva imagen y alfa. Geometría medida en tv-catalog.mjs; cada TV nueva conserva su relación de aspecto.

Apoyo sobre mueble usa la tapa del mueble modular, incluso al moverlo. Retroproyección se apoya por defecto sobre suelo. Mover TV manualmente desactiva apoyo. Los muebles existentes se conservan; el usuario activa apoyo para corregir una composición anterior. El zoom se guarda por escena, orientación y tamaño de TV, incluida ventana pequeña; no modifica el zoom temporal de la vista previa. Paredes/ventanas físicas siguen perteneciendo al fondo.

Lámparas: cinco modelos, colores de emisión, encendido y apagado. Lava: animación Canvas 2D, velocidad y pausa, color compartido con su emisión. Se detiene al ocultar la pestaña y respeta movimiento reducido. La animación no cambia los colores del vídeo.

## Prompts finales

Cada prompt utiliza este prefijo: `Use case: product-mockup. Asset type: standalone photographic [id] cutout for a movable room editor. Primary request:` y este cierre: `Background: genuinely transparent alpha, including spaces between feet or arms. Lighting: diffuse neutral product lighting; matte texture visible, no cast shadow outside object. Composition: complete single object centered, only a small transparent margin, straight verticals. Constraints: no environment, floor, furniture, logos, text, extra props, glow, TV reflections or reflections drawn onto furniture. TV glass plain almost-black, no video. Preserve alpha.`

- **projection:** Photorealistic front-facing early-2000s giant rear-projection television, tall charcoal rectangular floor-standing cabinet, large 4:3 flat dark screen in upper two thirds, chunky integrated speaker pedestal below, control row. Full object centered, exactly straight-on, no perspective.
- **crt-silver2000:** Photorealistic front-facing 2002 silver flat-glass CRT television with deep bulky plastic body, broad vertical stereo speakers on both sides, small buttons below, dark 4:3 screen. Full object centered, exactly straight-on.
- **crt-champagne:** Photorealistic front-facing 2000 champagne beige CRT television with rounded chunky housing, curved dark 4:3 glass, speaker grille at right, small buttons below. Full object centered, exactly straight-on.
- **crt-black2000:** Photorealistic front-facing 2004 charcoal CRT television with flat dark 4:3 glass, stereo speakers below screen, curved bulky cabinet with small control buttons. Full object centered, exactly straight-on.
- **lcd2005:** Photorealistic front-facing 2005 silver LCD flat-screen television, thick wide silver bezel, speaker grille under dark 16:9 screen, heavy rectangular tabletop stand. Full object centered, exactly straight-on.
- **flat-modern:** Photorealistic front-facing modern black thin flat-screen television, dark 16:9 screen, slim black bezel, two small angled feet. Full object centered, exactly straight-on.
- **floor-lamp:** Photorealistic front-facing tall floor lamp, thin brushed steel pole, round metal base, off-white fabric cylindrical shade, switched off. Entire object centered, camera straight-on.
- **mushroom-lamp:** Photorealistic front-facing small 1970s mushroom table lamp in smooth milk-white glass, broad rounded dome and short cylindrical stem, switched off. Entire object centered.
- **desk-lamp:** Photorealistic front-facing black articulated desk lamp, angled articulated metal arm, round base, conical metal shade aimed downward, switched off. Entire object centered.
- **lava-lamp:** Photorealistic front-facing lava lamp outer shell: brushed aluminum conical base and matching metal cap, tall tapered clear glass vessel between them filled with neutral dark gray transparent liquid. EMPTY liquid with no wax blobs because these will be animated by code. Entire lamp centered, straight-on, symmetrical, cap at top, base at bottom, realistic glass edge and subtle rim highlights.

