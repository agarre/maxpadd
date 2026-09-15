/* maxpadd — KWin Script for Plasma 6 | (C) 2026 Hugo Breda | GPL-3.0 */
var defaultIgnored = ["plasmashell", "krunner", "spectacle", "org.kde.spectacle",
    "polkit-kde-authentication-agent-1", "kscreen_osd_service",
    "ksplashqml", "ksmserver", "xdg-desktop-portal-kde"];
var busy = {};
var reqMode = {};   // requested maximize mode per window (maximizedAboutToChange), leads maximizeMode
var armedAt = 0;    // last time a non-normal window (panel/dock) changed geometry → KWin rearrange follows
var compensateDockMode = readConfig("compensateDockMode", readConfig("compensateDock", false) ? 1 : 0);
var gapSize = Math.max(0, readConfig("gapSize", 15));
var dockMargin = Math.min(20, Math.max(10, readConfig("dockMargin", 12)));
// AIDEV-NOTE tolerance for fractional scaling (frameGeometry returns floats); optional e widens it (spec 03)
function near(a, b, e) { return Math.abs(a - b) < (e || 2); }
function same(g, t) { return near(g.x, t.x) && near(g.y, t.y) && near(g.width, t.width) && near(g.height, t.height); }
var ignoredApps = (function () {
    var ui = readConfig("ignoredApps", "").toString().split(",")
        .map(function (s) { return s.trim().toLowerCase(); })
        .filter(function (s) { return s.length > 0; });
    return defaultIgnored.concat(ui);
})();
function isIgnored(win) {
    var cls = String(win.resourceClass).toLowerCase();
    var name = String(win.resourceName).toLowerCase();
    return ignoredApps.indexOf(cls) >= 0 || ignoredApps.indexOf(name) >= 0;
}
// AIDEV-NOTE returns per-side gaps; adds dockMargin on panel sides when compensateDockMode >= 1
function getGaps(win) {
    var g = gapSize;
    if (compensateDockMode < 1) return {t: g, b: g, l: g, r: g};
    var dm = g > 0 ? dockMargin : 0;
    var s = workspace.clientArea(KWin.ScreenArea, win);
    var m = workspace.clientArea(KWin.MaximizeArea, win);
    return {
        t: g + (m.y > s.y ? dm : 0),
        b: g + ((m.y + m.height) < (s.y + s.height) ? dm : 0),
        l: g + (m.x > s.x ? dm : 0),
        r: g + ((m.x + m.width) < (s.x + s.width) ? dm : 0)
    };
}
// gapped target for a maximized window, or null when all gaps are zero
function gapTarget(win) {
    var gaps = getGaps(win);
    if (gaps.t <= 0 && gaps.b <= 0 && gaps.l <= 0 && gaps.r <= 0) return null;
    var a = workspace.clientArea(KWin.MaximizeArea, win);
    return {x: a.x + gaps.l, y: a.y + gaps.t, width: a.width - gaps.l - gaps.r, height: a.height - gaps.t - gaps.b};
}
function eligible(win) {
    if (!win || !win.normalWindow || win.fullScreen || win.maximizeMode !== 3) return false;
    if (win.move || win.resize || isIgnored(win)) return false;
    return !busy[String(win.internalId)];
}
// AIDEV-NOTE maxpadd/gap-v2 — resize maximized window IN PLACE; never setMaximize(false): the window stays
// genuinely maximized, apps keep consistent state and restore is KWin-native (spec 05, requires KWin >= 6.7)
function applyGap(win) {
    if (!eligible(win)) return;
    var gg = gapTarget(win);
    if (!gg) return;
    var g = win.frameGeometry;
    // AIDEV-NOTE maxpadd/idempotent — no write when already at target: kills loops + CSD event floods (spec 05 FR-003)
    if (same(g, gg)) return;
    // AIDEV-NOTE maxpadd/restore-race — maximizeMode lags frameGeometryChanged on unmaximize (like fullScreen race):
    // only gap a window actually sitting at MaximizeArea; geometry elsewhere + mode=3 = restore in flight, don't touch
    if (!same(g, workspace.clientArea(KWin.MaximizeArea, win))) return;
    var wid = String(win.internalId);
    busy[wid] = true;
    win.frameGeometry = gg;
    busy[wid] = false;
}
// AIDEV-NOTE maxpadd/preempt — any panel/strut geometry change ("fit content" panel grows on a new task) makes KWin
// Workspace::rearrange() re-snap EVERY maximized window to MaximizeArea, synchronously after the panel's
// frameGeometryChanged. The xdg configure goes out from a 0 ms timer and reads moveResizeGeometry at send time;
// frameGeometryAboutToChange fires inside moveResize() before it. Re-writing the gap there overwrites
// moveResizeGeometry, so the app's single configure already carries the gap: no full-area frame, no flash.
// Guards: ≤10 ms after a non-normal window moved (rearrange measured 0-1 ms), window currently AT the gapped
// geometry, no restore in flight (reqMode leads maximizeMode). Residual: fullscreen request inside that 10 ms.
function preempt(win) {
    if (Date.now() - armedAt > 10 || !eligible(win)) return;
    var wid = String(win.internalId);
    if (reqMode[wid] !== undefined && reqMode[wid] !== 3) return;
    var gg = gapTarget(win);
    if (!gg || !same(win.frameGeometry, gg)) return;
    busy[wid] = true;
    win.frameGeometry = gg;
    busy[wid] = false;
}
// AIDEV-NOTE compensateDockEdge: one-way nudge for mode 2, non-maximized windows only (maximized = applyGap's job)
function compensateDockEdge(win) {
    if (compensateDockMode !== 2) return;
    if (!win || !win.normalWindow || win.fullScreen) return;
    if (win.maximizeMode === 3) return;
    if (win.move || win.resize) return;
    if (isIgnored(win)) return;
    var wid = String(win.internalId);
    if (busy[wid]) return;
    var area = workspace.clientArea(KWin.MaximizeArea, win);
    var g = win.frameGeometry;
    if (near(g.width, area.width) && near(g.height, area.height)) return;
    var s = workspace.clientArea(KWin.ScreenArea, win);
    // AIDEV-NOTE fullscreen race: fullScreen flag lags behind frameGeometryChanged; detect by size
    if (near(g.width, s.width) && near(g.height, s.height)) return;
    var threshold = dockMargin + gapSize;
    var nX = g.x, nY = g.y, nW = g.width, nH = g.height, adj = false;
    // AIDEV-NOTE maxpadd/nudge-tolerance — !near(dist, threshold) stops sub-pixel re-nudges at boundary (spec 03 FR-003)
    if (area.y > s.y && (g.y - area.y) < threshold && !near(g.y - area.y, threshold))
        { nY = area.y + threshold; nH = (g.y + g.height) - nY; adj = true; }
    if ((s.y + s.height) > (area.y + area.height) && ((area.y + area.height) - (nY + nH)) < threshold && !near((area.y + area.height) - (nY + nH), threshold))
        { nH = (area.y + area.height - threshold) - nY; adj = true; }
    if (area.x > s.x && (g.x - area.x) < threshold && !near(g.x - area.x, threshold))
        { nX = area.x + threshold; nW = (g.x + g.width) - nX; adj = true; }
    if ((s.x + s.width) > (area.x + area.width) && ((area.x + area.width) - (nX + nW)) < threshold && !near((area.x + area.width) - (nX + nW), threshold))
        { nW = (area.x + area.width - threshold) - nX; adj = true; }
    if (!adj) return; if (nW < 50) nW = 50; if (nH < 50) nH = 50;
    busy[wid] = true;
    win.frameGeometry = {x: nX, y: nY, width: nW, height: nH};
    busy[wid] = false;
}
function connectWindow(win) {
    var wid = String(win.internalId);
    compensateDockEdge(win); applyGap(win);
    win.frameGeometryChanged.connect(function () {
        if (!win.normalWindow) { armedAt = Date.now(); return; }   // panel/dock moved → rearrange snap incoming
        compensateDockEdge(win); applyGap(win);
    });
    win.frameGeometryAboutToChange.connect(function () { preempt(win); });
    win.maximizedAboutToChange.connect(function (mode) { reqMode[wid] = mode; });
    win.maximizedChanged.connect(function () { compensateDockEdge(win); applyGap(win); });
    win.fullScreenChanged.connect(function () { applyGap(win); });
}
workspace.windowList().forEach(connectWindow); workspace.windowAdded.connect(connectWindow);
// AIDEV-NOTE maxpadd/state-cleanup — busy + reqMode only, both cleared on windowRemoved; no geometry cache (spec 05 FR-008)
workspace.windowRemoved.connect(function (win) { var wid = String(win.internalId); delete busy[wid]; delete reqMode[wid]; });
function applyAll() { workspace.windowList().forEach(function (win) { compensateDockEdge(win); applyGap(win); }); }
workspace.screensChanged.connect(applyAll); workspace.virtualScreenSizeChanged.connect(applyAll); workspace.virtualScreenGeometryChanged.connect(applyAll);
// AIDEV-NOTE maxpadd/desktop-switch — Hyprland "workspace N, monitor:X" on KWin: cycle ONE output's desktop,
// mouse-independent (spec 06). Needs kwinrc [Windows] PerOutputVirtualDesktops=true (KWin >= 6.7); when off KWin
// switches every output. Screen N = Nth output left-to-right, then top-to-bottom: workspace.screens raw order is
// NOT the Display Configuration order. API order is (desktop, output); reversed fails "Could not convert argument 0".
function cycleDesktopOnScreen(n) {
    var out = workspace.screens.slice().sort(function (a, b) { return (a.geometry.x - b.geometry.x) || (a.geometry.y - b.geometry.y); })[n - 1];
    if (!out) return;
    var desks = workspace.desktops, cur = workspace.currentDesktopForScreen(out), i = 0;
    for (var k = 0; k < desks.length; k++) if (desks[k].id === cur.id) i = k;   // compare by id, not object identity
    workspace.setCurrentDesktopForScreen(desks[(i + 1) % desks.length], out);
}
if (readConfig("desktopSwitchEnabled", false) && typeof workspace.setCurrentDesktopForScreen === "function") {
    for (var slot = 1; slot <= 4; slot++) (function (n) {
        var s = readConfig("desktopSlot" + n, n);
        if (s > 0) registerShortcut("maxpadd-desktop-slot-" + n, "maxpadd: next virtual desktop on screen " + s,
            "Meta+" + n, function () { cycleDesktopOnScreen(s); });
    })(slot);
}
