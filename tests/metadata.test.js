import GLib from 'gi://GLib';
import {test, assert} from './harness.js';

test('metadata declares all promised GNOME versions', () => {
    const [, bytes] = GLib.file_get_contents('metadata.json');
    const metadata = JSON.parse(new TextDecoder().decode(bytes));
    for (const version of ['49', '50', '51'])
        assert(metadata['shell-version'].includes(version));
});
