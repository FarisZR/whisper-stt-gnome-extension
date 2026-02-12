import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class VoiceOverlay {
    constructor() {
        this._actor = null;
        this._bars = [];
        this._history = [];
        this._maxBars = 28;
    }

    show() {
        if (this._actor)
            return;

        this._history = new Array(this._maxBars).fill(0);
        this._bars = [];

        this._actor = new St.BoxLayout({
            style_class: 'whisper-stt-overlay',
            vertical: true,
            reactive: false,
        });

        const title = new St.Label({
            style_class: 'whisper-stt-title',
            text: 'Recording...',
        });
        this._actor.add_child(title);

        const barsBox = new St.BoxLayout({
            style_class: 'whisper-stt-bars',
            vertical: false,
        });
        this._actor.add_child(barsBox);

        for (let i = 0; i < this._maxBars; i += 1) {
            const bar = new St.Widget({style_class: 'whisper-stt-bar'});
            bar.set_style('height: 8px;');
            barsBox.add_child(bar);
            this._bars.push(bar);
        }

        Main.layoutManager.addChrome(this._actor, {trackFullscreen: false});
        this._reposition();
    }

    hide() {
        if (!this._actor)
            return;

        this._actor.destroy();
        this._actor = null;
        this._bars = [];
        this._history = [];
    }

    update(level) {
        if (!this._actor)
            return;

        const safeLevel = Math.max(0, Math.min(1, Number(level) || 0));

        this._history.push(safeLevel);
        if (this._history.length > this._maxBars)
            this._history.shift();

        for (let i = 0; i < this._bars.length; i += 1) {
            const value = this._history[i] ?? 0;
            const height = 8 + Math.round(value * 40);
            this._bars[i].set_style(`height: ${height}px;`);
        }

        this._reposition();
    }

    destroy() {
        this.hide();
    }

    _reposition() {
        if (!this._actor)
            return;

        const monitor = Main.layoutManager.primaryMonitor;
        const width = 460;
        const x = monitor.x + Math.floor((monitor.width - width) / 2);
        const y = monitor.y + monitor.height - 170;

        this._actor.set_width(width);
        this._actor.set_position(x, y);
    }
}
