#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/dist}"

mkdir -p "$OUT_DIR"

gnome-extensions pack \
    --force \
    --extra-source=src \
    --out-dir="$OUT_DIR" \
    "$ROOT_DIR"
