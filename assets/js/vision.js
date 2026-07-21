"use strict";
/* ============================================================================
   VISION — play the theremin with your hands, through the webcam.
   No model, no dependency: plain frame differencing intersected with a skin
   chroma test, then a weighted centroid per zone. That keeps the page openable
   via file:// (a WASM hand model would need fetch(), which file:// blocks) and
   it mirrors how the real instrument works — a theremin senses proximity, it
   does not recognize a hand.
   Like demo.js, this only drives the shared voice, so the field, the cursor,
   the oscilloscope, the diagram and the MIDI LEDs react on their own.
   The video never leaves the machine: it is only read into an offscreen canvas.
   ==========================================================================*/
(function(Th){
  const $=Th.$, V=Th.V, Input=Th.Input, clamp01=Th.clamp01;

  /* ---- everything worth adjusting by feel lives here ---- */
  const W=160, H=120;          // analysis resolution
  const RATE=1/30;             // seconds between analysed frames
  const SPLIT=0.45;            // 'two' mode: left share of the frame (volume hand)
  const DIFF_FLOOR=8;          // minimum luma change counted as motion
  const DIFF_REL=0.30;         // ...or this share of the frame's strongest motion
  const ENERGY_MIN=90;         // below this a zone holds its last position
  const SMOOTH=0.35;           // smoothing toward the detected centroid
  const VOL_GATE=0.06;         // below this volume the voice is released
  const VIB_FLOOR=4000;        // motion energy below which no vibrato is applied
  const VIB_SPAN=16000;        // ...and the span above it that reaches full depth
  const HOLD_RELEASE=0.35;     // 'one' mode: seconds of stillness before releasing

  let stream=null, video=null, work=null, wctx=null, overlay=null, octx=null;
  let lum=null, dif=null, primed=false, acc=0;
  let pitchX=0.5, pitchY=0.5, vol=0, volTarget=0, stillT=0;
  let jitter=0;
  let volSeen=false, pitchSeen=false;

  /* ============================ DETECTION ============================ */
  function analyse(){
    // mirrored, so moving right on screen means moving right in the field
    wctx.save(); wctx.scale(-1,1); wctx.drawImage(video,-W,0,W,H); wctx.restore();
    const img=wctx.getImageData(0,0,W,H).data;

    let dMax=0;
    for(let i=0,p=0;i<img.length;i+=4,p++){
      const r=img[i], g=img[i+1], b=img[i+2];
      const y=0.299*r+0.587*g+0.114*b;
      const cb=128-0.168736*r-0.331264*g+0.5*b;
      const cr=128+0.5*r-0.418688*g-0.081312*b;
      // motion AND skin: rejects light flicker, shadows and moving background at once
      const skin = cb>=77 && cb<=127 && cr>=133 && cr<=173;
      const d = primed && skin ? Math.abs(y-lum[p]) : 0;
      lum[p]=y; dif[p]=d;
      if(d>dMax) dMax=d;
    }
    primed=true;

    // self-calibrating threshold: no sensitivity knob to expose
    const thr=Math.max(DIFF_FLOOR, dMax*DIFF_REL);
    const split = Input.camMode==='two' ? Math.round(W*SPLIT) : 0;
    let lw=0,ly=0, rw=0,rx=0,ry=0;
    for(let y=0;y<H;y++){
      const row=y*W;
      for(let x=0;x<W;x++){
        const w=dif[row+x]; if(w<thr) continue;
        if(x<split){ lw+=w; ly+=y*w; }
        else { rw+=w; rx+=x*w; ry+=y*w; }
      }
    }

    // pitch hand: when the energy drops the position is held, so a still hand sustains a note
    pitchSeen = rw>ENERGY_MIN;
    if(pitchSeen){
      const cx=rx/rw, cy=ry/rw;
      pitchX += (((cx-split)/(W-split))-pitchX)*SMOOTH;
      pitchY += ((1-cy/H)-pitchY)*SMOOTH;
    }
    // shaking the hand adds vibrato, the way a thereminist does it. Measured on the
    // zone's motion energy, not on the tracked position: at low speed the mask is a
    // thin crescent whose centroid is too noisy to tell a shake from a slow sweep.
    jitter += (clamp01((rw-VIB_FLOOR)/VIB_SPAN)-jitter)*0.25;

    if(Input.camMode==='two'){
      volSeen = lw>ENERGY_MIN;
      if(volSeen) volTarget=clamp01(1-(ly/lw)/H);   // hand high = loud, hand low = silent
      vol += (volTarget-vol)*SMOOTH;
    }else{
      volSeen=false;
      stillT = pitchSeen ? 0 : stillT+RATE;         // no volume hand: release on stillness
      vol = stillT<HOLD_RELEASE ? 1 : 0;
    }
  }

  /* ============================ VOICE ============================ */
  function apply(){
    const on = vol>VOL_GATE;
    if(on){
      V.tx=clamp01(pitchX); V.ty=clamp01(pitchY);
      V.pressure=jitter;
      if(!Input.camActive){ Input.camActive=true; Th.demoInterrupt(); Th.startVoice(); }
      Th.audioActivate(true, Input.camMode==='two' ? vol : 1);
    }else{
      release();
    }
  }
  function release(){
    if(!Input.camActive) return;
    Input.camActive=false; V.pressure=0;
    // hand back to whoever else is playing, at full level
    if(Th.noActiveSource()) Th.stopVoice(); else Th.audioActivate(true,1);
  }

  Th.visionTick = function(dt){
    if(!Input.camOn || !video || video.readyState<2) return;
    acc+=dt; if(acc<RATE) return; acc=0;
    analyse(); apply(); drawOverlay();
  };

  /* ============================ OVERLAY ============================ */
  function drawOverlay(){
    if(!octx) return;
    const w=overlay.width, h=overlay.height;
    octx.clearRect(0,0,w,h);
    if(Input.camMode==='two'){
      const sx=w*SPLIT;
      octx.strokeStyle='rgba(124,227,255,.35)'; octx.lineWidth=1;
      octx.beginPath(); octx.moveTo(sx,0); octx.lineTo(sx,h); octx.stroke();
      // volume gauge along the left edge
      octx.fillStyle='rgba(124,227,255,.5)';
      octx.fillRect(2,h-4-(h-8)*vol,3,(h-8)*vol+2);
      if(volSeen){
        octx.fillStyle='rgba(124,227,255,.9)';
        octx.beginPath(); octx.arc(sx*0.5,h-(h*vol),4,0,Math.PI*2); octx.fill();
      }
    }
    if(pitchSeen || Input.camActive){
      const sx = Input.camMode==='two' ? w*SPLIT : 0;
      const x = sx+(w-sx)*pitchX, y = h-h*pitchY;
      octx.strokeStyle='rgba(255,179,71,.9)'; octx.lineWidth=1.5;
      octx.beginPath(); octx.arc(x,y,7,0,Math.PI*2); octx.stroke();
      octx.fillStyle='rgba(255,225,175,.95)';
      octx.beginPath(); octx.arc(x,y,2.5,0,Math.PI*2); octx.fill();
    }
  }

  /* ============================ CAMERA ============================ */
  function setStatus(key){
    const el=$('camStatus'); if(!el) return;
    el.setAttribute('data-i18n',key);      // so applyLanguage() retranslates it
    el.textContent=Th.t(key);
  }
  function setBtn(on){
    const b=$('camBtn'); if(!b) return;
    b.classList.toggle('playing',on);
    const key = on ? 'cam.btn.stop.title' : 'cam.btn.title';
    b.setAttribute('data-i18n-title',key);
    b.title=Th.t(key);
  }

  // an infrared sensor opens like a camera but gives nothing a skin test can use
  function infrared(d){ return /\bir\b|infra/i.test(d.label||'') ? 1 : 0; }

  // machines commonly declare more video inputs than they really have — an unplugged
  // capture card, a Windows Hello sensor — and the browser's default pick is often one
  // of those ghosts, which fails as NotReadableError. Try the default, then walk the list.
  async function openStream(){
    const base={width:640,height:480};   // preview is 512 wide; asking for less would upscale a blurry image
    try{
      return await navigator.mediaDevices.getUserMedia({video:base,audio:false});
    }catch(err){
      const n=err&&err.name;
      if(n==='NotAllowedError'||n==='SecurityError') throw err;   // a refusal is final, do not nag
      let cams=[];
      try{
        cams=(await navigator.mediaDevices.enumerateDevices())
          .filter(d=>d.kind==='videoinput')
          .sort((a,b)=>infrared(a)-infrared(b));
      }catch(_){}
      for(const c of cams){
        try{
          return await navigator.mediaDevices.getUserMedia(
            {video:{deviceId:{exact:c.deviceId},width:base.width,height:base.height},audio:false});
        }catch(_){}
      }
      throw err;   // nothing opened: report the first error, the most meaningful one
    }
  }

  async function startCam(){
    const card=$('camView'); if(card){ card.classList.add('on'); Th.resize(); }  // measurable only once shown
    // the API only exists in a secure context, so over file:// or plain http on a
    // remote host there is nothing to call — say so instead of blaming the camera
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
      setStatus('cam.status.insecure'); return;
    }
    setStatus('cam.status.asking'); setBtn(true);
    try{
      stream=await openStream();
    }catch(err){
      stream=null; setBtn(false);
      const n=err&&err.name;
      // be specific: "no camera" would be wrong for a refusal or a camera already in use
      setStatus(n==='NotAllowedError'||n==='SecurityError' ? 'cam.status.denied'
              : n==='NotFoundError'||n==='OverconstrainedError' ? 'cam.status.none'
              : n==='NotReadableError'||n==='AbortError' ? 'cam.status.busy'
              : 'cam.status.error');
      return;
    }
    Th.initAudio();
    video.srcObject=stream;
    try{ await video.play(); }catch(_){}
    primed=false; acc=0; vol=0; volTarget=0; stillT=HOLD_RELEASE;
    Input.camOn=true;
    setStatus('cam.status.on');
  }

  function stopCam(){
    Input.camOn=false;
    release();
    if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
    if(video) video.srcObject=null;
    if(octx) octx.clearRect(0,0,overlay.width,overlay.height);
    const card=$('camView'); if(card) card.classList.remove('on');
    setStatus('cam.status.off');   // so a past failure does not greet the next opening
    setBtn(false);
  }

  Th.initVision = function(){
    video=$('camVideo'); overlay=$('camOverlay');
    if(!video||!overlay) return;
    octx=overlay.getContext('2d');
    work=document.createElement('canvas'); work.width=W; work.height=H;
    wctx=work.getContext('2d',{willReadFrequently:true});
    lum=new Float32Array(W*H); dif=new Float32Array(W*H);

    const btn=$('camBtn');
    // toggle on what is on screen, not on the stream: a camera that failed to start
    // still leaves the card open, and that card has to be closable
    const card=$('camView');
    if(btn) btn.addEventListener('click',()=>{
      card&&card.classList.contains('on') ? stopCam() : startCam();
    });

    const chips=$('camChips');
    if(chips) chips.addEventListener('click',e=>{
      const c=e.target.closest('.chip'); if(!c) return;
      Th.setActiveChip(chips,c);
      release();                              // no note left hanging across the switch
      Input.camMode=c.dataset.cam;
      vol=0; volTarget=0; stillT=HOLD_RELEASE;
    });
  };
})(window.Th);
