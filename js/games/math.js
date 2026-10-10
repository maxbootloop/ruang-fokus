/* ═══════════════════════════════════════════════════════════════
   math.js — "Pasar Angka"
   Latihan: numerasi dasar (tambah/kurang sampai 20), kecepatan
   pengambilan keputusan yang tepat.
   Adaptasi ADHD:
   • selalu pilihan ganda — mengurangi beban memori kerja & menulis
   • bantuan gambar (benda) di ronde pertama supaya bersifat konkret
   • salah tidak dipotong poin; jawaban benar tetap bisa dicoba ulang
   • jumlah soal sedikit (6) agar sesi terasa bisa diselesaikan
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const G = global.Games = global.Games || [];
  const el = global.UI.el;

  const OBJECTS = ['🍎', '🍊', '🍪', '⭐', '🐟', '🎈', '🧩', '🍇'];
  const PER_ROUND = 6;

  function makeProblem(round) {
    const R = global.UI.randInt;
    if (round <= 1) {
      const a = R(1, 5), b = R(1, 5);
      return { q: a + ' + ' + b, ans: a + b, a: a, b: b, op: '+', showObjects: true };
    }
    if (round === 2) {
      const a = R(4, 9), b = R(2, 9);
      return { q: a + ' + ' + b, ans: a + b, a: a, b: b, op: '+', showObjects: false };
    }
    const total = R(8, 18), take = R(2, total - 2);
    return { q: total + ' − ' + take, ans: total - take, a: total, b: take, op: '−', showObjects: false };
  }

  function options(ans) {
    const set = {};
    set[ans] = true;
    let guard = 0;
    while (Object.keys(set).length < 3 && guard++ < 60) {
      let d = global.UI.randInt(-4, 4);
      if (d === 0) d = global.UI.pick([-2, -1, 1, 2]);
      const v = ans + d;
      if (v >= 0) set[v] = true;
    }
    return global.UI.shuffle(Object.keys(set).map(Number));
  }

  G.push({
    id: 'pasar-angka',
    title: 'Pasar Angka',
    subtitle: 'Hitung cepat dan tepat',
    emoji: '🔢',
    blurb: 'Hitung soal tambah dan kurang, lalu pilih jawabannya. Ada gambar bantu.',
    duration: 150,
    rounds: 3,
    focus: ['numerasi'],
    energy: 'rendah',
    sensory: 'rendah',
    steps: [
      'Lihat soalnya. Boleh dihitung dengan jari atau gambar.',
      'Pilih satu jawaban dari tiga pilihan.',
      'Kalau salah, tidak ada hukuman — soal tetap bisa dicoba lagi.',
      'Selesaikan 6 soal untuk menutup satu ronde.'
    ],
    benefits: [
      'Melatih penjumlahan dan pengurangan sampai 20',
      'Melatih ketepatan lebih dari kecepatan',
      'Melatih tetap berusaha setelah menjawab salah'
    ],

    mount: function (stage, host) {
      let running = true;
      let round = host.round();
      let inRound = 0;
      let p = null;
      let locked = false;

      const hint = el('div', { class: 'gbar__hint', text: 'Soal 1 dari ' + PER_ROUND });
      const stat = el('div', { class: 'gbar__stat' }, [
        el('span', { class: 'gstat gstat--good', id: 'paOk', text: '✔ 0' }),
        el('span', { class: 'gstat gstat--warn', id: 'paNo', text: '✖ 0' })
      ]);
      const bar = el('div', { class: 'gbar' }, [hint, stat]);

      const card = el('div', { class: 'mprob is-active', id: 'paCard' });
      const pad = el('div', { class: 'gfield', style: { minHeight: '220px' } }, [el('div', { class: 'mprobs', style: { width: '100%' } }, [card])]);

      const wrap = el('div', { class: 'gwrap' }, [bar, pad]);
      stage.appendChild(wrap);

      let ok = 0, no = 0;

      function updateStats() {
        const a = document.getElementById('paOk');
        const b = document.getElementById('paNo');
        if (a) a.textContent = '✔ ' + ok;
        if (b) b.textContent = '✖ ' + no;
        hint.textContent = 'Soal ' + Math.min(inRound + 1, PER_ROUND) + ' dari ' + PER_ROUND;
      }

      function render() {
        p = makeProblem(round);
        locked = false;
        global.UI.clear(card);
        card.className = 'mprob is-active';

        const left = el('div', {}, [
          el('div', { class: 'mprob__q', text: p.q + ' = ?' }),
          el('div', { class: 'mprob__hint', text: p.showObjects ? 'Hitung gambarnya kalau perlu.' : 'Hitung di kepala, pelan-pelan.' })
        ]);

        if (p.showObjects) {
          const objIco = global.UI.pick(OBJECTS);
          const visual = el('div', { style: { fontSize: '1.5rem', letterSpacing: '2px', marginTop: '6px' } });
          visual.textContent = new Array(p.a + 1).join(objIco) + (p.op === '+' ? '  ➕  ' : '  ➖  ') +
            new Array(p.b + 1).join(p.op === '+' ? global.UI.pick(OBJECTS) : '✂️');
          left.appendChild(visual);
        }

        const opts = el('div', { class: 'mprob__opts' });
        options(p.ans).forEach(function (v) {
          const b = el('button', { class: 'opt', type: 'button', text: String(v), 'aria-label': 'Jawaban ' + v });
          b.addEventListener('click', function () { answer(v, b); });
          opts.appendChild(b);
        });

        card.appendChild(left);
        card.appendChild(opts);
        updateStats();
        host.setSteps(thisGame.steps, 1);
      }

      function answer(v, btn) {
        if (!running || locked) return;
        if (v === p.ans) {
          locked = true;
          ok++;
          host.right(12);
          btn.classList.add('is-correct');
          host.prompt('Benar! ' + p.q + ' = ' + p.ans + '.', 'good');
          global.setTimeout(next, 620);
        } else {
          no++;
          host.wrong();
          btn.classList.add('is-wrong');
          btn.disabled = true;
          host.prompt('Belum tepat. Coba hitung lagi — boleh pakai jari, tidak apa-apa.', 'soft');
          updateStats();
        }
      }

      function next() {
        if (!running) return;
        inRound++;
        if (inRound >= PER_ROUND) { endRound(); return; }
        render();
      }

      function endRound() {
        const last = round >= host.roundsTotal();
        if (last) {
          host.prompt('Semua soal selesai! ' + ok + ' benar. Kerja bagus.', 'good');
          host.complete();
          return;
        }
        running = false;
        host.prompt('Ronde ' + round + ' selesai. Ayo gerak sebentar!', 'good');
        host.offerMovementBreak(12, function () {
          running = true;
          round++;
          host.setRound(round);
          inRound = 0;
          ok = 0; no = 0;          // ronde baru, penghitung baru
          render();
        });
      }

      const thisGame = this;
      render();

      this._cleanup = function () { running = false; };
    },

    pause: function () {},
    resume: function () {},
    unmount: function () { if (this._cleanup) this._cleanup(); }
  });
})(window);
