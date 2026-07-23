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
  const $=Th.$, V=Th.V, Input=Th.Input, Geo=Th.Geo, clamp01=Th.clamp01;

  /* ---- everything worth adjusting by feel lives here ---- */
  const AW=160;                // analysis width; the height follows the field's ratio (cover)
  const RATE=1/30;             // seconds between analysed frames
  const SPLIT=0.45;            // 'two' mode: left share of the frame (volume hand)
  const DIFF_FLOOR=8;          // minimum luma change counted as motion
  const DIFF_REL=0.30;         // ...or this share of the frame's strongest motion
  const MOT_DECAY=0.75;        // motion accumulator: a slow hand leaves a lingering trace that
                               // fills the noisy crescent, so its centroid stops jittering
  const ENERGY_MIN=120;        // below this a zone holds its last position
  const VOL_GATE=0.06;         // below this volume the voice is released
  const VIB_FLOOR=4000;        // instantaneous motion energy below which no vibrato is applied
  const VIB_SPAN=16000;        // ...and the span above it that reaches full depth
  const HOLD_RELEASE=0.35;     // 'one' mode: seconds of stillness before releasing
  // adaptive smoothing (One-Euro): steady at rest, snappy in motion — replaces a single lag knob
  const EURO_MINCUT=1.1, EURO_BETA=0.02, EURO_DCUT=1.0;   // pitch X/Y
  const EURO_VOL_MINCUT=1.0, EURO_VOL_BETA=0.012;         // volume hand (a touch smoother)
  // skin chroma as a soft score, not a hard box: tolerant to skin tone and lighting drift.
  // centre ± half-range in YCbCr, widened vs a strict skin box
  const SKIN_CB=102, SKIN_CB_R=34;
  const SKIN_CR=153, SKIN_CR_R=28;
  const SKIN_ADAPT=0.02;       // how fast the skin centre re-centres on the moving pixels (0 = fixed)
  const SKIN_ADAPT_MAX=16;     // ...never drifting further than this from the defaults

  let stream=null, video=null, work=null, wctx=null;
  let W=AW, H=120, lum=null, dif=null, mot=null, primed=false, acc=0;
  let pitchX=0.5, pitchY=0.5, vol=0, volTarget=0, stillT=0;
  let jitter=0;
  let volSeen=false, pitchSeen=false;
  let skinCb=SKIN_CB, skinCr=SKIN_CR;   // current skin centre; may re-centre slowly on the hand

  /* One-Euro filter: low cutoff (steady) at rest, rising with speed (low lag). One per signal. */
  function makeOneEuro(minCut, beta, dCut){
    let xp=0, dxp=0, has=false;
    const alpha=(cut,dt)=>{ const r=2*Math.PI*cut*dt; return r/(r+1); };
    const f=function(x, dt){
      if(!has){ has=true; xp=x; return x; }
      const dx=(x-xp)/dt, aD=alpha(dCut,dt);
      dxp += aD*(dx-dxp);
      const a=alpha(minCut+beta*Math.abs(dxp), dt);
      xp += a*(x-xp);
      return xp;
    };
    f.reset=()=>{ has=false; dxp=0; };
    return f;
  }
  const euroX=makeOneEuro(EURO_MINCUT,EURO_BETA,EURO_DCUT);
  const euroY=makeOneEuro(EURO_MINCUT,EURO_BETA,EURO_DCUT);
  const euroV=makeOneEuro(EURO_VOL_MINCUT,EURO_VOL_BETA,EURO_DCUT);

  // work canvas + buffers follow the field's aspect ratio; only reallocated when it really changes
  function ensureBuffers(aw, ah){
    if(work && W===aw && H===ah) return;
    W=aw; H=ah;
    if(!work){ work=document.createElement('canvas'); }
    work.width=W; work.height=H;
    wctx=work.getContext('2d',{willReadFrequently:true});
    lum=new Float32Array(W*H); dif=new Float32Array(W*H); mot=new Float32Array(W*H);
    primed=false;
  }

  function resetTracking(){
    if(mot) mot.fill(0);
    primed=false;
    euroX.reset(); euroY.reset(); euroV.reset();
    skinCb=SKIN_CB; skinCr=SKIN_CR;
  }

  /* ============================ DETECTION ============================ */
  function analyse(){
    const v=video, vw=v.videoWidth||4, vh=v.videoHeight||3;
    // analyse exactly the slice the field shows (cover): the work canvas takes the field's aspect
    // ratio, and the source is cropped the same way camRect() crops the display
    const Rf = (Geo.sideH>0 ? Geo.sideW/Geo.sideH : 4/3);
    ensureBuffers(AW, Math.min(200, Math.max(40, Math.round(AW/Rf))));
    const Rv = vw/vh;
    let sx,sy,sw,sh;
    if(Rv < Rf){ sw=vw; sh=vw/Rf; sx=0; sy=(vh-sh)/2; }   // field wider than cam: crop top/bottom
    else       { sh=vh; sw=vh*Rf; sy=0; sx=(vw-sw)/2; }   // ...taller than cam: crop the sides
    // mirrored, so moving right on screen means moving right in the field
    wctx.save(); wctx.scale(-1,1); wctx.drawImage(v, sx,sy,sw,sh, -W,0,W,H); wctx.restore();
    const img=wctx.getImageData(0,0,W,H).data;

    // motion (frame diff) weighted by a soft skin score, then accumulated so a slow hand stays solid
    let motMax=0, scb=0, scr=0, sWt=0;
    for(let i=0,p=0;i<img.length;i+=4,p++){
      const r=img[i], g=img[i+1], b=img[i+2];
      const yl=0.299*r+0.587*g+0.114*b;
      const cb=128-0.168736*r-0.331264*g+0.5*b;
      const cr=128+0.5*r-0.418688*g-0.081312*b;
      // soft skin membership (0..1): tolerant at the edges, so a skin tone stays counted
      const dcb=(cb-skinCb)/SKIN_CB_R, dcr=(cr-skinCr)/SKIN_CR_R;
      const skin=Math.max(0,1-dcb*dcb)*Math.max(0,1-dcr*dcr);
      const d = primed ? Math.abs(yl-lum[p])*skin : 0;
      lum[p]=yl; dif[p]=d;
      const m = mot[p]=Math.max(d, mot[p]*MOT_DECAY);
      if(m>motMax) motMax=m;
      if(d>DIFF_FLOOR){ scb+=cb*d; scr+=cr*d; sWt+=d; }   // sample the moving pixels' own chroma
    }
    primed=true;

    // slowly re-centre the skin window on the hand actually moving, so a warm/cool light or a
    // darker/lighter tone stops pulling the mask off. Bounded with heavy inertia — never runs away.
    if(SKIN_ADAPT>0 && sWt>0){
      skinCb += (scb/sWt-skinCb)*SKIN_ADAPT; skinCr += (scr/sWt-skinCr)*SKIN_ADAPT;
      skinCb=Math.min(SKIN_CB+SKIN_ADAPT_MAX,Math.max(SKIN_CB-SKIN_ADAPT_MAX,skinCb));
      skinCr=Math.min(SKIN_CR+SKIN_ADAPT_MAX,Math.max(SKIN_CR-SKIN_ADAPT_MAX,skinCr));
    }

    // self-calibrating threshold on the accumulated motion: no sensitivity knob to expose
    const thr=Math.max(DIFF_FLOOR, motMax*DIFF_REL);
    const split = Input.camMode==='two' ? Math.round(W*SPLIT) : 0;
    let lw=0,ly=0, rw=0,rx=0,ry=0, rInst=0;
    for(let y=0;y<H;y++){
      const row=y*W;
      for(let x=0;x<W;x++){
        const m=mot[row+x]; if(m<thr) continue;
        if(x<split){ lw+=m; ly+=y*m; }
        else { rw+=m; rx+=x*m; ry+=y*m; rInst+=dif[row+x]; }   // rInst: live energy, for vibrato
      }
    }

    // pitch hand: when the energy drops the position is held, so a still hand sustains a note
    pitchSeen = rw>ENERGY_MIN;
    if(pitchSeen){
      const cx=rx/rw, cy=ry/rw;
      pitchX = euroX((cx-split)/(W-split), RATE);
      pitchY = euroY(1-cy/H, RATE);
    }
    // shaking the hand adds vibrato, the way a thereminist does it. Measured on the zone's live
    // energy (not the accumulator, which would smear a shake into a sweep; not the tracked
    // position, too noisy at low speed to tell a shake from a glide).
    jitter += (clamp01((rInst-VIB_FLOOR)/VIB_SPAN)-jitter)*0.25;

    if(Input.camMode==='two'){
      volSeen = lw>ENERGY_MIN;
      if(volSeen) volTarget=clamp01(1-(ly/lw)/H);   // hand high = loud, hand low = silent
      vol = euroV(volTarget, RATE);
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

  function ready(){ return Input.camOn && video && video.readyState>=2; }

  Th.visionTick = function(dt){
    if(!ready()) return;
    acc+=dt; if(acc<RATE) return; acc=0;
    analyse(); apply();
  };

  /* ============================ OVERLAY ============================ */
  /* render.js owns the canvas and paints the frame as the field's backdrop; this file
     only knows what the tracking means, so it draws the markers on request. The tracked
     values are already in mirrored space, which is screen space — nothing to convert. */
  Th.getCamVideo = function(){ return ready() ? video : null; };

  Th.drawVisionOverlay = function(c,x,y,w,h){
    if(!ready()) return;
    c.save();
    c.globalCompositeOperation='source-over';
    if(Input.camMode==='two'){
      const sx=x+w*SPLIT;
      c.strokeStyle='rgba(124,227,255,.35)'; c.lineWidth=1;
      c.beginPath(); c.moveTo(sx,y); c.lineTo(sx,y+h); c.stroke();
      // volume gauge along the field's left edge
      c.fillStyle='rgba(124,227,255,.5)';
      c.fillRect(x+4,y+h-6-(h-12)*vol,4,(h-12)*vol+2);
      if(volSeen){
        c.fillStyle='rgba(124,227,255,.9)';
        c.beginPath(); c.arc(x+w*SPLIT*0.5,y+h-h*vol,5,0,Math.PI*2); c.fill();
      }
    }
    if(pitchSeen || Input.camActive){
      const sx = Input.camMode==='two' ? x+w*SPLIT : x;
      const px = sx+(x+w-sx)*pitchX, py = y+h-h*pitchY;
      c.strokeStyle='rgba(255,179,71,.9)'; c.lineWidth=1.5;
      c.beginPath(); c.arc(px,py,9,0,Math.PI*2); c.stroke();
      c.fillStyle='rgba(255,225,175,.95)';
      c.beginPath(); c.arc(px,py,3,0,Math.PI*2); c.fill();
    }
    c.restore();
  };

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
    // 16:9 preferred (ideal, not strict) so a widescreen frame nearly fills the field and the
    // cover crop stays minimal; a 4:3-only camera still opens and cover takes over
    const base={width:{ideal:1280},height:{ideal:720}};
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
    resetTracking(); acc=0; vol=0; volTarget=0; stillT=HOLD_RELEASE;
    Input.camOn=true;
    setStatus('cam.status.on');
  }

  function stopCam(){
    Input.camOn=false;
    release();
    if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
    if(video) video.srcObject=null;
    const card=$('camView'); if(card) card.classList.remove('on');
    setStatus('cam.status.off');   // so a past failure does not greet the next opening
    setBtn(false);
  }

  Th.initVision = function(){
    video=$('camVideo');
    if(!video) return;
    // the work canvas and buffers are sized on first analysed frame (they follow the field ratio)

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
      vol=0; volTarget=0; stillT=HOLD_RELEASE; resetTracking();
    });
  };
})(window.Th);
