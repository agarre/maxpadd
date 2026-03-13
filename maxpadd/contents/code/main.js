/*
 * maxpadd — KWin Script for Plasma 6
 * (C) 2026 Hugo Breda Schneweiss <hbreda@gmail.com>
 * License: GPL-3.0
 *
 * Adds configurable padding (in pixels) around maximized windows.
 */

var defaultIgnored = ["plasmashell", "krunner", "spectacle", "org.kde.spectacle",
    "polkit-kde-authentication-agent-1", "kscreen_osd_service",
    "ksplashqml", "ksmserver", "xdg-desktop-portal-kde"];
var winState = {}; // { internalId: { gapped: bool, geo: {x,y,width,height} } }
var busy = {};

function getGapSize() {
    return Math.max(0, readConfig("gapSize", 15));
}

function getIgnoredApps() {
    var userIgnored = readConfig("ignoredApps", "").toString().split(",")
        .map(function (s) { return s.trim().toLowerCase(); })
        .filter(function (s) { return s.length > 0; });
    return defaultIgnored.concat(userIgnored);
}

function isIgnored(win) {
    var ignored = getIgnoredApps();
    var cls = String(win.resourceClass).toLowerCase();
    var name = String(win.resourceName).toLowerCase();
    return ignored.indexOf(cls) >= 0 || ignored.indexOf(name) >= 0;
}

function applyGap(win) {
    if (!win || !win.normalWindow || win.fullScreen) return;
    if (win.move || win.resize) return;
    if (isIgnored(win)) return;
    var wid = String(win.internalId);
    if (busy[wid]) return;

    var gap = getGapSize();
    if (gap <= 0) return;

    var area = workspace.clientArea(KWin.MaximizeArea, win);
    var g = win.frameGeometry;
    if (g.width !== area.width || g.height !== area.height) return;

    busy[wid] = true;
    var st = winState[wid];

    // AIDEV-NOTE toggle: 2nd maximize from gapped state restores original size
    if (st && st.gapped) {
        win.setMaximize(false, false);
        if (st.geo) {
            win.frameGeometry = st.geo;
        }
        winState[wid] = {gapped: false, geo: st.geo};
        busy[wid] = false;
        return;
    }

    win.setMaximize(false, false);
    win.frameGeometry = {
        x: area.x + gap, y: area.y + gap,
        width: area.width - (gap * 2), height: area.height - (gap * 2)
    };
    winState[wid] = {gapped: true, geo: st ? st.geo : null};
    busy[wid] = false;
}

function saveGeo(win) {
    var wid = String(win.internalId);
    if (busy[wid]) return;
    var st = winState[wid];
    if (st && st.gapped) return;
    var area = workspace.clientArea(KWin.MaximizeArea, win);
    var g = win.frameGeometry;
    if (g.width === area.width && g.height === area.height) return;
    // AIDEV-NOTE skip stale gapped geometry from previous script instance
    var mL = g.x - area.x;
    var mR = (area.x + area.width) - (g.x + g.width);
    var mT = g.y - area.y;
    var mB = (area.y + area.height) - (g.y + g.height);
    if (mL > 0 && mL === mR && mL === mT && mL === mB) return;
    winState[wid] = {gapped: false, geo: {x: g.x, y: g.y, width: g.width, height: g.height}};
}

function connectWindow(win) {
    saveGeo(win);
    applyGap(win);
    win.frameGeometryChanged.connect(function () { saveGeo(win); applyGap(win); });
    win.fullScreenChanged.connect(function () { applyGap(win); });
}

workspace.windowList().forEach(connectWindow);
workspace.windowAdded.connect(connectWindow);

function applyAll() {
    workspace.windowList().forEach(function (win) { applyGap(win); });
}

workspace.screensChanged.connect(applyAll);
workspace.virtualScreenSizeChanged.connect(applyAll);
workspace.virtualScreenGeometryChanged.connect(applyAll);
