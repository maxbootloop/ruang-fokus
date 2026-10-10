/* ═══════════════════════════════════════════════════════════════
   breathe.js — "Napas Warna"
   Latihan: regulasi diri & menenangkan sistem saraf.
   Latar bukti: latihan pernapasan lambat (sekitar 4–6 napas/menit)
   sering dipakai sebagai bagian intervensi ADHD untuk menurunkan
   gairah berlebih dan membantu anak kembali ke kondisi siap belajar.
   Adaptasi: tidak ada target napas, tidak ada penilaian, dan anak
   boleh berhenti kapan saja tanpa kehilangan apa pun.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const G = global.Games = global.Games || [];
  const el = global.UI.el;

  G.push({
    id: 'napas-warna',
    title: 'Napas Warna',
    subtitle: 'Menenangkan diri',
    emoji: '🌬️',
    blurb: 'Ikuti lingkaran warna: membesar = tarik napas, mengecil = buang napas.',
    duration: 120,
    rounds: 2,
    focus: ['regulasi'],
    energy: 'rendah',
    sensory: 'rendah',
    steps: [
      'Duduk santai. Bahu turun. Tangan di pangkuan.',
      'Lingkaran membesar dan menjadi hijau: tarik napas lewat hidung.',
      'Lingkaran mengecil dan menjadi jingga: buang napas lewat mulut, pelan.',
      'Ikuti saja sampai hitungan selesai. Tidak perlu sempurna.'
    ],
    benefits: [
      'Melatih pernapasan lambat untuk menurunkan gairah berlebih',
      'Melatih mengenali tanda tubuh tegang',
      'Memberi jalan keluar saat frustrasi, bukan hukuman'
    ],

    mount: function (stage, host) {
      let running = true;
      let phase = 'idle';
      let breath = 0;

      const perRound = 4;
      const inhale = host.round() >= 2 ? 4 : 4;
      const exhale = host.round() >= 2 ? 7 : 5;

      const hint = el('div', { class: 'gbar__hint', text: 'Siap? Ikuti lingkarannya.' });
      const stat = el('div', { class: 'gbar__stat' }, [
        el('span', { class: 'gstat', id: 'bwCount', text: '0/' + perRound + ' napas' })
      ]);
      const bar = el('div', { class: 'gbar' }, [hint, stat]);

      const orb = el('div', { class: 'borb', id: 'bwOrb' }, [el('span', { id: 'bwLabel', text: 'Siap' })]);
      const pad = el('div', { class: 'gfield', style: { minHeight: '250px' } }, [orb]);

      const cta = el('div', { class: 'gcta' }, [
        el('button', { class: 'btn btn--primary btn--lg', type: 'button', onClick: function () { begin(); } }, ['▶ Mulai bernapas']),
        el('button', {
          class: 'btn btn--ghost btn--lg', type: 'button', dataset: { noautoclick: '1' },
          onClick: function () { if (running) host.complete(); }
        }, ['Sudah cukup, selesai'])
      ]);

      const wrap = el('div', { class: 'gwrap' }, [bar, pad, cta]);
      stage.appendChild(wrap);

      function label(t) { const l = document.getElementById('bwLabel'); if (l) l.textContent = t; }

      function updateCount() {
        const c = document.getElementById('bwCount');
        if (c) c.textContent = breath + '/' + perRound + ' napas';
      }

      /* Penjadwalan yang sadar-jeda: setiap timer mengingat sisa waktunya,
         sehingga napas tidak terpotong atau meloncat saat tab disembunyikan,
         anak menekan Jeda, atau sesi masuk jeda gerak. */
      let schedule = [];
      let paused = false;

      function clearTimers() {
        schedule.forEach(function (item) { global.clearTimeout(item.handle); });
        schedule = [];
      }
      function later(fn, ms) {
        const item = { fn: fn, total: ms, startedAt: performance.now(), handle: null };
        item.handle = global.setTimeout(function () {
          schedule = schedule.filter(function (x) { return x !== item; });
          if (paused) return;
          fn();
        }, ms);
        schedule.push(item);
      }
      function pauseTimers() {
        if (paused) return;
        paused = true;
        const now = performance.now();
        schedule.forEach(function (item) {
          global.clearTimeout(item.handle);
          item.remaining = Math.max(0, item.total - (now - item.startedAt));
        });
      }
      function resumeTimers() {
        if (!paused) return;
        paused = false;
        const pending = schedule.slice();
        schedule = [];
        pending.forEach(function (item) { later(item.fn, item.remaining == null ? item.total : item.remaining); });
      }

      function begin() {
        clearTimers();
        paused = false;
        breath = 0;
        updateCount();
        host.setSteps(thisGame.steps, 1);
        cycle();
      }

      function cycle() {
        if (!running) return;
        if (breath >= perRound) { endRound(); return; }

        /* ── tarik napas ── */
        phase = 'in';
        orb.className = 'borb is-in';
        orb.style.background = 'radial-gradient(circle at 35% 30%, #A8E4DA, #0E6E64)';
        label('Tarik napas…');
        hint.textContent = 'Tarik napas lewat hidung, pelan.';
        global.Sound.play('calm');
        host.say('Tarik napas');

        later(function () {
          if (!running) return;
          /* ── tahan sebentar ── */
          label('Tahan');
          hint.textContent = 'Tahan sebentar. Tenang.';

          later(function () {
            if (!running) return;
            /* ── buang napas ── */
            phase = 'out';
            orb.className = 'borb is-out';
            orb.style.background = 'radial-gradient(circle at 35% 30%, #FFE39B, #D97706)';
            label('Buang napas…');
            hint.textContent = 'Buang napas lewat mulut, lebih panjang dari tarikan.';
            host.sound('hint');
            host.say('Buang napas');

            later(function () {
              if (!running) return;
              breath++;
              updateCount();
              if (breath >= perRound) { endRound(); return; }
              cycle();
            }, exhale * 1000);
          }, 300);
        }, inhale * 1000);
      }

      function endRound() {
        clearTimers();
        const last = host.round() >= host.roundsTotal();
        host.countCalm();
        if (last) {
          label('Tenang');
          host.prompt('Selesai. Perhatikan badanmu sekarang — biasanya lebih ringan.', 'good');
          host.complete();
          return;
        }
        label('Ronde selesai');
        host.prompt('Ronde pertama selesai. Bagus. Lanjut satu ronde lagi.', 'good');
        later(function () {
          if (!running) return;
          host.setRound(host.round() + 1);
          breath = 0;
          updateCount();
          cycle();
        }, 1800);
      }

      const thisGame = this;
      host.setSteps(this.steps, 1);
      later(begin, 700);

      const cleanup = function () { running = false; clearTimers(); };
      this._cleanup = cleanup;
      this._pause = function () { pauseTimers(); };
      this._resume = function () { resumeTimers(); };
    },

    pause: function () { if (this._pause) this._pause(); },
    resume: function () { if (this._resume) this._resume(); },
    unmount: function () { if (this._cleanup) this._cleanup(); }
  });
})(window);
