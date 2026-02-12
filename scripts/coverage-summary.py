#!/usr/bin/env python3

from __future__ import annotations

import sys
from pathlib import Path


def _percent(hit: int, total: int) -> float:
    return 100.0 if total == 0 else (hit / total) * 100.0


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: coverage-summary.py <coverage.lcov>", file=sys.stderr)
        return 2

    lcov_path = Path(sys.argv[1])
    lines = lcov_path.read_text(encoding="utf-8").splitlines()

    lf = lh = brf = brh = fnf = fnh = 0

    function_names: dict[tuple[str, str], int] = {}
    current_file = ""

    for line in lines:
        if line.startswith("SF:"):
            current_file = line[3:]
        elif line.startswith("LF:"):
            lf += int(line[3:])
        elif line.startswith("LH:"):
            lh += int(line[3:])
        elif line.startswith("BRF:"):
            brf += int(line[4:])
        elif line.startswith("BRH:"):
            brh += int(line[4:])
        elif line.startswith("FNF:"):
            fnf += int(line[4:])
        elif line.startswith("FNH:"):
            fnh += int(line[4:])
        elif line.startswith("FN:"):
            _, payload = line.split(":", 1)
            _, name = payload.split(",", 1)
            function_names[(current_file, name)] = 0
        elif line.startswith("FNDA:"):
            _, payload = line.split(":", 1)
            hits_raw, name = payload.split(",", 1)
            function_names[(current_file, name)] = int(hits_raw)

    non_top_level = {
        key: hits for key, hits in function_names.items() if key[1] != "top-level"
    }

    fnf_adjusted = len(non_top_level)
    fnh_adjusted = sum(1 for hits in non_top_level.values() if hits > 0)

    print("Raw coverage:")
    print(f"  lines:    {lh}/{lf} ({_percent(lh, lf):.2f}%)")
    print(f"  branches: {brh}/{brf} ({_percent(brh, brf):.2f}%)")
    print(f"  funcs:    {fnh}/{fnf} ({_percent(fnh, fnf):.2f}%)")

    print("Adjusted coverage (excluding gjs top-level artifact):")
    print(
        f"  funcs:    {fnh_adjusted}/{fnf_adjusted} ({_percent(fnh_adjusted, fnf_adjusted):.2f}%)"
    )

    if _percent(lh, lf) < 100.0:
        print("Coverage gate failed: lines are below 100%", file=sys.stderr)
        return 1

    if _percent(fnh_adjusted, fnf_adjusted) < 100.0:
        print(
            "Coverage gate failed: adjusted function coverage is below 100%",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
