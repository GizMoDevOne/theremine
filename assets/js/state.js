"use strict";
/* ============================================================================
   SHARED STATE — constants, params, voice, mappings, input flags
   Everything shared across files (audio/input/midi/render/ui/main) lives on
   the global Th object: loaded first via a classic <script> tag (no ES
   modules, so the page stays openable via file:// without a server).
   ==========================================================================*/
window.Th = window.Th || {};
(function(Th){
  const N = Th.N = 8;

  /* ---- params ---- */
  const P = Th.P = { wave:'sine', glide:0.08, vibRate:6.0, res:4.0, reverb:0.35, scale:'libre', octave:0 };
  const FMIN = Th.FMIN = 65.41, FMAX = Th.FMAX = 1046.5;          // C2..C6, ~4 octaves
  const CMIN = Th.CMIN = 180,   CMAX = Th.CMAX = 9000;            // filter range
  const BEND_RANGE = Th.BEND_RANGE = 2;                            // pitch bend semitones
  const NAMES = Th.NAMES = ['Do','Do#','Ré','Ré#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'];
  const SCALES = Th.SCALES = { libre:null, penta:[0,2,4,7,9], majeur:[0,2,4,5,7,9,11], chroma:[0,1,2,3,4,5,6,7,8,9,10,11] };

  /* ---- voice (monophonic, theremin-style) ---- */
  const V = Th.V = { active:false, tx:0.5, ty:0.5, cx:0.5, cy:0.5, pressure:0, freq:220, cut:1200 };
  const Motion = Th.Motion = { lfoPhase:0 };

  /* ---- input flags shared across mouse/touch, computer keyboard, MIDI and the SVG diagram ---- */
  const Input = Th.Input = {
    pointerDown:false,
    keysDown:new Set(),
    shiftVib:false,
    kbCut:0.55,
    activeNote:null,        // pads MIDI mode
    inputMode:'keys',       // 'keys' (MIDI keyboard) | 'pads' (X/Y grid)
    layout:'generic',       // pad mapping: 'generic' | 'launchpad'
    heldNotes:[],
    kbdNote:null,
    bendSemi:0,
    sustainOn:false,
    handDrag:false,
    handN:0,
    boot:false,
    figClosedByUser:false,  // playable diagram manually hidden (close button)
  };

  Th.noActiveSource = function(){
    return !Input.pointerDown && !Input.keysDown.size && Input.activeNote==null &&
      Input.kbdNote==null && !Input.handDrag;
  };

  /* ---- canvas geometry (rectangular field), computed by render.resize(), read by input.fieldXY() ---- */
  Th.Geo = { W:0, H:0, DPR:1, sideW:0, sideH:0, ox:0, oy:0, cellW:0, cellH:0 };

  const $ = Th.$ = id => document.getElementById(id);
  const clamp01 = Th.clamp01 = v => v<0?0:v>1?1:v;

  /* ============================ MAPPINGS ============================ */
  function freqFromX(x){ let f=FMIN*Math.pow(FMAX/FMIN, clamp01(x)) * Math.pow(2,P.octave); return snap(f); }
  function xFromFreq(f){ f/=Math.pow(2,P.octave); return clamp01(Math.log(f/FMIN)/Math.log(FMAX/FMIN)); }
  function cutFromY(y){ return CMIN*Math.pow(CMAX/CMIN, clamp01(y)); }
  function snap(f){ const sc=SCALES[P.scale]; if(!sc) return f;
    let midi=69+12*Math.log2(f/440), base=Math.round(midi), best=base, bd=99;
    for(let d=-2;d<=2;d++){ const m=base+d, pc=((m%12)+12)%12; if(sc.includes(pc)&&Math.abs(m-midi)<bd){bd=Math.abs(m-midi);best=m;} }
    return 440*Math.pow(2,(best-69)/12);
  }
  function noteName(f){ const m=Math.round(69+12*Math.log2(f/440)); return NAMES[((m%12)+12)%12]+(Math.floor(m/12)-1); }
  function posForNote(n){ const f=440*Math.pow(2,(n-69)/12); return clamp01(Math.log(f/FMIN)/Math.log(FMAX/FMIN)); }

  Th.freqFromX = freqFromX;
  Th.xFromFreq = xFromFreq;
  Th.cutFromY = cutFromY;
  Th.snap = snap;
  Th.noteName = noteName;
  Th.posForNote = posForNote;
})(window.Th);
