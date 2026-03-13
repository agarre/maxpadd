# maxpadd — KWin Script for Plasma 6

## Project Overview

KWin Script (pure JavaScript) that adds configurable padding around maximized windows on KDE Plasma 6 + Wayland/X11.

- **Script ID:** `maximized-window-gap-p6`
- **Language:** JavaScript (ECMAScript — KWin Scripting native). NO TypeScript, NO QML, NO npm.
- **Target:** KDE Plasma ≥ 6.0, KWin ≥ 6.0
- **License:** GPL-3.0
- **Author:** Hugo Breda / Agarre Tecnologia

## Repository Structure

```
maxpadd/
├── maximized-window-gap-p6/   ← KWin script package (installable)
│   ├── contents/
│   │   ├── code/
│   │   │   └── main.js        ← Main script logic
│   │   ├── config/
│   │   │   └── main.xml       ← Config key declarations
│   │   └── ui/
│   │       └── config.ui      ← Qt Designer config UI
│   ├── metadata.json           ← KWin package metadata
│   └── LICENSE
├── docs/                       ← All .md documentation lives here
│   ├── kwin-maximized-gap-guide.md
│   └── kwin-maximized-gap-prompt.md
├── .gitignore
└── CLAUDE.md
```

## Key Rules

### Code Standards

- Plain JavaScript ONLY — no TypeScript, no build step, no dependencies
- Keep main.js under 80 lines
- Use KWin 6 API exclusively — NEVER use deprecated Plasma 5 API names:
  - `windowList` not `clientList()`
  - `windowAdded` not `clientAdded`
  - `window.frameGeometry` not `client.geometry`
  - `window.output` not `workspace.activeScreen`
- Always guard against infinite signal loops when setting `frameGeometry`
- Never hardcode screen dimensions or pixel values
- Never apply gap to fullscreen windows (`window.fullScreen === true`)
- Only apply to normal windows (`window.normalWindow === true`)

### KWin API Quick Reference

- `readConfig(key, default)` — read script config
- `workspace.clientArea(KWin.MaximizeArea, window)` — get maximize area per-screen
- `workspace.windowAdded` / `workspace.windowRemoved` — window lifecycle signals
- `window.maximizedChanged` — per-window maximize state signal (Plasma 6)
- `window.frameGeometry` — read/write window geometry (QRectF)
- `Qt.rect(x, y, w, h)` — create QRectF objects

### File Organization

- **All `.md` files go in `/docs`** — .gitignore blocks .md files outside /docs
- CLAUDE.md is the exception (root level, tracked by git)
- Documentation language: PT-BR for guides, EN for code comments and README

### Development Workflow

```bash
# Install via symlink
ln -s $(pwd)/maximized-window-gap-p6 ~/.local/share/kwin/scripts/maximized-window-gap-p6

# Enable
kwriteconfig6 --file kwinrc --group Plugins --key maximized-window-gap-p6Enabled true
qdbus6 org.kde.KWin /KWin reconfigure

# Watch logs
journalctl _COMM=kwin_wayland -f | grep -i gap
```

### Testing Checklist

- Maximize window → gap appears, window centered
- Restore window → returns to previous size
- Change % in config → gap updates after reconfigure
- Both monitors work independently
- Fullscreen (F11) NOT affected
- System Settings / dialogs NOT affected
- Window with minimum size constraint → no crash
- Set to 100% → window maximizes normally (no gap)

## Git Conventions

- Commit messages: EN, imperative mood, concise
- Branch naming: `feature/`, `fix/`, `docs/`
- Never commit console.log/debug statements
