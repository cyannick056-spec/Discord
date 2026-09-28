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

The Node server does **not** relay video. It only serves the Activity and signs short-lived LiveKit tokens. Media travels through LiveKit, so the web host stays lightweight.

## Environment

Copy `.env.example` to `.env` for local development. Never commit real secrets.

Required:

- `DISCORD_CLIENT_ID`: your Discord application's public client/application ID.
- `LIVEKIT_URL`: `wss://...` URL from your LiveKit Cloud project.
- `LIVEKIT_API_KEY`: server-only LiveKit API key.
- `LIVEKIT_API_SECRET`: server-only LiveKit API secret.
- `STREAM_KEY`: private password used by the Switch APK to obtain a publisher token.
- `DEFAULT_STREAM`: normally `cris`.

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
