# maxpadd

A simple KWin script that adds padding around maximized windows on KDE Plasma 6.

Instead of windows taking up the entire screen when maximized, maxpadd shrinks them by a configurable pixel gap and centers them — giving you breathing room around your windows.

## What it does

- Adds a gap (padding) around maximized windows, in pixels
- Configurable gap size (0–200 px, default 15 px)
- Works on multiple monitors independently
- Skips fullscreen apps (games, videos, etc.)
- Skips dialogs and system windows — only touches regular windows
- Ignore list: plasma internals are always excluded, and you can add your own apps
- Toggle: maximize a gapped window again to restore its original size

## Requirements

- KDE Plasma 6.0+
- KWin 6.0+
- Wayland or X11

## Install

### Option 1: Symlink (for dev / tinkering)

```bash
# From the repo root:
ln -s "$(pwd)/maxpadd" ~/.local/share/kwin/scripts/maxpadd
```

### Option 2: Copy

```bash
# From the repo root:
cp -r maxpadd ~/.local/share/kwin/scripts/
```

### Then enable it

```bash
kwriteconfig6 --file kwinrc --group Plugins --key maxpaddEnabled true
qdbus6 org.kde.KWin /KWin reconfigure
```

Or go to **System Settings > Window Management > KWin Scripts** and toggle it on.

## Configure

After enabling, go to **System Settings > Window Management > KWin Scripts**, find "maxpadd" and click the settings icon.

### Padding tab

- **Gap size (px):** space between the window edge and the screen edge, on all four sides.
  - `15` (default) = 15 px border around the window
  - `0` = no gap (normal maximize behavior)
  - `200` = maximum gap

### Ignored Apps tab

Some apps are always ignored (plasmashell, krunner, spectacle, etc.). You can add extra apps as a comma-separated list of window class names (e.g. `discord, steam, gimp`).

To find an app's window class, run `xprop WM_CLASS` and click the window, or check `qdbus6 org.kde.KWin /KWin queryWindowInfo`.

## Pairs well with KZones

If you use [KZones](https://github.com/gerritdevriese/kzones) for tiling / snap layouts, maxpadd is a great complement — KZones handles tiling zones while maxpadd gives your maximized windows a comfortable gap. They work independently and don't conflict.

## How it works

When you maximize a window, maxpadd intercepts it, un-maximizes it, and resizes it to the screen area minus the configured gap on each side. It also reacts to screen layout changes (plugging in a monitor, etc.) so your gaps stay consistent.

Maximizing a gapped window a second time restores it to its original pre-maximize geometry.

It's a tiny plain JavaScript file. No dependencies, no build step, no bloat.

## Troubleshooting

Check the logs:

```bash
journalctl -f QT_CATEGORY=js QT_CATEGORY=kwin_scripting
```

If a window isn't getting the gap, make sure it's a regular window (not a dialog or splash screen) and that it's truly maximized (not just resized to fill the screen).

## License

GPL-3.0 — free to use, modify, and share. See [LICENSE](LICENSE) for details.
