import GLib from 'gi://GLib';

import {test, assertDeepEqual} from './harness.js';

test('metadata supports GNOME 49, 50, and 51', async () => {
    let metadata;

    try {
        const [success, bytes] = GLib.file_get_contents('metadata.json');

        if (!success)
            throw new Error('failed to read metadata.json');

        metadata = JSON.parse(new TextDecoder().decode(bytes));
    } catch (error) {
        console.error('Failed to read metadata.json:', error);
        throw error;
    }

    assertDeepEqual(metadata['shell-version'], ['49', '50', '51']);
});
