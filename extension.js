import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {WhisperController} from './src/core/whisperController.js';
import {VoiceOverlay} from './src/gnome/overlay.js';
import {createRuntimeDeps} from './src/gnome/runtimeDeps.js';

const KEYBINDING_NAME = 'toggle-recording-shortcut';

export default class WhisperSttExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._overlay = new VoiceOverlay();
        this._controller = new WhisperController(createRuntimeDeps({
            settings: this._settings,
            overlay: this._overlay,
            title: this.metadata.name,
        }));

        Main.wm.addKeybinding(
            KEYBINDING_NAME,
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
            () => {
                void this._controller.toggle();
            }
        );
    }

    disable() {
        Main.wm.removeKeybinding(KEYBINDING_NAME);

        if (this._controller)
            void this._controller.disable();

        this._overlay?.destroy();
        this._overlay = null;
        this._controller = null;
        this._settings = null;
    }
}
