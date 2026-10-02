# Muebles sólidos y ambientes nocturnos

Los muebles se muestran con opacidad completa incluso al cargar una colocación
antigua con opacidad baja. El render conserva las aperturas y el suavizado de
los contornos del recurso; los píxeles del cuerpo se vuelven opacos. Al guardar
una vista se normaliza solamente la opacidad de los muebles de esa vista.
Las figuras y otras decoraciones conservan su opacidad editable.

El catálogo incluye 21 materiales: original, roble, nogal, caoba, lacados,
acero, mármol, piedra gris, madera blanqueada, cerezo, fresno negro, cemento,
piedra oscura, cobre, latón y lino. La paleta ofrece ocho colores preparados y
el selector permite cualquier color. Los materiales nuevos se aplican al
mueble completo; el editor permite restringirlos a la superficie de apoyo.

Las maderas utilizan el albedo de roble existente, y cobre y latón usan el
cepillado de acero con tinte. Cemento, piedra oscura y lino son pequeñas
texturas procedurales deterministas, calculadas una vez y reutilizadas. No
incluyen reflejos ni iluminación dibujados. Los reflejos de la tapa se calculan
a partir del vídeo y responden al acabado y la rugosidad.

Los cuatro ambientes nuevos son Ámbar y petróleo, Lavanda de madrugada,
Rosa y cobre, y Salvia nocturna. Cambian luz trasera, oscuridad, separación
de sombras y color por superficie. No añaden figuras ni muebles, y conservan
la cámara, geometría, materiales elegidos y otras vistas. Las lámparas
existentes mantienen su color y alcance editados.

Los controles de profundidad de perspectiva y profundidad de sombras tienen
identificadores independientes.

Seleccionar objetos mantiene las filas existentes, su orden y el scroll. Las
acciones de cada fila consultan el borrador actual, incluso después de cerrar
y reabrir el editor. Los controles originales de luz, color, tono y sombra
están en un panel abierto; la sombra de apoyo y el recorte se pueden desplegar
dentro de ese panel. El catálogo queda plegado debajo de los ajustes.
