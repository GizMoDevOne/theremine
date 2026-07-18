"use strict";
/* ============================================================================
   I18N — browser language detection (fr/en), manual toggle, applies to
   [data-i18n]/[data-i18n-html]/[data-i18n-title] elements, and localized
   note names (FR solfège vs EN letters).
   Loaded right after state.js: applies before the other files wire up
   their own listeners, to avoid any content flash.
   ==========================================================================*/
(function(Th){
  const STORAGE_KEY = 'theremine:lang';

  const TR = {
    fr: {
      'topbar.eyebrow': `Champ X/Y · onde continue`,
      'topbar.sub': `Balaie le champ : gauche→droite la hauteur, bas→haut le timbre. Presse pour le vibrato.`,
      'readout.freq.label': `fréquence`,
      'readout.cut.label': `timbre`,
      'readout.vib.label': `vibrato`,
      'midi.select.input.title': `Interprétation de l'entrée MIDI`,
      'midi.select.input.keys': `Entrée : clavier`,
      'midi.select.input.pads': `Entrée : pads X/Y`,
      'midi.select.map.title': `Correspondance des pads`,
      'midi.select.map.generic': `Pads : générique`,
      'midi.select.map.launchpad': `Pads : Launchpad`,
      'midi.button': `Connecter MIDI`,
      'midi.status.disconnected': `MIDI non connecté`,
      'midi.status.unavailable': `Web MIDI indisponible ici`,
      'midi.status.denied': `Accès MIDI refusé`,
      'midi.status.connected': `MIDI connecté`,
      'midi.status.inputsCount': (n) => `${n} entrée${n>1?'s':''}`,
      'help.btn.title': `Aide et raccourcis (?)`,
      'lang.btn.title': `Langue / Language`,
      'panel.wave.label': `Onde`,
      'panel.wave.sine': `Sinus`,
      'panel.wave.triangle': `Tri`,
      'panel.wave.sawtooth': `Dent`,
      'panel.wave.square': `Carré`,
      'panel.glide.label': `Glissando`,
      'panel.vib.label': `Vibrato Hz`,
      'panel.res.label': `Résonance`,
      'panel.rev.label': `Réverb`,
      'panel.scale.label': `Gamme`,
      'panel.scale.libre': `Libre`,
      'panel.scale.penta': `Penta`,
      'panel.scale.majeur': `Majeur`,
      'panel.scale.chroma': `Chroma`,
      'panel.octave.label': `Octave`,
      'fig.head': `Schéma · jouable`,
      'fig.caption': `Attrape la main : horizontale = hauteur, verticale = timbre.`,
      'fig.svg.volume': `VOLUME`,
      'fig.svg.pitch': `HAUTEUR`,
      'fig.close.title': `Masquer le schéma`,
      'help.close.title': `Fermer (Échap)`,
      'help.eyebrow': `Aide`,
      'help.h2': `Comment jouer`,
      'help.lead': `Un thérémine à quatre entrées : souris, tactile, clavier de l'ordinateur, MIDI.`,
      'help.h3.mouse': `Souris &amp; tactile`,
      'help.mouse.move.k': `Bouger dans le champ`,
      'help.mouse.move.d': `Hauteur de gauche à droite, timbre du bas vers le haut.`,
      'help.mouse.press.k': `Presser &amp; maintenir`,
      'help.mouse.press.d': `Tenir la note ; glisser = glissando continu.`,
      'help.mouse.force.k': `Force (doigt / stylet)`,
      'help.mouse.force.d': `Ajoute le vibrato.`,
      'help.mouse.hover.k': `Survol`,
      'help.mouse.hover.d': `Le réticule affiche la note qui sonnerait à cet endroit.`,
      'help.mouse.fig.k': `Schéma (bas à droite)`,
      'help.mouse.fig.d': `Attrape la main et déplace-la : horizontale = hauteur, verticale = timbre.`,
      'help.h3.keyboard': `Clavier de l'ordinateur`,
      'help.kb.notes.d': `Les notes, disposées comme un piano.`,
      'help.kb.timbre.d': `Timbre (ouverture du filtre).`,
      'help.kb.octave.d': `Octave – / +.`,
      'help.kb.shift.k': `<kbd>Maj</kbd>`,
      'help.kb.shift.d': `Vibrato, tant que la touche est maintenue.`,
      'help.kb.space.k': `<kbd>Espace</kbd>`,
      'help.kb.space.d': `Mettre sous tension au démarrage.`,
      'help.kb.helpkey.k': `<kbd>?</kbd> · <kbd>Échap</kbd>`,
      'help.kb.helpkey.d': `Ouvrir / fermer cette aide.`,
      'help.h3.midikeys': `Clavier MIDI — entrée « clavier »`,
      'help.midikeys.notes.k': `Touches`,
      'help.midikeys.notes.d': `Jouent la hauteur, en legato monophonique (la dernière note l'emporte).`,
      'help.midikeys.bend.k': `Pitch bend`,
      'help.midikeys.bend.d': `Glissando fluide (± 2 demi-tons).`,
      'help.midikeys.mod.k': `Molette de modulation`,
      'help.midikeys.mod.d': `Profondeur du vibrato.`,
      'help.midikeys.after.k': `Aftertouch`,
      'help.midikeys.after.d': `Profondeur du vibrato (pression sur la touche).`,
      'help.midikeys.sustain.k': `Pédale de sustain`,
      'help.midikeys.sustain.d': `Maintient la note après le relâcher.`,
      'help.midikeys.vel.k': `Vélocité`,
      'help.midikeys.vel.d': `Frappe forte = timbre plus brillant.`,
      'help.h3.midipads': `Pads MIDI — entrée « pads X/Y »`,
      'help.midipads.pad.k': `Un pad`,
      'help.midipads.pad.d': `Un point du champ : colonne = hauteur, ligne = timbre.`,
      'help.midipads.after.k': `Aftertouch (MPD218)`,
      'help.midipads.after.d': `Ajoute le vibrato.`,
      'help.midipads.led.k': `LED`,
      'help.midipads.led.d': `S'allument en halo autour du point joué, en retour sur le contrôleur.`,
      'help.midipads.sel.k': `Sélecteur « Pads »`,
      'help.midipads.sel.d': `Générique ↔ Launchpad, selon la disposition de ton contrôleur.`,
      'help.h3.settings': `Réglages (barre du bas)`,
      'help.settings.wave.d': `Sinus, triangle, dent de scie, carré.`,
      'help.settings.glide.d': `Vitesse du glissé entre deux hauteurs (0 = instantané).`,
      'help.settings.vib.d': `Vitesse de l'oscillation du vibrato.`,
      'help.settings.res.d': `Accent (pic) du filtre.`,
      'help.settings.rev.d': `Quantité d'espace / de réverbération.`,
      'help.settings.scale.d': `Libre (continu, vrai thérémine) ou aimantée à une gamme.`,
      'help.settings.octave.d': `Transposition générale.`,
      'help.h3.controller': `Brancher un contrôleur`,
      'help.controller.browser.k': `Chrome / Edge`,
      'help.controller.browser.d': `Ouvre le fichier téléchargé dans Chrome ou Edge : le MIDI est bloqué dans l'aperçu intégré.`,
      'help.controller.connect.k': `Connecter MIDI`,
      'help.controller.connect.d': `Puis choisis l'entrée « clavier » ou « pads X/Y » selon ton appareil.`,
      'boot.text': `Un thérémine que l'on joue dans un champ.<br>
    <b style="color:var(--cream)">Souris / tactile</b> : bouge dans le champ, la hauteur suit X, le timbre suit Y.<br>
    <b style="color:var(--cream)">Clavier</b> : <kbd>A W S E D F T G Y H U J</kbd> = les notes · <kbd>↑↓</kbd> le timbre · <kbd>Z X</kbd> l'octave · <kbd>Maj</kbd> le vibrato.<br>
    <b style="color:var(--cream)">Clavier MIDI</b> : les touches jouent la hauteur (legato), le pitch bend glisse, la molette de modulation fait le vibrato.<br>
    <b style="color:var(--cream)">Pads</b> : passe l'entrée sur « pads X/Y » ; l'aftertouch (MPD218) fait le vibrato, et le contrôleur s'allume en retour.`,
      'boot.go': `Mettre sous tension`,
      'boot.footer': `Aide &amp; raccourcis à tout moment : touche <kbd>?</kbd> ou le bouton <b style="color:var(--field-hi)">?</b> en haut à droite.`,
      noteNames: ['Do','Do#','Ré','Ré#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'],
    },
    en: {
      'topbar.eyebrow': `X/Y field · continuous wave`,
      'topbar.sub': `Sweep the field: left→right for pitch, bottom→top for timbre. Press for vibrato.`,
      'readout.freq.label': `frequency`,
      'readout.cut.label': `timbre`,
      'readout.vib.label': `vibrato`,
      'midi.select.input.title': `How MIDI input is interpreted`,
      'midi.select.input.keys': `Input: keyboard`,
      'midi.select.input.pads': `Input: X/Y pads`,
      'midi.select.map.title': `Pad mapping`,
      'midi.select.map.generic': `Pads: generic`,
      'midi.select.map.launchpad': `Pads: Launchpad`,
      'midi.button': `Connect MIDI`,
      'midi.status.disconnected': `MIDI not connected`,
      'midi.status.unavailable': `Web MIDI unavailable here`,
      'midi.status.denied': `MIDI access denied`,
      'midi.status.connected': `MIDI connected`,
      'midi.status.inputsCount': (n) => `${n} input${n>1?'s':''}`,
      'help.btn.title': `Help & shortcuts (?)`,
      'lang.btn.title': `Language / Langue`,
      'panel.wave.label': `Wave`,
      'panel.wave.sine': `Sine`,
      'panel.wave.triangle': `Tri`,
      'panel.wave.sawtooth': `Saw`,
      'panel.wave.square': `Square`,
      'panel.glide.label': `Glide`,
      'panel.vib.label': `Vibrato Hz`,
      'panel.res.label': `Resonance`,
      'panel.rev.label': `Reverb`,
      'panel.scale.label': `Scale`,
      'panel.scale.libre': `Free`,
      'panel.scale.penta': `Penta`,
      'panel.scale.majeur': `Major`,
      'panel.scale.chroma': `Chroma`,
      'panel.octave.label': `Octave`,
      'fig.head': `Diagram · playable`,
      'fig.caption': `Grab the hand: horizontal = pitch, vertical = timbre.`,
      'fig.svg.volume': `VOLUME`,
      'fig.svg.pitch': `PITCH`,
      'fig.close.title': `Hide diagram`,
      'help.close.title': `Close (Esc)`,
      'help.eyebrow': `Help`,
      'help.h2': `How to play`,
      'help.lead': `A theremin with four input methods: mouse, touch, computer keyboard, MIDI.`,
      'help.h3.mouse': `Mouse &amp; touch`,
      'help.mouse.move.k': `Move in the field`,
      'help.mouse.move.d': `Pitch left to right, timbre bottom to top.`,
      'help.mouse.press.k': `Press &amp; hold`,
      'help.mouse.press.d': `Hold the note; drag for continuous glissando.`,
      'help.mouse.force.k': `Force (finger / stylus)`,
      'help.mouse.force.d': `Adds vibrato.`,
      'help.mouse.hover.k': `Hover`,
      'help.mouse.hover.d': `The reticle previews the note that would sound at that spot.`,
      'help.mouse.fig.k': `Diagram (bottom-right)`,
      'help.mouse.fig.d': `Grab the hand and move it: horizontal = pitch, vertical = timbre.`,
      'help.h3.keyboard': `Computer keyboard`,
      'help.kb.notes.d': `Notes, laid out like a piano.`,
      'help.kb.timbre.d': `Timbre (filter opening).`,
      'help.kb.octave.d': `Octave – / +.`,
      'help.kb.shift.k': `<kbd>Shift</kbd>`,
      'help.kb.shift.d': `Vibrato, while the key is held.`,
      'help.kb.space.k': `<kbd>Space</kbd>`,
      'help.kb.space.d': `Power on at boot.`,
      'help.kb.helpkey.k': `<kbd>?</kbd> · <kbd>Esc</kbd>`,
      'help.kb.helpkey.d': `Open / close this help panel.`,
      'help.h3.midikeys': `MIDI keyboard — "keys" input`,
      'help.midikeys.notes.k': `Keys`,
      'help.midikeys.notes.d': `Play pitch, in monophonic legato (the last note wins).`,
      'help.midikeys.bend.k': `Pitch bend`,
      'help.midikeys.bend.d': `Smooth glissando (± 2 semitones).`,
      'help.midikeys.mod.k': `Mod wheel`,
      'help.midikeys.mod.d': `Vibrato depth.`,
      'help.midikeys.after.k': `Aftertouch`,
      'help.midikeys.after.d': `Vibrato depth (pressure on the key).`,
      'help.midikeys.sustain.k': `Sustain pedal`,
      'help.midikeys.sustain.d': `Holds the note after release.`,
      'help.midikeys.vel.k': `Velocity`,
      'help.midikeys.vel.d': `Hard hit = brighter timbre.`,
      'help.h3.midipads': `MIDI pads — "X/Y pads" input`,
      'help.midipads.pad.k': `A pad`,
      'help.midipads.pad.d': `A point on the field: column = pitch, row = timbre.`,
      'help.midipads.after.k': `Aftertouch (MPD218)`,
      'help.midipads.after.d': `Adds vibrato.`,
      'help.midipads.led.k': `LED`,
      'help.midipads.led.d': `Light up in a halo around the played point, echoed back to the controller.`,
      'help.midipads.sel.k': `"Pads" selector`,
      'help.midipads.sel.d': `Generic ↔ Launchpad, depending on your controller's layout.`,
      'help.h3.settings': `Settings (bottom bar)`,
      'help.settings.wave.d': `Sine, triangle, sawtooth, square.`,
      'help.settings.glide.d': `Glide speed between two pitches (0 = instant).`,
      'help.settings.vib.d': `Speed of the vibrato oscillation.`,
      'help.settings.res.d': `Filter resonance (peak).`,
      'help.settings.rev.d': `Amount of space / reverberation.`,
      'help.settings.scale.d': `Free (continuous, true theremin) or snapped to a scale.`,
      'help.settings.octave.d': `Overall transposition.`,
      'help.h3.controller': `Connecting a controller`,
      'help.controller.browser.k': `Chrome / Edge`,
      'help.controller.browser.d': `Open the downloaded file in Chrome or Edge: MIDI is blocked in embedded previews.`,
      'help.controller.connect.k': `Connect MIDI`,
      'help.controller.connect.d': `Then pick "keyboard" or "X/Y pads" input to match your device.`,
      'boot.text': `A theremin played across a field.<br>
    <b style="color:var(--cream)">Mouse / touch</b>: move in the field, pitch follows X, timbre follows Y.<br>
    <b style="color:var(--cream)">Keyboard</b>: <kbd>A W S E D F T G Y H U J</kbd> = notes · <kbd>↑↓</kbd> timbre · <kbd>Z X</kbd> octave · <kbd>Shift</kbd> vibrato.<br>
    <b style="color:var(--cream)">MIDI keyboard</b>: keys play pitch (legato), pitch bend glides, the mod wheel adds vibrato.<br>
    <b style="color:var(--cream)">Pads</b>: switch input to "X/Y pads"; aftertouch (MPD218) adds vibrato, and the controller lights up in return.`,
      'boot.go': `Power on`,
      'boot.footer': `Help &amp; shortcuts any time: press <kbd>?</kbd> or the <b style="color:var(--field-hi)">?</b> button top-right.`,
      noteNames: ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],
    },
  };

  let lang = 'fr';

  function detectLang(){
    const raw = (navigator.language || (navigator.languages && navigator.languages[0]) || 'en').toLowerCase();
    return raw.startsWith('fr') ? 'fr' : 'en';
  }

  Th.t = function(key, vars){
    const entry = (TR[lang] && TR[lang][key] !== undefined) ? TR[lang][key] : (TR.fr[key] || key);
    return typeof entry === 'function' ? entry(vars) : entry;
  };
  Th.getLang = function(){ return lang; };

  function applyLanguage(next){
    lang = next;
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent = Th.t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-html]').forEach(el=>{ el.innerHTML = Th.t(el.getAttribute('data-i18n-html')); });
    document.querySelectorAll('[data-i18n-title]').forEach(el=>{ el.title = Th.t(el.getAttribute('data-i18n-title')); });
    const names = TR[lang].noteNames;
    Th.NAMES.splice(0, Th.NAMES.length, ...names);   // in-place mutation: preserves the reference used by noteName()
    const langBtn = Th.$('langBtn');
    if(langBtn) langBtn.textContent = lang === 'fr' ? 'EN' : 'FR';
  }
  Th.applyLanguage = applyLanguage;

  const stored = localStorage.getItem(STORAGE_KEY);
  applyLanguage(stored === 'fr' || stored === 'en' ? stored : detectLang());

  const langBtn = Th.$('langBtn');
  if(langBtn){
    langBtn.addEventListener('click', ()=>{
      const next = lang === 'fr' ? 'en' : 'fr';
      localStorage.setItem(STORAGE_KEY, next);
      applyLanguage(next);
    });
  }
})(window.Th);
