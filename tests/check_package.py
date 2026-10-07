#!/usr/bin/env python3
"""Check the actual release bundles without needing a running GNOME session."""

import json
from pathlib import Path
import sys
import tarfile
import zipfile

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1])
version = sys.argv[2] if len(sys.argv) > 2 else None
uuid = "whisper-stt@fariszr.com"
required = {"extension.js", "prefs.js", "metadata.json", "stylesheet.css",
            "schemas/gschemas.compiled", "schemas/org.gnome.shell.extensions.whisper-stt.gschema.xml"}
required.update(str(path.relative_to(root)) for path in (root / "src").rglob("*.js"))

with zipfile.ZipFile(output / f"{uuid}.shell-extension.zip") as bundle:
    files = {name: bundle.read(name) for name in bundle.namelist() if not name.endswith("/")}
    assert required <= files.keys(), f"Missing runtime files: {required - files.keys()}"
    assert not any(name.startswith(("tests/", ".git/", "media/", "scripts/")) for name in files)
    metadata = json.loads(files["metadata.json"])
    assert metadata["uuid"] == uuid
    assert metadata["shell-version"] == ["49", "50"]
    if version:
        assert metadata["version-name"] == version
        assert isinstance(metadata["version"], int) and metadata["version"] > 0
    # Both distribution formats must contain exactly the same payload.
    with tarfile.open(output / "whisper-stt-gnome-extension.tar.gz") as archive:
        tar_files = {member.name.removeprefix(f"{uuid}/"): archive.extractfile(member).read()
                     for member in archive.getmembers() if member.isfile()}
    assert tar_files == files, "Homebrew and GNOME bundles differ"
print(f"Validated {len(files)} runtime files in both release bundles")
