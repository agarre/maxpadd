#!/bin/bash
# Hand Meta+N over to maxpadd's per-screen desktop shortcuts (Desktops tab).
#
# Plasma binds Meta+1..9 to "Activate Task Manager Entry N", and KWin registers a taken
# shortcut as unset — so the panel binding has to go first. On Plasma >= 6.7 KGlobalAccel
# lives inside kwin_wayland: editing kglobalshortcutsrc by hand does nothing, the D-Bus API
# writes the file and applies it immediately.
#
# Usage: ./desktop-shortcuts.sh [--undo] [N...]      default N = 1 2 3 4
#   --undo   give Meta+N back to the task manager and unset the maxpadd slot
#
# Needs busctl (systemd) or gdbus (GLib); qdbus cannot marshal the a(ai) argument.
# Run it AFTER enabling the Desktops tab and ./reload.sh — the maxpadd action must exist.

set -u
UNDO=0; SLOTS=()
for a in "$@"; do
    case "$a" in
        --undo) UNDO=1 ;;
        [1-4]) SLOTS+=("$a") ;;
        *) echo "usage: $0 [--undo] [N...]   (N = 1..4)" >&2; exit 2 ;;
    esac
done
[ ${#SLOTS[@]} -eq 0 ] && SLOTS=(1 2 3 4)

META_BASE=268435504   # Qt6: Qt::META (0x10000000) + '0' (0x30); Meta+N = META_BASE + N

KGA=org.kde.kglobalaccel; KGA_PATH=/kglobalaccel; KGA_IF=org.kde.KGlobalAccel
# shortcutKeys returns an empty list for "registered, no key" AND for "unknown action":
# registration is checked against the component's action list instead.
if command -v busctl >/dev/null 2>&1; then
    kga_get() { busctl --user call $KGA $KGA_PATH $KGA_IF shortcutKeys as 4 "$1" "$2" "$1" "$2" | awk '{print ($2 > 0) ? $4 : 0}'; }
    kga_has() { busctl --user call $KGA $KGA_PATH $KGA_IF allActionsForComponent as 1 "$1" | tr '"' '\n' | grep -qx "$2"; }
    kga_set() { busctl --user call $KGA $KGA_PATH $KGA_IF setForeignShortcutKeys 'asa(ai)' 4 "$1" "$2" "$1" "$2" 1 4 "$3" 0 0 0; }
elif command -v gdbus >/dev/null 2>&1; then
    kga_get() { gdbus call --session --dest $KGA --object-path $KGA_PATH --method $KGA_IF.shortcutKeys "['$1','$2','$1','$2']" | grep -o '\[\[[0-9]*' | grep -o '[0-9]*' | grep . || echo 0; }
    kga_has() { gdbus call --session --dest $KGA --object-path $KGA_PATH --method $KGA_IF.allActionsForComponent "['$1']" | tr "'" '\n' | grep -qx "$2"; }
    kga_set() { gdbus call --session --dest $KGA --object-path $KGA_PATH --method $KGA_IF.setForeignShortcutKeys "['$1','$2','$1','$2']" "[[$3,0,0,0]]" >/dev/null; }
else
    echo "desktop-shortcuts.sh: no D-Bus CLI found (busctl or gdbus)" >&2; exit 1
fi

keyname() { case "$1" in 0) echo "unset" ;; $((META_BASE + $2))) echo "Meta+$2" ;; *) echo "code $1" ;; esac; }

TODO=()
for n in "${SLOTS[@]}"; do
    tm="activate task manager entry $n"; mp="maxpadd-desktop-slot-$n"
    if ! kga_has kwin "$mp"; then
        echo "Meta+$n: maxpadd slot $n is not registered — enable the Desktops tab, run ./reload.sh, then run this again."
        continue
    fi
    tm_now=$(kga_get plasmashell "$tm"); mp_now=$(kga_get kwin "$mp")
    if [ $UNDO -eq 1 ]; then
        echo "Meta+$n: maxpadd slot $n ($(keyname "$mp_now" "$n")) -> unset; \"Activate Task Manager Entry $n\" ($(keyname "$tm_now" "$n")) -> Meta+$n"
    else
        echo "Meta+$n: \"Activate Task Manager Entry $n\" ($(keyname "$tm_now" "$n")) -> unset; maxpadd slot $n ($(keyname "$mp_now" "$n")) -> Meta+$n"
    fi
    TODO+=("$n")
done
[ ${#TODO[@]} -eq 0 ] && exit 0

read -r -p "Proceed? [y/N] " ans
[[ "$ans" =~ ^[yY]$ ]] || { echo "Nothing changed."; exit 0; }

for n in "${TODO[@]}"; do
    if [ $UNDO -eq 1 ]; then
        kga_set kwin "maxpadd-desktop-slot-$n" 0 && kga_set plasmashell "activate task manager entry $n" $((META_BASE + n))
    else
        kga_set plasmashell "activate task manager entry $n" 0 && kga_set kwin "maxpadd-desktop-slot-$n" $((META_BASE + n))
    fi
    echo "Meta+$n: done ($(keyname "$(kga_get kwin "maxpadd-desktop-slot-$n")" "$n") on maxpadd slot $n)"
done
