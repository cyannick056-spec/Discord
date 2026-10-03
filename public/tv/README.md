# Shared TV assets

The CRT reuses the original `public/crt-room-4x3.webp` photograph. Its original housing, bezel, buttons and glass are clipped in CSS using the calibration in `models.mjs`; the supporting strip below the housing is excluded.

The flat TV uses `real-flat.webp`. Both orientations and all rooms reuse the same model asset and a continuous camera transform.

Tableless backgrounds are served from `public/rooms/tableless-v2/` to bypass previously cached photos. Non-hashed assets revalidate on subsequent loads.
