# YouTube source

The Source control accepts YouTube video, shorts, live and playlist links. It uses the official IFrame Player API, native controls, branding and playback. No video is downloaded, proxied, sampled or recreated. Playback changes are shared in the current Discord Activity instance; volume is local to each viewer. Return to Switch reconnects the existing stream provider. Old stream callbacks cannot overwrite the YouTube mount.

`GET/PUT /api/playback?instance=…` require the existing signed Activity entry ticket. State is ephemeral in server memory, with revision conflicts, bounded session count, payload validation and write rate limiting. Sessions expire after six hours without access. A server restart returns playback to Switch; decoration saves are unaffected. All participants who can access the Activity may change its playback.

The YouTube player keeps a viewport of at least 200×200 pixels. Runtime TV size/aperture adjustments preserve saved geometry and keep its controls on screen. CRT overlays, on-screen displays and decoration over the player aperture are removed while using YouTube. Very small call tiles hold local playback until expanded. The editor displays a static layout preview to avoid a second audible player.

The page and iframe API use `origin` referrer policy. This provides a nonempty application identity without sending the signed Activity ticket in a same-origin proxy request's referrer. Private, removed, embed-disabled, identity and autoplay errors receive a readable message. Failed loading keeps the Return to Switch control available.

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

In the Discord Developer Portal, open this application's **Activities → URL Mappings**. Add `/youtube` with target `www.youtube.com` and `/s` with target `www.youtube.com/s` (no scheme). Put both mappings above the existing `/` mapping and preserve all existing entries, especially `/api`. YouTube's native embed requests its bootstrap scripts and styles from root-relative `/s/...` paths; a parent document's MutationObserver does not remap resources inside that child document. The SDK remaps only parent DOM resources for the YouTube target; stream networking is left intact. Requests use the `/.proxy` base when present in the current Activity document URL.

The app probes the mapped loader and native embed's bootstrap script paths, checking HTTP status and content type before changing the shared source. A missing mapping can return the application's entry HTML rather than JavaScript. Failed attempts leave Switch selected, provide an explicit error and do not keep retrying every poll. A selected source that fails initialization waits for a changed selection or **Reintentar YouTube**.

Browser route fixtures with a same-origin-only CSP verify HTML/404 preflight failures without a shared source change, mapped loader/widget/iframe URLs, no repeated initialization after failure, explicit retry recovery and cancellation when the source dialog closes. Long error notices do not intercept the source controls on mobile. These fixtures use simulated YouTube responses; they do not exercise actual video playback.

This mapping is necessary for this loader correction. It does not prove that the embedded YouTube page, its internal network requests, browser identity requirements and media playback all work through the Discord proxy. The portal configuration is outside this repository, and real playback must be tested in the signed-in Discord client after it is configured. Do not call the route fixture a successful real YouTube playback test.

## Native API message origin correction

The user reached the iframe-ready timeout after configuring `/youtube`. The previous constructor supplied the full mapped base (including `/youtube`) as `host`. The official widget API checks incoming `MessageEvent.origin` against that host string; message origins contain no path. Thus even a ready child could never pass that check. The correction constructs an existing native iframe with the mapped embed URL and documented URL parameters, then lets the official API infer the bare message origin from its src. Returning to Switch clears both the old status and notice, and old autoplay/error callbacks cannot restore them.

A browser regression using an unmodified official widget script fetched on 2026-10-02 reproduces dropped ready messages with the old host and accepts the same child's ready messages with an existing iframe. The child messages and playback are simulated. It also verifies missing `/s` resources preserve Switch, explicit retry, cancellation and notice cleanup. This proves the origin correction, not successful real YouTube media playback through Discord; other internal API/media requests and identity checks remain unverified.

## Playback stalls and native diagnostics

The user still saw a black player after adding both mappings. A local probe using YouTube's real embed HTML and unmodified bootstrap/widget scripts, with the configured routes and a same-origin network policy, observed additional Google/DoubleClick requests blocked by CSP, a root `/youtubei/...` request, and native error 153. This is evidence that loading the API and static assets is insufficient for real playback through this proxy design. The probe is a simulated sandbox, not the user's authenticated Discord client, and does not establish the exact cause on their Android device. Do not prescribe additional portal mappings without actual client evidence or claim that these code changes solve YouTube media access.

The Activity now distinguishes a ready API from a playing video. A 20-second playback watchdog reports a stalled native player without destroying it, and **Información de carga** shows readiness, player state, native error code and CSP events observed read-only in the same-origin child document. There are no fetch/postMessage overrides or modifications to YouTube's player source. Some early events or cross-origin redirects cannot be inspected; absence of reported blocks does not prove successful network access. Reports are local, bounded, and omit credentials, query strings, video identifiers and signed media parameters. No diagnostic telemetry is sent to a server.

Polling does not repeatedly play, reload or seek a buffering player; a selection is loaded once, and time correction waits for active/paused media. A local player that has not started, fails, or is blocked from autoplay cannot publish a fake pause or seek to the shared Activity state. **Ver fuera de la actividad** opens a canonical YouTube video/playlist URL only on a user click, via the existing Discord SDK's `openExternalLink` command. Discord handles the external-link prompt. This option does not play inside the TV or preserve shared playback outside the Activity.

Validation covers stalled buffering, error 153 with sanitized CSP details, no-ready timeout, Switch cleanup, absence of repeated loading/seeking commands while buffering, failure isolation from shared playback, and existing two-viewer controls. Embedded media playback remains unresolved pending actual client diagnostics; the optional external-link command is a fallback, not an embedded-playback fix.
