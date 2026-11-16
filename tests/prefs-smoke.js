import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw';

Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource')._register();
const {ExtensionPreferences} = await import('resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js');
const path = ARGV[0];
const dir = Gio.File.new_for_path(path);
const [, bytes] = GLib.file_get_contents(`${path}/metadata.json`);
const metadata = JSON.parse(new TextDecoder().decode(bytes));
const {default: Preferences} = await import(dir.get_child('prefs.js').get_uri());
const prefs = new Preferences({...metadata, path, dir});
ExtensionPreferences.lookupByUUID = () => prefs;
Adw.init();
const window = new Adw.PreferencesWindow();
prefs.fillPreferencesWindow(window);
const settings = prefs.getSettings();

function findRow(widget, title) {
    if (widget.get_title?.() === title)
        return widget;
    for (let child = widget.get_first_child(); child; child = child.get_next_sibling()) {
        const found = findRow(child, title);
        if (found)
            return found;
    }
    return null;
}

const endpoint = findRow(window, 'Endpoint');
endpoint.text = 'https://example.invalid/transcribe';
if (settings.get_string('transcription-endpoint') !== endpoint.text)
    throw new Error('Entry changes must reach GSettings');
settings.set_string('transcription-endpoint', 'https://example.invalid/new');
if (endpoint.text !== settings.get_string('transcription-endpoint'))
    throw new Error('External setting changes must reach the entry');
settings.set_boolean('proxy-enabled', true);
const toggle = findRow(window, 'Enable Proxy');
const host = findRow(window, 'Proxy Host');
if (!toggle.active || !host.visible)
    throw new Error('Enabling proxy must update toggle and dependent visibility');
toggle.active = false;
if (settings.get_boolean('proxy-enabled') || host.visible)
    throw new Error('Disabling proxy must update setting and dependent visibility');
window.close();
print('Preferences construction and bidirectional bindings passed.');
