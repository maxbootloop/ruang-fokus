/* ═══════════════════════════════════════════════════════════════
   audio.js — efek suara lembut + instruksi bersuara (opsional)
   Dibuat dengan Web Audio API (tanpa file audio).
   Prinsip ADHD: umpan balik harus SEGERA, singkat, dan tidak meledak.
   Suara dihindari: buzzer keras, sirene, nada menghukum.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  let ctx = null;
  let master = null;
  let enabled = true;
  let voiceOn = true;
  let padNode = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.28;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  /* beberapa browser menahan audio sampai ada interaksi pengguna */
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(function () {});
  }

  /* satu nada lembut dengan amplop halus (tidak ada klik/pop) */
  function tone(freq, dur, type, gain, delay, glideTo) {
    const c = ensure();
    if (!c || !enabled) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    const peak = (gain == null ? 0.5 : gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.06, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  function chord(freqs, dur, gain, delay) {
    freqs.forEach(function (f, i) { tone(f, dur, 'sine', gain, (delay || 0) + i * 0.05); });
  }

  const SFX = {
    tap:     function () { tone(520, 0.07, 'sine', 0.22); },
    select:  function () { tone(660, 0.09, 'triangle', 0.24); },
    correct: function () { chord([659.25, 880], 0.16, 0.34); },           // E5→A5, hangat
    wrong:   function () { tone(233, 0.17, 'sine', 0.2, 0, 196); },        // turun lembut, bukan buzzer
    hint:    function () { tone(587.33, 0.12, 'sine', 0.18); },
    tick:    function () { tone(880, 0.045, 'sine', 0.1); },
    star:    function () { chord([783.99, 987.77, 1174.66], 0.22, 0.28); },
    round:   function () { chord([523.25, 659.25], 0.15, 0.26); },
    reward:  function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, 0.3, 'sine', 0.3, i * 0.11); }); },
    finish:  function () { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) { tone(f, 0.34, 'sine', 0.3, i * 0.1); }); },
    break:   function () { chord([440, 554.37], 0.3, 0.22); },
    calm:    function () { tone(396, 1.1, 'sine', 0.16, 0, 528); },
    open:    function () { tone(494, 0.1, 'sine', 0.18); }
  };

  /* ambience pad untuk latihan napas: sangat pelan, opsional */
  function padStart() {
    const c = ensure();
    if (!c || !enabled || padNode) return;
    try {
      const g = c.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 2);
      const a = c.createOscillator(); a.type = 'sine'; a.frequency.value = 174;
      const b = c.createOscillator(); b.type = 'sine'; b.frequency.value = 261.63;
      a.connect(g); b.connect(g); g.connect(master);
      a.start(); b.start();
      padNode = { a: a, b: b, g: g };
    } catch (e) {}
  }
  function padStop() {
    const c = ctx;
    if (!padNode || !c) return;
    try {
      padNode.g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.6);
      padNode.a.stop(c.currentTime + 0.7);
      padNode.b.stop(c.currentTime + 0.7);
    } catch (e) {}
    padNode = null;
  }

  /* ── suara instruksi (Web Speech API) ── */
  let voices = [];
  function loadVoices() {
    if (!global.speechSynthesis) return;
    voices = global.speechSynthesis.getVoices() || [];
  }
  if (global.speechSynthesis) {
    loadVoices();
    global.speechSynthesis.onvoiceschanged = loadVoices;
  }
  function say(text) {
    if (!voiceOn || !enabled || !global.speechSynthesis || !text) return;
    try {
      global.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''));
      u.lang = 'id-ID';
      u.rate = 0.94;
      u.pitch = 1.05;
      u.volume = 0.95;
      const v = voices.find(function (x) { return /id[-_]ID/i.test(x.lang); })
             || voices.find(function (x) { return /^id/i.test(x.lang); });
      if (v) u.voice = v;
      global.speechSynthesis.speak(u);
    } catch (e) {}
  }
  function hush() {
    if (global.speechSynthesis) { try { global.speechSynthesis.cancel(); } catch (e) {} }
  }

  global.Sound = {
    unlock: unlock,
    play: function (name) {
      const fn = SFX[name];
      if (fn) { try { fn(); } catch (e) {} }
    },
    setEnabled: function (on) { enabled = !!on; if (!on) { padStop(); hush(); } },
    isEnabled: function () { return enabled; },
    setVoice: function (on) { voiceOn = !!on; if (!on) hush(); },
    isVoice: function () { return voiceOn; },
    say: say,
    hush: hush,
    padStart: padStart,
    padStop: padStop
  };
})(window);
