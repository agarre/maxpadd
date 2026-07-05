/* maxpadd — KWin Script for Plasma 6 | (C) 2026 Hugo Breda | GPL-3.0 */
var defaultIgnored = ["plasmashell", "krunner", "spectacle", "org.kde.spectacle",
    "polkit-kde-authentication-agent-1", "kscreen_osd_service",
    "ksplashqml", "ksmserver", "xdg-desktop-portal-kde"];
var winState = {}, busy = {};
var compensateDockMode = readConfig("compensateDockMode", readConfig("compensateDock", false) ? 1 : 0);
var gapSize = Math.max(0, readConfig("gapSize", 15));
var dockMargin = Math.min(20, Math.max(10, readConfig("dockMargin", 12)));
// AIDEV-NOTE tolerance for fractional scaling (frameGeometry returns floats); optional e widens it (spec 03)
function near(a, b, e) { return Math.abs(a - b) < (e || 2); }
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
    // AIDEV-NOTE maxpadd/csd-detect — maximizeMode===3 catches CSD apps whose geometry has insets (spec 02 FR-001)
    if (win.maximizeMode !== 3 && (!near(g.width, area.width) || !near(g.height, area.height))) return;
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
    // AIDEV-NOTE maxpadd/gapped-geo — gappedGeo tracked for FR-003 re-fit + FR-004 stale-flag reset (spec 02)
    var gg = {
        x: area.x + gaps.l, y: area.y + gaps.t,
        width: area.width - gaps.l - gaps.r, height: area.height - gaps.t - gaps.b
    };
    win.frameGeometry = gg;
    winState[wid] = {gapped: true, geo: st ? st.geo : null, gappedGeo: gg};
    busy[wid] = false;
}
function saveGeo(win) {
    var wid = String(win.internalId);
    if (busy[wid]) return;
    // AIDEV-NOTE maxpadd/csd-detect — never capture maximized geometry as restore target (spec 02 FR-002)
    if (win.maximizeMode === 3) return;
    var st = winState[wid];
    if (st && st.gapped) {
        // AIDEV-NOTE maxpadd/stale-flag — user move/resize away from gapped geometry clears the flag (spec 02 FR-004)
        var cg = win.frameGeometry, gg = st.gappedGeo;
        if ((win.move || win.resize) && gg && (!near(cg.x, gg.x) || !near(cg.y, gg.y) ||
            !near(cg.width, gg.width) || !near(cg.height, gg.height)))
            winState[wid] = {gapped: false, geo: {x: cg.x, y: cg.y, width: cg.width, height: cg.height}};
        return;
    }
    var area = workspace.clientArea(KWin.MaximizeArea, win);
    var g = win.frameGeometry;
    if (near(g.width, area.width) && near(g.height, area.height)) return;
    // AIDEV-NOTE skip stale gapped geometry from previous script instance; epsilon 6 tolerates CSD settle (spec 03 FR-001)
    var mL = g.x - area.x, mR = (area.x + area.width) - (g.x + g.width);
    var mT = g.y - area.y, mB = (area.y + area.height) - (g.y + g.height);
    var gaps = getGaps(win);
    if (mL > 0 && near(mL, gaps.l, 6) && near(mR, gaps.r, 6) && near(mT, gaps.t, 6) && near(mB, gaps.b, 6)) return;
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
    saveGeo(win); compensateDockEdge(win); applyGap(win);
    win.frameGeometryChanged.connect(function () {
        saveGeo(win); compensateDockEdge(win); applyGap(win);
    });
    win.fullScreenChanged.connect(function () { applyGap(win); });
    // AIDEV-NOTE maxpadd/csd-detect — no saveGeo here: at signal time geometry is already maximized (FR-002)
    win.maximizedChanged.connect(function () { compensateDockEdge(win); applyGap(win); });
}
workspace.windowList().forEach(connectWindow); workspace.windowAdded.connect(connectWindow);
// AIDEV-NOTE maxpadd/state-cleanup — discard per-window state on close, keeps session-long memory bounded (spec 03 FR-002)
workspace.windowRemoved.connect(function (win) {
    var wid = String(win.internalId); delete winState[wid]; delete busy[wid];
});
// AIDEV-NOTE maxpadd/refit — re-fit gapped windows after screen layout changes (spec 02 FR-003)
function refitGapped(win) {
    var wid = String(win.internalId), st = winState[wid];
    if (!st || !st.gapped || busy[wid] || !win.normalWindow || win.fullScreen || isIgnored(win)) return;
    var area = workspace.clientArea(KWin.MaximizeArea, win), gaps = getGaps(win);
    busy[wid] = true;
    st.gappedGeo = {x: area.x + gaps.l, y: area.y + gaps.t,
        width: area.width - gaps.l - gaps.r, height: area.height - gaps.t - gaps.b};
    win.frameGeometry = st.gappedGeo;
    busy[wid] = false;
}
function applyAll() { workspace.windowList().forEach(function (win) { refitGapped(win); compensateDockEdge(win); applyGap(win); }); }
workspace.screensChanged.connect(applyAll); workspace.virtualScreenSizeChanged.connect(applyAll); workspace.virtualScreenGeometryChanged.connect(applyAll);
