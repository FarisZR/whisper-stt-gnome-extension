import {test, assertDeepEqual, assertEqual, assertRejects} from './harness.js';
import {splitBodyAndStatus, parseTranscriptionResponse} from '../src/core/transcriptionParser.js';

test('splitBodyAndStatus reads trailing HTTP status code', () => {
    assertDeepEqual(splitBodyAndStatus('{"text":"hello"}\n200'), {
        body: '{"text":"hello"}',
        statusCode: 200,
    });
});

test('splitBodyAndStatus falls back when status code is missing', () => {
    assertDeepEqual(splitBodyAndStatus('plain text'), {
        body: 'plain text',
        statusCode: 0,
    });
});

test('splitBodyAndStatus handles empty output', () => {
    assertDeepEqual(splitBodyAndStatus(''), {
        body: '',
        statusCode: 0,
    });
});

test('splitBodyAndStatus handles invalid trailing code', () => {
    assertDeepEqual(splitBodyAndStatus('payload\nabc'), {
        body: 'payload\nabc',
        statusCode: 0,
    });
});

test('parseTranscriptionResponse extracts text from JSON payload', () => {
    assertEqual(parseTranscriptionResponse('{"text":"hello world"}', 200), 'hello world');
});

test('parseTranscriptionResponse supports plain text payloads', () => {
    assertEqual(parseTranscriptionResponse('hello world', 200), 'hello world');
});

test('parseTranscriptionResponse supports JSON string payloads', () => {
    assertEqual(parseTranscriptionResponse('"hello world"', 200), 'hello world');
});

test('parseTranscriptionResponse supports empty successful payloads', () => {
    assertEqual(parseTranscriptionResponse('   ', 204), '');
});

test('parseTranscriptionResponse throws on non-2xx status', async () => {
    await assertRejects(
        () => Promise.resolve(parseTranscriptionResponse('{"error":{"message":"bad key"}}', 401)),
        'bad key'
    );
});

test('parseTranscriptionResponse throws plain text errors', async () => {
    await assertRejects(
        () => Promise.resolve(parseTranscriptionResponse('forbidden', 403)),
        'forbidden'
    );
});

test('parseTranscriptionResponse reads JSON message errors', async () => {
    await assertRejects(
        () => Promise.resolve(parseTranscriptionResponse('{"message":"invalid request"}', 400)),
        'invalid request'
    );
});

test('parseTranscriptionResponse throws on empty error response', async () => {
    await assertRejects(
        () => Promise.resolve(parseTranscriptionResponse('  ', 500)),
        'empty response body'
    );
});
