# Bento Window Changelog

## [Split Commands] - 2026-07-20

- Split the single command into two: **Auto Tile** (single app via priority list / focused window) and **Auto Tile All** (every tileable window on the active desktop)
- Removed the Tile Scope preference — pick the behavior by command, bind a hotkey to each
- Moved Target App Names and Window Gap to extension-level preferences shared by both commands

## [Initial Release] - {PR_MERGE_DATE}

- Tile multiple windows of the same app into bento‑box grids
- Auto‑adapts layout to window count: 2 (halves), 3 (left two + right big), 4 (2×2), 5 (left 2×2 + right big), 6 (3×2), 7 (4×2 last wide), 8 (4×2), 9 (3×3), 10+ (5×2)
- Comma‑separated app priority list with auto‑detect fallback (empty = use focused window's app)
- Tile Scope preference: tile the matched app's windows (default) or every tileable window on the active desktop
- Targets the desktop the windows are on when multiple desktops are active (multi‑display setups)
- Configurable gap, default 0 for flush tiles
