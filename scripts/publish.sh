#!/usr/bin/env bash
set -euo pipefail
REPOSITORY="${GITHUB_REPOSITORY:-FarisZR/whisper-stt-gnome-extension}"
: "${BUILD_COMMIT:?Full main commit required}"
[[ "$BUILD_COMMIT" =~ ^[0-9a-f]{40}$ ]]
# Do not let a delayed build move the tap back to an older commit.
current=$(gh api "repos/$REPOSITORY/commits/main" --jq .sha)
if [ "$current" != "$BUILD_COMMIT" ]; then
  echo "A newer main commit exists; skipping publication."
  exit 0
fi
cd dist
sha256sum --check SHA256SUMS
tag="build-$BUILD_COMMIT"
if ! gh release view "$tag" --repo "$REPOSITORY" >/dev/null 2>&1; then
  gh release create "$tag" --repo "$REPOSITORY" \
    --target "$BUILD_COMMIT" --draft \
    --title "Rolling build $BUILD_COMMIT" \
    --notes "GNOME Shell 49/50/51 extension built from commit $BUILD_COMMIT."
fi
if [ "$(gh release view "$tag" --repo "$REPOSITORY" --json isDraft --jq .isDraft)" = true ]; then
  gh release upload "$tag" --repo "$REPOSITORY" --clobber ./*.zip ./*.tar.gz SHA256SUMS
fi
gh release view "$tag" --repo "$REPOSITORY" \
  --json assets --jq '[.assets[].name] | sort' > assets.json
python3 -c 'import json; assert json.load(open("assets.json")) == ["SHA256SUMS", "whisper-stt-gnome-extension.tar.gz", "whisper-stt@fariszr.com.shell-extension.zip"]'
gh release edit "$tag" --repo "$REPOSITORY" --draft=false --latest=false
current=$(gh api "repos/$REPOSITORY/commits/main" --jq .sha)
if [ "$current" != "$BUILD_COMMIT" ]; then
  echo "A newer main commit arrived during upload; leaving this release non-latest."
  exit 0
fi
gh release edit "$tag" --repo "$REPOSITORY" --latest
echo 'published=true' >> "$GITHUB_OUTPUT"
