/*
 * maxpadd — KWin Script for Plasma 6
 * (C) 2026 Hugo Breda Schneweiss <hbreda@gmail.com>
 * License: GPL-3.0
 *
 * Adds configurable percentage-based padding around maximized windows.
 * AIDEV-NOTE: Uses idempotency check (geometry comparison) to prevent infinite loops
 */

const gapPercent = Math.max(50, Math.min(100, readConfig("gapPercent", 90)));

// --- Core ---

// AIDEV-NOTE: KWin 6 has no window.maximized property — use maximizedAboutToChange(mode)
// MaximizeMode: 0 = restore, 3 = fully maximized (horizontal + vertical)
function applyGap(win) {
    if (!win || !win.normalWindow) return;
    if (win.fullScreen) return;
    if (gapPercent >= 100) return;

    const area = workspace.clientArea(KWin.MaximizeArea, win);
    const factor = gapPercent / 100.0;
    const newW = Math.round(area.width * factor);
    const newH = Math.round(area.height * factor);
    const newX = Math.round(area.x + (area.width - newW) / 2);
    const newY = Math.round(area.y + (area.height - newH) / 2);

    // Idempotency guard: skip if already at target geometry
    const g = win.frameGeometry;
    if (g.x === newX && g.y === newY && g.width === newW && g.height === newH) return;

    win.frameGeometry = Qt.rect(newX, newY, newW, newH);
}

// --- Signal connections per window ---

function connectWindow(win) {
    win.maximizedAboutToChange.connect(function (mode) {
        // AIDEV-NOTE: mode 3 = fully maximized; apply gap after KWin finishes via callLater
        if (mode === 3) {
            Qt.callLater(function () { applyGap(win); });
        }
    });
}

// --- Init: connect existing + new windows ---

workspace.windowList().forEach(connectWindow);
workspace.windowAdded.connect(connectWindow);

// --- React to layout changes ---

function applyAll() {
    workspace.windowList().forEach(function (win) { applyGap(win); });
}

workspace.screensChanged.connect(applyAll);
workspace.virtualScreenGeometryChanged.connect(applyAll);
