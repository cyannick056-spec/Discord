# YouTube source

The Source control accepts YouTube video, shorts, live and playlist links. It uses the official IFrame Player API, native controls, branding and playback. No video is downloaded, proxied, sampled or recreated. Playback changes are shared in the current Discord Activity instance; volume is local to each viewer. Return to Switch reconnects the existing stream provider. Old stream callbacks cannot overwrite the YouTube mount.

`GET/PUT /api/playback?instance=…` require the existing signed Activity entry ticket. State is ephemeral in server memory, with revision conflicts, bounded session count, payload validation and write rate limiting. Sessions expire after six hours without access. A server restart returns playback to Switch; decoration saves are unaffected. All participants who can access the Activity may change its playback.

The YouTube player keeps a viewport of at least 200×200 pixels. Runtime TV size/aperture adjustments preserve saved geometry and keep its controls on screen. CRT overlays, on-screen displays and decoration over the player aperture are removed while using YouTube. Very small call tiles hold local playback until expanded. The editor displays a static layout preview to avoid a second audible player.

The page and iframe API use `strict-origin-when-cross-origin` referrer policy. Private, removed, embed-disabled, identity and autoplay errors receive a readable message. Failed loading keeps the Return to Switch control available.

## Environment verification

Unit/API tests cover URL validation, authorization, instance isolation, revision conflicts and session expiration. Browser tests exercise the official API contract with a stub: two viewers share source, pause, seek and playlist advance; volume remains independent; mobile keeps native controls unobstructed; tiny tiles resume after expansion.

Actual YouTube playback must also be verified in the signed-in Discord client. Discord controls the Activity CSP and external URL mappings; this repository cannot grant external network access or change the Developer Portal. Loading failures are reported rather than represented as a playable video. Merely configuring a mapping does not verify that all embedded YouTube requests and identity checks work. Do not claim full Discord playback from the stub tests.

YouTube iframe pixels are cross-origin and are not sampled for TV color, light or reflections. Switch retains live frame-based light/reflections; YouTube retains room practical lights and backlight. No fixed screen reflection is baked into the assets.

Official references:
- https://developers.google.com/youtube/iframe_api_reference
- https://developers.google.com/youtube/terms/required-minimum-functionality
- https://docs.discord.com/developers/activities/development-guides/networking
- https://docs.discord.com/developers/activities/development-guides/local-development

Live probe on 2026-10-02: the external YouTube API script failed to load in the execution environment. The app displayed its connection error and mounted no iframe. This result does not establish whether the signed-in Discord client's CSP permits YouTube; that check remains outstanding.

## Discord route configuration

The initial integration loaded `https://www.youtube.com/iframe_api` directly. A user subsequently observed the loader error inside Discord, before any video iframe was created. The correction uses a mapped route for the loader, the dynamic widget script and the embed host when running on a Discord Activity origin. Ordinary browser development keeps the official YouTube host.

In the Discord Developer Portal, open this application's **Activities → URL Mappings**. Add prefix `/youtube` with target `www.youtube.com` (no scheme). Put the more specific mapping above the existing `/` mapping and preserve all existing entries. The SDK remaps only DOM resources for this YouTube target; stream networking is left intact. Requests use the `/.proxy` base when present in the current Activity document URL.

The app probes the mapped loader, checking both HTTP status and JavaScript content type before changing the shared source. A missing mapping can return the application's entry HTML rather than JavaScript. Failed attempts leave Switch selected, provide an explicit error and do not keep retrying every poll. A selected source that fails initialization waits for a changed selection or **Reintentar YouTube**.

Browser route fixtures with a same-origin-only CSP verify HTML/404 preflight failures without a shared source change, mapped loader/widget/iframe URLs, no repeated initialization after failure, explicit retry recovery and cancellation when the source dialog closes. Long error notices do not intercept the source controls on mobile. These fixtures use simulated YouTube responses; they do not exercise actual video playback.

This mapping is necessary for this loader correction. It does not prove that the embedded YouTube page, its internal network requests, browser identity requirements and media playback all work through the Discord proxy. The portal configuration is outside this repository, and real playback must be tested in the signed-in Discord client after it is configured. Do not call the route fixture a successful real YouTube playback test.
