"use strict";
/* ============================================================================
   THÉRÉMINE — continuous X/Y field
   X = pitch · Y = timbre (filter) · pressure/aftertouch = vibrato
   Glissando (portamento) for continuous glide, even from discrete pads.
   Mouse/touch/keyboard/MIDI; phosphor-persistence oscilloscope.

   Entry point: wires up all the files and drives the rAF loop.
   Loaded last, as a classic <script> (like the other assets/js/*.js files)
   so the page stays openable via file:// without a local server.
   ==========================================================================*/
(function(Th){
  const $=Th.$, V=Th.V, P=Th.P, Input=Th.Input, Motion=Th.Motion,
        FMIN=Th.FMIN, FMAX=Th.FMAX, freqFromX=Th.freqFromX, cutFromY=Th.cutFromY,
        noteName=Th.noteName, clamp01=Th.clamp01;

  /* ============================ LOOP ============================ */
  let last=0;
  function tick(now){
    requestAnimationFrame(tick);
    const dt=Math.min(0.05,(now-last)/1000); last=now;

    Th.demoTick(dt);                  // demo mode drives the voice like a hand would
    Th.visionTick(dt);                // webcam mode: hands in the air drive it too
    // glissando: smoothing toward the target
    const tau=Math.max(0.001,P.glide), k=1-Math.exp(-dt/tau);
    V.cx+=(V.tx-V.cx)*k; V.cy+=(V.ty-V.cy)*k;

    V.freq=freqFromX(V.cx); V.cut=cutFromY(V.cy);
    Motion.lfoPhase+=dt*P.vibRate*2*Math.PI;

    const A=Th.getAudioNodes();
    if(A){ const t=A.c.currentTime;
      A.o1.frequency.setTargetAtTime(V.freq,t,0.015);
      A.o2.frequency.setTargetAtTime(V.freq,t,0.015);
      A.filt.frequency.setTargetAtTime(V.cut,t,0.02);
      A.filt.Q.setTargetAtTime(P.res,t,0.05);
      A.lfo.frequency.setTargetAtTime(P.vibRate,t,0.05);
      A.lfoAmt.gain.setTargetAtTime(V.pressure*55,t,0.04);   // depth in cents
      A.wet.gain.setTargetAtTime(P.reverb,t,0.05);
    }
    Th.updateLEDs();
    Th.render(dt);
    updateReadout();
    updateFig();
  }
  let readAcc=0;
  function updateReadout(){
    readAcc++; if(readAcc%4) return;
    $('oNote').textContent=V.active?noteName(V.freq):'—';
    $('oFreq').textContent=V.active?V.freq.toFixed(1)+' Hz':'— Hz';
    $('oCut').textContent=V.active?Math.round(V.cut)+' Hz':'— Hz';
    $('oVib').textContent=Math.round(V.pressure*100)+' %';
  }
  /* theremin illustration: antennas glowing, hand tracking pitch */
  const FIG={};
  function updateFig(){
    if(FIG.fig===undefined){ FIG.fig=$('thereminFig'); FIG.pitch=$('thPitchGlow');
      FIG.loop=$('thLoopGlow'); FIG.hand=$('thHand'); }
    if(!FIG.fig) return;
    const pitchN=V.active?clamp01(Math.log(V.freq/FMIN)/Math.log(FMAX/FMIN)):0;
    const shownN=Input.handDrag?Input.handN:pitchN;                     // while dragging: hand tracks the pointer 1:1
    FIG.pitch.style.opacity = V.active ? (0.25+pitchN*0.75) : 0.05;      // pitch antenna
    FIG.loop.style.opacity  = V.active ? (0.18+V.pressure*0.8) : 0.05;   // volume loop (vibrato)
    FIG.hand.setAttribute('transform','translate('+(shownN*56).toFixed(1)+',0)'); // hand -> antenna as pitch rises
    FIG.hand.style.opacity = V.active ? 0.95 : 0.4;
    FIG.fig.classList.toggle('playing', V.active);
  }

  /* ============================ STARTUP ============================ */
  function start(){ if(Input.boot)return; Input.boot=true; Th.initAudio();
    const b=$('boot'); b.style.opacity='0'; setTimeout(()=>b.remove(),500);
    if(navigator.requestMIDIAccess) Th.connectMIDI();
  }
  Th.powerOn = start;

  Th.initControls();
  Th.initHelp();
  Th.initDemo();
  Th.initVision();
  Th.initPlayableDiagram();
  Th.initMIDIControls();
  Th.initPointerInput();
  Th.initKeyboardInput(start);
  $('boot').addEventListener('click',start);

  Th.resize(); last=performance.now(); requestAnimationFrame(tick);
})(window.Th);
