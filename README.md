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
4. Check actual Cloudflare Realtime egress and Railway egress before deciding whether to migrate the two services to a PayPal-billed VPS. Export persistent decorations from the mounted directory before moving; a new VPS does not inherit Railway's volume.

The Activity verifies each viewer through Discord before creating a Cloudflare SFU session. The SFU secret stays on the Activity backend. A short relay heartbeat lets viewers find the current Switch publication and removes it after the stream stops. The Cloudflare path is new and requires a live test with an SFU account before replacing the production transport.

### VPS deployment prerequisites

An OVHcloud VPS requires a public TCP endpoint for SysDVR, an HTTPS domain for the Discord Activity, automatic service restart, firewall rules, and persistent backed-up storage for decorations. Match the Activity HTTPS URL in Discord Developer Portal URL mappings before moving traffic. Buying a VPS and changing DNS/Discord mappings are separate deployment steps after the new video path works.

### Deploy the two services on an OVHcloud VPS

The `deploy/` directory includes a Caddy HTTPS proxy, a Node Activity image, a native relay image and persistent volumes for TLS and decorations. It does **not** migrate the currently mounted Railway decorations automatically.

1. Point an A/AAAA DNS record for a domain you control to the VPS. Permit inbound TCP 80 and 443 for Discord and TCP 9000 (or your chosen `RELAY_PORT`) for the Switch. A VPS and a hostname are needed before these steps can run.
2. Clone this repository on the VPS, copy `deploy/vps.env.example` to `deploy/.env`, fill in Discord, stream and Cloudflare credentials **on the VPS** (never in GitHub). Set `ACTIVITY_DOMAIN` to the exact DNS hostname. Copy decorations from Railway's persistent directory before switching services.
3. Build the images one at a time if the VPS has limited memory: `docker compose --env-file deploy/.env -f deploy/compose.yaml build activity` then `docker compose --env-file deploy/.env -f deploy/compose.yaml build relay`; run `docker compose --env-file deploy/.env -f deploy/compose.yaml up -d`. Inspect `docker compose --env-file deploy/.env -f deploy/compose.yaml logs --tail=100` and verify `https://YOUR_DOMAIN/api/health`.
4. During the Cloudflare trial, use the same `STREAM_PROVIDER` value on both services. Set it to `cloudflare` only after configuring a Cloudflare SFU app and testing the publisher and subscriber. If the test fails, restore `livekit` on both services and restart. Then update the Activity URL mapping in Discord and the Switch `relay_host` only when the replacement is working.

Caddy renews the HTTPS certificate. The `decorations` Docker volume stores uploads across image updates; back it up separately. Store the Compose `.env` outside version control, and protect SSH access to the VPS. Building the Go relay on a small VPS may need extra RAM or swap. No OVHcloud purchase, DNS change or Cloudflare account creation is performed by this code change.

## Decorations

In the Activity, open **Ajustes → Decorar** and enter the editor password. Upload PNG, JPG, WebP or GIF images (up to 2 MB). Drag an image to move it; use its corner handle to resize and its round handle to rotate. Hold Shift while dragging for finer motion. Numeric position, size, rotation, opacity and layer controls remain available, alongside light, saturation, hue and shadow sliders that help the art match the room.

New decorations are anchored to the TV glass (or arcade cabinet/screen) so their position follows it across different window sizes. Choose **Escena completa** for art meant to stay with the whole background. The editor stores separate placements for Casa in TV 16:9 and 4:3, each in horizontal, vertical and compact window views; Arcade has its own three views. Select **Tamaño TV** to see and edit the correct composition. Older Casa placements remain available in both sizes until you open each size in the editor; then a separate copy is made for that size. Older scene-based placements are anchored to the screen when opened. Check each size and save it. You can copy a placement to other views or the other TV size before fine-tuning. **Guardar para todos** makes the arrangement visible to viewers.

The editor also includes five fixed viewer avatar slots without built-in pedestals; add your own bases or other artwork as separate decorations. Icon and PNG layers follow their saved **Capa** number equally. For any selected item, **Mostrar delante de otras figuras** moves that item to the foreground in the current composition; untick it to return to normal layering. Position and style each avatar slot in every composition just like a decoration. Inside Discord, the first five connected participants occupy the slots in the order observed by the Activity; a slot disappears when no participant occupies it. The editor shows numbered placeholders, including outside Discord. People watching in a normal browser are not counted as Discord participants.

Add `DISCORD_CLIENT_SECRET` to the Activity service's server environment (from its Discord Developer Portal OAuth2 page). Under OAuth2 → Redirects, also add `https://127.0.0.1` and save; Discord requires a redirect even though its Embedded App SDK returns to the Activity itself. Keep the secret out of source control and the browser. The Activity exchanges a short-lived authorization code on the server and requests only `identify` for the current viewer's profile. The TV shows the Activity instance roster, updated by Discord's participant event and a five-second refresh; someone who remains in the voice call after leaving the Activity no longer occupies a slot. Ajustes shows the viewer count and, if access fails, the Discord error code and a retry button.

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
