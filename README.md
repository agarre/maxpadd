# maxpadd

A simple KWin script that adds padding around maximized windows on KDE Plasma 6.

Instead of windows taking up the entire screen when maximized, maxpadd shrinks them by a configurable percentage and centers them — giving you a nice breathing room around your windows.

## What it does

- Adds a gap (padding) around maximized windows
- You pick the size — from 50% to 100% of the screen
- Works on multiple monitors independently
- Skips fullscreen apps (games, videos, etc.)
- Skips dialogs and system windows — only touches regular windows

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

Or just go to **System Settings > Window Management > KWin Scripts** and toggle it on.

## Configure

After enabling, go to **System Settings > Window Management > KWin Scripts**, find "maxpadd" and click the settings icon.

You'll see a single slider:

- **Window size (% of screen):** how much of the screen the window should take up
  - `90%` (default) = window takes 90% of the screen, leaving a 5% border on each side
  - `100%` = no gap at all (normal maximize behavior)
  - `50%` = window takes half the screen, centered

## How it works

When you maximize a window, maxpadd intercepts it and resizes it to the configured percentage of the screen area, centered. It also reacts to screen layout changes (plugging in a monitor, etc.) so your gaps stay consistent.

It's a tiny plain JavaScript file. No dependencies, no build step, no bloat.

## Troubleshooting

Check the logs:

```bash
journalctl -f QT_CATEGORY=js QT_CATEGORY=kwin_scripting
```

If a window isn't getting the gap, make sure it's a regular window (not a dialog or splash screen) and that it's truly maximized (not just resized to fill the screen).

## License

GPL-3.0 — free to use, modify, and share. See [LICENSE](LICENSE) for details.
