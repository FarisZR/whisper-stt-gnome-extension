import Adw from 'gi://Adw';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function _addStringRow(group, settings, title, key, subtitle = '') {
    const row = new Adw.EntryRow({
        title,
        text: settings.get_string(key),
    });

    if (subtitle)
        row.set_subtitle(subtitle);

    row.connect('changed', () => {
        settings.set_string(key, row.get_text());
    });

    settings.connect(`changed::${key}`, () => {
        const latest = settings.get_string(key);

        if (row.get_text() !== latest)
            row.set_text(latest);
    });

    group.add(row);
}

export default class WhisperSttPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

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

        const shortcutGroup = new Adw.PreferencesGroup({
            title: _('Shortcut'),
        });
        page.add(shortcutGroup);

        const shortcutRow = new Adw.EntryRow({
            title: _('Toggle Recording Shortcut'),
            text: settings.get_strv('toggle-recording-shortcut')[0] ?? '',
        });
        shortcutRow.set_subtitle(_('Example: <Ctrl><Super>space'));

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
