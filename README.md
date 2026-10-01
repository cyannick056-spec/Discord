# SHIS Stream — Discord Activity and native relay

Watch a Nintendo Switch stream together inside a Discord Activity. The current sender is a customized SysDVR sysmodule on the Switch; the Android APK in [`Shis-Stream`](https://github.com/cyannick056-spec/Shis-Stream) is an older alternative.

## Current architecture

```text
Nintendo Switch (Atmosphère + SysDVR SHIS Direct)
  -> Railway TCP proxy
  -> native SHIS relay (Go, this repo's relay/)
  -> LiveKit Cloud
  -> Discord Activity (this repo's src/)
  -> viewers in Discord
```

SysDVR captures H.264 video and PCM audio, then sends both to the relay over TCP. The relay authenticates the sender with `SHIS/1 <stream> <stream_key>`, publishes the media to LiveKit, and the Activity subscribes to it. The Node server (`server.mjs`) serves the Activity, issues short-lived viewer tokens, and stores shared decorations; it does not carry the video stream. The legacy `/api/publisher-token` endpoint remains for the older Android sender.

The Switch build, configuration file and installation instructions live in [`Shis-Stream/sysdvr-shis`](https://github.com/cyannick056-spec/Shis-Stream/tree/main/sysdvr-shis).

## Configuration

Copy `.env.example` to `.env` for local Activity development. Never commit real keys.

Activity server (`server.mjs`):

- `DISCORD_CLIENT_ID`: public Discord application ID.
- `DISCORD_CLIENT_SECRET`: required to authorize viewers; keep it server-side.
- `LIVEKIT_URL`: LiveKit Cloud `wss://...` URL.
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: server-only LiveKit credentials.
- `DEFAULT_STREAM`: stream name, normally `cris`.
- `DECORATION_DATA_DIR`: persistent writable directory (Railway volume: `/data/decorations`).
- `DECORATION_EDIT_KEY`: optional editor password; if unset, the server uses `STREAM_KEY`.
- `STREAM_KEY`: still used by the legacy publisher-token endpoint and as the optional editor password fallback.

Native relay (`relay/`), deployed separately from the Activity:

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: LiveKit credentials, available only to the relay and Activity server.
- `STREAM_KEY`: shared secret matching `stream_key` in the Switch's `/config/sysdvr/shis.ini`.
- `PORT` (or `RELAY_PORT`): TCP listen port; expose it through the Railway TCP proxy.
- `DEFAULT_STREAM`: optional fallback stream name.

Set the Switch's `relay_host` and `relay_port` to the TCP proxy endpoint, and keep `stream_key` private. They are **not** the HTTPS address or port of the Activity server. The `stream` value must match the Activity's chosen stream; rooms are named `shis-<stream>`.

## Cloudflare migration preview

The code can switch the transport with `STREAM_PROVIDER=cloudflare` on **both** the Activity and native relay. LiveKit remains the default until a live test succeeds. This is **Cloudflare Realtime SFU**, not RealtimeKit or Cloudflare Stream.

1. In [Cloudflare Realtime > Serverless SFU](https://dash.cloudflare.com/?to=/:account/realtime/sfu), create an SFU app. Add its `CLOUDFLARE_SFU_APP_ID` and `CLOUDFLARE_SFU_APP_SECRET` **only** to the Activity server's environment.
2. Set `SHIS_ACTIVITY_URL` on the relay to the Activity HTTPS origin (without a trailing slash). The relay authenticates its SFU signaling with the existing `STREAM_KEY`. Leave `STREAM_PROVIDER=livekit` on both services until test time.
3. With the Switch off and Activity closed, set `STREAM_PROVIDER=cloudflare` on both services and deploy. Start the Switch and verify video, game audio, signal-loss behavior and mobile Discord playback. Keep LiveKit credentials available so both services can switch back together.
4. Keep both services on Railway and compare their actual usage with Cloudflare Realtime egress during the test. The existing Railway volume continues to hold decorations.

The Activity verifies each viewer through Discord before creating a Cloudflare SFU session. The SFU secret stays on the Activity backend. A short relay heartbeat lets viewers find the current Switch publication and removes it after the stream stops. The Cloudflare path is new and requires a live test with an SFU account before replacing the production transport.

## Decorations

In the Activity, open **Ajustes → Decorar** and enter the editor password. Upload PNG, JPG, WebP or GIF images (up to 2 MB). Drag an image to move it; use its corner handle to resize and its round handle to rotate. Hold Shift while dragging for finer motion. Numeric position, size, rotation, opacity and layer controls remain available, alongside light, saturation, hue and shadow sliders that help the art match the room.

New decorations are anchored to the TV glass (or arcade cabinet/screen) so their position follows it across different window sizes. Choose **Escena completa** for art meant to stay with the whole background. The editor stores separate placements for Casa in TV 16:9 and 4:3, each in horizontal, vertical and compact window views; Arcade has its own three views. Select **Tamaño TV** to see and edit the correct composition. Older Casa placements remain available in both sizes until you open each size in the editor; then a separate copy is made for that size. Older scene-based placements are anchored to the screen when opened. Check each size and save it. You can copy a placement to other views or the other TV size before fine-tuning. **Guardar para todos** makes the arrangement visible to viewers.

The editor also includes five fixed viewer avatar slots without built-in pedestals; add your own bases or other artwork as separate decorations. Icon and PNG layers follow their saved **Capa** number equally. For any selected item, **Mostrar delante de otras figuras** moves that item to the foreground in the current composition; untick it to return to normal layering. Position and style each avatar slot in every composition just like a decoration. Inside Discord, the first five connected participants occupy the slots in the order observed by the Activity; a slot disappears when no participant occupies it. The editor shows numbered placeholders, including outside Discord. People watching in a normal browser are not counted as Discord participants.

Add `DISCORD_CLIENT_SECRET` to the Activity service's server environment (from its Discord Developer Portal OAuth2 page). Under OAuth2 → Redirects, also add `https://127.0.0.1` and save; Discord requires a redirect even though its Embedded App SDK returns to the Activity itself. Keep the secret out of source control and the browser. The Activity exchanges a short-lived authorization code on the server and requests only `identify` for the current viewer's profile. The TV shows the Activity instance roster, updated by Discord's participant event and a five-second refresh; someone who remains in the voice call after leaving the Activity no longer occupies a slot. Ajustes shows the viewer count and, if access fails, the Discord error code and a retry button.

### Room lighting

The editor supports a right-click action menu, double-click renaming, four proportional resize handles, position locking, duplication, layer order, centering, a 5% grid with optional snapping, and undo/redo (up to 80 gestures). Wheel over a figure resizes it; Alt + wheel rotates; Ctrl/Command + wheel zooms. Middle-button drag, Space + drag or **Mano** pans a zoomed preview. Arrows move, Shift makes larger keyboard steps and Alt makes fine steps. Ctrl/Command + D duplicates, Delete removes, L locks, H hides, Ctrl/Command + Z undoes, Ctrl/Command + Shift + Z or Y redoes, and Ctrl/Command + S saves. Text fields retain their normal editing shortcuts. Viewer slots cannot be duplicated or removed. Changes remain a local draft until **Guardar para todos**; the persistent footer reports unsaved changes.

The studio groups its controls in **Objetos**, **Luces**, **Ambiente** and **Escena**, with a collapsible mobile sheet and **Solo escena** for a larger preview. **Antes / después** compares the draft with the saved room. A searchable thumbnail list includes visibility, lock, category and favorite controls. **Mi biblioteca** reuses uploaded assets, including removed objects, and includes four starter pieces. Shift/Ctrl/Command + click or the list checkboxes select multiple objects; groups move together, support alignment/distribution and respect locked positions. Geometry tools apply to the selection, while the name and existing basic appearance controls edit the primary object.

**Escena** saves a separate composition for each scene, view and TV aspect. Original and previous photographed rooms remain available; three free room surfaces (plain wall, wood panels, brick) separate the TV cutout from a customizable wall/cabinet/floor, with optional uploaded backgrounds. Templates include the previous 3 a.m. room, cinema, warm room and blue studio. Camera pan/zoom moves the composition; independent TV pan/scale moves the TV in a free room; video pan/zoom changes only the cropped live image. TV and camera tools support dragging, corner resize and wheel zoom with gesture undo. The preview zoom is temporary and distinct from these saved settings. Room presets and previous versions include compositions. In compact tiles the video framing remains available; the TV tool outline is limited to full scene views.

When a parent WebRTC video is available, the editor preview reuses the same MediaStream tracks with muted audio and no additional SFU connection. Source replacement/metadata and signal state update the preview. Older browsers may fall back to preview lighting without video. Frame-color sampling uses the visible crop, including changes on paused frames, so video framing and environment colors agree. Room photograph grading is cached until its geometry or settings change.

**Perspectiva y transformación** offers manual X/Y tilt, skew, independent scaling and flips. It also includes front/left/right/above/below/isometric presets, automatic side-wall/ceiling/shelf projection, adjustable perspective depth and a four-corner homography with direct corner handles or numeric coordinates. Crossed or collapsed quads are rejected. It cannot reveal unseen sides of a 2D image. **Ajustar automáticamente** projects a 2D image onto a chosen wall, cabinet or floor plane; it uses a heuristic based on surface and position, not scene recognition. Turning automatic mode off retains its current angles for manual adjustment. Contact shadows and four-sided image cropping are optional. Perspective transforms also move a lamp's emission origin.

**Filtro del entorno** offers Original/Neutro, **Noche clásica**, **Solo la TV**, **Luz de luna**, **Noche acogedora**, **Noche suave**, subtle **Noche azul** and customizable **Neón**. The grade canvas redraws the neutral room photograph beneath decorations, with exposure, contrast, saturation, temperature, shadow depth and influence for the wall, cabinet, floor, TV casing and figures. Localized lights replace the old flat blue wash. **Luz TV** scales stream-driven illumination from 0–200%, with independent casing/cabinet/floor gains, reach and transition time. The video aperture is cut out of all three grade/lighting canvases, preserving the video and CRT treatment. Red/blue/white/off lighting tests affect only the editor preview. Grid, snapping, comparison, lighting tests and tool choice are editor-only controls.

Save up to six named room arrangements in **Mis ambientes y versiones**, then **Guardar para todos** to persist them. Each room stores its items, ambient level and lighting settings without nested archives. The three previous shared room versions can be restored into a reversible draft before saving. Lamps support point, spotlight and LED-strip shapes, orientation, softness, color temperature and an on/off control. Illumination and contact shadows are 2D approximations.

For Casa, select **Detrás de la TV** on a decoration to hide the part covered by the physical TV body and feet. Its layer/foreground settings continue to order it relative to other figures at the same depth. Artwork and shadows are clipped at the scene edges, including when rotated or moved outside the scene. In the editor, a selected hidden figure keeps an outline with a central move handle so it remains adjustable. Depth saves separately for each view and TV aspect; old decorations stay in front until enabled. In a tiny call tile the TV fills the scene, so figures assigned behind it are hidden.

The four neutral CRT backdrops have no fixed lamp, poster or colored light reflections. The room is moderately dim by default. In **Decorar**, **Ambiente** controls its base brightness (25–100%) and is saved for everyone along with the decorations.

Upload a lamp image, select it and enable **Emitir luz**. Set its color, intensity and reach; **Origen luz X/Y** positions the light at the bulb inside the image. Rotation moves this origin with the image. **Añadir luz** creates a simple light point without uploading artwork. Lights follow the same per-scene, per-view and per-aspect placement/copy/hide controls as other decorations. Hidden or fully transparent sources do not emit light. The original image brightness/color/shadow adjustments still apply.

The TV casts smoothly changing color onto its bezel, cabinet and floor, sampled locally from the decoded stream at 32×18 pixels, eight times per second. Black frames emit no light; loss of signal returns to the weak neutral static glow. This adds no SFU traffic or server work. The lighting layers leave the live picture untouched and are omitted in the smallest Discord tiles. This is simulated 2D illumination, with no geometry-based cast shadows. Cross-origin iframe video (such as a future YouTube player) cannot supply these pixel samples.

Assets: `public/crt-room-neutral-{wide,4x3,portrait-wide,portrait-4x3}.webp`, edited with the built-in image generator from the matching original backdrops. Prompt: preserve the exact CRT/screen/cabinet geometry; remove lamp, plant, fixed picture and colored reflections; use a plain neutral wall and matte materials under flat, moderately dim ambient light. The prior assets remain available for rollback.

### Viewer access

The public URL rejects ordinary direct visits with a small HTTP 403 response. Launches with Discord's frame parameters first receive a lightweight entry page, which uses the Embedded App SDK handshake and authorization. The full scene and decoration API need a signed, six-hour entry ticket created by the server after the Discord Activity completes its OAuth code exchange. On expiry, reloading the Activity obtains a new ticket. The server issues LiveKit viewer tokens only after checking the Discord bearer token with Discord's OAuth2 authorization endpoint and confirming that it belongs to this application with the `identify` scope. Requests without this authorization cannot enter the video room. LiveKit tokens are valid for two minutes to establish a connection and only grant access to the configured stream; an established connection can continue after the token expires. If Discord authorization fails or the secret is missing, viewing is unavailable until access is restored.

Discord OAuth verifies identity and app authorization, **not ongoing membership in a specific Activity instance**. The lightweight entry page and bundled static files still have public URLs, and hosting a public HTTPS endpoint still incurs a small amount of traffic for rejected requests. The GitHub repository is public as well. A previously issued LiveKit token may remain usable until it expires, and an existing connection is removed when the client disconnects.

The editor password stays in page memory only. Viewers can see decorations without it; upload and save require the password. Mount persistent storage in production so images survive redeployments.

## Local Activity development

```bash
npm install
npm run build
npm start
```

For Vite hot reload, run the API in one terminal with `npm run dev:server` and Vite in another with `npm run dev`.

## Discord and LiveKit setup

1. Create an application in the Discord Developer Portal, enable Activities, and map `/` to the HTTPS URL of this Activity.
2. Set `DISCORD_CLIENT_ID` on the Activity server.
3. Configure LiveKit credentials on both the Activity server and the native relay.
4. Configure the Switch with the relay TCP proxy host, port, stream name and shared `STREAM_KEY` as described in the other repository.
5. Launch the Activity in a Discord test server and start SysDVR on the Switch.

Viewer tokens cannot publish. Keep LiveKit API secrets and the stream key out of the browser and the repository.

## Deployment

The current deployment uses Railway: a Node service for the Activity (`npm install && npm run build`, then `node server.mjs`) and a separate Go service built from `relay/Dockerfile` for the native TCP relay. The Activity has an HTTPS endpoint and a persistent volume for decorations; the relay needs a TCP proxy. `render.yaml` is an older alternative for hosting the Activity, not the current deployment.
