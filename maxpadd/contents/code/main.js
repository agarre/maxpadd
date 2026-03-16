/* maxpadd — KWin Script for Plasma 6 | (C) 2026 Hugo Breda | GPL-3.0 */
var defaultIgnored = ["plasmashell", "krunner", "spectacle", "org.kde.spectacle",
    "polkit-kde-authentication-agent-1", "kscreen_osd_service",
    "ksplashqml", "ksmserver", "xdg-desktop-portal-kde"];
var winState = {}, busy = {};
var compensateDockMode = readConfig("compensateDockMode", readConfig("compensateDock", false) ? 1 : 0);
var gapSize = Math.max(0, readConfig("gapSize", 15));
var dockMargin = Math.min(20, Math.max(10, readConfig("dockMargin", 12)));
// AIDEV-NOTE tolerance for fractional scaling (frameGeometry returns floats)
function near(a, b) { return Math.abs(a - b) < 2; }
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
function getGapSize() { return gapSize; }
// AIDEV-NOTE returns per-side gaps; adds dockMargin on panel sides when compensateDockMode >= 1
function getGaps(win) {
    var g = getGapSize();
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
function applyGap(win) {
    if (!win || !win.normalWindow || win.fullScreen) return;
    if (win.move || win.resize) return;
    if (isIgnored(win)) return;
    var wid = String(win.internalId);
    if (busy[wid]) return;
    var gaps = getGaps(win);
    if (gaps.t <= 0 && gaps.b <= 0 && gaps.l <= 0 && gaps.r <= 0) return;
    var area = workspace.clientArea(KWin.MaximizeArea, win);
    var g = win.frameGeometry;
    if (!near(g.width, area.width) || !near(g.height, area.height)) return;
    busy[wid] = true;
    var st = winState[wid];
    // AIDEV-NOTE toggle: 2nd maximize from gapped state restores original size
    if (st && st.gapped) {
        win.setMaximize(false, false);
        if (st.geo) win.frameGeometry = st.geo;
        winState[wid] = {gapped: false, geo: st.geo};
        busy[wid] = false;
        return;
    }
    win.setMaximize(false, false);
    win.frameGeometry = {
        x: area.x + gaps.l, y: area.y + gaps.t,
        width: area.width - gaps.l - gaps.r, height: area.height - gaps.t - gaps.b
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
    if (near(g.width, area.width) && near(g.height, area.height)) return;
    // AIDEV-NOTE skip stale gapped geometry from previous script instance
    var mL = g.x - area.x, mR = (area.x + area.width) - (g.x + g.width);
    var mT = g.y - area.y, mB = (area.y + area.height) - (g.y + g.height);
    var gaps = getGaps(win);
    if (mL > 0 && near(mL, gaps.l) && near(mR, gaps.r) && near(mT, gaps.t) && near(mB, gaps.b)) return;
    winState[wid] = {gapped: false, geo: {x: g.x, y: g.y, width: g.width, height: g.height}};
}
// AIDEV-NOTE compensateDockEdge: one-way nudge for mode 2, no saveGeo participation
function compensateDockEdge(win) {
    if (compensateDockMode !== 2) return;
    if (!win || !win.normalWindow || win.fullScreen) return;
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
    var threshold = dockMargin + getGapSize();
    var nX = g.x, nY = g.y, nW = g.width, nH = g.height, adj = false;
    if (area.y > s.y && (g.y - area.y) < threshold)
        { nY = area.y + threshold; nH = (g.y + g.height) - nY; adj = true; }
    if ((s.y + s.height) > (area.y + area.height) && ((area.y + area.height) - (nY + nH)) < threshold)
        { nH = (area.y + area.height - threshold) - nY; adj = true; }
    if (area.x > s.x && (g.x - area.x) < threshold)
        { nX = area.x + threshold; nW = (g.x + g.width) - nX; adj = true; }
    if ((s.x + s.width) > (area.x + area.width) && ((area.x + area.width) - (nX + nW)) < threshold)
        { nW = (area.x + area.width - threshold) - nX; adj = true; }
    if (!adj) return; if (nW < 50) nW = 50; if (nH < 50) nH = 50;
    busy[wid] = true;
    win.frameGeometry = {x: nX, y: nY, width: nW, height: nH};
    busy[wid] = false;
}
function connectWindow(win) {
    saveGeo(win); compensateDockEdge(win); applyGap(win);
    win.frameGeometryChanged.connect(function () {
        saveGeo(win); compensateDockEdge(win); applyGap(win);
    });
    win.fullScreenChanged.connect(function () { applyGap(win); });
}
workspace.windowList().forEach(connectWindow); workspace.windowAdded.connect(connectWindow);
function applyAll() { workspace.windowList().forEach(function (win) { compensateDockEdge(win); applyGap(win); }); }
workspace.screensChanged.connect(applyAll); workspace.virtualScreenSizeChanged.connect(applyAll); workspace.virtualScreenGeometryChanged.connect(applyAll);
