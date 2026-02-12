import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as BarLevel from 'resource:///org/gnome/shell/ui/barLevel.js';
import * as Layout from 'resource:///org/gnome/shell/ui/layout.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const LEVEL_TICK_INTERVAL_MS = 50;
const LEVEL_DECAY_FACTOR = 0.82;
const LEVEL_ANIMATION_TIME_MS = 100;

export class VoiceOverlay {
    constructor() {
        this._actor = null;
        this._monitorConstraint = null;
        this._level = null;
        this._tickId = 0;
        this._targetLevel = 0;
        this._visibleLevel = 0;
    }

    show() {
        if (!this._actor)
            this._build();

        this._targetLevel = 0;
        this._visibleLevel = 0;
        this._level.value = 0;
        this._actor.opacity = 255;
        this._actor.show();

        this._startTick();
    }

    hide() {
        this._stopTick();

        if (!this._actor)
            return;

        this._actor.hide();
    }

    update(level) {
        if (!this._actor)
            return;

        this._targetLevel = Math.max(0, Math.min(1, Number(level) || 0));
    }

    destroy() {
        this._stopTick();

        if (!this._actor)
            return;

        this._actor.destroy();
        this._actor = null;
        this._monitorConstraint = null;
        this._level = null;
    }

    _build() {
        this._actor = new Clutter.Actor({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
            reactive: false,
            visible: false,
        });

        this._monitorConstraint = new Layout.MonitorConstraint({
            index: Main.layoutManager.primaryIndex,
        });
        this._actor.add_constraint(this._monitorConstraint);

        const box = new St.BoxLayout({
            style_class: 'osd-window whisper-stt-osd-window',
            vertical: false,
        });
        this._actor.add_child(box);

        const icon = new St.Icon({
            icon_name: 'audio-input-microphone-symbolic',
            y_expand: true,
        });
        box.add_child(icon);

        const vbox = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(vbox);

        this._level = new BarLevel.BarLevel({
            style_class: 'level whisper-stt-level',
            value: 0,
        });
        this._level.maximumValue = 1;
        this._level.overdriveStart = 1;
        vbox.add_child(this._level);

        Main.uiGroup.add_child(this._actor);
    }

    _startTick() {
        if (this._tickId !== 0)
            return;

        this._tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, LEVEL_TICK_INTERVAL_MS, () => {
            this._visibleLevel = Math.max(this._targetLevel, this._visibleLevel * LEVEL_DECAY_FACTOR);

            this._level.ease_property('value', this._visibleLevel, {
                duration: LEVEL_ANIMATION_TIME_MS,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });

            return GLib.SOURCE_CONTINUE;
        });
        GLib.Source.set_name_by_id(this._tickId, '[whisper-stt] overlay-level-tick');
    }

    _stopTick() {
        if (this._tickId === 0)
            return;

        GLib.source_remove(this._tickId);
        this._tickId = 0;
    }
}
