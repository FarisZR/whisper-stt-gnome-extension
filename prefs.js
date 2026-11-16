import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.whisper-stt';

function _addBoundRow(group, settings, key, row) {
    settings.bind(key, row, 'text', Gio.SettingsBindFlags.DEFAULT);

    group.add(row);

    return row;
}

function _addStringRow(group, settings, title, key, subtitle = '') {
    const row = new Adw.EntryRow({
        title,
        text: settings.get_string(key),
    });

    if (subtitle)
        row.set_tooltip_text(subtitle);

    return _addBoundRow(group, settings, key, row);
}

function _addPasswordRow(group, settings, title, key) {
    const row = new Adw.PasswordEntryRow({
        title,
        text: settings.get_string(key),
    });

    return _addBoundRow(group, settings, key, row);
}

export default class WhisperSttPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings(SETTINGS_SCHEMA);

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'audio-input-microphone-symbolic',
        });
        window.add(page);

        const feedbackGroup = new Adw.PreferencesGroup({
            title: _('Feedback'),
        });
        page.add(feedbackGroup);

        const soundsRow = new Adw.SwitchRow({
            title: _('Play sounds'),
            subtitle: _('Play a short success or error sound. Notifications are always shown.'),
        });
        settings.bind('sounds-enabled', soundsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        feedbackGroup.add(soundsRow);

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
            title: _('Proxy'),
        });
        page.add(proxyGroup);

        const proxyToggleRow = new Adw.SwitchRow({
            title: _('Enable Proxy'),
            subtitle: _('Use an HTTP or SOCKS5 proxy for transcription requests'),
            active: settings.get_boolean('proxy-enabled'),
        });
        proxyGroup.add(proxyToggleRow);

        const proxyTypeModel = Gtk.StringList.new([
            _('SOCKS5'),
            _('HTTP'),
        ]);
        const proxyTypeRow = new Adw.ComboRow({
            title: _('Proxy Type'),
            model: proxyTypeModel,
            selected: settings.get_string('proxy-type') === 'http' ? 1 : 0,
        });
        proxyGroup.add(proxyTypeRow);

        const proxyHostRow = _addStringRow(proxyGroup, settings, _('Proxy Host'), 'proxy-host', _('Example: 127.0.0.1'));
        const proxyPortRow = _addStringRow(proxyGroup, settings, _('Proxy Port'), 'proxy-port', _('SOCKS default: 1080, Squid default: 3128'));
        const proxyUsernameRow = _addStringRow(proxyGroup, settings, _('Proxy Username (optional)'), 'proxy-username');
        const proxyPasswordRow = _addPasswordRow(proxyGroup, settings, _('Proxy Password (optional)'), 'proxy-password');

        settings.bind('proxy-enabled', proxyToggleRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        for (const row of [proxyTypeRow, proxyHostRow, proxyPortRow, proxyUsernameRow, proxyPasswordRow])
            settings.bind('proxy-enabled', row, 'visible', Gio.SettingsBindFlags.GET);

        proxyTypeRow.connect('notify::selected', () => {
            const proxyType = proxyTypeRow.get_selected() === 1 ? 'http' : 'socks5';
            settings.set_string('proxy-type', proxyType);
        });

        settings.connect('changed::proxy-type', () => {
            const selected = settings.get_string('proxy-type') === 'http' ? 1 : 0;

            if (proxyTypeRow.get_selected() !== selected)
                proxyTypeRow.set_selected(selected);
        });

        const bypassGroup = new Adw.PreferencesGroup({
            title: _('VPN Bypass'),
        });
        page.add(bypassGroup);

        const bypassToggleRow = new Adw.SwitchRow({
            title: _('Bypass VPN connections'),
            subtitle: _('Sends transcription requests through the selected local interface instead of the VPN tunnel'),
            active: settings.get_boolean('bypass-vpn-enabled'),
        });
        bypassGroup.add(bypassToggleRow);

        const bypassInterfaceRow = _addStringRow(
            bypassGroup,
            settings,
            _('Network Interface'),
            'bypass-vpn-interface',
            _('Example: enp6s0 or wlan0')
        );

        settings.bind('bypass-vpn-enabled', bypassToggleRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('bypass-vpn-enabled', bypassInterfaceRow, 'visible', Gio.SettingsBindFlags.GET);

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
