# AGENTS.md - Whisper STT GNOME Extension

This document provides guidelines for AI agents working on the Whisper STT GNOME Extension.

## 1. Build, Lint, and Test

Since this is a GNOME Shell Extension written in GJS (JavaScript binding for GNOME), there is no compilation step.

### Installation & Deployment
To test changes, the extension must be installed or symlinked to the local extensions directory.
*   **UUID:** `whisper-stt@fariszr.com`
*   **Local Path:** `~/.local/share/gnome-shell/extensions/whisper-stt@fariszr.com/`

**Command to install/update (manual):**
```bash
# Ensure directory exists
mkdir -p ~/.local/share/gnome-shell/extensions/whisper-stt@fariszr.com/

# Copy files
cp -r ./* ~/.local/share/gnome-shell/extensions/whisper-stt@fariszr.com/
```

### Testing
Automated unit testing is difficult for GNOME Shell extensions due to dependencies on the running shell environment.
*   **Manual Testing:**
    1.  Install the extension (see above).
    2.  Reload GNOME Shell:
        *   **Wayland:** Logout and login, or run a nested shell: `dbus-run-session -- gnome-shell --nested --wayland`
        *   **X11:** Press `Alt+F2`, type `r`, and hit Enter.
    3.  Enable the extension: `gnome-extensions enable whisper-stt@fariszr.com`

### Logging & Debugging
*   **Logs:** Use `console.log()` or `log()`.
*   **View Logs:**
    ```bash
    # Watch live logs for the extension
    journalctl -f -o cat /usr/bin/gnome-shell | grep -i "whisper-stt"
    ```

### Linting
*   Currently, no strict linter is configured.
*   Follow standard ESLint rules for GJS if setting one up.
*   Avoid syntax errors as they will crash the extension or prevent it from loading.

## 2. Code Style & Conventions

### Environment
*   **Runtime:** GJS (SpiderMonkey based).
*   **Modules:** ES Modules (`import`/`export`) are used.
*   **GNOME Imports:** Use `gi://` for introspection and `resource:///` for shell resources.
    ```javascript
    import GObject from 'gi://GObject';
    import St from 'gi://St';
    import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
    ```

### Class Structure (GObject)
*   Use `GObject.registerClass` for UI elements or classes that need to emit signals.
*   Extend standard GNOME classes (e.g., `PanelMenu.Button`).
*   **Constructor:** Use `_init()` method calling `super._init()`.
    ```javascript
    const MyClass = GObject.registerClass(
    class MyClass extends PanelMenu.Button {
        _init() {
            super._init(0.0, 'Name');
            // ...
        }
    });
    ```

### Extension Lifecycle
*   The main entry point must default export a class extending `Extension`.
*   Implement `enable()`: Initialize resources, creating UI elements.
*   Implement `disable()`: Destroy resources, remove UI elements, clear references to avoid memory leaks.
    ```javascript
    export default class MyExtension extends Extension {
        enable() {
            this._indicator = new Indicator();
            Main.panel.addToStatusArea(this.uuid, this._indicator);
        }
        disable() {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
    ```

### Naming & Formatting
*   **Files:** `camelCase.js` or `kebab-case.js` (Project uses `extension.js`).
*   **Classes:** `PascalCase`.
*   **Variables/Functions:** `camelCase`.
*   **Private Members:** Prefix with `_` (e.g., `this._indicator`).
*   **Quotes:** Use single quotes `'` for JavaScript strings.
*   **Indentation:** 4 spaces (observed in `extension.js`).
*   **Semicolons:** Always use semicolons.

### Error Handling
*   Use `try...catch` blocks, especially for operations involving I/O or external commands.
*   Log errors clearly using `console.error()`.
*   Ensure the `disable()` method is robust and doesn't throw errors if initialization failed.

### UI Construction
*   Use `St` (Shell Toolkit) for widgets (e.g., `St.Icon`, `St.Label`, `St.BoxLayout`).
*   Layouts often use `Clutter` implicitly via `St` widgets.
*   Add to `Main.panel` using `addToStatusArea`.

### Metadata
*   `metadata.json` must be valid JSON.
*   Ensure `shell-version` includes the target GNOME version.

## 3. Tool Usage Rules for Agents
*   **Check `metadata.json`:** Verify `shell-version` compatibility when upgrading.
*   **Safe Edits:** When modifying `enable()`/`disable()`, ensure explicit cleanup.
*   **No `npm`:** Do not assume `npm` or `node` modules are available unless explicitly added to a build process (none currently). Use GJS built-ins.
