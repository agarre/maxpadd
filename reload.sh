#!/bin/bash
# Reload a KWin script by toggling it off/on.
# Usage: ./reload.sh [script-id]
# Default: maxpadd

SCRIPT="${1:-maxpadd}"

kwriteconfig6 --file kwinrc --group Plugins --key "${SCRIPT}Enabled" false
qdbus6 org.kde.KWin /KWin reconfigure
sleep 1
kwriteconfig6 --file kwinrc --group Plugins --key "${SCRIPT}Enabled" true
qdbus6 org.kde.KWin /KWin reconfigure

echo "Reloaded: $SCRIPT"
