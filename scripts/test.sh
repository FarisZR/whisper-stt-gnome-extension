#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
gjs -m tests/run.js
python3 -m unittest discover -s tests -p '*_test.py'
