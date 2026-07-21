"use strict";
/* ============================================================================
   DEMO — hands-free playback of short, well-known melodies.
   The player drives the shared voice (V.tx / V.ty / V.pressure + start/stop)
   exactly like a hand would, so the field pads, cursor, oscilloscope, SVG
   diagram and MIDI LEDs all react on their own — no dedicated visuals here.
   ==========================================================================*/
(function(Th){
  const $=Th.$, V=Th.V, Input=Th.Input, posForNote=Th.posForNote;

  /* Each note is [midi pitch | null for a rest, duration in beats, optional timbre 0..1].
     Melodies stay within C2..C6 (36..84) so the cursor sweeps the whole field.
     'rush' is an optional tempo multiplier reached on the last note (accelerando). */
  const SONGS = {
    /* ---- science fiction ---- */
    ce3k: { bpm:104, wave:'sine', glide:0.16, res:6, reverb:0.55, notes:[
      [62,0.5],[64,0.5],[60,0.75],[48,1],[55,2.25],[null,0.75],
      [62,0.5],[64,0.5],[60,0.75],[48,1],[55,3],
    ]},
    startrek: { bpm:80, wave:'sine', glide:0.13, res:5, reverb:0.6, notes:[
      [65,0.5],[72,1.5],[70,0.5],[69,0.5],[67,0.5],[65,0.5],[67,2],[null,0.5],
      [65,0.5],[74,1.5],[72,0.5],[70,0.5],[69,0.5],[67,0.5],[65,2.5],
    ]},
    xfiles: { bpm:92, wave:'sine', glide:0.09, res:5, reverb:0.62, notes:[
      [71,0.5],[74,0.5],[71,0.5],[78,2.5],[null,0.5],
      [71,0.5],[74,0.5],[71,0.5],[76,2.5],[null,0.5],
      [71,0.5],[74,0.5],[71,0.5],[78,1],[81,3.5],
    ]},
    bladerunner: { bpm:56, wave:'sawtooth', glide:0.26, res:5, reverb:0.72, notes:[
      [62,4],[69,3],[65,1],[64,4],[60,2],[62,5],
      [null,0.5],[57,2],[62,3],[65,4],[62,4],
    ]},
    /* ---- film & tv ---- */
    imperial: { bpm:104, wave:'sawtooth', glide:0.05, res:9, reverb:0.3, notes:[
      [67,1],[67,1],[67,1],[63,0.75],[70,0.25],
      [67,1],[63,0.75],[70,0.25],[67,2],[null,0.5],
      [74,1],[74,1],[74,1],[75,0.75],[70,0.25],
      [66,1],[63,0.75],[70,0.25],[67,2.5],
    ]},
    zara: { bpm:56, wave:'triangle', glide:0.24, res:4, reverb:0.68, notes:[
      [48,1.5],[55,1.5],[60,2.5],[64,2],[63,2],[null,0.75],
      [48,1.5],[55,1.5],[60,2.5],[63,2],[64,3],
    ]},
    jaws: { bpm:66, rush:3.6, wave:'sawtooth', glide:0.02, res:11, reverb:0.35, notes:[
      [40,1,0.15],[41,1,0.15],[40,1,0.15],[41,1,0.15],
      [40,1,0.18],[41,1,0.18],[40,1,0.18],[41,1,0.18],
      [40,1,0.22],[41,1,0.22],[40,1,0.22],[41,1,0.22],
      [40,1,0.28],[41,1,0.28],[40,1,0.28],[41,1,0.28],
      [40,1,0.35],[41,1,0.35],[40,1,0.35],[41,1,0.35],
      [52,2,0.7],
    ]},
    shire: { bpm:96, wave:'sine', glide:0.07, res:4, reverb:0.5, notes:[
      [65,0.5],[67,0.5],[69,1.5],[65,0.5],[69,0.5],[72,0.5],[74,2],
      [72,0.5],[69,0.5],[67,1],[65,1.5],[null,0.5],
      [65,0.5],[67,0.5],[69,1],[72,1],[69,0.5],[67,0.5],[65,3],
    ]},
    got: { bpm:92, wave:'sawtooth', glide:0.04, res:8, reverb:0.45, notes:[
      [67,0.5],[72,0.5],[75,0.25],[77,0.25],[67,0.5],[72,0.5],[75,0.25],[77,0.25],
      [67,0.5],[72,0.5],[75,0.25],[77,0.25],[67,0.5],[72,0.5],[75,0.25],[77,0.25],
      [67,0.5],[72,0.5],[76,0.25],[77,0.25],[67,0.5],[72,0.5],[76,0.25],[77,0.25],
      [79,1],[80,0.5],[79,0.5],[77,1],[75,1],[72,2.5],
    ]},
    /* ---- video games ---- */
    tetris: { bpm:150, wave:'square', glide:0.03, res:7, reverb:0.25, notes:[
      [76,1],[71,0.5],[72,0.5],[74,1],[72,0.5],[71,0.5],
      [69,1],[69,0.5],[72,0.5],[76,1],[74,0.5],[72,0.5],
      [71,1.5],[72,0.5],[74,1],[76,1],[72,1],[69,1],[69,2],
    ]},
    zelda: { bpm:112, wave:'square', glide:0.04, res:7, reverb:0.35, notes:[
      [70,2.5],[65,0.5],[70,1],[70,0.25],[70,0.25],[70,0.25],[70,0.25],
      [72,0.5],[74,0.5],[75,0.5],[77,2],
      [77,0.5],[79,0.5],[77,0.5],[75,0.5],[74,1],[70,1],[72,0.5],[74,0.5],[75,2.5],
    ]},
    halo: { bpm:64, wave:'sine', glide:0.15, res:4, reverb:0.72, notes:[
      [69,2],[72,1],[71,1],[69,2],[67,1],[69,1],[64,3],[null,0.5],
      [69,2],[72,1],[74,1],[72,2],[71,1],[69,1],[67,3.5],
    ]},
    /* ---- classical & theremin repertoire ---- */
    cygne: { bpm:60, wave:'sine', glide:0.18, res:4, reverb:0.65, notes:[
      [74,0.5],[79,2],[78,0.5],[76,0.5],[74,1.5],[71,1],
      [74,0.5],[76,2],[74,0.5],[71,0.5],[69,1.5],[67,2.5],[null,0.5],
      [71,0.5],[74,1],[78,2],[76,0.5],[74,0.5],[71,1],[67,3.5],
    ]},
    macabre: { bpm:132, wave:'sawtooth', glide:0.04, res:10, reverb:0.4, notes:[
      [74,0.5],[69,0.5],[74,0.5],[69,0.5],[77,1],[76,1],[74,2],
      [73,0.5],[69,0.5],[73,0.5],[69,0.5],[76,1],[74,1],[73,2],
      [74,0.5],[69,0.5],[74,0.5],[69,0.5],[77,1],[79,1],[81,2.5],
    ]},
    mountainking: { bpm:78, rush:2.6, wave:'triangle', glide:0.03, res:8, reverb:0.35, notes:[
      [59,0.5],[61,0.5],[62,0.5],[64,0.5],[66,0.5],[62,0.5],[66,1],
      [65,0.5],[61,0.5],[65,1],[64,0.5],[61,0.5],[64,1],
      [59,0.5],[61,0.5],[62,0.5],[64,0.5],[66,0.5],[62,0.5],[66,1],
      [65,0.5],[61,0.5],[65,1],[64,2],
      [71,0.5],[73,0.5],[74,0.5],[76,0.5],[78,0.5],[74,0.5],[78,1],
      [77,0.5],[73,0.5],[77,1],[76,0.5],[73,0.5],[76,1],
      [71,0.5],[73,0.5],[74,0.5],[76,0.5],[78,0.5],[74,0.5],[78,1],[76,2.5],
    ]},
    diesirae: { bpm:88, wave:'triangle', glide:0.09, res:6, reverb:0.68, notes:[
      [65,1],[64,1],[65,1],[62,1],[64,1],[60,1],[62,2],
      [62,1],[64,1],[65,1],[64,1],[62,1],[60,1],[62,2],
      [62,1],[65,1],[64,1],[62,1],[64,1],[62,1],[60,1],[62,3],
    ]},
    hedwig: { bpm:98, wave:'triangle', glide:0.11, res:6, reverb:0.5, notes:[
      [71,0.5],[76,0.75],[79,0.25],[78,0.5],[76,1],[83,0.5],[81,1.5],[78,1.5],
      [76,0.75],[79,0.25],[78,0.5],[75,1],[77,0.5],[71,2],
    ]},
  };
  const ORDER = ['ce3k','startrek','xfiles','bladerunner','zara',
                 'imperial','jaws','shire','got','hedwig',
                 'tetris','zelda','halo',
                 'cygne','macabre','mountainking','diesirae'];

  const RETRIGGER = 0.05;   // silence before re-attacking a repeated pitch (seconds)

  let song=null, songId=null, idx=0, noteT=0, vib=0, saved=null;

  /* ---------------------------- playback ---------------------------- */
  function beat(){
    // accelerando: 'rush' is the tempo multiplier reached on the last note
    const k = song.rush ? 1+(song.rush-1)*(idx/Math.max(1,song.notes.length-1)) : 1;
    return 60/(song.bpm*k);
  }
  function noteDur(i){ return song.notes[i][1]*beat(); }

  function applyNote(){
    const [pitch,,timbre]=song.notes[idx];
    if(pitch==null) return;                                   // rest: keep the last position
    V.tx=posForNote(pitch);
    V.ty=timbre!==undefined ? timbre : 0.40+0.40*posForNote(pitch);   // higher note, brighter timbre
  }

  /* voice gating: silence on rests, brief cut before a repeated pitch so it re-attacks */
  function gate(){
    const pitch=song.notes[idx][0];
    const prev=idx>0 ? song.notes[idx-1][0] : null;
    const mute = pitch==null || (pitch===prev && noteT<RETRIGGER);
    if(mute){ if(V.active) Th.stopVoice(); }
    else if(!V.active) Th.startVoice();
  }

  Th.demoTick = function(dt){
    if(!song) return;
    noteT+=dt;
    let guard=0;
    while(song && noteT>=noteDur(idx) && guard++<16){
      noteT-=noteDur(idx); idx++;
      if(idx>=song.notes.length){ Th.demoStop(); return; }
      applyNote();
    }
    gate();
    // vibrato swells in on the longer notes, and fades on rests
    const [pitch,beats]=song.notes[idx];
    const target = pitch==null ? 0 : Math.min(0.75, beats*0.5);
    vib += (target-vib)*Math.min(1,dt*4);
    V.pressure = vib;
  };

  Th.demoPlay = function(id){
    const s=SONGS[id]; if(!s) return;
    if(!Input.boot) Th.powerOn(); else Th.initAudio();
    if(!saved) saved=Th.snapshotParams();              // first track only: remember the user's settings
    song=s; songId=id; idx=0; noteT=0; vib=0;
    // 'libre' is required: any snapped scale would bend the melody out of tune,
    // and octave 0 keeps the written pitches exact
    Th.setParams({wave:s.wave, glide:s.glide, res:s.res, reverb:s.reverb, scale:'libre', octave:0});
    applyNote(); gate();
    markRow(); setBtn(true); setNowPlaying(id);
  };

  function stop(){
    if(!song) return;
    song=null; songId=null; vib=0; V.pressure=0;
    if(Th.noActiveSource()) Th.stopVoice();
    if(saved){ Th.setParams(saved); saved=null; }
    markRow(); setBtn(false); setNowPlaying(null);
  }
  Th.demoStop = stop;
  Th.demoInterrupt = stop;                             // no-op when idle: the manual input paths call it blindly

  /* ------------------------------- panel ------------------------------- */
  const demoOpen = Th.demoOpen = () => { const p=$('demo'); return !!p && p.classList.contains('open'); };
  function openDemo(){ Th.openSheet('demo'); }
  function closeDemo(){ Th.closeSheet('demo'); }
  Th.closeDemo = closeDemo;

  function markRow(){
    document.querySelectorAll('.demorow').forEach(r=>r.classList.toggle('active', r.dataset.song===songId));
  }
  /* track name shown just above the field while a track plays */
  function setNowPlaying(id){
    const el=$('nowPlaying'); if(!el) return;
    if(!id){ el.classList.remove('on'); el.removeAttribute('data-i18n'); el.textContent=''; return; }
    const key='demo.track.'+id+'.title';
    el.setAttribute('data-i18n',key);        // so applyLanguage() retranslates it on a language switch
    el.textContent=Th.t(key);
    el.classList.add('on');
  }
  function setBtn(playing){
    const b=$('demoBtn'); if(!b) return;
    b.textContent = playing ? '⏹' : '▶';
    b.classList.toggle('playing', playing);
    const key = playing ? 'demo.btn.stop.title' : 'demo.btn.title';
    b.setAttribute('data-i18n-title', key);            // kept in sync when the language changes
    b.title = Th.t(key);
  }

  Th.initDemo = function(){
    const btn=$('demoBtn'), panel=$('demo'), list=$('demoList'), close=$('demoClose'), bootLink=$('bootDemo');
    if(btn) btn.addEventListener('click',()=>{ song ? stop() : openDemo(); });
    if(close) close.addEventListener('click',closeDemo);
    if(panel) panel.addEventListener('click',e=>{ if(e.target.id==='demo') closeDemo(); });
    if(list) list.addEventListener('click',e=>{
      const row=e.target.closest('.demorow'); if(!row) return;
      Th.demoPlay(row.dataset.song); closeDemo();
    });
    if(bootLink) bootLink.addEventListener('click',e=>{ e.stopPropagation(); Th.demoPlay(ORDER[0]); });
  };
})(window.Th);
