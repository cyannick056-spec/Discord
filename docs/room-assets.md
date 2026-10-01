# Ambientes fotográficos modulares

Recursos finales: `public/rooms/{bedroom,retro,rain,japanese,cabin,city}-{wide,portrait}.webp` y `public/rooms/props/{cabinet,sofa,bed,shelf,lamp,rug,console,controller,games,poster}.webp`.

Las imágenes se crearon con la herramienta integrada de generación de imágenes. Las versiones WebP conservan la geometría y el canal alfa de las piezas. No se usó la API/CLI alternativa. El catálogo público está en `room-catalog.mjs`.

## Especificaciones de los prompts

Fondos: fotografía frontal de una habitación real vacía, cámara a la altura de una persona sentada, verticales rectas, materiales naturales, centro de pared y suelo despejado para componer TV y muebles independientes. Luz difusa neutra, detalle moderadamente claro para ajustar el ambiente en tiempo real. Sin televisión, mobiliario, lámparas, alfombras, decoración, personajes, texto, reflejos o brillo de TV pintados. Ventanas a un lado.

- Dormitorio: pared azul apagada, molduras y suelo de madera cálida; ventana pequeña lateral.
- Sala retro: papel de pared crema con patrón discreto, zócalo de nogal, suelo de roble y ventana lateral.
- Habitación con lluvia: pared gris azulada, suelo de madera oscura, ventana lateral con gotas y árboles difusos.
- Cuarto japonés: madera clara, yeso suave, puertas shoji laterales y suelo tatami.
- Cabaña: paredes y suelo de tablones de madera, ventana lateral hacia un bosque de pinos.
- Apartamento: pared gris pizarra, suelo de roble y ventanal lateral hacia edificios.

Variantes verticales: reencuadrar exactamente la habitación de referencia en una fotografía vertical, preservando materiales, colores y ventana o shoji, sin deformar la perspectiva ni añadir objetos; pared superior y suelo inferior despejados.

Piezas: fotografía de producto individual con transparencia real, objeto completo y centrado, cámara frontal con leve vista de la superficie superior, materiales fotográficos y luz neutra. Sin fondo, suelo, reflejo de TV, texto, objetos extra ni sombra exterior.

- Mueble bajo de nogal con dos puertas correderas, patas cortas y tapa vacía mate.
- Sofá de dos plazas de tela azul verdosa con patas de nogal.
- Cama individual baja, marco de nogal y edredón azul pizarra.
- Repisa abierta de nogal de dos niveles, vacía.
- Lámpara de mesa apagada, pantalla de tela beige y base de nogal.
- Alfombra ovalada tejida azul carbón en perspectiva horizontal.
- Consola retro tipo Nintendo 64, carbón mate, ranura superior y cuatro puertos frontales, sin cables ni accesorios.
- Mando retro gris de tres puntas, botones de colores, joystick y sin cable.
- Tres cajas de videojuegos teal, burdeos y azul oscuro con ilustraciones de aventura, sin letras ni cintas.
- Póster de papel de aventura de plataformas pixelada, islas flotantes, héroe pequeño y estrellas; sin marco, pared ni texto.

Se pidió una segunda extracción de fondo de sofá, cama, repisa, consola y cajas: preservar producto y perspectiva, quitar fondo, neblina, viñeta y sombras fuera de la silueta, incluidos los huecos entre patas y estantes.

## Uso en el editor

Escena permite elegir habitación y televisión; Objetos permite mover, girar, escalar, ocultar, bloquear o duplicar sus piezas y usar la biblioteca. Los muebles de cada habitación conservan sus posiciones al volver a ella. Paredes, suelo y ventanas forman la fotografía; su encuadre se controla con cámara. Los cuatro momentos modifican la iluminación sobre las nuevas fotografías, sin cambiar los colores del vídeo. La fotografía conserva gotas húmedas; una capa Canvas añade lluvia y gotas deslizantes en tiempo real sobre los dos cristales laterales, con intensidad y velocidad ajustables en Escena. Se recorta al cristal y sigue el encuadre; la animación se pausa al ocultar la pestaña y respeta movimiento reducido.

Se mantienen las tres TVs fotográficas: CRT original, plateada y carbón, en 4:3 y 16:9. Cambiar modelo ajusta el área de reproducción; sigue disponible el ajuste independiente de la pantalla.

La lluvia reparte las gotas móviles entre ambos cristales, también en vertical. Los surcos y las gotas grandes avanzan de forma visible; las gotas pequeñas originales de la foto siguen fijas. El editor indica cuando la preferencia de movimiento reducido pausa la animación y permite autorizarla expresamente con «Animar aunque el dispositivo reduzca el movimiento».

En pantallas estrechas el recorte de la habitación con lluvia se alinea a la izquierda para conservar la ventana. La lluvia se compone por encima de la fotografía graduada, debajo de muebles y luces; la TV la oculta cuando se mueve delante del cristal.

## Muebles, pantalla y reflejos

Se añadieron mueble negro, escritorio, carrito, repisa flotante y base elevada. Se eligen en Objetos → Añadir muebles y bases y se pueden mover como las otras decoraciones. Escena → Modelo, posición y tamaño de la TV permite elegir el mueble o base de apoyo; la TV sigue su superficie cuando se mueve, gira o cambia su perspectiva. Los pies integrados de los modelos de TV se recortan en el render sin cambiar los archivos fuente.

El editor usa las dimensiones reales de la actividad para la vista actual; al cambiar orientación intercambia esas dimensiones. El zoom de trabajo sigue siendo independiente del zoom guardado. Ajustar a pantalla conserva todo el vídeo, con bandas negras si cambia su proporción, e ignora el zoom y desplazamiento guardados hasta volver a Llenar pantalla. Se puede desactivar el redondeo. Las bandas también se respetan al calcular la luz.

El reflejo de la mesa se recorta al cuadrilátero de la superficie elegida. El suelo se dibuja detrás de las decoraciones. Se redujeron la intensidad predeterminada y el brillo máximo para mantener la textura de la madera frente a vídeos blancos.
