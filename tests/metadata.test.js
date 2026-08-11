import GLib from 'gi://GLib';

import {test, assertDeepEqual} from './harness.js';

test('metadata supports current stable GNOME 50', () => {
    const [success, bytes] = GLib.file_get_contents('metadata.json');

    if (!success)
        throw new Error('failed to read metadata.json');

    const metadata = JSON.parse(new TextDecoder().decode(bytes));

    assertDeepEqual(metadata['shell-version'], ['49', '50']);
});
