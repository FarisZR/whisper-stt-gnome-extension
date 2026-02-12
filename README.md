# whisper-client-gnome

A GNOME Shell extension that records microphone audio with a keyboard shortcut,
sends it to an OpenAI-compatible speech-to-text endpoint, then plays a tone and
copies the transcript to the clipboard.

## Features

- Toggle recording with one shortcut press (start/stop)
- Live voice graph overlay while recording
- OpenAI-style `/v1/audio/transcriptions` request flow
- Works with empty API key (no Authorization header sent)
- Copies transcript to clipboard using `wl-copy`

## Settings

Open extension preferences and configure:

- `Endpoint` (default: `https://api.openai.com/v1/audio/transcriptions`)
- `Model` (default: `whisper-1`)
- `API Key` (optional)
- `Language` and `Prompt` (optional)
- `Response Format` (`json` or `text`)
- Toggle shortcut accelerator string

## Development

Run tests:

```bash
./scripts/test.sh
```

Run tests with coverage output:

```bash
./scripts/coverage.sh
```

Compile extension schemas after editing `schemas/*.xml`:

```bash
glib-compile-schemas schemas
```
