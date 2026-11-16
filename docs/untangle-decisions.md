# Untangling decisions

Scope: all runtime modules, preferences, tests, installation and release tooling.
Optional comment and test cleanup both selected. Baseline: c15803b; working tree clean.

## Design and problem inventory (before implementation)

- Give each recording one audio source and one owner for metering and shutdown.
  - `runtimeDeps.js` opens both GStreamer and pw-record on the microphone; speech detection can measure a different source from the uploaded WAV.
  - `pipelineCommand.js` already emits level messages, but only tests consume `parseLevelLine`; production discards the messages.
  - Meter listeners, stale-sample timer, PCM decoding and subprocess lifetime are spread across runtime wiring and separate modules.
  - `startRecording` wraps a process handle in a pass-through stop wrapper.
  - `cleanupRecording` implicitly stops a global meter depending on listener count.
- Treat disable as session invalidation, and make asynchronous continuations check ownership.
  - Disable during startup can leave a newly started recorder/overlay alive.
  - Disable during transcription discards the session without stopping its work; a late result can copy text and notify after disable.
  - The watchdog clears state independently from the operation lock and operation timeouts; it cannot actually unblock a pending toggle.
  - Timeout defaults and minimums repeat six times; tests assert private fields and construct unreachable states.
  - A failed overlay initialization can leak the already started monitor.
  - Extension initialization has no rollback if keybinding registration fails.
- Bind preferences properties to settings rather than duplicating change propagation.
  - String, boolean and visibility rows each maintain bidirectional callbacks and equality guards.
  - Single-row wrappers and a visibility closure for one row add indirection without ownership.
  - Shortcut normalization in transcription settings has no runtime consumer; Shell owns the shortcut.
  - Exported settings defaults and speech statistics have no production callers.
- Make install and release operations share the validated bundle contract.
  - `install.sh` copies development files and has different rsync/cp behavior and no fail-fast handling.
  - Release shell code lives inside YAML and cannot be exercised locally.
  - A failed draft upload cannot recover on rerun; the current workflow requires manual deletion.
  - CI omits GStreamer, silently skipping real WAV/pipe regression tests.
  - Packaging accepts a commit argument while copying the working tree; callers must know it labels rather than checks out sources.
- Keep behavioral tests; remove assertions about representation and elapsed minimums.
  - Slow EOS test fails when shutdown finishes faster even though the WAV is valid (observed baseline failure).
  - Controller tests mutate private session/state/watchdog fields and inspect timeout fields.
  - Process test wrappers only catch, log and rethrow; tests duplicate the production pipeline.
  - Metadata tests freeze the exact supported version array instead of checking the promised compatibility.
  - The exact-100% coverage gate fails after removing private-state tests despite passing behavior checks. Keep coverage as a review report rather than requiring artificial tests to reach a percentage.

## Necessary special cases

- SIGINT, EOS grace and force-kill deadline: GStreamer must finalize WAV headers; a stuck child must not hold the extension indefinitely.
- Bound network, clipboard, tone and cleanup waits: external facilities may fail or hang. They must not keep the UI busy forever.
- Tone fallback list: sound themes differ; retain fallback behavior.
- JSON and plain-text response parsing, optional auth/proxy/interface: supported endpoint and networking requirements.
- Quiet/sustained/peak thresholds and meter smoothing: speech gating and readable animation requirements.
- Missing GStreamer locally may skip integration tests, but CI must install it.
- Latest-main publication guards: delayed builds must not roll Homebrew back.
- User-requested replacement: the shortcut during transcription now cancels and discards the old session and begins a fresh recording. Session cancellation races the network wait, so even an unresponsive provider cannot block replacement. Late results cannot touch the new session or clipboard.
- GitHub releases require tags. Generated `build-<sha>` tags identify immutable artifacts; pushes to main trigger the build, never tags. The existing tap requires this contract.

## GNOME compatibility evidence

The [GNOME 51 porting guide](https://gjs.guide/extensions/upgrading/gnome-shell-51.html) requires synchronous extension disable and removes St's vertical property. Both are already satisfied. `orientation` is available in the upstream [49](https://raw.githubusercontent.com/GNOME/gnome-shell/gnome-49/src/st/st-box-layout.h), [50](https://raw.githubusercontent.com/GNOME/gnome-shell/gnome-50/src/st/st-box-layout.h), and [51](https://raw.githubusercontent.com/GNOME/gnome-shell/gnome-51/src/st/st-box-layout.h) headers. No version branch is needed. Host Shell: 51.1; older shells require separate runtime validation.

## Verification

- Completed the redesign above. The recorder now owns its level callback, the obsolete PCM/byte-process path and separate monitor API are gone, and stale animation decay belongs to the existing overlay timer. GStreamer RMS/peak dB are converted with the prior PCM noise floor and gain, preserving speech gating calibration.
- Controller operations have one timeout policy, explicit session cancellation, bounded external processes, and suppression of discarded/disabled results. The watchdog was redundant with bounded operations and could not release the toggle lock; it is removed.
- Preferences use native property bindings for text, switches and dependent visibility. Index/string conversion for proxy type and the shortcut array remain explicit because the property types differ.
- Tone policy and fallback execution live together in `tonePlayer.js`; tests verify fallback/stop/failure behavior rather than copying event arrays. Unused speech statistics, configurable thresholds, shortcut normalization and defaults export are removed.
- Installation consumes the validated bundle. Packaging rejects labels for another checkout. Publication is a locally testable script that repairs draft uploads while preserving published artifacts. CI installs GStreamer and its test plugins.
- `./scripts/test.sh`: 74 GJS behavioral and integration tests plus 3 publication tests passed. WAV finalization, draining, force-kill, network timeout, silence/speech levels, replacement, late-result suppression and disable are covered.
- `./scripts/coverage.sh`: passed; reports coverage without an exact-percentage gate. Private controller state is no longer manufactured to satisfy coverage.
- `./scripts/package.sh` and `tests/check_package.py`: both archives contain identical validated runtime payloads, compiled schemas and all module imports (18 runtime files).
- `./scripts/shell-smoke.sh`: passed on GNOME Shell 51.1 with a temporary extension copy/private D-Bus session. Verified ACTIVE state, overlay construction/18 bars/stale decay, actual preferences construction and bidirectional bindings, then INACTIVE state after disable. Desktop profile installation was not changed.
- Shell syntax, workflow YAML parsing and `git diff --check` passed.
- Independent whole-codebase reviews were repeated after fixes and after replacement/cancellation changes; final review reported no remaining worthwhile findings.

## Limits and retained constraints

- GNOME 49/50 retain source/API compatibility, but those Shell versions are not installed here for runtime testing.
- Extension `disable()` remains synchronous as GNOME requires. Child finalization completes asynchronously with bounded waits; disabled callbacks cannot re-enter the overlay or publish transcription results.
- No real microphone recording was sent to an external endpoint. Audio integration uses a synthetic GStreamer source; request/response behavior uses behavioral tests.
- Publication was tested with a fake GitHub CLI, including draft repair, immutable reruns and stale-main rejection. No live release, tap update or remote push was performed.
- GitHub release tags remain necessary immutable artifact identifiers for the existing tap. Build triggers are `main` pushes, pull requests and manual dispatch, with publication restricted to current `main`.

## Follow-up: zero meter despite recorded microphone audio

The first deployment exposed a regression missed by the original smoke test.
Live inspection confirmed that the extension used the system-selected Lenovo
microphone and wrote a WAV with nonzero audio, but reported no speech.

GNOME Shell's `ui/environment.js` already calls `Gio._promisify` on
`DataInputStream.read_line_async` with its byte-returning finish method.
Repeating `_promisify` with `read_line_finish_utf8` does not replace that wrapper.
The new metering path therefore received byte arrays, which its text parser
rejected. Standalone GJS tests ran before any other wrapper was installed, so
they passed while Shell failed.

Pipe reads now use an explicit async callback and `read_line_finish_utf8`,
independent of shared prototype wrappers. No microphone routing change is needed.
`tests/fixtures/sharedGioRuntime.js` reproduces Shell's wrapper before loading the
process module: it failed before this correction and passes after it.
The real Shell smoke test now records a synthetic source and checks speech
levels inside Shell, alongside overlay, preferences and disable checks.
