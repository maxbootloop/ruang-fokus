/* ═══════════════════════════════════════════════════════════════
   app.js — katalog game, navigasi, sesi terpandu, progres,
   area pendamping, dan alat bantu.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const UIx = global.UI;
  const el = UIx.el;
  const Store = global.Store;
  const Session = global.Session;

  /* ── metadata kategori untuk penyaringan ── */
  const FOCUS = {
    atensi:     { ico: '🔎', label: 'Atensi' },
    memori:     { ico: '🧠', label: 'Memori' },
    impuls:     { ico: '✋', label: 'Tahan Impuls' },
    regulasi:   { ico: '🌬️', label: 'Regulasi Diri' },
    numerasi:   { ico: '🔢', label: 'Numerasi' },
    persepsi:   { ico: '👁️', label: 'Persepsi Visual' }
  };
  const DUR = [
    { id: 'short', label: '≤ 2 menit', test: function (g) { return g.duration <= 120; } },
    { id: 'mid', label: '2–4 menit', test: function (g) { return g.duration > 120 && g.duration <= 240; } }
  ];
  const ENERGY = [
    { id: 'rendah', label: 'Tenang', ico: '🪑' },
    { id: 'sedang', label: 'Sedang', ico: '🚶' },
    { id: 'tinggi', label: 'Banyak gerak', ico: '🤸' }
  ];

  /* ═══════════════════════════════════════════════════════════
     Registri game — semua game muncul di sini dengan metadata
     yang dibutuhkan pendamping: durasi, beban sensorik, fokus.
     ═══════════════════════════════════════════════════════════ */
  const GAMES = (global.Games || []).map(function (g) {
    return Object.assign({
      duration: 180,
      rounds: 3,
      focus: ['atensi'],
      energy: 'sedang',
      sensory: 'rendah',
      steps: [],
      benefits: [],
      isNew: false
    }, g);
  });

  const App = {
    screen: 'home',
    current: null,
    filter: { q: '', focus: 'all', dur: 'all', energy: 'all' },
    flow: null,          // sesi terpandu
    _guHoldTimer: null,
    _guHoldStart: 0,
    _vtTimer: null,
    _vtRemaining: 0,
    _vtTotal: 300,
    _vtDuration: 300,
    _breakTimer: null,

    /* ═══════════ INIT ═══════════ */
    init: function () {
      const s = Store.get().settings;
      Session.init();
      Sound.setEnabled(s.sound);
      Sound.setVoice(s.voice && s.sound);
      UIx.setMotion(s.motion);
      document.body.classList.toggle('readable', !!s.readable);
      document.body.classList.toggle('no-motion', !s.motion);

      this.bind();
      this.renderFilters();
      this.renderGames();
      this.renderBadges();
      this.renderTokenStrip();
      this.renderNext();
      Store.subscribe(this.onStoreChange.bind(this));

      const fg = document.getElementById('factGames');
      if (fg) fg.textContent = GAMES.length;

      /* unlock audio pada interaksi pertama (kebijakan browser) */
      const unlock = function () {
        Sound.unlock();
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
      };
      document.addEventListener('pointerdown', unlock);
      document.addEventListener('keydown', unlock);

      this.go('home');
      this.debugHash();
      this.renderRepo();
    },

    /* Pintasan uji/verifikasi: buka #game=lampu-fokus, #screen=grownup,
       #screen=timer, dan #seed=1 untuk mengisi data contoh. Berguna untuk
       memeriksa tampilan tanpa harus mengklik dari awal. */
    debugHash: function () {
      const h = String((global.location && global.location.hash) || '').replace(/^#/, '');
      if (!h) return;
      const params = {};
      h.split('&').forEach(function (kv) {
        const i = kv.indexOf('=');
        if (i > 0) params[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
      });
      if (params.seed === '1') this.seedDemo();
      if (params.game) {
        const g = GAMES.filter(function (x) { return x.id === params.game; })[0];
        if (g) { this.current = g; this.playCurrent(); return; }
      }
      if (params.screen === 'timer') { this.renderVtPicker(); this.vtRender(); }
      if (params.screen === 'steps') this.renderTasks();
      if (params.screen === 'grownup') this.openGrownup();
      if (params.screen === 'progress') this.renderProgress();
      if (params.screen) this.go(params.screen);
    },

    /* Data contoh untuk memeriksa tampilan progres/area pendamping.
       Sesinya disebar ke beberapa hari ke belakang agar grafik terlihat wajar. */
    seedDemo: function () {
      if (Store.get().sessions.length) return;
      const kinds = GAMES.map(function (g) { return { id: g.id, title: g.title }; });
      for (let d = 6; d >= 0; d--) {
        const n = 1 + ((d * 3) % 3);
        for (let s = 0; s < n; s++) {
          const k = kinds[(d + s) % kinds.length];
          const when = new Date();
          when.setDate(when.getDate() - d);
          when.setHours(16, 10 + s * 9, 0, 0);
          Store.logSession({
            at: when.getTime(),
            day: when.getFullYear() + '-' + String(when.getMonth() + 1).padStart(2, '0') + '-' + String(when.getDate()).padStart(2, '0'),
            kind: k.id, title: k.title,
            seconds: 120 + ((d * 37 + s * 23) % 120),
            rounds: 3, roundsTotal: 3,
            correct: 6 + ((d * 5 + s * 3) % 12),
            wrong: (d + s) % 4,
            completed: (d + s) % 5 !== 0,
            stoppedByChild: (d + s) % 7 === 0
          });
        }
      }
      Store.addTokens(4);
      /* tanda hari aktif + penghitung, agar ringkasan konsistensi ikut terisi */
      const s = Store.get();
      for (let d = 6; d >= 0; d--) {
        if (d === 3 || d === 2) continue;               // sengaja ada satu hari bolong
        const when = new Date();
        when.setDate(when.getDate() - d);
        const key = when.getFullYear() + '-' + String(when.getMonth() + 1).padStart(2, '0') + '-' + String(when.getDate()).padStart(2, '0');
        if (s.streakDays.indexOf(key) === -1) s.streakDays.push(key);
      }
      s.counters = Object.assign({ calm: 4, break: 6, retry: 5 }, s.counters || {});
      Store.save();
      Store.addNote('Contoh catatan: fokus bertahan 4 menit saat timer terlihat.');
      Store.setTasks([
        { text: 'Keluarkan buku dan alat tulis', done: true },
        { text: 'Baca satu soal saja', done: true },
        { text: 'Kerjakan soal itu (maks 5 menit)', done: false },
        { text: 'Berdiri dan gerakkan badan 30 detik', done: false }
      ]);
    },

    onStoreChange: function () {
      this.renderTokenStrip();
      this.renderBadges();
      this.renderNext();
    },

    /* ═══════════ NAVIGASI ═══════════
       opts.keepSession  — layar sementara (jeda gerak / pojok tenang) yang
                           tidak boleh mengakhiri sesi game yang berjalan.
                           Tanpa ini, semua jeda gerak antar ronde akan
                           mematikan sesi sebelum anak menyelesaikannya. */
    go: function (name, opts) {
      opts = opts || {};
      if (this.screen === 'stage' && name !== 'stage' && !opts.keepSession) {
        if (Session.running) Session.finish('child');   // dicatat sebagai berhenti sendiri
        else if (!Session.ended) Session.stopSilently();
      }
      if (this.screen === 'calm' && name !== 'calm') global.BreathTool.stop();
      if (this.screen === 'timer' && name !== 'timer') this.vtStop();
      this.screen = name;
      UIx.$$('.screen').forEach(function (sec) {
        sec.hidden = sec.dataset.screen !== name;
      });
      const focusTarget = document.querySelector('.screen[data-screen="' + name + '"] h1');
      if (focusTarget && opts.focus !== false) {
        focusTarget.setAttribute('tabindex', '-1');
        focusTarget.focus({ preventScroll: true });
      }
      global.scrollTo({ top: 0, behavior: 'auto' });
      document.title = 'Ruang Fokus — belajar nyaman untuk anak ADHD';
    },

    /* ═══════════ BINDING ═══════════ */
    bind: function () {
      const self = this;

      function on(id, ev, fn) { const n = document.getElementById(id); if (n) n.addEventListener(ev, fn); }

      on('brandHome', 'click', function () { self.flow = null; self.go('home'); });
      on('btnQuickStart', 'click', function () { self.go('stage'); self.quickStart(); });
      on('btnSessionFlow', 'click', function () { self.startFlow(); });
      on('btnCalm', 'click', function () { self.go('calm'); });
      on('btnProgress', 'click', function () { self.renderProgress(); self.go('progress'); });
      on('btnGrownup', 'click', function () { self.renderGrownup(); self.go('grownup'); });

      on('btnSound', 'click', function () {
        const s = Store.get().settings;
        const v = !s.sound;
        Store.setSetting('sound', v);
        Sound.setEnabled(v);
        Sound.setVoice(v && s.voice);
        self.syncTopbar();
        if (v) Sound.play('select');
      });
      on('btnMotion', 'click', function () {
        const v = !Store.get().settings.motion;
        Store.setSetting('motion', v);
        UIx.setMotion(v);
        document.body.classList.toggle('no-motion', !v);
        self.syncTopbar();
      });
      on('btnText', 'click', function () {
        const v = !Store.get().settings.readable;
        Store.setSetting('readable', v);
        document.body.classList.toggle('readable', v);
        self.syncTopbar();
        UIx.toast(v ? 'Mode baca aktif: huruf lebih besar' : 'Mode baca nonaktif', null, 1800);
      });

      on('searchGame', 'input', function (e) { self.filter.q = e.target.value; self.renderGames(); });

      /* brief */
      on('btnPlay', 'click', function () { self.playCurrent(); });
      on('btnBriefBack', 'click', function () { self.go('home'); });

      /* stage */
      on('btnStageExit', 'click', function () {
        if (!Session.running) { self.go('home'); return; }
        UIx.overlay({
          title: 'Sudahi game ini?',
          html: '<p>Kamu boleh berhenti kapan saja. Semua usaha yang sudah kamu lakukan tetap dihitung dan tetap dapat bintang.</p>',
          actions: [
            { label: 'Lanjut main', primary: true, action: function () { UIx.closeOverlay(); Session.resume(); } },
            { label: 'Ya, sudahi', action: function () { UIx.closeOverlay(); Session.finish('child'); } }
          ]
        });
        Session.pause(true);
      });
      on('btnStageSteps', 'click', function () { Session.pause(true); Session.showSteps(); });
      on('btnStagePause', 'click', function () { Session.togglePause(); });

      /* break */
      on('btnBreakDone', 'click', function () { self.endBreak(false); });
      on('btnBreakSkip', 'click', function () { self.endBreak(true); });

      /* calm */
      on('btnBreathToggle', 'click', function () {
        const btn = document.getElementById('btnBreathToggle');
        if (global.BreathTool.running) {
          global.BreathTool.stop();
          btn.textContent = 'Mulai';
        } else {
          global.BreathTool.start(function () {});
          btn.textContent = 'Hentikan';
          Store.bump('calm');
        }
      });
      on('btnBreathBack', 'click', function () { global.BreathTool.stop(); self.go('home'); });

      /* visual timer */
      on('btnVtToggle', 'click', function () { self.vtToggle(); });
      on('btnVtReset', 'click', function () { self.vtStop(); self.vtRender(); });
      on('btnVtBack', 'click', function () { self.vtStop(); self.go('home'); });

      /* task breakdown */
      on('stepForm', 'submit', function (e) { e.preventDefault(); self.addTask(); });
      on('btnStepTemplates', 'click', function () { self.loadTemplates(); });
      on('btnStepClear', 'click', function () { Store.setTasks([]); self.renderTasks(); });
      on('btnStepsBack', 'click', function () { self.go('home'); });

      /* progress */
      on('btnProgBack', 'click', function () { self.go('home'); });

      /* grown-up */
      on('btnGuBack', 'click', function () { self.go('home'); });
      this.bindGrownupGate();
      on('noteForm', 'submit', function (e) { e.preventDefault(); self.addNote(); });
      on('btnExport', 'click', function () { self.exportData(); });
      on('btnPrint', 'click', function () { global.print(); });
      on('btnWipe', 'click', function () { self.wipe(); });

      /* tautan repositori GitHub */
      on('repoForm', 'submit', function (e) {
        e.preventDefault();
        const inp = document.getElementById('repoInput');
        self.setRepo(inp ? inp.value : '');
      });
      on('btnRepoClear', 'click', function () { self.setRepo(''); });

      /* done */
      on('btnDoneAgain', 'click', function () { self.replayCurrent(); });
      on('btnDoneOther', 'click', function () {
        if (self.flow) { self.flowNext(); return; }
        self.go('home');
      });
      on('btnDoneCalm', 'click', function () { self.go('calm'); });

      /* alat di beranda */
      UIx.$$('[data-tool]').forEach(function (b) {
        b.addEventListener('click', function () {
          const t = b.dataset.tool;
          if (t === 'breath') self.go('calm');
          else if (t === 'timer') { self.renderVtPicker(); self.vtRender(); self.go('timer'); }
          else if (t === 'steps') { self.renderTasks(); self.go('steps'); }
          else if (t === 'body') self.showBreak(30, function () {});
        });
      });

      /* pintasan papan tuntas */
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && self.screen === 'brief') { self.go('home'); }
        if (e.key === 'Enter' && self.screen === 'brief') { self.playCurrent(); }
      });

      /* overlay klik di luar untuk menutup (kecuali jeda game) */
      const ov = document.getElementById('overlay');
      if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) UIx.closeOverlay(); });

      this.syncTopbar();
      this.renderVtPicker();
    },

    syncTopbar: function () {
      const s = Store.get().settings;
      const bs = document.getElementById('btnSound');
      const bm = document.getElementById('btnMotion');
      const bt = document.getElementById('btnText');
      if (bs) {
        bs.setAttribute('aria-pressed', String(s.sound));
        bs.classList.toggle('is-on', s.sound);
        document.getElementById('soundIco').textContent = s.sound ? '🔊' : '🔇';
        bs.title = s.sound ? 'Suara aktif' : 'Suara mati';
      }
      if (bm) {
        bm.setAttribute('aria-pressed', String(s.motion));
        bm.classList.toggle('is-on', s.motion);
        document.getElementById('motionIco').textContent = s.motion ? '✨' : '🚫';
      }
      if (bt) {
        bt.setAttribute('aria-pressed', String(s.readable));
        bt.classList.toggle('is-on', s.readable);
      }
    },

    /* ═══════════ TOKEN BOARD ═══════════ */
    renderTokenStrip: function () {
      const strip = document.getElementById('tokenStrip');
      const now = document.getElementById('tokensNow');
      const goal = document.getElementById('tokensGoal');
      const st = Store.get();
      const per = Store.TOKENS_PER_REWARD;
      const into = st.tokens % per;
      const complete = st.tokens > 0 && into === 0;

      if (now) now.textContent = st.tokens;
      if (goal) goal.textContent = (complete ? per : into) + '/' + per;
      if (!strip) return;

      UIx.clear(strip);
      for (let i = 0; i < per; i++) {
        const filled = i < (complete ? per : into);
        const t = el('span', {
          class: 'tok' + (filled ? ' is-filled' : '') + (i === per - 1 ? ' is-goal' : ''),
          text: filled ? '⭐' : '',
          'aria-hidden': 'true'
        });
        strip.appendChild(t);
      }
      const label = el('span', {
        style: { fontSize: '.8rem', fontWeight: '700', color: 'var(--ink-faint)', marginLeft: '4px' },
        text: complete ? 'Hadiah siap diambil!' : (per - (complete ? 0 : into)) + ' bintang lagi menuju hadiah'
      });
      strip.appendChild(label);
    },

    /* ═══════════ LENCANA ═══════════ */
    renderBadges: function () {
      const grid = document.getElementById('badgeGrid');
      if (!grid) return;
      const unlocked = Store.get().badges;
      UIx.clear(grid);
      Store.BADGES.forEach(function (b) {
        const on = unlocked.indexOf(b.id) !== -1;
        grid.appendChild(el('div', {
          class: 'badge' + (on ? ' is-unlocked' : ''),
          title: b.title + ' — ' + b.desc,
          'aria-label': (on ? 'Terbuka: ' : 'Belum terbuka: ') + b.title + '. ' + b.desc
        }, [
          el('span', { class: 'badge__ico', text: b.ico, 'aria-hidden': 'true' }),
          el('span', { text: b.title })
        ]));
      });
      const hint = document.getElementById('badgeHint');
      if (hint) hint.textContent = unlocked.length + ' dari ' + Store.BADGES.length + ' lencana terbuka.';
    },

    /* ═══════════ KARTU "LANJUTKAN DARI SINI" ═══════════ */
    renderNext: function () {
      const box = document.getElementById('nextBody');
      if (!box) return;
      UIx.clear(box);
      const st = Store.get();
      const stats = Store.stats();
      const per = Store.TOKENS_PER_REWARD;
      const readyReward = st.tokens >= per;

      let game = null, reason = '';
      if (stats.totalSessions > 0 && stats.weakest) game = stats.weakest;

      /* prioritas: 
         1. hadiah siap diambil
         2. game yang belum pernah dicoba
         3. game yang paling jarang dimainkan (variasi) */
      const played = {};
      st.sessions.forEach(function (s) { played[s.kind] = (played[s.kind] || 0) + 1; });
      const untried = GAMES.filter(function (g) { return !played[g.id]; });
      let chosen = null;

      if (readyReward) {
        reason = 'Kamu sudah punya ' + st.tokens + ' bintang. Hadiahnya sudah bisa diambil!';
        chosen = null;
      } else if (untried.length) {
        chosen = UIx.pick(untried);
        reason = 'Game ini belum pernah kamu coba. Sekali coba saja, 3 menit.';
      } else if (st.favorites.length) {
        chosen = GAMES.filter(function (g) { return st.favorites.indexOf(g.id) !== -1; })[0] || null;
        reason = 'Ini game favoritmu. Boleh dimainkan lagi.';
      } else {
        const counts = GAMES.map(function (g) { return { g: g, n: played[g.id] || 0 }; })
          .sort(function (a, b) { return a.n - b.n; });
        chosen = counts[0].g;
        reason = 'Coba berganti jenis latihan supaya otak tidak bosan.';
      }

      if (readyReward) {
        box.appendChild(el('div', { class: 'next-emoji', text: '🎁', 'aria-hidden': 'true' }));
        const t = el('div', { class: 'next-text' }, [
          el('h3', { text: 'Hadiah siap diambil' }),
          el('p', { text: reason })
        ]);
        box.appendChild(t);
        box.appendChild(el('button', {
          class: 'btn btn--primary btn--lg', type: 'button', text: 'Ambil hadiah',
          onClick: function () { App.claimReward(); }
        }));
        return;
      }

      box.appendChild(el('div', { class: 'next-emoji', text: chosen ? chosen.emoji : '🎲', 'aria-hidden': 'true' }));
      box.appendChild(el('div', { class: 'next-text' }, [
        el('h3', { text: chosen ? chosen.title : 'Pilih satu game' }),
        el('p', { text: chosen ? (reason + ' (' + UIx.fmtDur(chosen.duration) + ')') : reason })
      ]));
      box.appendChild(el('button', {
        class: 'btn btn--primary btn--lg', type: 'button',
        text: chosen ? 'Mulai ini' : 'Lihat daftar game',
        onClick: function () {
          if (chosen) App.openBrief(chosen.id);
          else document.getElementById('gameList').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }));
    },

    claimReward: function () {
      if (!Store.canRedeem()) { UIx.toast('Bintangnya belum cukup. ' + Store.TOKENS_PER_REWARD + ' bintang untuk satu hadiah.', null, 2600); return; }
      const pick = Store.redeem();
      Sound.play('reward');
      UIx.celebrate({ count: 30 });
      UIx.overlay({
        title: 'Hadiahmu!',
        html: '<div class="rewardcard"><span class="rewardcard__ico">' + (pick.ico || '🎁') + '</span>' +
              '<span><b>' + pick.title + '</b><small>' + (pick.note || '') + '</small></span></div>' +
              '<p style="margin-top:16px">Tunjukkan layar ini kepada orang tua atau gurumu untuk mengambilnya.</p>',
        actions: [
          { label: 'Terima kasih!', primary: true, action: function () { UIx.closeOverlay(); App.onStoreChange(); } },
          { label: 'Atur daftar hadiah', action: function () { UIx.closeOverlay(); App.renderGrownup(); App.go('grownup'); } }
        ]
      });
    },

    /* ═══════════ FILTER & DAFTAR GAME ═══════════ */
    renderFilters: function () {
      const self = this;
      const fRow = document.getElementById('filterFocus');
      const dRow = document.getElementById('filterDur');
      const eRow = document.getElementById('filterEnergy');
      if (!fRow || !dRow || !eRow) return;

      const countFocus = {};
      GAMES.forEach(function (g) { g.focus.forEach(function (f) { countFocus[f] = (countFocus[f] || 0) + 1; }); });

      UIx.clear(fRow);
      fRow.appendChild(this.chip('Semua fokus', self.filter.focus === 'all' ? 'all' : null, function () {
        self.filter.focus = 'all'; self.renderFilters(); self.renderGames();
      }, self.filter.focus === 'all'));
      Object.keys(FOCUS).forEach(function (k) {
        if (!countFocus[k]) return;
        fRow.appendChild(self.chip(FOCUS[k].ico + ' ' + FOCUS[k].label, k, function () {
          self.filter.focus = (self.filter.focus === k ? 'all' : k);
          self.renderFilters(); self.renderGames();
        }, self.filter.focus === k, countFocus[k]));
      });

      UIx.clear(dRow);
      dRow.appendChild(this.chip('Semua durasi', 'all', function () {
        self.filter.dur = 'all'; self.renderFilters(); self.renderGames();
      }, self.filter.dur === 'all'));
      DUR.forEach(function (d) {
        const n = GAMES.filter(d.test).length;
        dRow.appendChild(self.chip(d.label, d.id, function () {
          self.filter.dur = (self.filter.dur === d.id ? 'all' : d.id);
          self.renderFilters(); self.renderGames();
        }, self.filter.dur === d.id, n));
      });

      UIx.clear(eRow);
      eRow.appendChild(this.chip('Semua energi', 'all', function () {
        self.filter.energy = 'all'; self.renderFilters(); self.renderGames();
      }, self.filter.energy === 'all'));
      ENERGY.forEach(function (e2) {
        const n = GAMES.filter(function (g) { return g.energy === e2.id; }).length;
        if (!n) return;
        eRow.appendChild(self.chip(e2.ico + ' ' + e2.label, e2.id, function () {
          self.filter.energy = (self.filter.energy === e2.id ? 'all' : e2.id);
          self.renderFilters(); self.renderGames();
        }, self.filter.energy === e2.id, n));
      });
    },

    chip: function (label, value, onClick, active, n) {
      const b = el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(!!active),
        'aria-label': 'Filter ' + label
      }, [label]);
      if (n != null) b.appendChild(el('span', { class: 'chip__n', text: String(n) }));
      b.addEventListener('click', onClick);
      return b;
    },

    matches: function (g) {
      const f = this.filter;
      const q = f.q.trim().toLowerCase();
      if (q) {
        const hay = [g.title, g.subtitle, g.blurb, (g.steps || []).join(' '), (g.benefits || []).join(' '),
                     g.focus.map(function (x) { return FOCUS[x] ? FOCUS[x].label : x; }).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (f.focus !== 'all' && g.focus.indexOf(f.focus) === -1) return false;
      if (f.dur !== 'all') {
        const d = DUR.filter(function (x) { return x.id === f.dur; })[0];
        if (d && !d.test(g)) return false;
      }
      if (f.energy !== 'all' && g.energy !== f.energy) return false;
      return true;
    },

    renderGames: function () {
      const list = document.getElementById('gameList');
      if (!list) return;
      const self = this;
      UIx.clear(list);

      const items = GAMES.filter(function (g) { return self.matches(g); });
      if (!items.length) {
        list.appendChild(el('div', { class: 'empty' }, [
          el('p', { text: '🔍 Tidak ada game yang cocok dengan filter itu.' }),
          el('p', { text: 'Coba hapus filter atau kata pencarian.' })
        ]));
        return;
      }

      items.forEach(function (g) {
        const fav = Store.isFavorite(g.id);
        const card = el('button', {
          class: 'gcard' + (fav ? ' is-fav' : ''), type: 'button',
          'aria-label': g.title + '. ' + g.blurb + ' Durasi ' + UIx.fmtDur(g.duration) + '.'
        });
        if (g.isNew) card.appendChild(el('span', { class: 'gcard__flag', text: 'Baru' }));
        if (fav) card.appendChild(el('span', { class: 'gcard__star', text: '⭐', 'aria-hidden': 'true' }));

        card.appendChild(el('div', { class: 'gcard__top' }, [
          el('div', { class: 'gcard__emoji gcard__emoji--tint', text: g.emoji, 'aria-hidden': 'true' }),
          el('div', {}, [
            el('h3', { class: 'gcard__title', text: g.title }),
            el('p', { class: 'gcard__tag', text: g.subtitle })
          ])
        ]));
        card.appendChild(el('p', { class: 'gcard__desc', text: g.blurb }));

        const meta = el('div', { class: 'gcard__meta' });
        meta.appendChild(el('span', { class: 'pill pill--time', text: '⏱ ' + UIx.fmtDur(g.duration) }));
        g.focus.forEach(function (fk) {
          if (!FOCUS[fk]) return;
          meta.appendChild(el('span', { class: 'pill', text: FOCUS[fk].ico + ' ' + FOCUS[fk].label }));
        });
        const e3 = ENERGY.filter(function (x) { return x.id === g.energy; })[0];
        if (e3) meta.appendChild(el('span', { class: 'pill', text: e3.ico + ' ' + e3.label }));
        const sev = g.sensory === 'tinggi' ? 'pill--high' : (g.sensory === 'sedang' ? 'pill--mid' : 'pill--low');
        meta.appendChild(el('span', { class: 'pill ' + sev, text: '🎚 Rangsang ' + g.sensory }));
        card.appendChild(meta);

        card.addEventListener('click', function () { self.openBrief(g.id); });
        list.appendChild(card);
      });
    },

    /* ═══════════ KARTU LANGKAH (penopang memori kerja) ═══════════ */
    openBrief: function (id) {
      const g = GAMES.filter(function (x) { return x.id === id; })[0];
      if (!g) return;
      this.current = g;
      Sound.play('open');

      document.getElementById('briefEmoji').textContent = g.emoji;
      document.getElementById('briefTitle').textContent = g.title;
      document.getElementById('briefSub').textContent = g.subtitle + ' — ' + g.blurb;
      document.getElementById('briefKicker').textContent = 'Sebelum mulai · ' + UIx.fmtDur(g.duration) + ' · ' + g.rounds + ' ronde';

      const steps = document.getElementById('briefSteps');
      UIx.clear(steps);
      (g.steps || []).forEach(function (s, i) {
        steps.appendChild(el('li', { class: 'stepcard' }, [
          el('span', { class: 'stepcard__n', text: String(i + 1) }),
          el('span', { class: 'stepcard__t', text: s }),
          el('span', { class: 'stepcard__emoji', text: ['👀', '👆', '✅', '🌬️', '🎯'][i % 5], 'aria-hidden': 'true' })
        ]));
      });

      const meta = document.getElementById('briefMeta');
      UIx.clear(meta);
      meta.appendChild(el('span', { class: 'pill pill--time', text: '⏱ ' + UIx.fmtDur(g.duration) }));
      meta.appendChild(el('span', { class: 'pill', text: '🔁 ' + g.rounds + ' ronde' }));
      g.focus.forEach(function (fk) {
        if (FOCUS[fk]) meta.appendChild(el('span', { class: 'pill', text: FOCUS[fk].ico + ' ' + FOCUS[fk].label }));
      });
      const e3 = ENERGY.filter(function (x) { return x.id === g.energy; })[0];
      if (e3) meta.appendChild(el('span', { class: 'pill', text: e3.ico + ' ' + e3.label }));
      meta.appendChild(el('span', { class: 'pill', text: '🎚 Rangsang ' + g.sensory }));

      const ben = document.getElementById('briefBenList');
      if (ben) {
        UIx.clear(ben);
        (g.benefits || []).forEach(function (b) { ben.appendChild(el('li', { text: b })); });
      }

      const s = Store.get().settings;
      const favBtn = el('button', {
        class: 'btn btn--ghost', type: 'button',
        text: (Store.isFavorite(g.id) ? '⭐ Hapus dari favorit' : '☆ Simpan sebagai favorit'),
        onClick: function () {
          const on = Store.toggleFavorite(g.id);
          favBtn.textContent = on ? '⭐ Hapus dari favorit' : '☆ Simpan sebagai favorit';
        }
      });
      const favRow = document.getElementById('briefFavRow');
      if (favRow) {
        UIx.clear(favRow);
        favRow.appendChild(favBtn);
      }

      this.go('brief');
      /* bacakan langkah kalau suara aktif — mengurangi beban membaca */
      if (s.voice && s.sound) global.setTimeout(function () { Sound.say(g.steps.slice(0, 2).join('. ')); }, 420);
    },

    playCurrent: function () {
      if (!this.current) { this.go('home'); return; }
      const g = this.current;
      this.go('stage');
      Session.start(g);
      this.current = g;
    },

    replayCurrent: function () {
      if (this.current) { this.go('stage'); Session.start(this.current); }
      else this.go('home');
    },

    quickStart: function () {
      /* pilih otomatis: durasi pendek, beban rangsang rendah, hindari yang baru dimainkan */
      const st = Store.get();
      const last = st.sessions.length ? st.sessions[st.sessions.length - 1].kind : null;
      let pool = GAMES.filter(function (g) { return g.id !== last && g.duration <= 180; });
      if (!pool.length) pool = GAMES.slice();
      const fav = pool.filter(function (g) { return Store.isFavorite(g.id); });
      const chosen = UIx.pick(fav.length ? fav : pool);
      UIx.toast('Kita coba: ' + chosen.title, null, 2200);
      this.current = chosen;
      this.go('stage');
      Session.start(chosen);
    },

    /* ═══════════ SESI TERPANDU ═══════════ */
    startFlow: function () {
      const order = UIx.shuffle(GAMES.filter(function (g) { return g.focus.indexOf('regulasi') === -1; })).slice(0, 3);
      if (!order.length) { this.quickStart(); return; }
      this.flow = { games: order, idx: -1, startedAt: Date.now(), tokensBefore: Store.get().tokens, log: [] };
      UIx.toast('Sesi terpandu: 3 game pendek dengan jeda gerak.', null, 3000);
      this.flowNext();
    },

    flowNext: function () {
      if (!this.flow) return;
      this.flow.idx++;
      if (this.flow.idx >= this.flow.games.length) { this.flowFinish(); return; }
      this.current = this.flow.games[this.flow.idx];
      this.openBrief(this.current.id);
      const kicker = document.getElementById('briefKicker');
      if (kicker) kicker.textContent = 'Sesi terpandu · game ' + (this.flow.idx + 1) + ' dari ' + this.flow.games.length + ' · ' + UIx.fmtDur(this.current.duration);
    },

    flowFinish: function () {
      const f = this.flow;
      this.flow = null;
      const earned = Store.get().tokens - (f ? f.tokensBefore : 0);
      const mins = Math.round((Date.now() - (f ? f.startedAt : Date.now())) / 60000);
      Sound.play('finish');
      UIx.celebrate({ count: 40 });
      UIx.overlay({
        title: 'Sesi terpandu selesai! 🎉',
        html: '<p>Kamu menyelesaikan <b>' + (f ? f.games.length : 3) + ' game</b> dalam sekitar <b>' + mins + ' menit</b>.</p>' +
              '<p>Bintang yang kamu dapat hari ini: <b>⭐ ' + Math.max(0, earned) + '</b></p>' +
              '<p style="color:var(--ink-faint)">Sekarang waktunya istirahat atau bermain bebas. Otak juga butuh pulih.</p>',
        actions: [
          { label: 'Selesai', primary: true, action: function () { UIx.closeOverlay(); App.go('home'); } },
          { label: 'Lihat progres', action: function () { UIx.closeOverlay(); App.renderProgress(); App.go('progress'); } },
          { label: 'Napas tenang', action: function () { UIx.closeOverlay(); App.go('calm'); } }
        ]
      });
    },

    /* ═══════════ JEDA GERAK ═══════════ */
    _breakDone: null,
    showBreak: function (seconds, done) {
      const self = this;
      this._breakDone = done || null;
      seconds = Math.max(5, Math.round(seconds || 15));
      const moves = [
        { ico: '🙆', t: 'Berdiri, angkat kedua tangan tinggi-tinggi.' },
        { ico: '🦵', t: 'Angkat kaki bergantian, seperti jalan di tempat.' },
        { ico: '🤸', t: 'Miringkan badan ke kiri dan kanan, pelan saja.' },
        { ico: '👐', t: 'Kepalkan tangan, lalu buka lebar. Ulangi.' },
        { ico: '🐘', t: 'Ayunkan tangan seperti belalai gajah.' },
        { ico: '🐸', t: 'Jongkok lalu berdiri, seperti katak melompat.' },
        { ico: '🌬️', t: 'Tarik napas panjang, buang lewat mulut.' }
      ];
      const list = UIx.shuffle(moves).slice(0, 2);

      const art = document.getElementById('breakArt');
      const txt = document.getElementById('breakText');
      const cnt = document.getElementById('breakCount');
      if (art) art.textContent = list[0].ico;
      if (txt) txt.innerHTML = list.map(function (m) { return '<b>' + m.ico + ' ' + m.t + '</b>'; }).join('<br>');
      if (cnt) cnt.textContent = seconds;

      this.go('break', { keepSession: true });
      Sound.play('break');
      global.clearInterval(this._breakTimer);
      let left = seconds;
      this._breakTimer = global.setInterval(function () {
        left--;
        if (cnt) cnt.textContent = Math.max(0, left);
        if (left <= 0) {
          global.clearInterval(self._breakTimer);
          self._breakTimer = null;
          if (art) art.textContent = '✅';
          if (txt) txt.innerHTML = '<b>Bagus! Badan sudah segar.</b><br>Tekan tombol di bawah untuk lanjut.';
          Sound.play('select');
        }
      }, 1000);
    },

    endBreak: function (skipped) {
      global.clearInterval(this._breakTimer);
      this._breakTimer = null;
      const cb = this._breakDone;
      this._breakDone = null;
      if (!skipped) Store.bump('break');
      if (cb) { cb(); return; }
      this.go('home');
    },

    /* ═══════════ SELESAI SESI ═══════════ */
    afterSession: function (o) {
      const self = this;
      const g = o.game;
      const stats = o.tokens;

      const stars = document.getElementById('doneStars');
      UIx.clear(stars);
      const n = o.rec.completed ? 3 : (o.completion >= 0.5 ? 2 : 1);
      for (let i = 0; i < n; i++) {
        const sp = el('span', { text: '⭐' });
        sp.style.animationDelay = (i * 0.14) + 's';
        stars.appendChild(sp);
      }

      /* Pujian berbasis usaha, bukan kemampuan tetap.
         ("Kamu berusaha keras" lebih melindungi motivasi daripada
         "Kamu pintar" — penting untuk anak yang sering gagal.) */
      const praise = [];
      if (o.rec.completed) praise.push('Kamu menyelesaikan semua ronde sampai akhir.');
      else if (o.completion >= 0.5) praise.push('Kamu sudah menyelesaikan sebagian besar rondenya.');
      else praise.push('Kamu sudah mencoba, dan itu tetap berarti.');
      if (o.wrong > 0 && o.correct > 0) praise.push('Kamu tetap mencoba setelah menjawab salah — itu bagian tersulit.');
      if (o.seconds >= 60) praise.push('Kamu bertahan fokus ' + UIx.fmtDur(o.seconds) + '.');
      if (o.correct >= 8) praise.push('Banyak jawaban tepatmu: ' + o.correct + '.');
      if (praise.length < 2) praise.push('Latihan singkat seperti ini yang membuat otak makin kuat.');
      document.getElementById('donePraise').textContent = praise.slice(0, 2).join(' ');

      const statsBox = document.getElementById('doneStats');
      UIx.clear(statsBox);
      const add = function (k, v, n2, cls) {
        statsBox.appendChild(el('div', { class: 'stat ' + (cls || '') }, [
          el('div', { class: 'stat__k', text: k }),
          el('div', { class: 'stat__v', text: v }),
          n2 ? el('div', { class: 'stat__n', text: n2 }) : null
        ]));
      };
      add('Waktu fokus', UIx.fmtDur(o.seconds), 'berlatih fokus');
      add('Ronde', o.rec.rounds + '/' + (o.rec.roundsTotal || o.rec.rounds), 'selesai', 'stat--info');
      add('Jawaban tepat', String(o.correct), o.wrong ? (o.wrong + ' kali mencoba lagi') : 'tanpa salah', 'stat--good');
      add('Bintang didapat', '⭐ ' + o.tokens, 'total ' + Store.get().tokens, 'stat--accent');

      const rw = document.getElementById('doneReward');
      UIx.clear(rw);
      if (Store.canRedeem()) {
        rw.appendChild(el('div', { class: 'rewardcard' }, [
          el('span', { class: 'rewardcard__ico', text: '🎁', 'aria-hidden': 'true' }),
          el('span', {}, [
            el('b', { text: 'Hadiahmu siap diambil!' }),
            el('small', { text: 'Kamu sudah punya ' + Store.get().tokens + ' bintang.' })
          ]),
          el('button', {
            class: 'btn btn--primary', type: 'button', text: 'Ambil',
            onClick: function () { self.claimReward(); }
          })
        ]));
      }

      /* lencana baru */
      (o.unlocked || []).forEach(function (b, i) {
        global.setTimeout(function () {
          UIx.toast('Lencana baru: ' + b.ico + ' ' + b.title, 'star', 3400);
          Sound.play('star');
        }, 700 + i * 900);
      });

      this.renderNext();
      UIx.celebrate({ count: o.rec.completed ? 34 : 18 });
      Sound.play(o.rec.completed ? 'finish' : 'round');

      this.go('done');

      /* sesi terpandu: lanjut ke game berikutnya setelah anak menekan tombol */
      if (this.flow) {
        const btn = document.getElementById('btnDoneOther');
        if (btn) btn.textContent = 'Lanjut ke game berikutnya →';
        const again = document.getElementById('btnDoneAgain');
        if (again) again.textContent = '🔁 Ulangi game ini';
      }
    },

    /* ═══════════ PROGRES ANAK ═══════════ */
    renderProgress: function () {
      const st = Store.stats();
      const grid = document.getElementById('statGrid');
      if (!grid) return;
      UIx.clear(grid);

      const add = function (k, v, n, cls) {
        grid.appendChild(el('div', { class: 'stat ' + (cls || '') }, [
          el('div', { class: 'stat__k', text: k }),
          el('div', { class: 'stat__v', text: v }),
          el('div', { class: 'stat__n', text: n || '' })
        ]));
      };
      add('Bintangku', '⭐ ' + st.tokens, 'terkumpul ' + st.lifetimeTokens + ' sepanjang waktu', 'stat--accent');
      add('Sesi selesai', String(st.completed), st.totalSessions + ' kali memulai', 'stat--good');
      add('Total latihan', st.totalMinutes + ' mnt', 'semua sesi digabung', 'stat--info');
      add('Fokus terlama', UIx.fmtDur(st.longestFocus), 'sesi terpanjang');
      add('Rata-rata fokus', UIx.fmtDur(st.avgSeconds), 'per sesi');
      add('Hari berurutan', String(st.streak), st.activeDays + ' hari aktif', 'stat--good');

      /* grafik 7 hari */
      const chart = document.getElementById('progChart');
      if (chart) {
        UIx.clear(chart);
        const max = Math.max(1, Math.max.apply(null, st.week.map(function (d) { return d.seconds; })));
        chart.setAttribute('aria-label', 'Menit latihan 7 hari terakhir: ' +
          st.week.map(function (d) { return UIx.dayName(d.day) + ' ' + Math.round(d.seconds / 60) + ' menit'; }).join(', '));
        st.week.forEach(function (d) {
          const h = d.seconds ? Math.max(8, Math.round((d.seconds / max) * 118)) : 5;
          const col = el('div', { class: 'chart__col' }, [
            el('span', { class: 'chart__v', text: d.seconds ? Math.round(d.seconds / 60) + 'm' : '' }),
            el('div', { class: 'chart__bar' + (d.seconds ? '' : ' is-zero'), style: { height: h + 'px' } }),
            el('span', { class: 'chart__lbl', text: UIx.dayName(d.day) })
          ]);
          chart.appendChild(col);
        });
      }

      const top = document.getElementById('progTop');
      if (top) {
        UIx.clear(top);
        if (!st.top.length) {
          top.appendChild(el('li', { class: 'topitem' }, [el('span', { class: 'topitem__t', text: 'Belum ada data. Mainkan satu game dulu, ya!' })]));
        } else {
          st.top.slice(0, 5).forEach(function (t) {
            const g = GAMES.filter(function (x) { return x.id === t.kind; })[0];
            top.appendChild(el('li', { class: 'topitem' }, [
              el('span', { class: 'topitem__ico', text: g ? g.emoji : '🎮', 'aria-hidden': 'true' }),
              el('span', { class: 'topitem__t', text: g ? g.title : t.title }),
              el('span', { class: 'topitem__v', text: t.count + '×' })
            ]));
          });
        }
      }
    },

    /* ═══════════ AREA PENDAMPING ═══════════ */
    bindGrownupGate: function () {
      const self = this;
      const btn = document.getElementById('btnGuHold');
      const fill = document.getElementById('guHoldFill');
      if (!btn) return;
      const DURATION = 2000;

      function start(e) {
        if (e) e.preventDefault();
        self._guHoldStart = performance.now();
        global.clearInterval(self._guHoldTimer);
        self._guHoldTimer = global.setInterval(function () {
          const pct = Math.min(1, (performance.now() - self._guHoldStart) / DURATION);
          if (fill) fill.style.width = (pct * 100) + '%';
          if (pct >= 1) { stop(); self.openGrownup(); }
        }, 60);
      }
      function stop() {
        global.clearInterval(self._guHoldTimer);
        self._guHoldTimer = null;
        if (fill) fill.style.width = '0%';
      }
      btn.addEventListener('pointerdown', start);
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, stop); });
      btn.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') start(e); });
      btn.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') stop(); });
    },

    openGrownup: function () {
      const gate = document.getElementById('guGate');
      const body = document.getElementById('guBody');
      if (gate) gate.hidden = true;
      if (body) body.hidden = false;
      this.renderGrownup();
      Sound.play('open');
    },

    renderGrownup: function () {
      const st = Store.stats();
      const grid = document.getElementById('guStats');
      if (grid) {
        UIx.clear(grid);
        const add = function (k, v, n, cls) {
          grid.appendChild(el('div', { class: 'stat ' + (cls || '') }, [
            el('div', { class: 'stat__k', text: k }),
            el('div', { class: 'stat__v', text: v }),
            el('div', { class: 'stat__n', text: n || '' })
          ]));
        };
        add('Total latihan', st.totalMinutes + ' mnt', st.totalSessions + ' sesi dimulai', 'stat--info');
        add('Sesi tuntas', st.completionRate + '%', st.completed + ' dari ' + st.totalSessions, 'stat--good');
        add('Fokus rata-rata', UIx.fmtDur(st.avgSeconds), 'terpanjang ' + UIx.fmtDur(st.longestFocus));
        add('Akurasi rata-rata', st.avgAccuracy == null ? '—' : st.avgAccuracy + '%', 'jawaban tepat', 'stat--accent');
        add('Selesai tanpa berhenti', st.independence + '%', 'ukuran kemandirian', 'stat--good');
        add('Konsistensi', st.streak + ' hari', st.activeDays + ' hari aktif total');
      }

      /* pengaturan */
      const set = document.getElementById('guSettings');
      if (set) {
        UIx.clear(set);
        const s = Store.get().settings;
        const toggle = function (key, title, desc) {
          const sw = el('button', {
            class: 'switch', type: 'button', role: 'switch',
            'aria-checked': String(!!s[key]), 'aria-label': title
          });
          sw.addEventListener('click', function () {
            const v = Store.toggleSetting(key);
            sw.setAttribute('aria-checked', String(!!v));
            App.applySetting(key, v);
          });
          return el('div', { class: 'setrow' }, [
            el('div', {}, [el('div', { class: 'setrow__t', text: title }), el('div', { class: 'setrow__d', text: desc })]),
            sw
          ]);
        };

        [['sound', 'Efek suara', 'Nada lembut untuk umpan balik langsung.'],
         ['voice', 'Instruksi bersuara', 'Membacakan langkah agar tidak perlu membaca.'],
         ['motion', 'Animasi & konfeti', 'Matikan bila anak mudah teralih perhatian.'],
         ['readable', 'Mode baca', 'Huruf lebih besar dan spasi lebih lega.'],
         ['movementBreaks', 'Jeda gerak otomatis', 'Jeda 12–15 detik di antara ronde.']
        ].forEach(function (d) { set.appendChild(toggle(d[0], d[1], d[2])); });

        /* durasi sesi */
        const durRow = el('div', { class: 'setrow' }, [
          el('div', {}, [
            el('div', { class: 'setrow__t', text: 'Durasi sesi' }),
            el('div', { class: 'setrow__d', text: 'Panjang satu game sebelum waktu habis.' })
          ]),
          el('input', {
            class: 'slider', type: 'range', min: '1', max: '10', step: '1',
            value: String(s.sessionMinutes), 'aria-label': 'Durasi sesi dalam menit',
            onInput: function (e) {
              const v = Number(e.target.value);
              Store.setSetting('sessionMinutes', v);
              e.target.setAttribute('aria-valuetext', v + ' menit');
            }
          }),
          el('span', { class: 'gstat', text: s.sessionMinutes + ' mnt', id: 'guDurLabel' })
        ]);
        durRow.querySelector('input').addEventListener('input', function (e) {
          const l = document.getElementById('guDurLabel');
          if (l) l.textContent = e.target.value + ' mnt';
        });
        set.appendChild(durRow);

        /* ronde */
        const roundRow = el('div', { class: 'setrow' }, [
          el('div', {}, [
            el('div', { class: 'setrow__t', text: 'Jumlah ronde' }),
            el('div', { class: 'setrow__d', text: 'Lebih sedikit ronde = sesi lebih pendek dan mudah diselesaikan.' })
          ]),
          el('input', {
            class: 'slider', type: 'range', min: '1', max: '5', step: '1',
            value: String(s.rounds), 'aria-label': 'Jumlah ronde',
            onInput: function (e) { Store.setSetting('rounds', Number(e.target.value)); }
          }),
          el('span', { class: 'gstat', text: s.rounds + '×', id: 'guRoundLabel' })
        ]);
        roundRow.querySelector('input').addEventListener('input', function (e) {
          const l = document.getElementById('guRoundLabel');
          if (l) l.textContent = e.target.value + '×';
        });
        set.appendChild(roundRow);

        /* daftar hadiah */
        const rp = el('div', { class: 'setrow', style: { display: 'block' } });
        rp.appendChild(el('div', { class: 'setrow__t', text: 'Daftar hadiah (1 hadiah = ' + Store.TOKENS_PER_REWARD + ' bintang)' }));
        rp.appendChild(el('div', { class: 'setrow__d', text: 'Hadiah sebaiknya kecil, cepat, dan bisa langsung diberikan.' }));
        const ul = el('ul', { class: 'notelist' });
        Store.get().rewardPool.forEach(function (r) {
          ul.appendChild(el('li', { class: 'noteitem' }, [
            el('span', { text: r.ico || '🎁' }),
            el('span', { class: 'noteitem__t', text: r.title + (r.note ? ' — ' + r.note : '') }),
            el('button', {
              class: 'noteitem__del', type: 'button', text: '✕',
              'aria-label': 'Hapus hadiah ' + r.title,
              onClick: function () { Store.removeReward(r.id); App.renderGrownup(); }
            })
          ]));
        });
        rp.appendChild(ul);
        const form = el('form', { class: 'stepform' }, [
          el('label', { class: 'sr-only', for: 'rewardInput', text: 'Hadiah baru' }),
          el('input', { id: 'rewardInput', type: 'text', placeholder: 'Tambah hadiah, mis: main lego 15 menit' }),
          el('button', { class: 'btn btn--primary', type: 'submit', text: 'Tambah' })
        ]);
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          const inp = document.getElementById('rewardInput');
          if (inp.value.trim()) { Store.addReward({ title: inp.value.trim() }); inp.value = ''; App.renderGrownup(); }
        });
        rp.appendChild(form);
        set.appendChild(rp);
      }

      /* catatan */
      const nl = document.getElementById('noteList');
      if (nl) {
        UIx.clear(nl);
        const notes = Store.get().notes;
        if (!notes.length) {
          nl.appendChild(el('li', { class: 'noteitem' }, [el('span', { class: 'noteitem__t', style: { color: 'var(--ink-faint)' }, text: 'Belum ada catatan.' })]));
        }
        notes.forEach(function (n) {
          nl.appendChild(el('li', { class: 'noteitem' }, [
            el('span', { class: 'noteitem__d', text: UIx.fmtDate(n.at) }),
            el('span', { class: 'noteitem__t', text: n.text }),
            el('button', {
              class: 'noteitem__del', type: 'button', text: '✕', 'aria-label': 'Hapus catatan',
              onClick: function () { Store.removeNote(n.id); App.renderGrownup(); }
            })
          ]));
        });
      }

      /* tabel riwayat */
      const tb = document.getElementById('guTableBody');
      if (tb) {
        UIx.clear(tb);
        const rows = Store.get().sessions.slice(-30).reverse();
        if (!rows.length) {
          const tr = el('tr');
          tr.appendChild(el('td', { colspan: '5', style: { color: 'var(--ink-faint)' }, text: 'Belum ada sesi tercatat.' }));
          tb.appendChild(tr);
        }
        rows.forEach(function (r) {
          const g = GAMES.filter(function (x) { return x.id === r.kind; })[0];
          const tr = el('tr');
          tr.appendChild(el('td', { text: UIx.fmtDate(r.at) }));
          tr.appendChild(el('td', { text: (g ? g.emoji + ' ' : '') + (g ? g.title : r.title || r.kind) }));
          tr.appendChild(el('td', { text: UIx.fmtDur(r.seconds) }));
          tr.appendChild(el('td', { text: r.accuracy == null ? '—' : r.accuracy + '%' }));
          tr.appendChild(el('td', { text: r.completed ? '✅ tuntas' : (r.stoppedByChild ? '⏹ berhenti sendiri' : '⏳ belum tuntas') }));
          tb.appendChild(tr);
        });
      }

      /* tautan GitHub selalu sinkron dengan yang tersimpan */
      this.renderRepo();
    },

    applySetting: function (key, v) {
      const s = Store.get().settings;
      if (key === 'sound') { Sound.setEnabled(v); Sound.setVoice(v && s.voice); }
      if (key === 'voice') Sound.setVoice(v && s.sound);
      if (key === 'motion') { UIx.setMotion(v); document.body.classList.toggle('no-motion', !v); }
      if (key === 'readable') document.body.classList.toggle('readable', v);
      this.syncTopbar();
    },

    /* ═══════════ TAUTAN GITHUB ═══════════ */
    /* Menyimpan alamat repositori di perangkat dan menyalinnya ke semua
       tautan GitHub di antarmuka. Hanya alamat github.com yang diterima,
       supaya tidak ada tautan asing yang bisa disisipkan lewat kolom isian. */
    GITHUB_FALLBACK: 'https://docs.github.com/pages',

    normalizeRepo: function (raw) {
      let url = String(raw == null ? '' : raw).trim();
      if (!url) return '';
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      let parsed;
      try { parsed = new URL(url); } catch (e) { return null; }
      const host = parsed.hostname.toLowerCase();
      if (host !== 'github.com' && host !== 'www.github.com') return null;
      /* sisakan pemilik/nama saja, buang /tree/main dan sejenisnya */
      const parts = parsed.pathname.split('/').filter(Boolean).slice(0, 2);
      if (parts.length < 1) return null;
      return 'https://github.com/' + parts.join('/');
    },

    setRepo: function (raw) {
      const clean = this.normalizeRepo(raw);
      if (clean === null) {
        UIx.toast('Alamat harus berupa tautan github.com yang sah', null, 3000);
        Sound.play('wrong');
        return;
      }
      Store.setTop('repoUrl', clean);
      this.renderRepo();
      if (clean) {
        Sound.play('correct');
        UIx.toast('Tautan repositori disimpan di perangkat ini', 'good', 2600);
      } else {
        UIx.toast('Tautan repositori dikosongkan', null, 2000);
      }
    },

    renderRepo: function () {
      const url = Store.getTop('repoUrl') || '';
      const target = url || this.GITHUB_FALLBACK;
      const footer = document.getElementById('footerRepoLink');
      if (footer) {
        footer.href = target;
        footer.textContent = url
          ? 'Kode sumber di GitHub: ' + url.replace(/^https?:\/\/github\.com\//, '')
          : 'Kode sumber & cara menerbitkan di GitHub';
      }
      const link = document.getElementById('repoLink');
      if (link) link.href = target;
      const input = document.getElementById('repoInput');
      if (input && input.value !== url) input.value = url;
      const status = document.getElementById('repoStatus');
      if (status) {
        status.textContent = url
          ? 'Tersimpan: ' + url
          : 'Belum ada repositori disetel. Tautan di bawah mengarah ke panduan GitHub Pages.';
      }
    },

    addNote: function () {
      const inp = document.getElementById('noteInput');
      if (!inp || !inp.value.trim()) return;
      Store.addNote(inp.value.trim());
      inp.value = '';
      this.renderGrownup();
      UIx.toast('Catatan disimpan di perangkat ini', 'good', 1800);
    },

    exportData: function () {
      const data = Store.exportData();
      try {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const d = new Date();
        a.href = url;
        a.download = 'ruang-fokus-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        global.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        UIx.toast('Data diekspor', 'good');
      } catch (e) {
        UIx.toast('Gagal mengekspor di browser ini', null, 2600);
      }
    },

    wipe: function () {
      UIx.overlay({
        title: 'Hapus semua data?',
        html: '<p>Tindakan ini menghapus seluruh riwayat sesi, bintang, lencana, catatan, dan pengaturan dari perangkat ini. Tidak bisa dibatalkan.</p>',
        actions: [
          { label: 'Batal', primary: true, action: function () { UIx.closeOverlay(); } },
          { label: 'Ya, hapus semua', action: function () {
              UIx.closeOverlay();
              Store.wipe();
              App.applySetting('sound', true);
              App.renderGames(); App.renderBadges(); App.renderProgress(); App.renderGrownup();
              UIx.toast('Semua data sudah dihapus', null, 2400);
            } }
        ]
      });
    },

    /* ═══════════ ALAT: TIMER VISUAL ═══════════ */
    renderVtPicker: function () {
      const box = document.getElementById('vtPicker');
      if (!box) return;
      const self = this;
      UIx.clear(box);
      [60, 120, 300, 600, 900].forEach(function (sec) {
        const label = sec < 60 ? sec + ' dtk' : (sec / 60) + ' mnt';
        const b = el('button', {
          class: 'chip', type: 'button', text: label,
          'aria-pressed': String(self._vtDuration === sec),
          'aria-label': 'Atur timer ' + label
        });
        b.addEventListener('click', function () {
          self.vtStop();
          self._vtDuration = sec;
          self._vtTotal = sec;
          self._vtRemaining = sec;
          self.renderVtPicker();
          self.vtRender();
        });
        box.appendChild(b);
      });
    },

    vtRender: function () {
      const arc = document.getElementById('vtArc');
      const clock = document.getElementById('vtClock');
      const state = document.getElementById('vtState');
      const C = 2 * Math.PI * 96;
      const pct = this._vtTotal ? this._vtRemaining / this._vtTotal : 0;
      if (arc) {
        arc.setAttribute('stroke-dasharray', String(C));
        arc.setAttribute('stroke-dashoffset', String(C * (1 - pct)));
        arc.classList.toggle('is-low', pct <= 0.4 && pct > 0.15);
        arc.classList.toggle('is-crit', pct <= 0.15);
      }
      if (clock) clock.textContent = UIx.fmtClock(this._vtRemaining);
      if (state) state.textContent = this._vtTimer ? (this._vtRemaining <= 0 ? 'selesai' : 'berjalan') : (this._vtRemaining < this._vtTotal ? 'dijeda' : 'siap');
      const btn = document.getElementById('btnVtToggle');
      if (btn) btn.textContent = this._vtTimer ? 'Jeda' : (this._vtRemaining < this._vtTotal ? 'Lanjut' : 'Mulai');
    },

    vtToggle: function () {
      const self = this;
      if (this._vtTimer) { this.vtStop(); this.vtRender(); return; }
      if (this._vtRemaining <= 0) { this._vtRemaining = this._vtTotal; }
      let last = performance.now();
      Sound.unlock();
      this._vtTimer = global.setInterval(function () {
        const now = performance.now();
        const dt = (now - last) / 1000;
        last = now;
        self._vtRemaining = Math.max(0, self._vtRemaining - dt);
        self.vtRender();
        if (self._vtRemaining <= 0) {
          self.vtStop();
          self.vtRender();
          Sound.play('finish');
          UIx.celebrate({ count: 20 });
          UIx.toast('Waktu habis!', 'good', 3000);
        }
      }, 250);
      this.vtRender();
    },

    vtStop: function () {
      if (this._vtTimer) { global.clearInterval(this._vtTimer); this._vtTimer = null; }
    },

    /* ═══════════ ALAT: PECAH TUGAS ═══════════ */
    renderTasks: function () {
      const list = document.getElementById('stepList');
      if (!list) return;
      const tasks = Store.getTasks();
      UIx.clear(list);
      if (!tasks.length) {
        list.appendChild(el('li', { class: 'stepitem' }, [
          el('span', { class: 'stepitem__t', style: { color: 'var(--ink-faint)' }, text: 'Belum ada langkah. Tambahkan satu langkah kecil di atas, atau tekan "Pakai contoh".' })
        ]));
        return;
      }
      tasks.forEach(function (t, i) {
        const li = el('li', { class: 'stepitem' + (t.done ? ' is-done' : '') });
        const box = el('button', {
          class: 'stepitem__box', type: 'button', text: t.done ? '✓' : '',
          'aria-pressed': String(!!t.done),
          'aria-label': (t.done ? 'Batalkan langkah ' : 'Tandai selesai langkah ') + (i + 1) + ': ' + t.text
        });
        box.addEventListener('click', function () {
          const arr = Store.getTasks();
          arr[i].done = !arr[i].done;
          Store.setTasks(arr);
          App.renderTasks();
          if (arr[i].done) {
            Sound.play('correct');
            const allDone = arr.every(function (x) { return x.done; });
            if (allDone) {
              Store.addTokens(1);
              UIx.celebrate({ count: 20 });
              UIx.toast('Semua langkah selesai! ⭐ +1 bintang', 'star', 3200);
            }
          }
        });
        const del = el('button', {
          class: 'stepitem__del', type: 'button', text: '✕', 'aria-label': 'Hapus langkah ' + (i + 1)
        });
        del.addEventListener('click', function () {
          const arr = Store.getTasks();
          arr.splice(i, 1);
          Store.setTasks(arr);
          App.renderTasks();
        });
        li.appendChild(box);
        li.appendChild(el('span', { class: 'stepitem__t', text: t.text }));
        li.appendChild(del);
        list.appendChild(li);
      });
    },

    addTask: function () {
      const inp = document.getElementById('stepInput');
      if (!inp || !inp.value.trim()) return;
      const arr = Store.getTasks();
      arr.push({ text: inp.value.trim(), done: false });
      Store.setTasks(arr);
      inp.value = '';
      Sound.play('tap');
      this.renderTasks();
    },

    loadTemplates: function () {
      Store.setTasks([
        { text: 'Keluarkan buku dan alat tulis', done: false },
        { text: 'Baca satu soal saja', done: false },
        { text: 'Kerjakan soal itu (maks 5 menit)', done: false },
        { text: 'Centang, lalu berdiri dan gerakkan badan 30 detik', done: false },
        { text: 'Lanjut satu soal berikutnya', done: false },
        { text: 'Rapikan alat, lalu istirahat', done: false }
      ]);
      this.renderTasks();
      UIx.toast('Contoh langkah dimuat. Ubah sesuai kebutuhan anak.', null, 2600);
    }
  };

  global.App = App;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { App.init(); });
  } else {
    App.init();
  }
})(window);
