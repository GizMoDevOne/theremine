# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-07-18

### Added
- Initial release: a browser-based theremin playable via an X/Y field (mouse/touch), computer keyboard, MIDI keyboard (legato, pitch bend, aftertouch, sustain), and MIDI pads (generic and Launchpad layouts, LED feedback).
- Waveform selection (sine/triangle/sawtooth/square), glissando, vibrato, filter resonance, convolution reverb, scale quantization, octave transpose.
- Phosphor-persistence oscilloscope rendering, playable SVG theremin diagram, and an in-app help panel.
- Bilingual interface (French/English): auto-detected from the browser language, with a manual switch in the top bar and the choice persisted locally.
- `README.md`, `CHANGELOG.md`, `.gitignore`, and a favicon (`assets/img/favicon.svg`).

### Changed
- Extracted the inline CSS and JavaScript out of `index.html` into `assets/css/style.css` and a set of classic scripts under `assets/js/` (`state`, `i18n`, `audio`, `input`, `midi`, `render`, `ui`, `main`), sharing state through a single `window.Th` namespace instead of ES module imports/exports — this keeps `index.html` openable directly via `file://` (ES modules are blocked by CORS on that protocol in most browsers).
- The X/Y field is now a rectangle spanning the full width of the bottom control bar and the full available height between the two bars, instead of a small centered square.
- The playable SVG diagram now hides itself automatically whenever it would overlap the (now wider) field, and can be dismissed manually via a close button on the diagram itself.
- The oscilloscope trace now auto-normalizes to the signal's real peak (with smoothing and a safety margin) so it makes full, consistent use of the field's height regardless of the instrument's actual volume.
- The field's corners are now rounded to match the bottom control bar's border radius.
