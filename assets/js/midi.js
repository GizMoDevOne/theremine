"use strict";
/* ============================================================================
   MIDI — legato keyboard, X/Y pads, pitch bend, aftertouch, LED feedback
   ==========================================================================*/
(function(Th){
  const $=Th.$, N=Th.N, V=Th.V, Input=Th.Input, posForNote=Th.posForNote, BEND_RANGE=Th.BEND_RANGE;

  let MIDI=null, midiOut=null;

  Th.initMIDIControls = function(){
    if($('mapSel')) $('mapSel').onchange=e=>Input.layout=e.target.value;
    if($('inSel')) $('inSel').onchange=e=>Input.inputMode=e.target.value;
    // start() already connects on power-on; the button is for a controller plugged in
    // afterwards, or for retrying once a refused permission has been granted
    if($('midiBtn')) $('midiBtn').onclick=connectMIDI;
  };

  async function connectMIDI(){
    if(!navigator.requestMIDIAccess){ setMidi(false,Th.t('midi.status.unavailable')); return; }
    try{ MIDI=await navigator.requestMIDIAccess({sysex:false}); hookIn(); pickOut();
         MIDI.onstatechange=()=>{hookIn();pickOut();}; }
    catch(err){ setMidi(false,Th.t('midi.status.denied')); }
  }
  Th.connectMIDI = connectMIDI;

  function hookIn(){ if(!MIDI)return; let n=0; for(const i of MIDI.inputs.values()){i.onmidimessage=onMIDI;n++;}
    if(n) setMidi(true, midiOut?midiOut.name:Th.t('midi.status.inputsCount',n)); }
  function pickOut(){ if(!MIDI)return; midiOut=null; for(const o of MIDI.outputs.values()){midiOut=o;break;}
    if(MIDI.inputs.size||midiOut) setMidi(true, midiOut?midiOut.name:Th.t('midi.status.connected')); }

  function applyKbdPitch(){ if(Input.kbdNote!=null) V.tx=posForNote(Input.kbdNote+Input.bendSemi); }

  function onMIDI(e){ const [st,d1,d2]=e.data, cmd=st&0xf0;
    if(cmd===0x90&&d2>0){ Th.demoInterrupt(); Th.initAudio();
      if(Input.inputMode==='pads'){ const cp=cellForNote(d1); if(cp){ Input.activeNote=d1;
          V.tx=cp.c/(N-1); V.ty=(N-1-cp.r)/(N-1); Th.startVoice(); } }
      else { // MIDI keyboard: note -> pitch, monophonic legato, velocity -> timbre
        Input.heldNotes=Input.heldNotes.filter(x=>x!==d1); Input.heldNotes.push(d1);
        Input.kbdNote=d1; V.ty=0.32+(d2/127)*0.55; applyKbdPitch(); Th.startVoice(); }
    }
    else if(cmd===0x80 || (cmd===0x90&&d2===0)){
      if(Input.inputMode==='pads'){ if(d1===Input.activeNote){ Input.activeNote=null; if(!Input.pointerDown&&!Input.keysDown.size) Th.stopVoice(); } }
      else { Input.heldNotes=Input.heldNotes.filter(x=>x!==d1);
        if(Input.heldNotes.length){ Input.kbdNote=Input.heldNotes[Input.heldNotes.length-1]; applyKbdPitch(); }        // legato: fall back to the held note
        else if(!Input.sustainOn){ Input.kbdNote=null; if(!Input.pointerDown&&!Input.keysDown.size) Th.stopVoice(); } }
    }
    else if(cmd===0xE0){ Input.bendSemi=(((d2<<7|d1)-8192)/8192)*BEND_RANGE; applyKbdPitch(); }        // pitch bend -> glissando
    else if(cmd===0xA0){ if(d1===Input.activeNote||Input.inputMode==='keys') V.pressure=d2/127; }           // polyphonic aftertouch
    else if(cmd===0xD0){ V.pressure=d1/127; }                                                    // channel pressure
    else if(cmd===0xB0){
      if(d1===1) V.pressure=d2/127;                                                              // mod wheel -> vibrato
      else if(d1===64){ Input.sustainOn=d2>=64;                                                   // sustain pedal
        if(!Input.sustainOn&&!Input.heldNotes.length){ Input.kbdNote=null; if(!Input.pointerDown&&!Input.keysDown.size) Th.stopVoice(); } }
    }
  }
  function setMidi(on,txt){ $('midiDot').classList.toggle('on',on); $('midiTxt').textContent=txt; }

  /* -- pad <-> grid cell mapping (LED) -- */
  function padNote(r,c){ if(Input.layout==='launchpad'){ const rb=N-1-r; return 11+rb*10+c; } return 36+r*N+c; }
  function cellForNote(note){
    if(Input.layout==='launchpad'){ const rb=Math.floor(note/10)-1, c=(note%10)-1;
      if(rb>=0&&rb<N&&c>=0&&c<N) return {r:N-1-rb,c}; }
    else { const n=note-36; if(n>=0&&n<N*N) return {r:Math.floor(n/N),c:n%N}; }
    const m=note%(N*N); return {r:Math.floor(m/N),c:m%N};
  }
  /* light field: pads near the cursor light up */
  const lastLED=new Int16Array(N*N).fill(-1);
  Th.updateLEDs = function(){
    if(!midiOut||!V.active){ if(!V.active) clearLEDs(); return; }
    const gx=V.cx*(N-1), gyRow=(1-V.cy)*(N-1);   // column, row
    for(let r=0;r<N;r++)for(let c=0;c<N;c++){
      const d=Math.hypot(c-gx,r-gyRow), b=Math.max(0,1-d/2.2);
      let val=0;
      if(b>0.02){ val= Input.layout==='launchpad' ? (b>0.6?9:b>0.3?60:105) : Math.round(b*b*127); }
      const idx=r*N+c;
      if(val!==lastLED[idx]){ lastLED[idx]=val;
        try{ midiOut.send(val>0?[0x90,padNote(r,c),val]:[0x80,padNote(r,c),0]); }catch(e){} }
    }
  };
  function clearLEDs(){ if(!midiOut)return;
    for(let i=0;i<N*N;i++){ if(lastLED[i]!==0){ lastLED[i]=0; const r=(i/N)|0,c=i%N;
      try{midiOut.send([0x80,padNote(r,c),0]);}catch(e){} } } }
})(window.Th);
