import Adw from 'gi://Adw';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.whisper-stt';

function _addStringRow(group, settings, title, key, subtitle = '') {
    const row = new Adw.EntryRow({
        title,
        text: settings.get_string(key),
    });

    if (subtitle)
        row.set_tooltip_text(subtitle);

    row.connect('changed', () => {
        settings.set_string(key, row.get_text());
    });

    settings.connect(`changed::${key}`, () => {
        const latest = settings.get_string(key);

        if (row.get_text() !== latest)
            row.set_text(latest);
    });

    group.add(row);

    return row;
}

export default class WhisperSttPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings(SETTINGS_SCHEMA);

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'audio-input-microphone-symbolic',
        });
        window.add(page);

        const apiGroup = new Adw.PreferencesGroup({
            title: _('Transcription API'),
        });
        page.add(apiGroup);

        _addStringRow(apiGroup, settings, _('Endpoint'), 'transcription-endpoint',
            _('OpenAI-compatible endpoint, e.g. https://api.openai.com/v1/audio/transcriptions'));
        _addStringRow(apiGroup, settings, _('Model'), 'transcription-model', _('Default: whisper-1'));
        _addStringRow(apiGroup, settings, _('API Key'), 'api-key',
            _('Leave blank for endpoints that do not require authentication'));
        _addStringRow(apiGroup, settings, _('Language (optional)'), 'language', _('ISO code, e.g. en'));
        _addStringRow(apiGroup, settings, _('Prompt (optional)'), 'prompt');
        _addStringRow(apiGroup, settings, _('Response Format'), 'response-format', _('json or text'));

        const proxyGroup = new Adw.PreferencesGroup({
            title: _('SOCKS5 Proxy'),
        });
        page.add(proxyGroup);

        const proxyToggleRow = new Adw.SwitchRow({
            title: _('Enable SOCKS5 Proxy'),
            subtitle: _('Use a SOCKS5 proxy for transcription requests'),
            active: settings.get_boolean('proxy-enabled'),
        });
        proxyGroup.add(proxyToggleRow);

        proxyToggleRow.connect('notify::active', () => {
            settings.set_boolean('proxy-enabled', proxyToggleRow.get_active());
        });

        settings.connect('changed::proxy-enabled', () => {
            const enabled = settings.get_boolean('proxy-enabled');

            if (proxyToggleRow.get_active() !== enabled)
                proxyToggleRow.set_active(enabled);

            proxyHostRow.set_visible(enabled);
            proxyPortRow.set_visible(enabled);
            proxyUsernameRow.set_visible(enabled);
            proxyPasswordRow.set_visible(enabled);
        });

        const proxyHostRow = _addStringRow(proxyGroup, settings, _('Proxy Host'), 'proxy-host', _('Example: 127.0.0.1'));
        const proxyPortRow = _addStringRow(proxyGroup, settings, _('Proxy Port'), 'proxy-port', _('Default: 1080'));
        const proxyUsernameRow = _addStringRow(proxyGroup, settings, _('Proxy Username (optional)'), 'proxy-username');
        const proxyPasswordRow = _addStringRow(proxyGroup, settings, _('Proxy Password (optional)'), 'proxy-password');

        const proxyEnabled = settings.get_boolean('proxy-enabled');
        proxyHostRow.set_visible(proxyEnabled);
        proxyPortRow.set_visible(proxyEnabled);
        proxyUsernameRow.set_visible(proxyEnabled);
        proxyPasswordRow.set_visible(proxyEnabled);

        const shortcutGroup = new Adw.PreferencesGroup({
            title: _('Shortcut'),
        });
        page.add(shortcutGroup);

        const shortcutRow = new Adw.EntryRow({
            title: _('Toggle Recording Shortcut'),
            text: settings.get_strv('toggle-recording-shortcut')[0] ?? '',
        });
        shortcutRow.set_tooltip_text(_('Example: <Ctrl><Super>space'));

        shortcutRow.connect('changed', () => {
            const value = shortcutRow.get_text().trim();
            settings.set_strv('toggle-recording-shortcut', value ? [value] : []);
        });

        settings.connect('changed::toggle-recording-shortcut', () => {
            const latest = settings.get_strv('toggle-recording-shortcut')[0] ?? '';

            if (shortcutRow.get_text() !== latest)
                shortcutRow.set_text(latest);
        });

        shortcutGroup.add(shortcutRow);
    }
}
