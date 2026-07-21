"use strict";
/* ============================================================================
   UI — wave/scale chips, sliders, octave, help modal, playable SVG diagram
   ==========================================================================*/
(function(Th){
  const $=Th.$, V=Th.V, P=Th.P, Input=Th.Input, clamp01=Th.clamp01, noActiveSource=Th.noActiveSource;

  /* ============================ CONTROLS ============================ */
  function bind(id,vid,fn,fmt){ const el=$(id); el.oninput=()=>{fn(parseFloat(el.value)); $(vid).textContent=fmt();}; }

  function setOctave(o){ P.octave=Math.max(-2,Math.min(2,o)); $('octVal').textContent=(P.octave>0?'+':'')+P.octave; }
  Th.setOctave = setOctave;

  /* bind() only goes slider -> P; this is the other way around, so the bottom bar
     stays truthful when something else sets the params (demo mode, presets...) */
  function chips(id,attr,val){
    [...$(id).children].forEach(c=>c.classList.toggle('active', c.dataset[attr]===val));
  }
  /* the click direction, shared with the webcam mode chips */
  function setActiveChip(group,el){
    [...group.children].forEach(c=>c.classList.toggle('active', c===el));
  }
  Th.setActiveChip = setActiveChip;
  function syncControls(){
    $('rGli').value=Math.round(P.glide*1000);  $('vGli').textContent=Math.round(P.glide*1000);
    $('rVib').value=Math.round(P.vibRate*10);  $('vVib').textContent=P.vibRate.toFixed(1);
    $('rRes').value=Math.round(P.res*10);      $('vRes').textContent=P.res.toFixed(1);
    $('rRev').value=Math.round(P.reverb*100);  $('vRev').textContent=P.reverb.toFixed(2);
    chips('waveChips','w',P.wave); chips('scaleChips','s',P.scale);
    setOctave(P.octave);
  }
  Th.snapshotParams = () => ({...P});
  Th.setParams = patch => { Object.assign(P,patch); if(patch.wave) Th.setWave(patch.wave); syncControls(); };

  Th.initControls = function(){
    $('waveChips').onclick=e=>{ const b=e.target.closest('.chip'); if(!b)return;
      setActiveChip($('waveChips'),b); Th.setWave(b.dataset.w); };
    $('scaleChips').onclick=e=>{ const b=e.target.closest('.chip'); if(!b)return;
      setActiveChip($('scaleChips'),b); P.scale=b.dataset.s; };
    bind('rGli','vGli',v=>P.glide=v/1000,()=>Math.round(P.glide*1000));
    bind('rVib','vVib',v=>P.vibRate=v/10,()=>P.vibRate.toFixed(1));
    bind('rRes','vRes',v=>P.res=v/10,()=>P.res.toFixed(1));
    bind('rRev','vRev',v=>P.reverb=v/100,()=>P.reverb.toFixed(2));
    $('octDn').onclick=()=>setOctave(P.octave-1); $('octUp').onclick=()=>setOctave(P.octave+1);
  };

  /* ============================ HELP ============================ */
  /* shared by the demo panel: move the focus into the sheet on open and hand it back
     to whatever opened it on close, so the modal is usable without a mouse */
  let lastFocus=null;
  function openSheet(id){
    lastFocus=document.activeElement;
    const p=$(id); p.classList.add('open');
    const close=p.querySelector('.close'); if(close) close.focus();
  }
  function closeSheet(id){
    const p=$(id); if(!p.classList.contains('open')) return;   // Escape closes both blindly
    p.classList.remove('open');
    if(lastFocus&&lastFocus.focus) lastFocus.focus();
    lastFocus=null;
  }
  Th.openSheet = openSheet;
  Th.closeSheet = closeSheet;

  const helpOpen=()=>$('help').classList.contains('open');
  function openHelp(){ openSheet('help'); }
  function closeHelp(){ closeSheet('help'); }
  function toggleHelp(){ helpOpen()?closeHelp():openHelp(); }
  Th.helpOpen = helpOpen;
  Th.closeHelp = closeHelp;
  Th.toggleHelp = toggleHelp;

  Th.initHelp = function(){
    $('helpBtn').onclick=openHelp;
    $('helpClose').onclick=closeHelp;
    $('help').addEventListener('click',e=>{ if(e.target.id==='help') closeHelp(); });
  };

  /* ============================ PLAYABLE DIAGRAM ============================ */
  Th.initPlayableDiagram = function(){
    const svg=$('thSvg'), fig=$('thereminFig'); if(!svg) return;
    const toVB=e=>{ const r=svg.getBoundingClientRect();
      return { x:(e.clientX-r.left)/r.width*260, y:(e.clientY-r.top)/r.height*180 }; };
    function apply(e){ const p=toVB(e);
      Input.handN=clamp01((p.x-46)/(184-46));            // left toward the antenna = low -> high pitch
      V.tx=Input.handN; V.ty=clamp01((150-p.y)/(150-30)); // up = brighter timbre
    }
    svg.addEventListener('pointerdown',e=>{ e.preventDefault(); Th.demoInterrupt(); Th.initAudio();
      Input.handDrag=true; fig.classList.add('grabbing');
      try{ svg.setPointerCapture(e.pointerId); }catch(_){}
      apply(e); Th.startVoice(); });
    svg.addEventListener('pointermove',e=>{ if(Input.handDrag) apply(e); });
    function end(){ Input.handDrag=false; fig.classList.remove('grabbing');
      if(noActiveSource()) Th.stopVoice(); }
    svg.addEventListener('pointerup',end);
    svg.addEventListener('pointercancel',end);

    const closeBtn=$('figClose');
    if(closeBtn) closeBtn.addEventListener('click',()=>{
      Input.figClosedByUser=true; fig.style.display='none';
    });
  };
})(window.Th);
