# Frozen banner anchors (v1)

The ONLY legal style/reference inputs for GPT Image 2 banner generation.

- `jellyfin.jpg` - dark-variant anchor (clean lobster, real washes, hex-free)
- `usage-tracker.jpg` - light-flatlay anchor (loose watercolor, on-brand)
- `tokenjuice.jpg` - origin north-star (bright clean character watercolor)

Rules:
- This set is immutable. `SHA256SUMS` is enforced by `banner/anchors.test.mjs`.
- NEVER add a generated or shipped banner here. Re-feeding outputs as references
  is the exact cause of the hexagonal drift this set exists to prevent.
- A new version (anchors-v2) is a deliberate, reviewed change, never a drop-in.
