# Escenarios actuales

Casa ofrece cuatro fondos nocturnos sin ventanas ni lluvia: `cozy-night`, `midnight-den`, `walnut-den` y `violet-den`. Cada uno tiene archivos `wide` y `portrait` en `public/rooms`. Los presets completos están documentados en `room-composition-assets.md` y sus piezas independientes en `scene-layout-assets.md`.

El catálogo de TVs se define en `tv-catalog.mjs`. Los cuatro recortes `crt-room-*.webp` y sus variantes neutras se conservan porque siguen dando forma al modelo CRT original. Plateada y carbón conservan sus dos archivos de TV. Arcade usa `arcade-silver-black.webp`; no reutiliza una habitación antigua como fondo.

Los antiguos fondos de alcoba, consola Nintendo 64, habitaciones azules y las estampas fijas ya no se distribuyen. Las imágenes subidas y las piezas de `public/rooms/props` siguen disponibles. La compatibilidad con identificadores antiguos solo permite validar y migrar guardados; no presenta escenarios retirados. Se conserva la migración actual y sus copias de respaldo; se retiró la restauración anterior que producción ya no ejecutaba.

## Cambio de escenario

La primera escena se muestra al terminar de cargar el guardado. En cambios de fondo, TV, formato o vista se mantiene una copia visual del último entorno completo mientras se decodifican los nuevos recursos y se preparan los materiales. La copia vive en un árbol de sombra para no entrar en las consultas del reproductor, la iluminación o el editor. No crea otro reproductor. Solo la transición más reciente puede revelar el resultado. Antes de mostrarlo se recalculan las sombras y la graduación del fondo con la nueva geometría.

## Muebles, pantalla y reflejos

Los muebles del catálogo se pueden mover y configurar por vista. La TV sigue la superficie de apoyo elegida. La opacidad del cuerpo y los bordes suaves de las figuras se conservan al aplicar materiales y colores.

En reproducción, la pantalla detecta las bandas negras y llena el cristal con el área activa del juego. El editor conserva los ajustes manuales de encuadre. La luz usa la misma área visible. El reflejo de la mesa se recorta a la superficie de apoyo y el del suelo permanece detrás de las decoraciones.
