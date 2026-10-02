# SHIS Stream — Discord Activity

SHIS Stream is a private-use Discord Activity for watching a Nintendo Switch stream together inside a voice call. The current production path uses a customized SysDVR sender on the Switch, a small Railway relay, Cloudflare Realtime SFU and the Discord Activity UI.

## Current architecture

```text
Nintendo Switch
  └─ SysDVR SHIS Direct (H.264 video + PCM audio)
       ↓ TCP
Railway native relay
       ↓ authenticated signaling/media publish
Cloudflare Realtime SFU
       ↓
Discord Activity
       ↓
Viewers in the same Activity
```

The Switch never needs Discord or Cloudflare credentials. It only knows the TCP relay endpoint, stream name and a private stream key. The relay authenticates that sender and publishes the media through Cloudflare Realtime SFU. The Activity authorizes viewers with Discord and subscribes them to the current publication.

The customized Switch sender lives in [`cyannick056-spec/Shis-Stream`](https://github.com/cyannick056-spec/Shis-Stream).

## Main features

- Nintendo Switch video and game audio inside a Discord Activity.
- Casa/CRT and Arcade presentation modes.
- Shared TV format, scene and effects controlled by the host.
- Local volume and exit controls for spectators.
- Decoration/editor system with movable figures, furniture, lights and viewer avatar slots.
- Separate saved layouts for scene, orientation and TV aspect.
- Runtime room lighting and TV-color spill driven by the live Switch image.
- Compact Discord tiles use the full rectangular viewport and hide room/editor clutter.
- The editor keeps drafts locally until the host explicitly saves the current view.
- Shared decorations are stored on a persistent Railway volume.

## Host access

Only the host can change shared scene state such as TV format, effects, playback source and saved decorations.

Host access is activated from the Activity using the configured editor key. The key is stored only in the server environment (`DECORATION_EDIT_KEY`) and must never be committed to this repository. Authorized host sessions are signed and scoped to the current Activity instance.

Spectators keep independent volume and can leave the Activity without changing the shared scene.

## Configuration

Copy `.env.example` to `.env` for local development. Never commit real credentials.

Current Activity/server variables:

- `DISCORD_CLIENT_ID` — Discord application/client ID.
- `DISCORD_CLIENT_SECRET` — Discord OAuth client secret; server-side only.
- `STREAM_PROVIDER=cloudflare` — current production transport.
- `CLOUDFLARE_SFU_APP_ID` — Cloudflare Realtime SFU application ID.
- `CLOUDFLARE_SFU_APP_SECRET` — Cloudflare Realtime SFU secret; server-side only.
- `STREAM_KEY` — private key shared with the Switch relay path.
- `DECORATION_EDIT_KEY` — separate host/editor password.
- `DECORATION_DATA_DIR` — persistent decoration storage directory.
- `DEFAULT_STREAM` — logical stream name.
- `PORT` — Activity HTTP port.

Relay variables:

- `STREAM_PROVIDER=cloudflare`
- `SHIS_ACTIVITY_URL` — HTTPS origin of the Activity server used for authenticated Cloudflare signaling.
- `STREAM_KEY` — must match the Switch configuration.
- `DEFAULT_STREAM` — logical stream name.
- `PORT` / `RELAY_PORT` — relay listen port exposed through Railway TCP proxy.

Cloudflare credentials remain on the Activity backend. They are not stored on the Switch and are not exposed to viewers.

## Local development

Requires Node.js 20 or newer.

```bash
npm install
npm run build
npm start
```

For Vite hot reload:

```bash
npm run dev:server
npm run dev
```

The production service runs on Railway. The Activity uses an HTTPS endpoint and a persistent volume for shared decoration data; the native relay is a separate Railway service with a TCP proxy.

## Switch sender

The active sender is **SysDVR SHIS Direct v0.6**. Build/install instructions and Switch-side source live in:

- [`cyannick056-spec/Shis-Stream`](https://github.com/cyannick056-spec/Shis-Stream)
- [`sysdvr-shis/`](https://github.com/cyannick056-spec/Shis-Stream/tree/main/sysdvr-shis)

The Switch configuration uses the relay TCP proxy host/port, a stream name and a private `stream_key`. Real endpoints and secrets are intentionally not stored in either public repository.

## Legacy compatibility

Some LiveKit compatibility code remains in the project as an older transport/fallback path, and the server still contains legacy token endpoints used by previous sender experiments. They are not the current production path.

Older Android and standalone Switch-forwarder experiments are kept in the companion repository for reference only. New work should target SysDVR SHIS Direct + Railway relay + Cloudflare Realtime SFU.

## Security notes

- Do not commit Discord secrets, Cloudflare secrets, stream keys or editor passwords.
- Ordinary direct visits to the production Activity are rejected; viewer entry is authorized through Discord.
- Viewer authorization does not grant publishing rights.
- Shared state writes are host-authorized on the server.
- Public repository source code is not a substitute for keeping deployment secrets private.

## Project status

This repository is the active Discord Activity and backend for SHIS Stream. Public documentation describes the current supported setup; implementation history and one-off development/debugging notes are intentionally kept out of the main README.
