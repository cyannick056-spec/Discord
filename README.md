# SHIS Stream — Discord Activity

Viewer Activity + tiny token backend for the Android sender in `cyannick056-spec/Shis-Stream`.

## Architecture

```text
Switch Android 10
  -> SHIS Stream APK (MediaProjection + playback audio)
  -> LiveKit Cloud
  -> this Discord Activity
  -> friends watching inside Discord
```

The Node server does **not** relay video. It serves the Activity, signs short-lived LiveKit tokens, and stores the shared decorations. Media travels through LiveKit.

## Environment

Copy `.env.example` to `.env` for local development. Never commit real secrets.

Required:

- `DISCORD_CLIENT_ID`: your Discord application's public client/application ID.
- `LIVEKIT_URL`: `wss://...` URL from your LiveKit Cloud project.
- `LIVEKIT_API_KEY`: server-only LiveKit API key.
- `LIVEKIT_API_SECRET`: server-only LiveKit API secret.
- `STREAM_KEY`: private password used by the Switch APK to obtain a publisher token.
- `DEFAULT_STREAM`: normally `cris`.
- `DECORATION_DATA_DIR`: writable persistent directory for decorations (Railway mounts a volume at `/data`, so use `/data/decorations`).
- `DECORATION_EDIT_KEY`: optional private editor password; falls back to `STREAM_KEY` when absent.

## Decorations

In the Activity, open **Ajustes → Decorar** and enter the editor password. Upload PNG, JPG, WebP or GIF images (up to 2 MB), place them by dragging, then fine-tune position, size, rotation, opacity and layer in the numeric fields. **Guardar para todos** makes the arrangement visible to viewers. The editor stores separate placements for Casa/Arcade in horizontal, vertical and compact window views. You can copy a placement to the other views and adjust each one afterward. New images start in the selected view; select them in another view to place them there as well.

The editor password stays in page memory only. Viewers can see decorations without it; upload and save require the password. In production, mount persistent storage before adding images, or uploads will disappear on redeploy.

## Local development

```bash
npm install
npm run build
npm start
```

For Vite hot reload, run the API in one terminal with `npm run dev:server` and Vite in another with `npm run dev`.

## Discord setup

1. Create an application in the Discord Developer Portal.
2. Configure an Activity URL Mapping pointing `/` to the HTTPS URL where this repo is deployed.
3. Enable Activities for the application.
4. Put the application ID in `DISCORD_CLIENT_ID` on the server and redeploy.
5. Launch the unverified Activity from your test server while developing.

The frontend only calls `DiscordSDK.ready()`; it does not need Discord OAuth for the MVP because it only acts as a LiveKit viewer.

## LiveKit setup

Create a LiveKit Cloud project and put its URL, API key and API secret in the server environment. Secrets stay on the server. The browser and APK receive only short-lived participant tokens.

Rooms are named `shis-<stream>`. The Switch publishes with `canPublish=true`; Activity viewers receive `canPublish=false, canSubscribe=true` tokens.

## Deployment

A `render.yaml` is included as an easy first deployment option. Any Node host with HTTPS works. Build command: `npm install && npm run build`; start command: `npm start`.

## Security

- Never put `LIVEKIT_API_SECRET` in the Android app, Activity JavaScript, or GitHub repository.
- `STREAM_KEY` is checked with a constant-time comparison and is sent by the APK in the `X-Stream-Key` header.
- Viewer tokens cannot publish.
