#!/bin/bash

UUID="whisper-stt@fariszr.com"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing extension to $DEST..."

# Create destination directory
mkdir -p "$DEST"

# Copy files (excluding .git and other dev files if needed, but simple cp -r is usually fine for extensions)
# We exclude .git using rsync if available, otherwise just copy everything
if command -v rsync >/dev/null 2>&1; then
    rsync -av --exclude='.git' --exclude='node_modules' . "$DEST"
else
    cp -r ./* "$DEST"
fi

# Compile schemas
echo "Compiling schemas..."
glib-compile-schemas "$DEST/schemas"

echo "Installation complete!"
echo "Please restart GNOME Shell to enable the extension:"
echo "  - Wayland: Log out and log back in."
echo "  - X11: Press Alt+F2, type 'r', and press Enter."
echo "Then enable the extension with: gnome-extensions enable $UUID"
