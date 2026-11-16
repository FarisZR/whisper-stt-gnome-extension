#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT
"$ROOT_DIR/scripts/package.sh" "$BUILD_DIR"
python3 "$ROOT_DIR/tests/check_package.py" "$BUILD_DIR"
gnome-extensions install --force "$BUILD_DIR/whisper-stt@fariszr.com.shell-extension.zip"
echo 'Installed Whisper STT. Log out and back in, then run:'
echo 'gnome-extensions enable whisper-stt@fariszr.com'
