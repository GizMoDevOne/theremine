# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-07-23

### Changed
- The webcam now fills the entire field (cover) instead of being letterboxed. 1.3.0 centred the 4:3 frame with dark bands to the sides; on a field roughly twice as wide as it is tall, those bands dominated. The frame is now scaled to cover the field with its aspect ratio kept — it never looks stretched — and the overflow is cropped by the field's rounded clip. The analysis is aligned to that same covered slice: the work canvas takes the field's aspect ratio and the source is cropped exactly as the display is, so the tracking marker still lands on the real hand and the whole analysis width serves the region actually played. The stream is requested at 16:9 (`ideal`, not strict), so a widescreen camera nearly fills the field with a minimal crop and a 4:3-only camera still opens with cover taking over. This reverses both the 1.3.0 letterbox and the 1.2.0 `object-fit: fill`.
- The webcam toggle shows a camera icon (inline SVG inheriting `currentColor`) instead of the ◉ glyph, which read more like a record dot than a camera. It stays cream in the toolbar and turns amber on its own when the camera is live; the help labels now point to the "camera button".
- Hand tracking is steadier, still with no dependency. Position and volume are smoothed by a One-Euro filter — steady at rest, low-lag in motion — in place of a single fixed smoothing constant. A motion accumulator lets a slow or near-still hand leave a lingering trace that fills the thin, noisy crescent the frame-diff produced, so the centroid stops jittering; vibrato still reads instantaneous energy, so a shake is not smeared into a sweep. The skin test is now a soft score with widened bounds and a slow, bounded re-centring on the moving pixels, so a darker or lighter skin tone and a warm or cool light no longer pull the mask off.
- Releasing Shift now eases the vibrato down over ~0.6 s instead of cutting it dead. A small per-frame input tick drives this only while the fade is running, so the pointer, MIDI and the webcam keep full control of the vibrato depth when they are the source.

### Fixed
- Mouse vibrato no longer stays pinned at full. Vibrato from the mouse is armed by Shift alone — a mouse reports no pressure — so releasing Shift while the button was held left the depth at 100% until the click was released: the guard cleared it only `if(!pointerDown)`, a proxy written for a finger or stylus that keeps supplying real pressure, which a mouse never does. Vibrato now falls back to the pointer's actual pressure (0 for a mouse), so releasing Shift releases it (via the fade above), whether or not the click is held.

## [1.3.0] - 2026-07-22

### Added
- The webcam feed now fills the whole X/Y field, behind the oscilloscope and at 30% opacity, instead of sitting in a 360×270 thumbnail in a corner. You read your hands and the trace at once. This falls out of the existing compositing rather than fighting it: the grid, the trace and the cursor all paint in `lighter` and the persistence layer is a near-black, so nothing covers the video. The frame is letterboxed — centred in the field with its aspect ratio kept, dark margins to the sides — so it never looks stretched; the tracking markers are handed that same rectangle, so the whole frame maps onto it one-to-one and a marker still sits over the real hand. What remains of the camera card is a status line and the mode switch, and it now stays reachable below 820px, where hiding the whole card used to make the mode chips unusable while the camera was running.

### Changed
- The two webfonts are self-hosted under `assets/fonts/` (47 KB, latin subset), so "zero dependencies" is now true of the network too: the page keeps its typography offline and sends no request to a third party — which sat awkwardly beside the promise that the camera feed never leaves your machine. Syncopate ships at 700 alone, the only weight the interface uses; the previous request asked for 400 as well and never applied it. Licenses are bundled as their terms require (DM Mono under the SIL OFL 1.1, Syncopate under Apache 2.0).
- The oscilloscope's persistence buffer is sized to the field instead of the window. The trace was already clipped to the field, so every frame faded and composited a full-screen buffer to show a field-sized picture — 37% wasted pixels at 1440×900, and proportionally more on a wide screen where the field is a smaller share of the window. The buffer now carries the field's origin in its transform, which leaves the drawing code on page coordinates.
- `vision.js` no longer owns a canvas. It exposes what it knows — the current frame and how to draw the tracking markers — and `render.js`, which owns the canvas, calls it; the same contract `Th.getAudioNodes()` already used. The separate preview canvas is gone.
- Removed dead code (`xFromFreq`, the `Th.snap`/`getLang`/`stopCam` exports, `hover.fy`, the vision trail buffer, a `touches` branch in `fieldXY` that Pointer Events never take, one orphaned i18n key), and factored the chip-selection logic that had been written out three times.
- `README.md` claimed the webcam worked from a double-clicked `index.html`. It does not, and never did: `getUserMedia` is unavailable outside a secure context — which the app itself already reported as "https requis". The claim contradicted the README's own Prerequisites section.

### Fixed
- Browser shortcuts no longer play notes. The global `keydown` listener had no guard, so `Ctrl+S` landed on a note key — and because the save dialog then took the focus, the matching `keyup` never arrived and the note went on sounding indefinitely. Typing in the MIDI selects or the dock sliders played notes for the same reason.
- Holding a key while the page loses focus (an Alt+Tab) no longer leaves the note and the vibrato stuck on. Losing focus releases the local sources only: MIDI and the webcam keep sending while the tab is in the background, and cutting them would have been wrong.
- The "Connecter MIDI" button was wired to nothing at all — MIDI only ever connected automatically at power-on, so a controller plugged in afterwards, or a permission refused then granted, had no way back. The help panel told users to click it.
- The playing field is measured again once the webfonts land. Its geometry is read off the note readout and the bottom bar, both sized by fonts that arrive after the scripts, so the field was offset until the first window resize.
- A cancelled touch (`pointercancel`, fired when a system gesture aborts a stroke) left the voice sounding: only `pointerup` and `pointerleave` were handled.
- A blocked `localStorage` no longer breaks the interface. Access throws where site data is turned off — Safari over `file://`, the very case this project is built for — and the unguarded call aborted the rest of `i18n.js`, leaving the page on its hardcoded French markup with a dead language button.
- An `AudioContext` that starts suspended is now resumed: `initAudio()` returned early on every later gesture, so there was no way to recover.
- A window drag no longer allocates a multi-megabyte canvas per `resize` event. The events coalesce into one recompute per frame, and the buffer is only reallocated when its pixel size actually changes.
- Four accessibility defects: the diagram card carried `aria-hidden` while holding a focusable close button; the viewport locked scale with `user-scalable=no` (WCAG 1.4.4); icon-only buttons had a `title` but no accessible name, leaving screen readers to announce the glyph; and neither modal had dialog semantics or managed focus. The accessible names come from the translation strings that already existed.

## [1.2.0] - 2026-07-21

### Added
- Webcam mode: play the instrument by moving your hands in the air, the way the real theremin is played. Two mappings, switchable from the preview card — *2 hands* mirrors a real theremin (right hand for pitch and timbre, left hand for continuous volume, so notes have real attacks and real silences), *1 hand* behaves like the mouse in the field. Shaking the pitch hand adds vibrato.
- Detection is plain JavaScript with no dependency: frame differencing intersected with a skin chroma test, an auto-calibrating threshold, and a weighted centroid per zone. A WASM hand model would have needed `fetch()`, which `file://` blocks — this keeps the page playable by double-click, camera included. Vibrato reads the zone's motion energy rather than the tracked position, so a smooth sweep across the field is not mistaken for a shake.
- A hand that stops moving holds its last position instead of being lost, so a note can be sustained still.
- The video never leaves the machine: it is only read into an offscreen canvas, never sent, stored or exported. Turning the camera off releases the stream.

### Changed
- `Th.audioActivate()` takes an optional level, so a source can drive continuous volume instead of the fixed gain.
- The X/Y field now starts level with the note readout instead of below the whole top bar, reclaiming the dead space the title block was holding and giving the playable area noticeably more height.
- The webcam preview sits centred on the field's bottom edge rather than in its bottom-left corner, and is larger (360×270). The stream is requested at 640×480 so the preview is not an upscale of a smaller frame; the analysis still runs on its own 160×120 buffer, so nothing costs more.
- The preview uses `object-fit: fill` rather than `cover`. The analysis squeezes the whole frame into its buffer without regard for aspect ratio, so displaying the whole frame is what keeps the tracking reticle over the actual hand — with `cover`, a camera returning 16:9 would have had its sides cropped and the reticle would drift away from the hand.

### Fixed
- The camera reported "camera unavailable" for every failure other than a refusal or a missing device, which hid the two causes users actually hit. A page opened over `file://` or plain `http` on a remote host now reports "https required" (the API simply does not exist outside a secure context), and a device that cannot be read now reports "camera busy".
- The camera card could not be closed once a start had failed: the button toggled on the stream, which stays null after an error, while the card had already been shown. It now toggles on what is actually on screen.
- `getUserMedia()` was left to pick the default video input, which on machines exposing phantom devices — an unplugged capture card, a Windows Hello infrared sensor — is often not a usable camera, and failed as `NotReadableError` while the real webcam sat idle. It now falls back to enumerating the video inputs and trying each one explicitly, infrared sensors last since they open without ever yielding anything a skin test can use. A permission refusal stays final, so the fallback never turns into a burst of prompts.
- Turning the camera off resets the status label, so a past failure no longer greets the next opening.

## [1.1.0] - 2026-07-20

### Added
- Demo mode: 17 short well-known pieces that play the instrument hands-free, grouped into science fiction, film & TV, video games, and classical — including Saint-Saëns' *The Swan*, one of the pieces Clara Rockmore made famous on the theremin itself. Reachable from a ▶ button in the top bar or straight from the boot screen, with the track's name shown just above the field while it plays.
- The demo player drives the very same voice a hand would, so the X/Y field, the cursor, the oscilloscope, the playable diagram and the MIDI pad LEDs all react live without any dedicated visualization code. Notes glide into each other, repeated pitches re-attack, vibrato swells on long notes, and timbre follows pitch. Tracks may declare an accelerando (*In the Hall of the Mountain King*, *Jaws*).
- Touching the field, pressing a key or playing a MIDI controller stops the demo instantly and restores the settings it borrowed.

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
