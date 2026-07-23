"use strict";
/* ============================================================================
   RENDER — canvas geometry, X/Y field, oscilloscope, cursor, reticle
   ==========================================================================*/
(function(Th){
  const $=Th.$, N=Th.N, V=Th.V, Geo=Th.Geo, Motion=Th.Motion, Input=Th.Input,
        FMIN=Th.FMIN, FMAX=Th.FMAX, CMIN=Th.CMIN, CMAX=Th.CMAX,
        clamp01=Th.clamp01, freqFromX=Th.freqFromX, noteName=Th.noteName;

  const cvs = $('stage'), ctx = cvs.getContext('2d',{alpha:false});
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const FIELD_RADIUS = 15;   // matches .panel's border-radius (bottom bar), so the field lines up with it visually
  const CAM_ALPHA = 0.30;    // webcam backdrop: enough to place your hands, never enough to fight the trace
  let scopeCvs, sctx;

  function roundedRectPath(c,x,y,w,h,r){
    c.beginPath();
    c.moveTo(x+r,y);
    c.arcTo(x+w,y,x+w,y+h,r);
    c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r);
    c.arcTo(x,y,x+w,y,r);
    c.closePath();
  }

  /* ============================ GEOMETRY ============================ */
  function resize(){
    Geo.DPR=Math.min(2,window.devicePixelRatio||1); Geo.W=innerWidth; Geo.H=innerHeight;
    cvs.width=Geo.W*Geo.DPR; cvs.height=Geo.H*Geo.DPR; cvs.style.width=Geo.W+'px'; cvs.style.height=Geo.H+'px';
    ctx.setTransform(Geo.DPR,0,0,Geo.DPR,0,0);
    // free band between the top bar and the bottom bar
    const tb=document.querySelector('.topbar'), dk=document.querySelector('.dock'), pn=document.querySelector('.dock .panel');
    const topH=tb?tb.getBoundingClientRect().height:70;
    const dockH=dk?dk.getBoundingClientRect().height:96;
    // the field starts level with the note readout rather than below the whole top bar:
    // the brand block above it is dead space, and the field reclaims that height
    const note=$('oNote');
    const fieldTop=note?Math.round(note.getBoundingClientRect().top):topH+2;
    const availH=Math.max(180, Geo.H - fieldTop - dockH - 20);
    const panelW=pn?pn.getBoundingClientRect().width:Geo.W*0.92;
    // rectangular field: width = bottom bar's width, height = all available vertical space
    Geo.sideW=panelW; Geo.sideH=availH; Geo.cellW=Geo.sideW/N; Geo.cellH=Geo.sideH/N;
    Geo.ox=(Geo.W-Geo.sideW)/2; Geo.oy=fieldTop;
    // sit the "now playing" label in the gap just above the field
    const np=$('nowPlaying');
    if(np) np.style.top=Math.max(4,Geo.oy-24)+'px';
    // camera strip: sits on the field's bottom edge. The frame itself is the field's
    // backdrop now, so this is only the status line and the mode switch. Horizontal
    // centring is left to CSS, which does not have to chase the status text's width.
    const cam=$('camView');
    if(cam&&cam.classList.contains('on')){
      cam.style.top=(Geo.oy+Geo.sideH-cam.getBoundingClientRect().height-14)+'px';
    }
    // pin the diagram just above the bottom bar
    const fig=$('thereminFig');
    if(fig){
      fig.style.bottom=(dockH+14)+'px';
      // responsive hide: as soon as the diagram card (~250-280px) would overlap the now full-width field
      const figW = Geo.W<=1400 ? 246 : 280;
      const fieldRight = Geo.ox + Geo.sideW;
      const figLeftEdge = Geo.W - 24 - figW;
      const wouldOverlap = figLeftEdge < fieldRight + 12 || Geo.W < figW + 48;
      fig.style.display = (Input.figClosedByUser || wouldOverlap) ? 'none' : '';
    }
    // the persistence buffer is field-sized, not screen-sized: the trace is clipped to the
    // field anyway, so a full-screen buffer was faded and composited for nothing every frame.
    // The transform carries the field's origin, so the drawing code keeps its page coordinates.
    // Only reallocated when the size really changes — a window drag fires resize continuously.
    const bw=Math.max(1,Math.round(Geo.sideW*Geo.DPR)), bh=Math.max(1,Math.round(Geo.sideH*Geo.DPR));
    if(!scopeCvs){ scopeCvs=document.createElement('canvas'); }
    if(scopeCvs.width!==bw||scopeCvs.height!==bh){ scopeCvs.width=bw; scopeCvs.height=bh; }
    sctx=scopeCvs.getContext('2d');
    sctx.setTransform(Geo.DPR,0,0,Geo.DPR,-Geo.ox*Geo.DPR,-Geo.oy*Geo.DPR);
    sctx.fillStyle='#0a0705'; sctx.fillRect(Geo.ox,Geo.oy,Geo.sideW,Geo.sideH);
  }
  // coalesce bursts of resize events into a single recompute per frame
  let resizePending=false;
  addEventListener('resize',()=>{
    if(resizePending) return;
    resizePending=true;
    requestAnimationFrame(()=>{ resizePending=false; resize(); });
  });
  Th.resize = resize;

  /* ============================ RENDER ============================ */
  function render(dt){
    // background
    ctx.globalCompositeOperation='source-over';
    const bg=ctx.createRadialGradient(Geo.W/2,Geo.H*0.44,Math.min(Geo.sideW,Geo.sideH)*0.1,Geo.W/2,Geo.H*0.44,Math.max(Geo.sideW,Geo.sideH));
    bg.addColorStop(0,'#140d07'); bg.addColorStop(1,'#0a0705');
    ctx.fillStyle=bg; ctx.fillRect(0,0,Geo.W,Geo.H);

    // clip the field itself to rounded corners, matching the bottom bar
    ctx.save();
    roundedRectPath(ctx, Geo.ox, Geo.oy, Geo.sideW, Geo.sideH, FIELD_RADIUS);
    ctx.clip();
    drawCamera();
    drawField();
    drawScope(dt);
    // the tracking markers belong above the trace but below the cursor, which stays the lead.
    // the frame covers the whole field, so the tracking space IS the field — hand the markers
    // the field rect and a marker keeps sitting over the real hand
    if(Th.drawVisionOverlay){ Th.drawVisionOverlay(ctx, Geo.ox, Geo.oy, Geo.sideW, Geo.sideH); }
    drawCursor();
    ctx.restore();

    drawReticle();
  }
  Th.render = render;

  /* the webcam fills the whole field (cover): the frame is scaled to cover the field with its
     aspect ratio kept, so it never looks stretched, and the overflow is cropped by the field's
     rounded clip. vision.js analyses the very same covered slice, so the tracking maps 1:1 to
     the field and a marker keeps sitting over the real hand. */
  function camRect(){
    const v = Th.getCamVideo && Th.getCamVideo();
    const fx=Geo.ox, fy=Geo.oy, fw=Geo.sideW, fh=Geo.sideH;
    if(!v) return {x:fx,y:fy,w:fw,h:fh};
    const ar=(v.videoWidth||16)/(v.videoHeight||9);
    let w=fw, h=fw/ar;
    if(h<fh){ h=fh; w=fh*ar; }   // cover: if too short, grow to fill the height (crops the sides)
    return {x:fx+(fw-w)/2, y:fy+(fh-h)/2, w, h};
  }

  /* webcam frame as the field's backdrop: mirrored, and scaled to cover the field (camRect) */
  function drawCamera(){
    const v = Th.getCamVideo && Th.getCamVideo();
    if(!v) return;
    const r=camRect();
    ctx.save();
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=CAM_ALPHA;
    ctx.translate(r.x+r.w, r.y); ctx.scale(-1,1);
    try{ ctx.drawImage(v,0,0,r.w,r.h); }catch(_){}   // a frame can vanish mid-teardown
    ctx.restore();
  }

  /* cold X/Y field + pads */
  function drawField(){
    ctx.save(); ctx.globalCompositeOperation='lighter';
    // cell grid
    ctx.strokeStyle='rgba(79,107,255,.10)'; ctx.lineWidth=1;
    for(let i=0;i<=N;i++){
      ctx.beginPath(); ctx.moveTo(Geo.ox+i*Geo.cellW,Geo.oy); ctx.lineTo(Geo.ox+i*Geo.cellW,Geo.oy+Geo.sideH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(Geo.ox,Geo.oy+i*Geo.cellH); ctx.lineTo(Geo.ox+Geo.sideW,Geo.oy+i*Geo.cellH); ctx.stroke();
    }
    // pads lit near the cursor (mirrors the LEDs)
    if(V.active){
      const gx=V.cx, gy=1-V.cy;
      for(let r=0;r<N;r++)for(let c=0;c<N;c++){
        const px=(c+0.5)/N, py=(r+0.5)/N, d=Math.hypot(px-gx,py-gy);
        const b=Math.max(0,1-d*3.2); if(b<0.03) continue;
        const x=Geo.ox+c*Geo.cellW, y=Geo.oy+r*Geo.cellH;
        ctx.fillStyle=`rgba(124,227,255,${b*0.14})`;
        ctx.fillRect(x+1.5,y+1.5,Geo.cellW-3,Geo.cellH-3);
      }
    }
    ctx.restore();
  }

  /* phosphor-persistence oscilloscope (the SOUND) */
  let scopePeak=0.08;   // smoothed peak for auto-normalizing the trace (auto-gain oscilloscope style)
  function drawScope(dt){
    const cy=Geo.oy+Geo.sideH*0.5;
    const margin=Math.max(10,Geo.sideH*0.08), yMin=Geo.oy+margin, yMax=Geo.oy+Geo.sideH-margin;
    // fade the persistent layer
    sctx.globalCompositeOperation='source-over';
    sctx.fillStyle=reduce?'rgba(10,7,5,0.5)':'rgba(10,7,5,0.16)';
    sctx.fillRect(Geo.ox,Geo.oy,Geo.sideW,Geo.sideH);

    const A=Th.getAudioNodes();
    if(A){
      A.analyser.getFloatTimeDomainData(A.scope);
      const buf=A.scope, len=buf.length;
      // trigger on rising edge to stabilize the trace
      let start=0; for(let i=1;i<len/2;i++){ if(buf[i-1]<0&&buf[i]>=0){start=i;break;} }
      const span=Math.floor(len*0.45), step=Geo.sideW/span;
      // auto-normalize: the trace recalibrates on the signal's real peak so it always
      // fills the available height, regardless of the instrument's actual volume
      let peak=0; for(let i=0;i<span;i++){ const v=Math.abs(buf[start+i]||0); if(v>peak) peak=v; }
      scopePeak += (Math.max(peak,0.08) - scopePeak) * 0.15;
      // target only a fraction of the margined range at the tracked peak, so normal playing
      // stays comfortably clear of the border; the clamp below is only a safety net for transients
      const amp = (yMax-yMin)*0.34 / scopePeak;
      // timbre tint: the more open the filter, the brighter/warmer the trace
      const bright=0.4+clamp01((V.cut-CMIN)/(CMAX-CMIN))*0.6;
      const on=V.active?1:0.18;
      sctx.globalCompositeOperation='lighter';
      sctx.lineJoin='round'; sctx.lineWidth=2.2;
      sctx.strokeStyle=`rgba(255,${150+bright*70|0},${60+bright*90|0},${0.9*on})`;
      sctx.beginPath();
      for(let i=0;i<span;i++){ const v=buf[start+i]||0; const x=Geo.ox+i*step;
        const y=Math.min(yMax,Math.max(yMin, cy - v*amp*(V.active?1:0.25)));
        i?sctx.lineTo(x,y):sctx.moveTo(x,y); }
      sctx.stroke();
      // bright core
      sctx.lineWidth=1; sctx.strokeStyle=`rgba(255,225,175,${0.7*on})`; sctx.stroke();
    }
    // composite the phosphor layer
    ctx.globalCompositeOperation='lighter';
    ctx.drawImage(scopeCvs,Geo.ox,Geo.oy,Geo.sideW,Geo.sideH);
    ctx.globalCompositeOperation='source-over';
  }

  /* cursor + field rings (the CONTROL) */
  function drawCursor(){
    if(!V.active) return;
    const wob=Math.sin(Motion.lfoPhase)*V.pressure*0.012;      // vibrato makes the cursor wobble
    const cx=Geo.ox+(clamp01(V.cx+wob))*Geo.sideW, cyp=Geo.oy+(1-V.cy)*Geo.sideH;

    ctx.save(); ctx.globalCompositeOperation='lighter';
    // crosshair
    ctx.strokeStyle='rgba(124,227,255,.16)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(Geo.ox,cyp); ctx.lineTo(Geo.ox+Geo.sideW,cyp);
    ctx.moveTo(cx,Geo.oy); ctx.lineTo(cx,Geo.oy+Geo.sideH); ctx.stroke();

    // radiating rings: spacing tied to pitch
    const spacing=14+ (1-clamp01((Math.log(V.freq/FMIN)/Math.log(FMAX/FMIN))))*34;
    const t=performance.now()/1000;
    for(let i=0;i<5;i++){
      const rr=((t*spacing*1.4 + i*spacing) % (spacing*5));
      const a=(1-rr/(spacing*5))*0.5;
      ctx.strokeStyle=`rgba(79,107,255,${a})`; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.arc(cx,cyp,rr+6,0,Math.PI*2); ctx.stroke();
    }
    // amber core
    const R=10+V.pressure*8;
    const g=ctx.createRadialGradient(cx,cyp,0,cx,cyp,R*2.6);
    g.addColorStop(0,'rgba(255,225,175,.95)'); g.addColorStop(.35,'rgba(255,150,40,.55)');
    g.addColorStop(1,'rgba(255,107,26,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cyp,R*2.6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,235,200,.95)'; ctx.beginPath(); ctx.arc(cx,cyp,3.2,0,Math.PI*2); ctx.fill();

    // note label
    ctx.globalCompositeOperation='source-over';
    ctx.font='500 13px "DM Mono", monospace'; ctx.fillStyle='rgba(255,217,160,.9)';
    ctx.textAlign='center'; ctx.fillText(noteName(V.freq), cx, cyp-R*2.6-8);
    ctx.restore();
  }

  /* mouse reticle (the cold "field"): always visible on hover */
  function drawReticle(){
    const hover = Th.hover;
    if(!hover.on) return;
    const x=hover.x, y=hover.y, inside=hover.inside;
    const t=reduce?0:performance.now()/1000;
    const col=inside?[124,227,255]:[138,122,107];   // cyan inside the field, slate gray outside
    const R=inside?15:9, a=inside?1:0.6;
    ctx.save(); ctx.globalCompositeOperation='lighter';
    // outer ring
    ctx.strokeStyle=`rgba(${col[0]},${col[1]},${col[2]},${0.55*a})`; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.arc(x,y,R,0,Math.PI*2); ctx.stroke();
    // inner pulsing ring (inside the field only)
    if(inside){
      const pr=R-5+Math.sin(t*3)*1.6;
      ctx.strokeStyle=`rgba(${col[0]},${col[1]},${col[2]},.28)`; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(x,y,pr,0,Math.PI*2); ctx.stroke();
    }
    // graticule: 4 slowly rotating ticks
    ctx.strokeStyle=`rgba(${col[0]},${col[1]},${col[2]},${0.8*a})`; ctx.lineWidth=1.4;
    for(let i=0;i<4;i++){ const ang=t*0.7+i*Math.PI/2, c=Math.cos(ang), s=Math.sin(ang);
      ctx.beginPath(); ctx.moveTo(x+c*(R+2),y+s*(R+2)); ctx.lineTo(x+c*(R+7),y+s*(R+7)); ctx.stroke(); }
    // amber core: nod to the "sound" at the center of the cold field
    ctx.fillStyle='rgba(255,225,175,.95)';
    ctx.beginPath(); ctx.arc(x,y,inside?2.3:1.5,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // note preview under the cursor when hovering without playing
    if(inside && !V.active){
      ctx.save(); ctx.globalCompositeOperation='source-over';
      ctx.font='500 12px "DM Mono", monospace'; ctx.textAlign='center';
      ctx.fillStyle='rgba(124,227,255,.75)';
      ctx.fillText(noteName(freqFromX(hover.fx)), x, y-R-10);
      ctx.restore();
    }
  }
})(window.Th);
