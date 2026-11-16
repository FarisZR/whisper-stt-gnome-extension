#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

rm -rf "$ROOT_DIR/coverage"
mkdir -p "$ROOT_DIR/coverage"

gjs --coverage-prefix="file://$ROOT_DIR/src/core" --coverage-output="$ROOT_DIR/coverage" -m tests/run.js
python3 "$ROOT_DIR/scripts/coverage-summary.py" "$ROOT_DIR/coverage/coverage.lcov"
