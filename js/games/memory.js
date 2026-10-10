/* ═══════════════════════════════════════════════════════════════
   memory.js — "Ingat Urutan"
   Latihan: memori kerja visual-spasial & memori jangka pendek.
   Adaptasi ADHD (memori kerja sering lemah):
   • urutan pendek (3 → 5 langkah), tidak pernah 8–9 langkah
   • tombol "Lihat lagi" tersedia — anak tidak diuji tanpa bantuan
   • penanda titik menunjukkan posisi langkah saat ini (dudukan eksternal)
   • jeda gerak antar ronde untuk memulihkan atensi
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const G = global.Games = global.Games || [];
  const el = global.UI.el;

  const ICONS = ['🍓', '🍋', '🥝', '🍇', '🌽', '🥕', '🍩', '🧁', '🍪'];

  function seqLen(round) { return round <= 1 ? 3 : (round === 2 ? 4 : 5); }

  G.push({
    id: 'ingat-urutan',
    title: 'Ingat Urutan',
    subtitle: 'Latihan memori kerja',
    emoji: '🧠',
    blurb: 'Perhatikan urutan kotak yang menyala, lalu ketuk dengan urutan yang sama.',
    duration: 150,
    rounds: 3,
    focus: ['memori', 'atensi'],
    energy: 'rendah',
    sensory: 'sedang',
    steps: [
      'Perhatikan: kotak akan menyala satu per satu.',
      'Ingat urutannya — dari yang pertama sampai terakhir.',
      'Ketuk kotak dengan urutan yang sama.',
      'Kalau lupa, tekan tombol "Lihat lagi" (boleh dipakai 2 kali).'
    ],
    benefits: [
      'Melatih memori kerja visual-spasial',
      'Melatih perhatian pada urutan dan detail',
      'Melatih kesabaran menunggu giliran'
    ],

    mount: function (stage, host) {
      let running = true;
      let sequence = [];
      let inputIdx = 0;
      let playing = false;
      let replaysLeft = 2;
      let roundNo = host.round();

      const hint = el('div', { class: 'gbar__hint', id: 'imHint', text: 'Perhatikan urutannya…' });
      const dots = el('div', { class: 'seqdots', id: 'imDots' });
      const stat = el('div', { class: 'gbar__stat' }, [
        el('span', { class: 'gstat', id: 'imLen', text: '3 langkah' }),
        el('span', { class: 'gstat gstat--warn', id: 'imReplay', text: 'Lihat lagi: 2' })
      ]);
      const bar = el('div', { class: 'gbar' }, [hint, stat]);

      const board = el('div', { class: 'gboard', id: 'imBoard', style: { gridTemplateColumns: 'repeat(3, auto)' } });
      const cta = el('div', { class: 'gcta' }, [
        el('button', { class: 'btn btn--ghost btn--lg', type: 'button', id: 'imReplayBtn', onClick: function () { replay(false); } }, ['👀 Lihat lagi']),
        el('button', { class: 'btn btn--ghost btn--lg', type: 'button', id: 'imNewBtn', onClick: function () { newSeq(0); } }, ['🔁 Urutan baru'])
      ]);
      const wrap = el('div', { class: 'gwrap' }, [bar, dots, board, cta]);
      stage.appendChild(wrap);

      const tiles = [];
      ICONS.slice(0, 9).forEach(function (ico, i) {
        const t = el('button', {
          class: 'cell', type: 'button', dataset: { i: String(i) },
          'aria-label': 'Kotak ' + (i + 1) + ' ' + ico
        }, [el('span', { text: ico })]);
        t.addEventListener('click', function () { onTap(i); });
        tiles.push(t);
        board.appendChild(t);
      });

      function setDots(n) {
        global.UI.clear(dots);
        for (let i = 0; i < n; i++) {
          dots.appendChild(el('span', { class: 'seqdot' + (i < inputIdx ? ' is-done' : (i === inputIdx ? ' is-now' : '')), 'aria-hidden': 'true' }));
        }
      }

      function updateStats() {
        const l = document.getElementById('imLen');
        const r = document.getElementById('imReplay');
        if (l) l.textContent = sequence.length + ' langkah';
        if (r) r.textContent = 'Lihat lagi: ' + replaysLeft;
      }

      function resetTiles() {
        tiles.forEach(function (t) { t.className = 'cell'; t.disabled = false; });
      }

      /* Timer urutan dilacak supaya bisa dibatalkan saat sesi dibekukan
         (tab disembunyikan, anak menekan Jeda, atau ada jeda gerak).
         Kalau tidak, urutan bisa berjalan sendiri tanpa ditonton anak. */
      let pending = [];
      function clearPending() {
        pending.forEach(function (h) { global.clearTimeout(h); });
        pending = [];
      }
      function at(fn, ms) {
        pending.push(global.setTimeout(function () {
          if (!running) return;
          fn();
        }, ms));
      }

      function newSeq(extra) {
        resetTiles();
        inputIdx = 0;
        const len = seqLen(roundNo) + (extra || 0);
        const pool = global.UI.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
        sequence = pool.slice(0, len);
        updateStats();
        setDots(len);
        play();
      }

      function play() {
        clearPending();
        playing = true;
        hint.textContent = 'Perhatikan urutannya…';
        host.say('Perhatikan');
        tiles.forEach(function (t) { t.disabled = true; });
        global.UI.clear(dots);
        sequence.forEach(function (idx, k) {
          at(function () {
            const t = tiles[idx];
            t.classList.add('is-lit');
            host.sound('select');
            global.setTimeout(function () { t.classList.remove('is-lit'); }, 420);
          }, 620 * k + 420);
        });
        at(function () {
          playing = false;
          tiles.forEach(function (t) { t.disabled = false; });
          hint.textContent = 'Sekarang ketuk dengan urutan yang sama.';
          host.prompt('Giliranmu! Ketuk dari yang pertama.', null);
          setDots(sequence.length);
          inputIdx = 0;
          setDots(sequence.length);
        }, 620 * sequence.length + 420);
      }

      function replay(manual) {
        if (!running || playing) return;
        if (replaysLeft <= 0) {
          host.prompt('Bantuan lihat lagi sudah habis. Tetap coba — salah juga tidak apa-apa.', 'soft');
          return;
        }
        replaysLeft--;
        if (manual !== true) host.countRetry();
        updateStats();
        host.setSteps(thisGame.steps, 3);
        play();
      }

      function onTap(i) {
        if (!running || playing) return;
        if (sequence[inputIdx] === i) {
          tiles[i].classList.add('is-ok');
          global.setTimeout(function () { if (tiles[i]) tiles[i].classList.remove('is-ok'); }, 280);
          inputIdx++;
          host.sound('tap');
          setDots(sequence.length);
          if (inputIdx >= sequence.length) {
            host.right(20);
            host.prompt('Benar semua! Kamu mengingat ' + sequence.length + ' langkah.', 'good');
            playing = true;
            tiles.forEach(function (t) { t.disabled = true; });
            at(function () {
              if (roundNo >= host.roundsTotal()) {
                host.complete();
                return;
              }
              host.prompt('Ronde selesai. Ayo gerak sebentar!', 'good');
              host.offerMovementBreak(12, function () {
                roundNo++;
                host.setRound(roundNo);
                replaysLeft = 2;
                inputIdx = 0;
                newSeq(0);
              });
            }, 900);
          }
        } else {
          host.wrong();
          tiles[i].classList.add('is-bad');
          global.setTimeout(function () { if (tiles[i]) tiles[i].classList.remove('is-bad'); }, 420);
          host.prompt('Bukan itu urutannya. Tenang — coba lihat lagi urutannya.', 'soft');
          inputIdx = 0;
          setDots(sequence.length);
          if (replaysLeft > 0) {
            at(function () { replay(true); }, 900);
          } else {
            at(function () {
              host.prompt('Tidak masalah. Ini urutan baru, lebih pelan.', 'soft');
              newSeq(0);
            }, 1100);
          }
        }
      }

      const thisGame = this;
      host.setSteps(this.steps, 1);
      newSeq(0);

      this._cleanup = function () { running = false; clearPending(); };
      /* Saat dibekukan, urutan yang sedang berjalan dibatalkan lalu diulang
         dari awal ketika anak kembali — lebih baik mengulang daripada
         menampilkan urutan yang sudah setengah jalan. */
      this._pause = function () {
        if (!playing) { clearPending(); return; }
        clearPending();
        playing = false;
        tiles.forEach(function (t) { t.disabled = true; });
        hint.textContent = 'Dijeda sebentar…';
      };
      this._resume = function () {
        if (!running || playing) return;
        const waitingForRedo = tiles.some(function (t) { return t.disabled; });
        if (waitingForRedo) {
          hint.textContent = 'Kita lihat ulang urutannya, ya.';
          play();
        } else {
          tiles.forEach(function (t) { t.disabled = false; });
          hint.textContent = 'Sekarang ketuk dengan urutan yang sama.';
        }
      };
    },

    pause: function () { if (this._pause) this._pause(); },
    resume: function () { if (this._resume) this._resume(); },
    unmount: function () { if (this._cleanup) this._cleanup(); }
  });
})(window);
