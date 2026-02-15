# AGENTS.md - Whisper STT GNOME Extension

This document provides guidelines for AI agents working on the Whisper STT GNOME Extension.

## 1. Build, Lint, and Test

This is a GNOME Shell Extension written in GJS (JavaScript binding for GNOME). No compilation step required.

### Installation & Deployment
To test changes, the extension must be installed or symlinked to the local extensions directory.
*   **UUID:** `whisper-stt@fariszr.com`
*   **Local Path:** `~/.local/share/gnome-shell/extensions/whisper-stt@fariszr.com/`

**Install/update (helper script):**
```bash
./install.sh
```

**Install/update (manual):**
```bash
mkdir -p ~/.local/share/gnome-shell/extensions/whisper-stt@fariszr.com/
cp -r ./* ~/.local/share/gnome-shell/extensions/whisper-stt@fariszr.com/
```

**Compile schemas after editing `schemas/*.xml`:**
```bash
glib-compile-schemas schemas
```

### Testing
**Run all tests:**
```bash
./scripts/test.sh
```

**Run tests with coverage:**
```bash
./scripts/coverage.sh
```

**Run a single test:**
Temporarily edit `tests/run.js` to import only the desired test file, then run `./scripts/test.sh`. Remember to revert the change.

**Test framework:** Custom harness in `tests/harness.js` provides `test()`, `assert()`, `assertEqual()`, `assertDeepEqual()`, `assertIncludes()`, `assertRejects()`. Tests are async functions passed to `test()`.

**Manual extension testing:**
1.  Install the extension
2.  Reload GNOME Shell (Wayland: logout/login or `dbus-run-session -- gnome-shell --nested --wayland`; X11: `Alt+F2`, type `r`, press Enter)
3.  Enable: `gnome-extensions enable whisper-stt@fariszr.com`

### Logging & Debugging
Use `console.log()` or `log()` for output. View logs:
```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep -i "whisper-stt"
```

### Linting
No strict linter configured. Follow standard ESLint rules for GJS if adding one. Avoid syntax errors as they crash the extension.

## 2. Code Style & Conventions

### Environment
*   **Runtime:** GJS (SpiderMonkey-based)
*   **Modules:** ES Modules (`import`/`export`)
*   **GNOME Imports:** Use `gi://` for introspection, `resource:///` for shell resources
    ```javascript
    import GObject from 'gi://GObject';
    import St from 'gi://St';
    import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
    ```

### Async Patterns
*   Use `async/await` for all asynchronous operations
*   Promisify Gio methods: `Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async')`
*   Helper for sleep: Use GLib.timeout_add with Promise wrapper
*   Always handle async errors in `try/catch`

### Dependency Injection
The codebase uses a dependency injection pattern. Pass dependencies as a `deps` object to constructors, not import globals.
```javascript
constructor(deps) {
    this._deps = deps;
    this._settings = deps.settings;
}
```

### Class Structure
*   Use plain ES classes (not `GObject.registerClass` - this codebase doesn't use it)
*   Export classes using `export class ClassName { ... }`
*   Extension entry point: default export class extending `Extension`

### Extension Lifecycle
Main `extension.js` must export a class extending `Extension`:
```javascript
export default class WhisperSttExtension extends Extension {
    enable() {
        this._settings = this.getSettings(SETTINGS_SCHEMA);
        this._overlay = new VoiceOverlay();
        // Initialize resources
    }
    disable() {
        this._overlay?.destroy();
        this._overlay = null;
        this._controller = null;
        this._settings = null;
    }
}
```

### Preferences UI
`prefs.js` uses `Adw` (libadwaita) widgets:
*   Use `ExtensionPreferences` base class, implement `fillPreferencesWindow(window)`
*   Use `Adw.EntryRow`, `Adw.PreferencesPage`, `Adw.PreferencesGroup`
*   Bind to settings via `settings.get_string(key)` / `settings.set_string(key, value)`
*   Listen for changes: `settings.connect('changed::key', ...)`

### Settings & GSettings
*   Schema defined in `schemas/org.gnome.shell.extensions.whisper-stt.gschema.xml`
*   Access via `this.getSettings(schemaId)` in extension
*   Normalize settings in `src/core/settings.js` using `normalizeSettings()` function
*   Always trim string values from settings
*   Provide defaults via `SETTINGS_DEFAULTS` constant

### Naming & Formatting
*   **Files:** `camelCase.js` for core logic, descriptive names in `src/`
*   **Classes:** `PascalCase`
*   **Variables/Functions:** `camelCase`
*   **Private Members:** Prefix with `_` (e.g., `this._indicator`)
*   **Constants:** `UPPER_SNAKE_CASE`
*   **Helper Functions:** Prefix with `_` (internal to module)
*   **Quotes:** Single quotes `'` for strings
*   **Indentation:** 4 spaces
*   **Semicolons:** Required

### Error Handling
*   Wrap I/O and external command calls in `try...catch`
*   Log errors with `console.error()` or `printerr()`
*   In tests, use `assertRejects()` for expected rejections
*   Make `disable()` method robust - don't throw if init failed
*   Gracefully handle process cancellation and cleanup

### Process Management
*   Use `Gio.Subprocess.new()` for spawning commands
*   Use `spawnLineProcess()` or `spawnByteProcess()` from `src/gnome/process.js` for long-running processes
*   Stop processes via the returned `stop()` async method
*   Use `cancellable` objects for process cancellation
*   Drain pipes with `_drainPipe()` / `_drainBytes()` helpers

### UI Construction
*   Use `St` (Shell Toolkit) for widgets: `St.Icon`, `St.Label`, `St.BoxLayout`
*   Use `Clutter` for layout (implicitly via `St`)
*   Add to panel: `Main.panel.addToStatusArea(uuid, indicator)`
*   For overlays, add to `Main.layoutManager.uiGroup` and show/hide with opacity/visibility
*   Use `monitorConstraint` for positioning

## 3. Tool Usage Rules for Agents

*   **Check `metadata.json`:** Verify `shell-version` compatibility when making changes
*   **Safe Edits:** When modifying `enable()`/`disable()`, ensure proper cleanup to avoid memory leaks
*   **No `npm`:** Don't assume npm/node modules exist. Use GJS built-ins and GNOME APIs
*   **Schema Changes:** After editing `schemas/*.xml`, run `glib-compile-schemas schemas`
*   **Test First:** Write or update tests in `tests/` directory before implementing features
*   **Dependency Injection:** Follow existing patterns - inject dependencies via `deps` object, not direct imports of shell resources in core logic files
