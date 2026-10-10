/* ═══════════════════════════════════════════════════════════════
   attention.js — "Lampu Fokus"
   Latihan: atensi berkelanjutan & atensi selektif (mencari target
   di antara pengganggu), motorik halus, pemindaian visual.
   Adaptasi ADHD:
   • hanya satu target muncul sekaligus — tidak ada beban mencari banyak hal
   • pengganggu bergerak pelan, bukan berkedip cepat (anti-overstimulasi)
   • ronde pendek + jeda gerak di antara ronde
   • salah tidak dihukum; hanya diberi isyarat lembut
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const G = global.Games = global.Games || [];
  const el = global.UI.el;

  const GLYPHS = ['🌟', '🍀', '🎈', '🐠', '🦋', '🌸', '🍎', '⭐', '🐞', '🌼'];
  const SHAPES = ['circle', 'square', 'triangle', 'star', 'heart'];

  function gridSize(round) {
    if (round <= 1) return 9;
    if (round === 2) return 12;
    return 16;
  }

  G.push({
    id: 'lampu-fokus',
    title: 'Lampu Fokus',
    subtitle: 'Cari target yang sama',
    emoji: '🔎',
    blurb: 'Temukan dan ketuk lampu yang bentuknya sama dengan contoh.',
    duration: 150,
    rounds: 3,
    focus: ['atensi', 'persepsi'],
    energy: 'sedang',
    sensory: 'rendah',
    steps: [
      'Lihat kotak contoh di bagian atas layar.',
      'Cari kotak di bawah yang bentuknya SAMA dengan contoh.',
      'Ketuk satu kali. Kalau benar, kotak itu menyala hijau.',
      'Setelah beberapa kali benar, ada jeda gerak sebentar.'
    ],
    benefits: [
      'Melatih perhatian berkelanjutan dalam waktu singkat',
      'Melatih menyaring informasi yang tidak penting (atensi selektif)',
      'Melatih koordinasi mata dan tangan'
    ],

    mount: function (stage, host) {
      const game = this;              // definisi game, agar `this` selalu benar
      let running = true;
      let targetShape = '';
      let targetGlyph = '';
      let hits = 0;          // total temuan benar dalam sesi
      let roundHits = 0;     // temuan benar pada ronde berjalan
      let onBoard = 0;       // sisa kotak yang cocok di papan saat ini
      const perRound = 4;    // temuan yang dibutuhkan untuk menutup satu ronde

      const banner = el('div', { class: 'gbar' }, [
        el('div', { class: 'gbar__hint', id: 'lfHint', text: 'Contoh:' }),
        el('div', { class: 'gbar__stat' }, [
          el('span', { class: 'gstat', id: 'lfCount', text: '0/' + perRound })
        ])
      ]);

      const targetBox = el('div', {
        class: 'gtile gtile--pick is-lit',
        id: 'lfTarget',
        style: { margin: '0 auto', cursor: 'default' },
        'aria-label': 'Contoh target'
      });

      const field = el('div', { class: 'gfield', id: 'lfField' });

      const wrap = el('div', { class: 'gwrap' }, [banner, el('div', { class: 'gcta' }, [targetBox]), field]);
      stage.appendChild(wrap);

      const SHAPE_SVG = {
        circle: '●', square: '■', triangle: '▲', star: '★', heart: '♥'
      };

      function newTarget() {
        targetShape = global.UI.pick(SHAPES);
        targetGlyph = global.UI.pick(GLYPHS);
        global.UI.clear(targetBox);
        targetBox.appendChild(el('span', { class: 'gtile__ico', text: SHAPE_SVG[targetShape] }));
        targetBox.appendChild(el('span', { class: 'gtile__t', text: targetGlyph }));
        targetBox.setAttribute('aria-label', 'Contoh target: ' + targetShape + ' ' + targetGlyph);
      }

      /* Membangun ulang seluruh papan dengan target yang baru.
         Target sengaja TIDAK diubah di tengah papan: kalau contohnya berganti
         sementara kotak lama masih terlihat, kotak lama jadi tidak cocok lagi
         dan anak bisa buntu tanpa jawaban benar. */
      function fillBoard() {
        const n = gridSize(host.round());
        const field2 = document.getElementById('lfField');
        global.UI.clear(field2);
        onBoard = 0;
        newTarget();

        const targetCount = Math.max(3, Math.round(n / 4));   // 3–4 kotak cocok per papan
        const indices = global.UI.shuffle(Array.from({ length: n }, function (_, i) { return i; }));
        const targetSet = indices.slice(0, targetCount);

        for (let i = 0; i < n; i++) {
          const isT = targetSet.indexOf(i) !== -1;
          /* pengganggu: bentuk berbeda, atau bentuk sama tetapi lambang berbeda */
          const shape = isT ? targetShape : global.UI.pick(SHAPES.filter(function (s) { return s !== targetShape; }));
          const glyph = isT ? targetGlyph : global.UI.pick(GLYPHS.filter(function (g) { return g !== targetGlyph; }));
          const size = n > 12 ? 'gtile gtile--sm' : 'gtile';

          const tile = el('button', {
            class: size,
            type: 'button',
            dataset: { t: isT ? '1' : '0' },
            'aria-label': (isT ? 'kotak cocok: ' : 'bukan target: ') + shape + ' ' + glyph
          }, [
            el('span', { class: 'gtile__ico', text: SHAPE_SVG[shape] }),
            el('span', { class: 'gtile__t', text: glyph })
          ]);

          if (isT) {
            onBoard++;
            tile.style.borderColor = 'var(--line-strong)';
          }

          tile.addEventListener('click', function () {
            if (!running || tile.classList.contains('is-faded')) return;
            const ok = tile.dataset.t === '1';
            if (ok) {
              hits++; roundHits++; onBoard--;
              host.right(12);
              tile.classList.add('is-hit', 'is-faded');
              updateCount();

              if (roundHits >= perRound) { endRound(); return; }

              /* Sediakan papan baru bila kotak yang cocok sudah habis,
                 supaya selalu ada jawaban benar yang bisa ditemukan. */
              if (onBoard <= 0) {
                host.prompt('Papan baru! Lihat contohnya lagi.', null);
                fillBoard();
              } else {
                host.prompt('Tepat! Masih ada ' + onBoard + ' kotak yang sama.', 'good');
              }
            } else {
              host.wrong();
              tile.classList.add('is-miss');
              global.setTimeout(function () { tile.classList.remove('is-miss'); }, 420);
              host.prompt('Belum sama. Lihat contohnya di atas, lalu coba lagi.', 'soft');
            }
          });

          field2.appendChild(tile);
        }
        host.setSteps(game.steps, 1);
      }

      function updateCount() {
        const c = document.getElementById('lfCount');
        if (c) c.textContent = roundHits + '/' + perRound;
      }

      function newRound() {
        hits = 0;
        roundHits = 0;
        running = true;
        updateCount();
        fillBoard();
      }

      function endRound() {
        running = false;
        host.prompt('Ronde ' + host.round() + ' selesai! Waktunya gerak sebentar.', 'good');
        if (host.round() >= host.roundsTotal()) {
          host.complete();
          return;
        }
        host.offerMovementBreak(12, function () {
          host.setRound(host.round() + 1);
          newRound();
        });
      }

      newRound();
      host.setSteps(game.steps, 1);

      /* Game ini hanya bereaksi pada ketukan, jadi tidak ada timer yang bisa
         menumpuk. Saat dibekukan, sisa kelas animasi dibersihkan supaya tidak
         ada kotak yang tetap menyala saat anak kembali. */
      this._cleanup = function () { running = false; };
      this._pause = function () {
        UIx.$$('.gtile.is-miss', stage).forEach(function (t) { t.classList.remove('is-miss'); });
      };
      this._resume = function () {};
    },

    pause: function () { if (this._pause) this._pause(); },
    resume: function () { if (this._resume) this._resume(); },
    unmount: function () { if (this._cleanup) this._cleanup(); }
  });
})(window);
