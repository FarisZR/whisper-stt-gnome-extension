#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${1:-}" != --session ]]; then
    SMOKE_DIR="$(mktemp -d)"
    trap 'rm -rf "$SMOKE_DIR"' EXIT
    "$ROOT_DIR/scripts/package.sh" "$SMOKE_DIR/bundles"
    export XDG_DATA_HOME="$SMOKE_DIR/data" XDG_CONFIG_HOME="$SMOKE_DIR/config"
    export WAYLAND_DISPLAY="whisper-smoke-$$" GTK_A11Y=none GDK_BACKEND=wayland
    export GI_TYPELIB_PATH="/usr/lib64/gnome-shell/girepository-1.0:${GI_TYPELIB_PATH:-}"
    export LD_LIBRARY_PATH="/usr/lib64/gnome-shell:${LD_LIBRARY_PATH:-}"
    export SMOKE_EXTENSION="$XDG_DATA_HOME/gnome-shell/extensions/whisper-stt@fariszr.com"
    mkdir -p "$SMOKE_EXTENSION" "$XDG_CONFIG_HOME"
    unzip -q "$SMOKE_DIR/bundles/whisper-stt@fariszr.com.shell-extension.zip" -d "$SMOKE_EXTENSION"
    # Eval is enabled only in the throwaway copy and private D-Bus session.
    python3 - "$SMOKE_EXTENSION/extension.js" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
path.write_text(path.read_text().replace('    enable() {',
    '    enable() {\n        global.context.unsafe_mode = true;'))
PY
    dbus-run-session -- "$0" --session
    exit
fi

gsettings set org.gnome.shell enabled-extensions '["whisper-stt@fariszr.com"]'
gnome-shell --headless --wayland --no-x11 --wayland-display="$WAYLAND_DISPLAY" \
    --virtual-monitor 1280x720 > "$XDG_CONFIG_HOME/shell.log" 2>&1 &
SHELL_PID=$!
trap 'kill "$SHELL_PID" 2>/dev/null || true; cat "$XDG_CONFIG_HOME/shell.log"' EXIT
for attempt in {1..40}; do
    if gnome-extensions info whisper-stt@fariszr.com 2>/dev/null | rg -q 'State: ACTIVE'; then
        break
    fi
    sleep 0.5
done
gnome-extensions info whisper-stt@fariszr.com | rg 'State: ACTIVE'
eval_shell() {
    gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
        --method org.gnome.Shell.Eval "$1"
}
eval_shell '(async () => { const Main = await import("resource:///org/gnome/shell/ui/main.js"); const e = Main.extensionManager.lookup("whisper-stt@fariszr.com").stateObj; e._overlay.show(); e._overlay.update(0.8); const count = e._overlay._bars.length; const GLib = (await import("gi://GLib")).default; await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => { resolve(); return GLib.SOURCE_REMOVE; })); if (e._overlay._targetLevel !== 0) throw new Error("stale levels must decay"); e._overlay.hide(); return count; })()' | rg "true, '18'"
gjs -m "$ROOT_DIR/tests/prefs-smoke.js" "$SMOKE_EXTENSION"
gnome-extensions disable whisper-stt@fariszr.com
gnome-extensions info whisper-stt@fariszr.com | rg 'State: INACTIVE'
if rg 'JS ERROR|whisper-stt.*(Error|CRITICAL)' "$XDG_CONFIG_HOME/shell.log"; then
    exit 1
fi
echo 'Shell load, overlay, preferences and disable passed.'
