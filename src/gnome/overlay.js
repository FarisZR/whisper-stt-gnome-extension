import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Layout from 'resource:///org/gnome/shell/ui/layout.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const LEVEL_TICK_INTERVAL_MS = 50;
const LEVEL_ATTACK_SMOOTHING = 0.45;
const LEVEL_RELEASE_SMOOTHING = 0.2;
const BAR_COUNT = 18;
const BASE_HEIGHT = 8;
const EXTRA_HEIGHT = 22;
const BAR_WIDTH = 6;

export class VoiceOverlay {
    constructor() {
        this._actor = null;
        this._monitorConstraint = null;
        this._bars = [];
        this._tickId = 0;
        this._targetLevel = 0;
        this._visibleLevel = 0;
        this._phase = 0;
    }

    show() {
        if (!this._actor)
            this._build();

        this._targetLevel = 0;
        this._visibleLevel = 0;
        this._phase = 0;
        this._renderBars();
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
        this._bars = [];
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
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._actor.add_child(box);

        const waves = new St.BoxLayout({
            style_class: 'whisper-stt-waves',
            vertical: false,
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        box.add_child(waves);

        for (let i = 0; i < BAR_COUNT; i += 1) {
            const bar = new St.Widget({
                style_class: 'whisper-stt-wave-bar',
                y_align: Clutter.ActorAlign.END,
                y_expand: false,
                x_expand: false,
            });
            bar.set_width(BAR_WIDTH);
            bar.set_height(BASE_HEIGHT);
            waves.add_child(bar);
            this._bars.push(bar);
        }

        Main.uiGroup.add_child(this._actor);
    }

    _startTick() {
        if (this._tickId !== 0)
            return;

        this._tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, LEVEL_TICK_INTERVAL_MS, () => {
            const smoothing = this._targetLevel >= this._visibleLevel
                ? LEVEL_ATTACK_SMOOTHING
                : LEVEL_RELEASE_SMOOTHING;

            this._visibleLevel = this._visibleLevel * (1 - smoothing) + this._targetLevel * smoothing;
            this._phase += 0.4;
            this._renderBars();

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

    _renderBars() {
        if (this._bars.length === 0)
            return;

        const center = (this._bars.length - 1) / 2;

        for (let i = 0; i < this._bars.length; i += 1) {
            const distance = Math.abs(i - center) / center;
            const envelope = 0.32 + (1 - distance) * 0.68;
            const motion = 0.6 + Math.abs(Math.sin(this._phase + distance * 4.0)) * 0.4;
            const baseline = 0.12;
            const amplitude = baseline + this._visibleLevel * envelope * motion;
            const height = BASE_HEIGHT + Math.round(amplitude * EXTRA_HEIGHT);

            this._bars[i].set_height(height);
        }
    }
}
