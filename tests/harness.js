const _tests = [];

export function test(name, fn) {
    _tests.push({name, fn});
}

export function assert(condition, message = 'Assertion failed') {
    if (!condition)
        throw new Error(message);
}

export function assertEqual(actual, expected, message = '') {
    if (actual !== expected)
        throw new Error(message || `Expected ${expected} but got ${actual}`);
}

export function assertIncludes(haystack, needle, message = '') {
    if (!haystack.includes(needle))
        throw new Error(message || `Expected "${haystack}" to include "${needle}"`);
}

export function assertDeepEqual(actual, expected, message = '') {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);

    if (actualJson !== expectedJson) {
        throw new Error(message || `Expected ${expectedJson} but got ${actualJson}`);
    }
}

export async function assertRejects(fn, expectedSubstring = '') {
    let rejected = false;

    try {
        await fn();
    } catch (error) {
        rejected = true;

        if (expectedSubstring)
            assertIncludes(String(error.message ?? error), expectedSubstring);
    }

    if (!rejected)
        throw new Error('Expected function to reject, but it resolved');
}

export async function run() {
    let failures = 0;

    for (const {name, fn} of _tests) {
        try {
            await fn();
            print(`ok - ${name}`);
        } catch (error) {
            failures += 1;
            printerr(`not ok - ${name}`);
            printerr(String(error.stack ?? error));
        }
    }

    if (failures > 0)
        throw new Error(`${failures} test(s) failed`);

    print(`1..${_tests.length}`);
}
