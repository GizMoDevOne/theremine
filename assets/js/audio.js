"use strict";
/* ============================================================================
   AUDIO — Web Audio graph: oscillators, filter, vibrato LFO, reverb
   ==========================================================================*/
(function(Th){
  const P = Th.P;
  let A = null;

  Th.getAudioNodes = function(){ return A; };

  Th.initAudio = function initAudio(){
    // every gesture entry point calls this, so it doubles as the recovery path for a
    // context that started (or was left) suspended — Safari does that
    if(A){ if(A.c.state==='suspended') A.c.resume(); return; }
    const c=new (window.AudioContext||window.webkitAudioContext)();
    const master=c.createGain(); master.gain.value=0.9;
    const comp=c.createDynamicsCompressor();
    comp.threshold.value=-14; comp.ratio.value=3.5; comp.attack.value=0.005; comp.release.value=0.25;
    const analyser=c.createAnalyser(); analyser.fftSize=2048; analyser.smoothingTimeConstant=0;
    const scope=new Float32Array(analyser.fftSize);
    master.connect(comp); comp.connect(analyser); analyser.connect(c.destination);

    // reverb
    const conv=c.createConvolver(); conv.buffer=impulse(c,2.8,3.0);
    const wet=c.createGain(); wet.gain.value=P.reverb; conv.connect(wet); wet.connect(master);

    // synthesis chain: 2 oscillators -> filter -> VCA
    const filt=c.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=1200; filt.Q.value=P.res;
    const vca=c.createGain(); vca.gain.value=0.0001;
    filt.connect(vca);
    const send=c.createGain(); send.gain.value=0.35; vca.connect(master); vca.connect(send); send.connect(conv);

    const o1=c.createOscillator(), o2=c.createOscillator();
    o1.type=P.wave; o2.type=P.wave; o2.detune.value=-6;               // slight warm unison
    const g2=c.createGain(); g2.gain.value=0.5;
    o1.connect(filt); o2.connect(g2); g2.connect(filt);
    o1.frequency.value=220; o2.frequency.value=220;

    // vibrato LFO -> pitch of both oscillators
    const lfo=c.createOscillator(); lfo.type='sine'; lfo.frequency.value=P.vibRate;
    const lfoAmt=c.createGain(); lfoAmt.gain.value=0;                 // depth in cents (driven by pressure)
    lfo.connect(lfoAmt); lfoAmt.connect(o1.detune); lfoAmt.connect(o2.detune);

    o1.start(); o2.start(); lfo.start();
    A={c,master,analyser,scope,filt,vca,o1,o2,lfo,lfoAmt,wet,send};
  };

  function impulse(c,dur,decay){ const len=c.sampleRate*dur, b=c.createBuffer(2,len,c.sampleRate);
    for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);
      for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);} return b; }

  Th.setWave = function(w){ P.wave=w; if(A){A.o1.type=w;A.o2.type=w;} };

  /* level (0..1) is optional: webcam mode passes the left hand's height for continuous volume */
  Th.audioActivate = function(on, level){
    if(!A) return; const t=A.c.currentTime;
    A.vca.gain.setTargetAtTime(on?0.26*(level===undefined?1:level):0.0001, t, on?0.015:0.09);
  };
})(window.Th);
