// WebAudio synthesizer: every sound in BREACH LINE is generated, none is a file. A low
// pad drone sits under the match; gunfire, hits, pickups, the arm klaxon and the round
// stings layer on top. The whole engine mutes with the audio context's own suspend.

export function createAudio() {
  let ctx = null;
  let master = null;
  let droneGain = null;
  let enabled = true;

  function boot() {
    if (ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { enabled = false; return; }
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // Two detuned saws through a lowpass make the station's ambient hum.
    droneGain = ctx.createGain();
    droneGain.gain.value = 0.05;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    for (const freq of [55, 55.8]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start();
    }
    filter.connect(droneGain);
    droneGain.connect(master);
  }

  function blip(freq, seconds, type, volume, sweep) {
    if (!enabled) return;
    boot();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(30, sweep), ctx.currentTime + seconds);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
    osc.connect(gain); gain.connect(master);
    osc.start(); osc.stop(ctx.currentTime + seconds);
  }

  function noise(seconds, volume, filterHz) {
    if (!enabled) return;
    boot();
    if (ctx.state === 'suspended') ctx.resume();
    const frames = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterHz || 900;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start();
  }

  return {
    resume() { boot(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    shot() { noise(0.12, 0.55, 1400); blip(150, 0.08, 'square', 0.2, 60); },
    sniper() { noise(0.3, 0.7, 2400); blip(90, 0.22, 'sawtooth', 0.25, 40); },
    hit() { blip(300, 0.07, 'triangle', 0.25, 180); },
    headshot() { blip(720, 0.12, 'triangle', 0.3, 240); },
    kill() { blip(520, 0.14, 'sine', 0.3, 700); },
    down() { blip(220, 0.5, 'sawtooth', 0.3, 60); },
    reload() { blip(200, 0.06, 'square', 0.15); setTimeout(() => blip(260, 0.06, 'square', 0.15), 140); },
    empty() { blip(140, 0.05, 'square', 0.12); },
    buy() { blip(660, 0.09, 'sine', 0.25); setTimeout(() => blip(880, 0.09, 'sine', 0.25), 90); },
    arm() { for (let i = 0; i < 3; i += 1) setTimeout(() => blip(440, 0.16, 'square', 0.3, 330), i * 260); },
    beep() { blip(880, 0.05, 'square', 0.18); },
    explode() { noise(0.8, 0.9, 400); blip(70, 0.6, 'sawtooth', 0.4, 30); },
    win() { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.3), i * 140)); },
    lose() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'triangle', 0.3), i * 160)); },
    roundStart() { blip(392, 0.1, 'triangle', 0.25); setTimeout(() => blip(523, 0.14, 'triangle', 0.25), 120); },
  };
}
