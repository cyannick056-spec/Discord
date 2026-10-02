# SHIS Stream — Actividad de Discord

SHIS Stream es una Activity privada de Discord para ver una Nintendo Switch dentro de una llamada y personalizar el entorno visual de la transmisión.

La arquitectura actual usa **SysDVR SHIS Direct**, un relay nativo en **Railway**, **Cloudflare Realtime SFU** y la Activity de Discord.

## Cómo funciona

```text
Nintendo Switch
  └─ SysDVR SHIS Direct
       ├─ vídeo H.264
       └─ audio PCM
          ↓ TCP
Relay nativo en Railway
          ↓ WebRTC
Cloudflare Realtime SFU
          ↓
Activity de Discord
          ↓
Espectadores dentro de la misma Activity
```

La Switch solo conoce el host TCP del relay, el puerto, el nombre lógico del stream y una clave privada. Las credenciales de Discord y Cloudflare permanecen en el servidor.

El emisor de Nintendo Switch está en [`cyannick056-spec/Shis-Stream`](https://github.com/cyannick056-spec/Shis-Stream).

## Funciones actuales

- Vídeo de Nintendo Switch y audio del juego dentro de Discord.
- Modos visuales **Casa** y **Arcade**.
- Formatos de TV 16:9 y 4:3.
- Filtro CRT, barrido, suavizado de bordes y estados de señal.
- Controles compartidos reservados al host.
- Volumen local y salida independientes para espectadores.
- Editor para posición, tamaño, capas, encuadre, iluminación y materiales.
- Fondos de escena que **solo cambian el entorno**: no crean, borran, sustituyen ni mueven objetos.
- La TV, los muebles, las imágenes/figuritas personales, el filtro, las luces y el encuadre se conservan al cambiar de fondo.
- Escena predeterminada configurable: guarda el fondo, el filtro/ambiente y la lluvia para el siguiente inicio sin alterar TV, muebles, figuritas ni posiciones.
- Lluvia animada como capa independiente del fondo, activable desde el editor.
- Fondos actuales: rincón nocturno, madrugada clásica, noche de nogal, rincón violeta, ventana nocturna, balcón nocturno, callejón/basurero, cuarto azul frío, cuarto rosa/violeta, loft industrial, bosque abierto y sala de mañana.
- Catálogo integrado limitado a **muebles y superficies de apoyo**.
- Imágenes y figuritas personales añadidas por el usuario desde el editor.
- Ajustes independientes para vista horizontal, vertical y ventana pequeña.
- Perfiles, versiones de escena y biblioteca personal de objetos.
- Avatares de espectadores integrados en la escena.
- Persistencia de la decoración en un volumen de Railway.

## Servicios

### Activity y backend

Servicio Node.js/Express desplegado en Railway. Sirve la Activity, autoriza el acceso con Discord, guarda el estado compartido y actúa como backend de señalización para Cloudflare Realtime SFU.

La decoración compartida se guarda en `DECORATION_DATA_DIR`, normalmente `/data`, sobre un volumen persistente.

### Relay nativo

Servicio Go desplegado en Railway con un proxy TCP público. Recibe H.264 y PCM desde SysDVR SHIS Direct, convierte el audio a Opus y publica vídeo/audio mediante WebRTC hacia Cloudflare Realtime SFU.

El código está en `relay/`.

### Cloudflare Realtime SFU

Transporta la publicación del relay hacia los espectadores. Las credenciales de Cloudflare permanecen únicamente en el backend.

## Acceso y permisos

La Activity se abre desde Discord y usa OAuth para verificar al usuario. El backend entrega un ticket temporal para las peticiones protegidas.

El host puede modificar el estado compartido de la escena y la TV. Los espectadores conservan únicamente controles locales como volumen y salida.

El acceso de host/editor usa `DECORATION_EDIT_KEY`.

## Variables de entorno

Copia `.env.example` a `.env` para desarrollo local.

- `DISCORD_CLIENT_ID` — ID público de la aplicación de Discord.
- `DISCORD_CLIENT_SECRET` — secreto OAuth de Discord; solo servidor.
- `CLOUDFLARE_SFU_APP_ID` — ID de Cloudflare Realtime SFU.
- `CLOUDFLARE_SFU_APP_SECRET` — secreto de Cloudflare; solo servidor.
- `SHIS_ACTIVITY_URL` — URL HTTPS de la Activity usada por el relay para señalización.
- `STREAM_KEY` — clave privada del camino de publicación Switch → relay.
- `DECORATION_EDIT_KEY` — clave del host/editor.
- `DECORATION_DATA_DIR` — carpeta persistente de decoración.
- `DEFAULT_STREAM` — nombre lógico del stream.
- `PORT` — puerto HTTP del servicio Activity.

Nunca guardes secretos reales en el repositorio.

## Desarrollo local

Requiere Node.js 20 o superior.

```bash
npm install
npx tsc --noEmit
npm test
npm run build
npm start
```

Para desarrollo con Vite:

```bash
npm run dev:server
npm run dev
```

## Relay

```bash
cd relay
go test ./...
go build .
```

Railway construye el relay con `relay/Dockerfile`.

## Estructura principal

- `src/` — interfaz, reproducción, escenas, editor y lógica visual.
- `server.mjs` — backend HTTP de la Activity.
- `cloudflare.mjs` — señalización con Cloudflare Realtime SFU.
- `activity-controls.mjs` — estado compartido host/espectadores.
- `decorations.mjs` — almacenamiento y validación de escenas.
- `relay/` — relay TCP/WebRTC.
- `public/rooms/` — fondos y muebles integrados de las escenas actuales.
- `tests/` — pruebas del comportamiento actual.

## Seguridad

- No expongas secretos de Discord, Cloudflare, `STREAM_KEY` ni `DECORATION_EDIT_KEY`.
- El navegador no recibe el secreto de Cloudflare.
- La Switch no contiene credenciales de Discord ni Cloudflare.
- Las escrituras de estado compartido requieren autorización de host.
- Las visitas directas a la Activity no sustituyen el acceso autorizado desde Discord.
