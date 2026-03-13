# Prompt: Build KWin Script — Maximized Window Gap for Plasma 6

## Context

You are building a KWin Script for KDE Plasma 6 (KWin 6.x) that adds configurable padding around maximized windows. The script must work on Wayland and X11, with multi-monitor support.

**Language:** JavaScript (KWin Scripting native — NOT TypeScript, NOT QML)
**Target:** KDE Plasma ≥ 6.0, KWin ≥ 6.0
**License:** GPL-3.0

## Project structure

Create exactly this file tree:

```
maximized-window-gap-p6/
├── contents/
│   ├── code/
│   │   └── main.js
│   ├── config/
│   │   └── main.xml
│   └── ui/
│       └── config.ui
├── metadata.json
├── LICENSE
└── README.md
```

## Specification

### Behavior

1. When a window is maximized (both horizontally and vertically), resize it to occupy only `gapPercent`% of the maximize area, centered on screen.
2. When a window is restored from maximized state, do nothing — KWin handles restoration natively.
3. Fullscreen windows (F11 / `window.fullScreen === true`) must NEVER be affected.
4. Only apply to `window.normalWindow === true`. Ignore panels, dialogs, splash screens, tooltips, popups, and any non-normal windows.
5. Multi-monitor: use `workspace.clientArea(KWin.MaximizeArea, window)` which already returns the correct area per-screen. Do NOT hardcode screen dimensions.

### Configuration

The user sees ONE setting when clicking the wrench/gear icon:

```
Window size (% of screen): [___] %
```

- Config key: `gapPercent`
- Type: `Int`
- Default: `90`
- Range: `50` to `100`
- Read via: `readConfig("gapPercent", 90)`

When set to 90%, the window occupies 90% of the maximize area (5% gap on each side). When set to 100%, no gap (behaves as normal maximize).

### Gap calculation

```
area = workspace.clientArea(KWin.MaximizeArea, window)
factor = gapPercent / 100.0
newWidth = area.width * factor
newHeight = area.height * factor
newX = area.x + (area.width - newWidth) / 2
newY = area.y + (area.height - newHeight) / 2
window.frameGeometry = Qt.rect(newX, newY, newWidth, newHeight)
```

### Critical implementation details

1. **Avoid infinite loops:** Setting `frameGeometry` on a maximized window will cause KWin to "unmaximize" it, which may re-trigger signals. Use a guard flag (e.g., `window._gapApplying = true`) or a Set to track windows being processed. Clear the flag after applying geometry.

2. **Connect to all windows:** On script load, iterate `workspace.windowList` (or `workspace.stackingOrder`) to connect signals to existing windows. Also connect to `workspace.windowAdded` for new windows.

3. **Per-window signal:** Connect to each window's maximize state change. In KWin 6, the approach is:
   - Try `window.maximizedChanged.connect(callback)` first
   - The callback receives no args — check the window's current state inside it
   - A window is "fully maximized" when both horizontal and vertical are true

4. **Checking maximized state in KWin 6:** There is no single `.maximized` boolean. You may need to check the window's frameGeometry against the maximize area to determine if it just got maximized, OR use the workspace-level signal if per-window doesn't work. Test both approaches:
   - **Approach A (preferred):** Per-window signal connection
   - **Approach B (fallback):** `workspace.clientMaximizeSet.connect(function(client, h, v) { ... })` — this is the Plasma 5 API name but may still work in 6

5. **Do NOT use deprecated APIs:**
   - Do NOT use `clientList()` — use `windowList` or `stackingOrder`  
   - Do NOT use `clientAdded` — use `windowAdded`
   - Do NOT use `client.geometry` — use `window.frameGeometry`
   - Do NOT use `workspace.activeScreen` — use `window.output`

6. **Cleanup on window removal:** Connect to `workspace.windowRemoved` to clean up any tracking data for destroyed windows.

## File contents

### metadata.json

```json
{
    "KPlugin": {
        "Id": "maximized-window-gap-p6",
        "Name": "Maximized Window Gap",
        "Description": "Adds configurable padding around maximized windows (Plasma 6)",
        "Authors": [
            {
                "Name": "Hugo Breda / Agarre Tecnologia",
                "Email": "contato@agarre.com.br"
            }
        ],
        "Category": "Window Management",
        "License": "GPL-3.0",
        "Version": "1.0.0",
        "Website": "https://github.com/agaborges/maximized-window-gap-p6"
    },
    "X-Plasma-API": "javascript",
    "X-Plasma-MainScript": "contents/code/main.js",
    "X-KDE-ConfigModule": "kwin/effects/configs/kcm_kwin4_genericscripted"
}
```

### contents/config/main.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kcfg xmlns="http://www.kde.org/standards/kcfg/1.0"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.kde.org/standards/kcfg/1.0
                          http://www.kde.org/standards/kcfg/1.0/kcfg.xsd">
    <kcfgfile name=""/>
    <group name="General">
        <entry name="gapPercent" type="Int">
            <default>90</default>
        </entry>
    </group>
</kcfg>
```

### contents/ui/config.ui

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ui version="4.0">
    <class>MaximizedWindowGapConfig</class>
    <widget class="QWidget" name="MaximizedWindowGapConfig">
        <layout class="QFormLayout" name="formLayout">
            <item row="0" column="0">
                <widget class="QLabel" name="labelGap">
                    <property name="text">
                        <string>Window size (% of screen):</string>
                    </property>
                </widget>
            </item>
            <item row="0" column="1">
                <widget class="QSpinBox" name="kcfg_gapPercent">
                    <property name="minimum">
                        <number>50</number>
                    </property>
                    <property name="maximum">
                        <number>100</number>
                    </property>
                    <property name="value">
                        <number>90</number>
                    </property>
                    <property name="suffix">
                        <string> %</string>
                    </property>
                </widget>
            </item>
        </layout>
    </widget>
</ui>
```

### contents/code/main.js

Write the complete script following ALL the rules above. The script must:

1. Read `gapPercent` from config with `readConfig("gapPercent", 90)`
2. Define a helper function `applyGap(window)` that:
   - Returns immediately if `window.normalWindow !== true`
   - Returns immediately if `window.fullScreen === true`  
   - Returns immediately if a guard flag is set on the window
   - Gets the maximize area via `workspace.clientArea(KWin.MaximizeArea, window)`
   - Calculates centered geometry at `gapPercent`% of the area
   - Sets guard flag, applies `window.frameGeometry = Qt.rect(...)`, clears guard flag with a small timer (`Qt.callLater` or similar)
3. Connect to maximize state changes for each window
4. On script init, connect to all existing windows via `workspace.stackingOrder` or `workspace.windowList`
5. Connect to `workspace.windowAdded` for new windows
6. Keep the code under 80 lines, clean, well-commented

### README.md

Write a clean README with:
- Project name and one-line description
- Screenshot placeholder
- Installation instructions (KDE Store, kpackagetool6, manual symlink)
- Configuration explanation
- Compatibility (Plasma 6+, Wayland, X11, multi-monitor)
- License (GPL-3.0)
- Credits

## Testing instructions

After creating all files, the developer should test with:

```bash
# Install via symlink
mkdir -p ~/.local/share/kwin/scripts/
ln -s $(pwd)/maximized-window-gap-p6 ~/.local/share/kwin/scripts/maximized-window-gap-p6

# Enable
kwriteconfig6 --file kwinrc --group Plugins --key maximized-window-gap-p6Enabled true
qdbus6 org.kde.KWin /KWin reconfigure

# Watch logs
journalctl _COMM=kwin_wayland -f | grep -i gap
```

Test checklist:
- [ ] Maximize window → gap appears, window centered
- [ ] Restore window → returns to previous size
- [ ] Change % in config → gap updates after reconfigure
- [ ] Both monitors work independently
- [ ] Fullscreen (F11) is NOT affected
- [ ] System Settings / dialogs are NOT affected
- [ ] Double-click titlebar to maximize → gap works
- [ ] Meta+Up to maximize → gap works
- [ ] Window with minimum size constraint (Discord, etc.) → no crash
- [ ] Set to 100% → window maximizes normally (no gap)

## Constraints

- Do NOT use TypeScript — plain JavaScript only
- Do NOT use any external dependencies or npm packages
- Do NOT create a build step — the script must work as-is
- Do NOT use Plasma 5 API names (clientList, clientAdded, etc.)
- Do NOT hardcode screen dimensions or pixel values
- Do NOT apply gap to fullscreen windows
- ALWAYS use `Qt.rect()` for creating QRectF objects
- ALWAYS guard against infinite signal loops
- Keep total main.js under 80 lines
