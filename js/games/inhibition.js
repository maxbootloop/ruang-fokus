/* ═══════════════════════════════════════════════════════════════
   inhibition.js — "Tahan Dulu!"
   Latihan: kontrol impuls / respons inhibisi (Go–No-Go).
   Ini latihan yang paling dekat dengan kesulitan inti ADHD:
   menahan diri untuk TIDAK bereaksi.
   Adaptasi penting agar tidak menghukum anak:
   • rasionya ramah: awalnya 4 isyarat "boleh" : 1 isyarat "tahan"
   • isyarat "tahan" besar, jelas, dengan warna & bunyi berbeda
   • salah menekan TIDAK memotong poin; diberi isyarat lembut + napas
   • ada kadens lambat (1 isyarat per ~1,3 detik), bukan tembak cepat
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const G = global.Games = global.Games || [];
  const el = global.UI.el;

  function ratio(round) { return round <= 1 ? 0.2 : (round === 2 ? 0.3 : 0.38); } // porsi isyarat "tahan"

  G.push({
    id: 'tahan-dulu',
    title: 'Tahan Dulu!',
    subtitle: 'Latihan menahan impuls',
    emoji: '✋',
    blurb: 'Ketuk bintang secepatnya — tapi JANGAN ketuk bom. Tahan tanganmu.',
    duration: 150,
    rounds: 3,
    focus: ['impuls', 'atensi'],
    energy: 'tinggi',
    sensory: 'sedang',
    steps: [
      'Sebuah gambar muncul di tengah lingkaran.',
      'Kalau BINTANG: ketuk secepatnya. Dapat poin.',
      'Kalau BOM: jangan ketuk sama sekali. Tahan tanganmu.',
      'Kalau kamu hampir menekan bom, tarik napas panjang sekali, lalu lanjut.'
    ],
    benefits: [
      'Melatih menahan respons impulsif (Go–No-Go)',
      'Melatih kecepatan reaksi yang tepat, bukan sekadar cepat',
      'Melatih kesadaran diri saat tangan ingin bergerak lebih dulu'
    ],

    mount: function (stage, host) {
      let running = true;
      let starCount = 0;           // bintang yang berhasil diketuk (per ronde)
      let bombCount = 0;           // bom yang gagal ditahan (per ronde)
      let heldTotal = 0;           // total berhasil menahan (seluruh sesi)
      let perRound = 8;
      let inRound = 0;
      let current = null;          // { isBomb, shownAt, timer }
      let gapTimer = null;
      let paused = false;
      let pauseStartedAt = 0;      // untuk menghitung sisa jendela respons saat dilanjutkan
      let gapLeft = 0;             // sisa jeda antar isyarat saat dibekukan

      const hint = el('div', { class: 'gbar__hint', text: 'Bersiap…' });
      const stat = el('div', { class: 'gbar__stat' }, [
        el('span', { class: 'gstat gstat--good', id: 'tdStar', text: '⭐ 0' }),
        el('span', { class: 'gstat gstat--warn', id: 'tdBomb', text: '💥 0' }),
        el('span', { class: 'gstat', id: 'tdLeft', text: '8 isyarat' })
      ]);
      const bar = el('div', { class: 'gbar' }, [hint, stat]);

      const pad = el('div', { class: 'gfield', style: { minHeight: '190px' } });
      const btn = el('button', {
        class: 'holdbtn', type: 'button', id: 'tdBtn',
        'aria-label': 'Tombol reaksi'
      }, [
        el('span', { class: 'holdbtn__ring', id: 'tdRing', 'aria-hidden': 'true' }),
        el('span', { id: 'tdFace', text: '👀', style: { fontSize: '3.4rem' } })
      ]);
      pad.appendChild(btn);

      const wrap = el('div', { class: 'gwrap' }, [bar, pad]);
      stage.appendChild(wrap);

      function updateStats() {
        const s = document.getElementById('tdStar');
        const b = document.getElementById('tdBomb');
        const l = document.getElementById('tdLeft');
        if (s) s.textContent = '⭐ ' + starCount;
        if (b) b.textContent = '💥 ' + bombCount;
        if (l) l.textContent = Math.max(0, perRound - inRound) + ' isyarat';
      }

      function face(txt) {
        const f = document.getElementById('tdFace');
        if (f) f.textContent = txt;
      }

      function nextCue() {
        if (!running) return;
        if (paused) return;                     // dilanjutkan lewat resumeTimers()
        if (inRound >= perRound) { endRound(); return; }
        inRound++;
        updateStats();

        const isBomb = Math.random() < ratio(host.round());
        current = { isBomb: isBomb, shownAt: performance.now(), done: false };

        btn.classList.remove('is-holding', 'is-tooearly');
        if (isBomb) {
          face('💥');
          btn.style.borderColor = 'var(--danger)';
          btn.style.background = 'var(--danger-soft)';
          hint.textContent = 'JANGAN ketuk! Tahan tanganmu.';
          host.sound('hint');
        } else {
          face('⭐');
          btn.style.borderColor = 'var(--primary)';
          btn.style.background = 'var(--primary-soft)';
          hint.textContent = 'Ketuk sekarang!';
        }

        /* jendela respons: bintang lebih lama supaya anak tidak frustrasi */
        const window = isBomb ? 1200 : 1500;
        current.window = window;
        current.expire = function () {
          if (!running || !current || current.done) return;
          if (paused) return;                    // menunggu dilanjutkan
          current.done = true;
          if (current.isBomb) {
            /* berhasil menahan diri — ini inti latihannya */
            heldTotal++;
            host.right(14);
            host.prompt('Hebat, kamu berhasil menahan! Itu latihan yang berat.', 'good');
            host.countRetry();
          } else {
            /* bintang terlewat: tanpa hukuman, hanya lanjut */
            host.prompt('Terlewat satu bintang. Tidak apa-apa, lanjut.', 'soft');
          }
          face('👀');
          updateStats();
          scheduleCue(380);
        };
        current.timer = global.setTimeout(current.expire, window);
      }

      /* Penjadwalan isyarat berikutnya yang sadar-jeda: durasinya disimpan
         agar tidak hilang saat tab disembunyikan atau anak menekan Jeda. */
      function scheduleCue(ms) {
        gapLeft = ms;
        gapTimer = global.setTimeout(function () {
          gapLeft = 0;
          nextCue();
        }, ms);
      }

      function pauseTimers() {
        pauseStartedAt = performance.now();
        global.clearTimeout(gapTimer);
        gapTimer = null;
        if (current && current.timer) { global.clearTimeout(current.timer); current.timer = null; }
      }

      function resumeTimers() {
        if (!running) return;
        if (current && !current.done) {
          const left = Math.max(150, (current.window || 1200) - (pauseStartedAt - current.shownAt));
          current.shownAt = performance.now();
          current.timer = global.setTimeout(current.expire, left);
        } else {
          scheduleCue(Math.max(250, gapLeft || 380));
        }
      }

      function endRound() {
        running = false;
        const last = host.round() >= host.roundsTotal();
        if (last) {
          host.prompt('Selesai! Kamu berlatih menahan diri ' + perRound * host.roundsTotal() + ' kali.', 'good');
          host.complete();
          return;
        }
        const next = host.round() + 1;
        host.prompt('Ronde selesai! Badanmu butuh gerak sekarang.', 'good');
        host.offerMovementBreak(15, function () {
          running = true;
          inRound = 0;
          perRound = 8;
          host.setRound(next);
          host.setSteps([
            'Lingkaran akan menyala lagi.',
            'Bintang: ketuk cepat.',
            'Bom: tahan tanganmu.',
            'Napas panjang sekali kalau tanganmu hampir menekan bom.'
          ], 1);
          updateStats();
          scheduleCue(700);
        });
      }

      function tap() {
        if (!running) return;
        if (paused) return;
        if (!current || current.done) {
          host.prompt('Tunggu isyaratnya muncul dulu, ya.', 'soft');
          return;
        }
        current.done = true;
        global.clearTimeout(current.timer);

        if (current.isBomb) {
          bombCount++;
          btn.classList.add('is-tooearly');
          host.wrong();
          host.prompt('Itu bom. Tidak apa-apa — tarik napas panjang sekali, lalu coba lagi.', 'soft');
          host.countRetry();
          global.Sound.say('Tarik napas');
        } else {
          const rt = Math.round(performance.now() - current.shownAt);
          starCount++;
          host.right(rt < 700 ? 14 : 10);
          host.prompt('Bagus! ' + rt + ' milidetik.', 'good');
        }
        face('👀');
        updateStats();
        scheduleCue(380);
      }

      btn.addEventListener('click', tap);
      const keyHandler = function (e) {
        if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); tap(); }
      };
      document.addEventListener('keydown', keyHandler);

      updateStats();
      host.setSteps(this.steps, 1);
      scheduleCue(900);

      const cleanup = function () {
        running = false;
        global.clearTimeout(gapTimer);
        if (current && current.timer) global.clearTimeout(current.timer);
        document.removeEventListener('keydown', keyHandler);
      };
      this._cleanup = cleanup;

      /* dipanggil oleh Session saat tab disembunyikan, dijeda, atau ada jeda gerak.
         Semua timer dibatalkan supaya tidak menumpuk lalu meledak sekaligus. */
      this._pause = function () {
        if (paused) return;
        paused = true;
        pauseTimers();
      };
      this._resume = function () {
        if (!paused) return;
        paused = false;
        resumeTimers();
      };
    },

    pause: function () { if (this._pause) this._pause(); },
    resume: function () { if (this._resume) this._resume(); },
    unmount: function () { if (this._cleanup) this._cleanup(); }
  });
})(window);
