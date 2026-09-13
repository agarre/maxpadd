#!/bin/bash
# Reload a KWin script by toggling it off/on.
# Usage: ./reload.sh [script-id]
# Default: maxpadd
#
# Distro-agnostic: the Qt DBus CLI is named qdbus6 (Arch/CachyOS), qdbus-qt6 (Fedora)
# or plain qdbus (Debian/Ubuntu/openSUSE). gdbus (GLib) and busctl (systemd) are the
# fallbacks when no Qt CLI is installed.

SCRIPT="${1:-maxpadd}"

reconfigure() {
    if command -v qdbus6 >/dev/null 2>&1; then
        qdbus6 org.kde.KWin /KWin reconfigure
    elif command -v qdbus-qt6 >/dev/null 2>&1; then
        qdbus-qt6 org.kde.KWin /KWin reconfigure
    elif command -v qdbus >/dev/null 2>&1; then
        qdbus org.kde.KWin /KWin reconfigure
    elif command -v gdbus >/dev/null 2>&1; then
        gdbus call --session --dest org.kde.KWin --object-path /KWin --method org.kde.KWin.reconfigure >/dev/null
    elif command -v busctl >/dev/null 2>&1; then
        busctl --user call org.kde.KWin /KWin org.kde.KWin reconfigure
    else
        echo "reload.sh: no DBus CLI found (qdbus6, qdbus-qt6, qdbus, gdbus or busctl)" >&2
        exit 1
    fi
}

kwriteconfig6 --file kwinrc --group Plugins --key "${SCRIPT}Enabled" false
reconfigure
sleep 1
kwriteconfig6 --file kwinrc --group Plugins --key "${SCRIPT}Enabled" true
reconfigure

echo "Reloaded: $SCRIPT"
