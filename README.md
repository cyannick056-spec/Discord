# SHIS Stream — Actividad de Discord

SHIS Stream es una Activity privada de Discord para ver una Nintendo Switch dentro de una llamada y compartir una escena visual editable alrededor de la transmisión.

El sistema usa **SysDVR SHIS Direct**, un relay nativo en **Railway**, **Cloudflare Realtime SFU** y la Activity de Discord.

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

El código del emisor de Switch está en [`cyannick056-spec/Shis-Stream`](https://github.com/cyannick056-spec/Shis-Stream).

## Funciones

- Vídeo de Nintendo Switch y audio del juego dentro de Discord.
- Modos visuales **Casa** y **Arcade**.
- Formatos de TV 16:9 y 4:3.
- Filtro CRT, barrido, suavizado de bordes y estados de señal.
- Fuente alternativa de YouTube compartida dentro de la Activity.
- Controles compartidos reservados al host.
- Volumen local y salida independientes para espectadores.
- Editor de escenas con fondos, televisores, muebles, figuras, luces y materiales.
- Posición, tamaño, capas, brillo, saturación, sombras y emisión de luz por objeto.
- Ajustes independientes para vista horizontal, vertical y ventana pequeña.
- Perfiles, versiones de escena y biblioteca de objetos.
- Avatares de espectadores integrados en la escena.
- Persistencia de la decoración en un volumen de Railway.

## Servicios

### Activity y backend

Servicio Node.js/Express desplegado en Railway. Sirve la Activity, autoriza el acceso con Discord, guarda el estado compartido y actúa como backend de señalización para Cloudflare Realtime SFU.

La decoración compartida se guarda en `DECORATION_DATA_DIR`, normalmente `/data`, montado como volumen persistente.

### Relay nativo

Servicio Go desplegado en Railway con un proxy TCP público. Recibe H.264 y PCM desde SysDVR SHIS Direct, convierte el audio a Opus y publica vídeo/audio mediante WebRTC hacia Cloudflare Realtime SFU.

El código está en `relay/`.

### Cloudflare Realtime SFU

Transporta la publicación del relay hacia los espectadores. Las credenciales de Cloudflare solo existen en el backend.

## Acceso y permisos

La Activity se abre desde Discord y usa OAuth para verificar al usuario. El backend entrega un ticket temporal para las peticiones protegidas.

El host puede modificar el estado compartido de la escena y la TV. Los espectadores no pueden cambiar la escena; conservan controles locales como volumen y salida.

El acceso de host/editor usa `DECORATION_EDIT_KEY`.

## Variables de entorno

Copia `.env.example` a `.env` para desarrollo local.

- `DISCORD_CLIENT_ID` — ID público de la aplicación de Discord.
- `DISCORD_CLIENT_SECRET` — secreto OAuth de Discord; solo servidor.
- `CLOUDFLARE_SFU_APP_ID` — ID de la aplicación de Cloudflare Realtime SFU.
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

El relay usa Go y las bibliotecas nativas de Opus.

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
- `playback.mjs` — reproducción compartida de YouTube.
- `relay/` — relay TCP/WebRTC.
- `public/` — assets visuales y páginas públicas.
- `tests/` — pruebas del comportamiento actual.

## Seguridad

- No expongas secretos de Discord, Cloudflare, `STREAM_KEY` ni `DECORATION_EDIT_KEY`.
- El navegador no recibe el secreto de Cloudflare.
- La Switch no contiene credenciales de Discord ni Cloudflare.
- Las escrituras de estado compartido requieren autorización de host.
- Las visitas directas a la Activity no sustituyen el acceso autorizado desde Discord.
