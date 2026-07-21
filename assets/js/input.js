"use strict";
/* ============================================================================
   INPUT — mouse/touch field, computer keyboard, voice lifecycle
   ==========================================================================*/
(function(Th){
  const $=Th.$, V=Th.V, P=Th.P, Input=Th.Input, Geo=Th.Geo, clamp01=Th.clamp01, posForNote=Th.posForNote;
  const cvs = $('stage');

  /* -- mouse / touch field -- */
  const hover = Th.hover = { x:0, y:0, on:false, inside:false, fx:0.5, fy:0.5 };

  function fieldXY(e){ const r=cvs.getBoundingClientRect(), t=e.touches?e.touches[0]:e;
    const px=(t.clientX-r.left-Geo.ox)/Geo.sideW, py=(t.clientY-r.top-Geo.oy)/Geo.sideH;
    return { x:clamp01(px), y:clamp01(1-py), inside:px>=-0.02&&px<=1.02&&py>=-0.02&&py<=1.02,
             force:(e.pointerType&&e.pointerType!=='mouse')?(e.pressure||0):0 }; }

  function updateHover(e){ const r=cvs.getBoundingClientRect(), p=fieldXY(e);
    hover.x=e.clientX-r.left; hover.y=e.clientY-r.top; hover.on=true; hover.inside=p.inside; hover.fx=p.x; hover.fy=p.y; return p; }

  /* ---- voice lifecycle ---- */
  function startVoice(){ if(!V.active){ V.active=true; Th.audioActivate(true);
    // avoid a glide from the old position on (re)start
    if(!Input.pointerDown){ V.cx=V.tx; V.cy=V.ty; } } }
  function stopVoice(){ V.active=false; Th.audioActivate(false); }
  Th.startVoice = startVoice;
  Th.stopVoice = stopVoice;

  /* a key or a button held when the page loses focus never gets its keyup/pointerup:
     drop every local source, but leave MIDI and the webcam playing — they keep sending
     while the tab is in the background, and cutting them would be wrong */
  function releaseAll(){
    Input.keysDown.clear(); Input.shiftVib=false; Input.pointerDown=false;
    if(Th.noActiveSource()){ V.pressure=0; stopVoice(); }
  }

  Th.initPointerInput = function(){
    cvs.addEventListener('pointerdown',e=>{ Th.demoInterrupt(); Th.initAudio(); const p=updateHover(e); if(!p.inside) return;
      Input.pointerDown=true; V.tx=p.x; V.ty=p.y; startVoice(); });
    cvs.addEventListener('pointermove',e=>{ const p=updateHover(e);
      if(Input.pointerDown&&p.inside){ V.tx=p.x; V.ty=p.y; if(p.force>0) V.pressure=p.force; } });
    cvs.addEventListener('pointerenter',e=>updateHover(e));
    addEventListener('pointerup',()=>{ Input.pointerDown=false; if(!Input.keysDown.size) stopVoice(); if(!Input.shiftVib) V.pressure=0; });
    // pointercancel too: on touch a system gesture aborts the stroke without a pointerup
    function leave(){ hover.on=false; if(Input.pointerDown){Input.pointerDown=false; if(!Input.keysDown.size) stopVoice();} }
    cvs.addEventListener('pointerleave',leave);
    cvs.addEventListener('pointercancel',leave);
  };

  /* -- computer keyboard -- */
  const KEYMAP = {KeyA:0,KeyW:1,KeyS:2,KeyE:3,KeyD:4,KeyF:5,KeyT:6,KeyG:7,KeyY:8,KeyH:9,KeyU:10,KeyJ:11,KeyK:12};

  function playKeyboard(){
    const codes=[...Input.keysDown]; const semi=KEYMAP[codes[codes.length-1]];  // last key
    V.tx=posForNote(48+semi); V.ty=Input.kbCut; startVoice();                   // 48 = C3 on A ; octave transposes via freqFromX
  }

  const isTyping = t => !!t && (t.tagName==='SELECT'||t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable);

  Th.initKeyboardInput = function(onStart){
    addEventListener('blur',releaseAll);
    document.addEventListener('visibilitychange',()=>{ if(document.hidden) releaseAll(); });
    addEventListener('keydown',e=>{
      if(e.repeat) return;
      // Ctrl+S and friends land on note keys: the dialog then steals the focus and the
      // keyup never arrives, leaving the note droning. Same for typing in a select/slider.
      if(e.ctrlKey||e.metaKey||e.altKey||isTyping(e.target)) return;
      if(e.key==='?'){ e.preventDefault(); Th.toggleHelp(); return; }
      if(e.code==='Escape'){ Th.closeHelp(); Th.closeDemo(); return; }
      if(Th.helpOpen()||Th.demoOpen()) return;        // a panel is open: don't intercept gameplay keys
      if(!Input.boot && e.code==='Space'){ e.preventDefault(); onStart(); return; }
      if(e.code==='ShiftLeft'||e.code==='ShiftRight'){ Input.shiftVib=true; V.pressure=1; return; }
      if(e.code==='ArrowUp'){ Input.kbCut=clamp01(Input.kbCut+0.08); V.ty=Input.kbCut; return; }
      if(e.code==='ArrowDown'){ Input.kbCut=clamp01(Input.kbCut-0.08); V.ty=Input.kbCut; return; }
      if(e.code==='KeyZ'){ Th.setOctave(P.octave-1); return; }
      if(e.code==='KeyX'){ Th.setOctave(P.octave+1); return; }
      if(e.code in KEYMAP){ Th.demoInterrupt(); Th.initAudio(); Input.keysDown.add(e.code); playKeyboard(); }
    });
    addEventListener('keyup',e=>{
      if(e.code==='ShiftLeft'||e.code==='ShiftRight'){ Input.shiftVib=false; if(!Input.pointerDown) V.pressure=0; }
      if(e.code in KEYMAP){ Input.keysDown.delete(e.code); if(Input.keysDown.size) playKeyboard(); else if(!Input.pointerDown) stopVoice(); }
    });
  };
})(window.Th);
