#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/dist}"
COMMIT="${2:-$(git -C "$ROOT_DIR" rev-parse HEAD)}"
BUILD_NUMBER="$(git -C "$ROOT_DIR" rev-list --count "$COMMIT")"

mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
STAGING_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGING_DIR"' EXIT

cp "$ROOT_DIR"/{extension.js,prefs.js,metadata.json,stylesheet.css,LICENSE} "$STAGING_DIR/"
cp -r "$ROOT_DIR"/{src,schemas} "$STAGING_DIR/"
python3 - "$STAGING_DIR/metadata.json" "$COMMIT" "$BUILD_NUMBER" <<'PY'
import json
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
commit = sys.argv[2]
if not re.fullmatch(r"[0-9a-f]{40}", commit):
    raise SystemExit("Build version must be a full Git commit hash")
metadata = json.loads(path.read_text())
metadata["version-name"] = commit
metadata["version"] = int(sys.argv[3])
path.write_text(json.dumps(metadata, indent=2) + "\n")
PY
glib-compile-schemas --strict "$STAGING_DIR/schemas"

gnome-extensions pack \
    --force \
    --extra-source=src \
    --extra-source=LICENSE \
    --out-dir="$OUT_DIR" \
    "$STAGING_DIR"

# Homebrew needs a named directory artifact; keep its payload identical to the
# GNOME installable ZIP, including compiled schemas and the src module tree.
python3 - "$OUT_DIR" "$STAGING_DIR" <<'PY'
from pathlib import Path
import sys
import tarfile
import tempfile
import zipfile

output = Path(sys.argv[1])
uuid = "whisper-stt@fariszr.com"
# GNOME's pack command includes schema XML but omits the compiled schema cache.
# Include it explicitly so Homebrew can install without a schema compiler.
with zipfile.ZipFile(output / f"{uuid}.shell-extension.zip", "a", zipfile.ZIP_DEFLATED) as bundle:
    bundle.write(Path(sys.argv[2]) / "schemas/gschemas.compiled", "schemas/gschemas.compiled")
with tempfile.TemporaryDirectory() as temp:
    extension = Path(temp) / uuid
    with zipfile.ZipFile(output / f"{uuid}.shell-extension.zip") as bundle:
        bundle.extractall(extension)
    with tarfile.open(output / "whisper-stt-gnome-extension.tar.gz", "w:gz") as archive:
        archive.add(extension, arcname=uuid)
PY
