<p align="center">
  <img src="assets/extension-icon.png" alt="Bento Window" width="160" height="160" />
</p>

<h1 align="center">Bento Window</h1>

<p align="center">A Raycast extension that tiles a single app's windows into a bento-box grid.</p>

---

A Raycast extension that tiles **a single app's windows** into a bento-box grid with one keystroke. The grid auto-adapts to how many windows you have open — 4 windows become 2×2, 6 become 3×2, 9 become 3×3, and so on.

Built for the **vibe coding** workflow where you spin up several terminals (Ghostty, Terminal, iTerm2…) and want them snapped into place without dragging each one into a quarter.

## How this differs from [Window Layouts](https://www.raycast.com/teemu_suvinen/window-layouts)

Window Layouts is excellent and the auto-layout algorithm here is intentionally similar. **The one thing Bento Window does that Window Layouts doesn't: it filters by app.**

| Scenario | Window Layouts | Bento Window |
|---|---|---|
| Tile only Ghostty windows, leave Chrome / VSCode untouched | ❌ all windows get tiled | ✅ only the target app |
| Run from the focused window, auto-detect which app to tile | ❌ | ✅ leave preference empty |
| Auto-pick a layout based on window count | ✅ | ✅ |

If you only ever want to tile every window on the desktop, **use Window Layouts instead** — it's mature and has more layout options. Bento Window exists for the case where you want to tile *just one app's windows*.

## Layouts

| Windows | Grid |
|---|---|
| 1 | Fullscreen |
| 2 | Left half + right half |
| 3 | Two small on left + one big on right |
| 4 | 2×2 |
| 5 | 2×2 small on left + one big on right |
| 6 | 3×2 |
| 7 | 4×2 (one cell empty) |
| 8 | 4×2 |
| 9 | 3×3 |
| 10+ | 5×2 (extras untouched) |

## Install (manual, before Store release)

This extension is not yet on the Raycast Store. To run it locally:

```bash
git clone https://github.com/ipopo/bento-window.git
cd bento-window
npm install
npm run dev
```

`npm run dev` registers the extension with Raycast and watches for code changes. You can `Ctrl+C` it once the extension shows up — the registration persists.

Then in Raycast:

1. Open a few windows of your target app (Ghostty, Terminal, etc.)
2. Run **Bento Tile**
3. Optional: assign a global hotkey (Raycast Settings → Extensions → Bento Window → record hotkey)

## Configuration

Raycast Settings → Extensions → **Bento Window**:

- **Target app names** — comma-separated list, tried in order. The first app with windows on the active desktop gets tiled.
  - Default: `Ghostty, Terminal, iTerm2, Alacritty, WezTerm`
  - Leave **empty** for auto mode — the extension uses the currently focused window's app. Works for any app you're focused in.
- **Gap** — pixels between tiles and screen edges. `0` (default) for flush tiles.

## Requirements

- macOS
- Raycast **Pro** (Window Management API is a Pro feature)
- Accessibility permission granted to Raycast (System Settings → Privacy & Security → Accessibility)

## License

MIT
