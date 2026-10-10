/* ═══════════════════════════════════════════════════════════════
   calm.js — "Tenang Dulu" (kontrol diri menunggu isyarat)
   Latihan: toleransi menunda respons & menahan gerak (delay tolerance).
   Anak harus MENAHAN tombol sampai isyarat berubah, lalu melepas.
   Adaptasi ADHD:
   • waktu tunggu pendek dan bervariasi (2–9 detik), tidak menyiksa
   • ada penghitung visual yang terus bergerak agar anak tidak "buta waktu"
   • melepas terlalu cepat TIDAK dihukum, hanya diulang dengan tenang
   • setiap keberhasilan dihargai; satu putaran selesai cepat
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const G = global.Games = global.Games || [];
  const el = global.UI.el;

  const PER_ROUND = 4;

  G.push({
    id: 'tenang-dulu',
    title: 'Tenang Dulu',
    subtitle: 'Latihan menunggu',
    emoji: '⏳',
    blurb: 'Tahan jarimu di tombol. Lepas HANYA saat tombol berubah hijau.',
    duration: 150,
    rounds: 2,
    focus: ['impuls', 'regulasi'],
    energy: 'rendah',
    sensory: 'rendah',
    steps: [
      'Letakkan satu jari di lingkaran besar.',
      'Tahan terus — jangan dilepas dulu.',
      'Lingkaran berubah HIJAU dan berbunyi: baru lepaskan jarimu.',
      'Kalau terlepas terlalu cepat, tidak apa-apa, kita ulangi pelan-pelan.'
    ],
    benefits: [
      'Melatih menunda respons (waiting tolerance)',
      'Melatih menahan gerakan motorik saat sudah siap bergerak',
      'Melatih membaca isyarat waktu, bukan menebak'
    ],

    mount: function (stage, host) {
      let running = true;
      let round = host.round();
      let inRound = 0;
      let holding = false;
      let armed = false;          // sudah waktunya lepas
      let waitTimer = null;
      let tickTimer = null;
      let startedAt = 0;
      let waited = 0;

      const hint = el('div', { class: 'gbar__hint', text: 'Tekan dan tahan tombol. Tunggu isyarat hijau.' });
      const stat = el('div', { class: 'gbar__stat' }, [
        el('span', { class: 'gstat gstat--good', id: 'tdOk2', text: '✔ 0' }),
        el('span', { class: 'gstat', id: 'tdRound2', text: 'Putaran 1/' + PER_ROUND })
      ]);
      const bar = el('div', { class: 'gbar' }, [hint, stat]);

      const ring = el('span', { class: 'holdbtn__ring', id: 'ctRing', 'aria-hidden': 'true' });
      const btn = el('button', {
        class: 'holdbtn', type: 'button', id: 'ctBtn', 'aria-label': 'Tahan tombol untuk latihan menunggu'
      }, [ring, el('span', { id: 'ctFace', text: '👇', style: { fontSize: '3.2rem' } })]);
      const pad = el('div', { class: 'gfield', style: { minHeight: '230px' } }, [btn]);

      const wrap = el('div', { class: 'gwrap' }, [bar, pad]);
      stage.appendChild(wrap);

      let ok = 0;

      function face(t) { const f = document.getElementById('ctFace'); if (f) f.textContent = t; }
      function updateStats() {
        const a = document.getElementById('tdOk2');
        const r = document.getElementById('tdRound2');
        if (a) a.textContent = '✔ ' + ok;
        if (r) r.textContent = 'Putaran ' + Math.min(inRound + 1, PER_ROUND) + '/' + PER_ROUND;
      }
      function setRing(pct, color) {
        const rg = document.getElementById('ctRing');
        if (!rg) return;
        rg.style.background = 'conic-gradient(' + (color || 'var(--accent)') + ' ' + pct.toFixed(3) + 'turn, transparent 0turn)';
      }
      function clearTimers() {
        global.clearTimeout(waitTimer);
        global.clearInterval(tickTimer);
        waitTimer = null; tickTimer = null;
      }

      function beginHold() {
        if (!running || holding) return;
        holding = true;
        armed = false;
        startedAt = performance.now();
        waited = 0;
        btn.classList.add('is-holding');
        btn.classList.remove('is-tooearly');
        btn.style.borderColor = 'var(--accent)';
        btn.style.background = 'var(--accent-soft)';
        face('⏳');
        hint.textContent = 'Tahan… tunggu isyarat hijau.';
        host.prompt('Bagus, tahan terus. Tunggu sampai hijau.', null);

        const target = global.UI.randInt(round >= 2 ? 3000 : 2000, round >= 2 ? 9000 : 6000);
        tickTimer = global.setInterval(function () {
          waited = performance.now() - startedAt;
          setRing(Math.min(1, waited / target), 'var(--accent)');
          /* penghitung visual: anak bisa melihat waktu berjalan */
          const left = Math.max(0, Math.ceil((target - waited) / 100) / 10);
          face(left.toFixed(1));
        }, 100);

        waitTimer = global.setTimeout(function () {
          if (!running || !holding) return;
          armed = true;
          global.clearInterval(tickTimer);
          btn.classList.add('is-holding');
          btn.style.borderColor = 'var(--good)';
          btn.style.background = 'var(--good-soft)';
          face('✅');
          hint.textContent = 'SEKARANG lepaskan!';
          setRing(1, 'var(--good)');
          global.Sound.play('select');
          host.say('Lepaskan');
          /* jendela 2 detik untuk melepas */
          waitTimer = global.setTimeout(function () {
            if (!running || !holding) return;
            endHold(true);
          }, 2200);
        }, target);
      }

      function endHold(timedOut) {
        if (!running || !holding) return;
        holding = false;
        clearTimers();
        btn.classList.remove('is-holding');
        btn.style.borderColor = 'var(--primary)';
        btn.style.background = 'var(--primary-soft)';
        setRing(0, 'var(--accent)');

        if (armed && !timedOut) {
          ok++;
          inRound++;
          host.right(15);
          const secs = ((performance.now() - startedAt) / 1000).toFixed(1);
          host.prompt('Tepat! Kamu menunggu ' + secs + ' detik. Itu latihan yang bagus.', 'good');
        } else if (timedOut && armed) {
          inRound++;
          host.prompt('Kamu menunggu, tetapi belum melepas. Kita coba lagi, lebih cepat sedikit.', 'soft');
          host.countRetry();
        } else {
          host.wrong();
          btn.classList.add('is-tooearly');
          host.prompt('Terlepas terlalu cepat. Tidak apa-apa — tarik napas, lalu tahan lagi.', 'soft');
          host.countRetry();
          global.Sound.say('Tarik napas dulu');
        }
        face('👇');
        updateStats();

        if (inRound >= PER_ROUND) {
          global.setTimeout(endRound, 700);
        } else {
          global.setTimeout(function () {
            btn.classList.remove('is-tooearly');
            hint.textContent = 'Tekan dan tahan lagi. Tunggu isyarat hijau.';
          }, 500);
        }
      }

      function endRound() {
        const last = round >= host.roundsTotal();
        if (last) {
          host.prompt('Semua putaran selesai! ' + ok + ' kali berhasil menunggu.', 'good');
          host.complete();
          return;
        }
        running = false;
        host.prompt('Ronde selesai! Gerakkan badan dulu sebentar.', 'good');
        host.offerMovementBreak(12, function () {
          running = true;
          round++;
          inRound = 0;
          host.setRound(round);
          updateStats();
          hint.textContent = 'Tekan dan tahan. Tunggu isyarat hijau.';
        });
      }

      btn.addEventListener('pointerdown', function (e) { e.preventDefault(); beginHold(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
        btn.addEventListener(ev, function () { endHold(false); });
      });
      btn.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!holding) beginHold(); }
      });
      btn.addEventListener('keyup', function (e) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); endHold(false); }
      });

      updateStats();
      host.setSteps(this.steps, 1);

      this._cleanup = function () { running = false; holding = false; clearTimers(); };
    },

    pause: function () {},
    resume: function () {},
    unmount: function () { if (this._cleanup) this._cleanup(); }
  });

  /* ── alat mandiri: lingkaran napas untuk "Pojok Tenang" ── */
  const BreathTool = {
    running: false,
    _timers: [],
    _pattern: { in: 4, hold: 1, out: 6 },
    start: function (onBreath) {
      const self = this;
      this.stop();
      this.running = true;
      const orb = document.getElementById('breathOrb');
      const label = document.getElementById('breathLabel');
      const count = document.getElementById('breathCount');
      const p = this._pattern;
      let breath = 0;

      function setLabel(t) { if (label) label.textContent = t; }
      function setOrb(cls, color) {
        if (!orb) return;
        orb.className = 'breath__orb ' + cls;
      }
      function later(fn, ms) { self._timers.push(global.setTimeout(fn, ms)); }

      function cycle() {
        if (!self.running) return;
        setOrb('is-in');
        setLabel('Tarik napas');
        global.Sound.play('calm');
        later(function () {
          if (!self.running) return;
          setLabel('Tahan');
          later(function () {
            if (!self.running) return;
            setOrb('is-out');
            setLabel('Buang napas');
            later(function () {
              if (!self.running) return;
              breath++;
              if (count) count.textContent = breath + ' napas selesai';
              if (onBreath) onBreath(breath);
              cycle();
            }, p.out * 1000);
          }, p.hold * 1000);
        }, p.in * 1000);
      }
      if (count) count.textContent = '';
      cycle();
    },
    stop: function () {
      this.running = false;
      this._timers.forEach(function (t) { global.clearTimeout(t); });
      this._timers = [];
      const label = document.getElementById('breathLabel');
      const orb = document.getElementById('breathOrb');
      if (label) label.textContent = 'Siap';
      if (orb) orb.className = 'breath__orb';
      global.Sound.padStop();
    }
  };

  global.BreathTool = BreathTool;
})(window);
