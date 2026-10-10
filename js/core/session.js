/* ═══════════════════════════════════════════════════════════════
   session.js — mesin sesi: timer visual, ronde, jeda, jeda gerak
   Aturan desain ADHD yang dijalankan di sini:
   • Sesi pendek (default 3 menit) dengan akhir yang jelas.
   • Timer SELALU terlihat — melawan buta waktu (time blindness).
   • Jeda gerak otomatis di antara ronde untuk melepas energi.
   • Anak boleh berhenti kapan saja tanpa hukuman (tombol Keluar).
   • Berhenti di tengah tetap dicatat sebagai data, bukan kegagalan.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const UIx = global.UI;

  const Session = {
    game: null,
    running: false,
    paused: false,
    ended: false,
    duration: 180,
    remaining: 180,
    round: 1,
    roundsTotal: 3,
    score: 0,
    correct: 0,
    wrong: 0,
    startedAt: 0,
    elapsedActive: 0,
    tokenAwarded: 0,
    _tick: null,
    _lastTs: 0,
    frozen: false,
    frozenPaused: false,
    onFreeze: null,
    onThaw: null,
    shared: {},
    onGameEnd: null,

    els: {},

    init: function () {
      this.els = {
        fill: document.getElementById('timerFill'),
        clock: document.getElementById('timerClock'),
        round: document.getElementById('timerRound'),
        score: document.getElementById('timerScore'),
        bar: document.getElementById('timerBar'),
        body: document.getElementById('stageBody'),
        title: document.getElementById('stageTitle'),
        stepNow: document.getElementById('stepNow'),
        stepNowNum: document.getElementById('stepNowNum'),
        stepNowTotal: document.getElementById('stepNowTotal'),
        stepNowText: document.getElementById('stepNowText')
      };
      const self = this;
      /* Tab disembunyikan / ponsel dikunci ──
         Peramban MENAHAN timer saat tab tidak terlihat, lalu menjalankannya
         sekaligus dalam satu ledakan ketika tab kembali aktif. Akibatnya
         game tampak "berjalan sendiri tanpa disentuh": isyarat dilompati,
         ronde ditutup, bahkan sesi bisa selesai dengan sendirinya.

         Solusinya: bekukan jam sesi DAN seluruh timer di dalam game selama
         tab tidak terlihat, lalu mulai lagi dengan jendela waktu yang utuh.

         Sengaja HANYA memakai visibilitychange. Sebelumnya blur/focus ikut
         dipakai, dan itu keliru: menekan tombol di dalam halaman dapat
         memicu blur/focus, sehingga sesi terasa terhenti sendiri dan
         tombol tidak merespons. */
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) self.freeze('hidden');
        else self.thaw();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          if (UIx.isOverlayOpen()) { UIx.closeOverlay(); }
          else if (self.running && !self.paused) self.pause();
        }
      });
      return this;
    },

    /* ── pembekuan dan pelanjutan ── */
    freeze: function (why) {
      if (this.frozen || !this.running || this.ended) return;
      this.frozen = true;
      this.frozenPaused = this.paused;
      this.paused = true;                       // step() berhenti menambah waktu
      try { if (this.game && this.game.pause) this.game.pause(); } catch (e) {}
      if (typeof this.onFreeze === 'function') { try { this.onFreeze(why); } catch (e) {} }
    },

    thaw: function () {
      if (!this.frozen) return;
      this.frozen = false;
      const wasPaused = this.frozenPaused;
      this.frozenPaused = false;
      this._lastTs = performance.now();          // jangan hitung waktu yang hilang
      if (this.ended || !this.running) return;

      if (wasPaused) {
        /* Anak sudah menjeda sendiri: cukup tampilkan kembali layar jeda. */
        this.paused = true;
        if (typeof this.onThaw === 'function') { try { this.onThaw(true); } catch (e) {} }
        return;
      }

      /* Anak sedang bermain lalu tab disembunyikan. Jam tetap DIBEKUKAN
         sampai anak menekan "Lanjut" — supaya waktu tidak berjalan sementara
         ia masih membaca dialog. Inilah yang dulu tampak seperti game
         berjalan sendiri setelah tab kembali aktif. */
      this.paused = true;
      this.syncPauseButton();
      if (typeof this.onThaw === 'function') { try { this.onThaw(false); } catch (e) {} }
    },

    /* Menyamakan tampilan tombol Jeda dengan keadaan sebenarnya. */
    syncPauseButton: function () {
      const btn = document.getElementById('btnStagePause');
      if (!btn) return;
      const p = !!this.paused;
      btn.setAttribute('aria-pressed', String(p));
      btn.innerHTML = p ? '<span aria-hidden="true">▶️</span> Lanjut' : '<span aria-hidden="true">⏸️</span> Jeda';
    },

    /* Melanjutkan jam sesi tanpa syarat. Dipakai setelah jeda gerak, di mana
       sesi mungkin sedang dibekukan (tab disembunyikan) atau dijeda biasa.
       Berbeda dengan resume(), fungsi ini tidak menyentuh dialog apa pun. */
    resumeClock: function () {
      if (!this.running || this.ended) return;
      if (this.frozenPaused) return;   // anak menjeda sendiri: hormati pilihannya
      this.frozen = false;
      this.frozenPaused = false;
      this.paused = false;
      this._lastTs = performance.now();
      this.syncPauseButton();
    },

    /* ── penjadwalan timer ──
       Memakai stempel waktu, bukan hitungan interval, agar tetap akurat
       meski perangkat lambat atau layar terkunci. */
    schedule: function (seconds) {
      const self = this;
      this.duration = Math.max(30, Math.round(seconds));
      this.remaining = this.duration;
      this.renderTimer();
      this.stopClock();
      this._lastTs = performance.now();
      this._tick = global.setInterval(function () { self.step(); }, 200);
    },

    step: function () {
      if (!this.running || this.paused || this.ended) { this._lastTs = performance.now(); return; }
      const now = performance.now();
      const dt = (now - this._lastTs) / 1000;
      this._lastTs = now;
      if (dt <= 0 || dt > 5) return;              // lompatan waktu (tab tidur) diabaikan
      this.remaining -= dt;
      this.elapsedActive += dt;
      if (this.remaining <= 0) {
        this.remaining = 0;
        this.renderTimer();
        this.finish('time');
        return;
      }
      const prev = Math.ceil((this.remaining + dt) / 10);
      const cur = Math.ceil(this.remaining / 10);
      if (cur !== prev && this.remaining <= 10.5 && this.remaining > 0.4) global.Sound.play('tick');
      this.renderTimer();
    },

    stopClock: function () {
      if (this._tick) { global.clearInterval(this._tick); this._tick = null; }
    },

    renderTimer: function () {
      const e = this.els;
      const pct = this.duration ? Math.max(0, Math.min(1, this.remaining / this.duration)) : 0;
      if (e.fill) {
        e.fill.style.width = (pct * 100).toFixed(2) + '%';
        e.fill.classList.toggle('is-low', pct <= 0.4 && pct > 0.15);
        e.fill.classList.toggle('is-crit', pct <= 0.15);
      }
      if (e.clock) e.clock.textContent = UIx.fmtClock(this.remaining);
      if (this.els.bar) {
        this.els.bar.setAttribute('aria-label', 'Sisa waktu ' + UIx.fmtClock(this.remaining) + ' dari ' + UIx.fmtClock(this.duration));
      }
      if (e.round) e.round.textContent = 'Ronde ' + this.round + '/' + this.roundsTotal;
      if (e.score) e.score.textContent = 'Skor ' + this.score;
    },

    /* ── HOST API untuk game ── */
    host: function () {
      const self = this;
      if (this._host) return this._host;
      this._host = {
        stage: function () { return self.els.body; },
        sound: function (n) { global.Sound.play(n); },
        say: function (t) { global.Sound.say(t); },
        prompt: function (t, kind) { UIx.prompt(t, kind); },
        readSteps: function () { if (self.game && self.game.steps) global.Sound.say(self.game.steps.join('. ')); },
        settings: function () { return global.Store.get().settings; },
        shared: function () { return self.shared; },
        toast: function (m, k) { UIx.toast(m, k); },

        setScore: function (n) { self.score = Math.max(0, Math.round(n) || 0); self.renderTimer(); },
        addScore: function (n) {
          self.score = Math.max(0, self.score + (Math.round(n) || 0));
          self.renderTimer();
          return self.score;
        },
        score: function () { return self.score; },

        setRound: function (n) {
          const r = Math.max(1, Math.round(n) || 1);
          if (r !== self.round) { global.Sound.play('round'); }
          self.round = r;
          self.renderTimer();
        },
        round: function () { return self.round; },
        roundsTotal: function () { return self.roundsTotal; },

        setSteps: function (list, index) {
          const e = self.els;
          if (!list || !list.length) { if (e.stepNow) e.stepNow.hidden = true; return; }
          if (e.stepNow) e.stepNow.hidden = false;
          if (e.stepNowNum) e.stepNowNum.textContent = Math.min((index || 0) + 1, list.length);
          if (e.stepNowTotal) e.stepNowTotal.textContent = list.length;
          if (e.stepNowText) e.stepNowText.textContent = list[index || 0] || list[0];
        },

        right: function (pts) {
          self.correct++;
          self.score = Math.max(0, self.score + (Math.round(pts == null ? 10 : pts) || 0));
          self.renderTimer();
          global.Sound.play('correct');
        },
        wrong: function () {
          self.wrong++;
          global.Sound.play('wrong');
        },
        countRetry: function () { global.Store.bump('retry'); },
        countCalm: function () { global.Store.bump('calm'); },
        countBreak: function () { global.Store.bump('break'); },

        /* selesai lebih cepat dari waktu (mis. semua ronde tuntas) */
        complete: function () { self.finish('complete'); },
        /* berhenti karena kesulitan tanpa hukuman */
        stuck: function () { self.finish('stuck'); },

        setStageTitle: function (t) { if (self.els.title) self.els.title.textContent = t; },

        /* jeda gerak terjadwal antar ronde */
        offerMovementBreak: function (sec, done) {
          const s = global.Store.get().settings;
          if (!s.movementBreaks) { if (done) done(); return; }
          global.App.showBreak(sec || 12, function () { global.Store.bump('break'); if (done) done(); });
        },

        /* permainan yang memakai ronde: panggil setelah ronde selesai */
        nextRoundOrFinish: function () {
          if (self.round >= self.roundsTotal) { self.finish('complete'); return false; }
          self.setRound(self.round + 1);
          return true;
        },

        timerVisible: function () { return global.Store.get().settings.autoTimer; },
        remaining: function () { return self.remaining; }
      };
      return this._host;
    },

    /* ── mulai sesi ── */
    start: function (game) {
      this.game = game;
      this.running = true;
      this.paused = false;
      this.ended = false;
      this.score = 0;
      this.correct = 0;
      this.wrong = 0;
      this.round = 1;
      this.startedAt = Date.now();
      this.elapsedActive = 0;
      this.shared = {};
      this._host = null;

      const s = global.Store.get().settings;
      this.roundsTotal = Math.max(1, Math.round(game.rounds || s.rounds || 3));
      const secs = Math.max(30, Math.round(game.duration || s.sessionMinutes * 60));

      const stage = this.els.body;
      UIx.clear(stage);
      if (this.els.title) this.els.title.textContent = game.title + ' — ' + (game.subtitle || '');
      UIx.prompt(game.prompt || (game.steps && game.steps[0]) || 'Ayo mulai!');
      const btnPause = document.getElementById('btnStagePause');
      if (btnPause) { btnPause.setAttribute('aria-pressed', 'false'); btnPause.innerHTML = '<span aria-hidden="true">⏸️</span> Jeda'; }

      try {
        game.mount(stage, this.host());
      } catch (err) {
        console.error('Ruang Fokus — game gagal dimuat:', err);
        try {
          if (stage) {
            UIx.clear(stage);
            stage.appendChild(UIx.el('p', { class: 'gcount', text: 'Game gagal dimuat: ' + (err && err.message ? err.message : 'tidak diketahui') }));
          }
        } catch (e2) { /* jangan biarkan penangan galat ikut gagal */ }
      }

      this.frozen = false;
      this.frozenPaused = false;
      this.schedule(secs);
      global.Sound.play('open');
    },

    pause: function (silent) {
      if (!this.running || this.ended || this.paused) return;
      this.paused = true;
      try { if (this.game && this.game.pause) this.game.pause(); } catch (e) {}
      const btnPause = document.getElementById('btnStagePause');
      if (btnPause) { btnPause.setAttribute('aria-pressed', 'true'); btnPause.innerHTML = '<span aria-hidden="true">▶️</span> Lanjut'; }
      if (silent) return;
      const self = this;
      UIx.overlay({
        title: 'Jeda dulu',
        html: '<p>Waktu berhenti sebentar. Kamu bisa tarik napas, minum, atau gerakkan badan.</p>' +
              '<p><b>Skor dan progresmu aman.</b> Lanjut kapan saja kamu siap.</p>',
        actions: [
          { label: 'Lanjut main', primary: true, action: function () { UIx.closeOverlay(); self.resume(); } },
          { label: 'Ulangi langkah', action: function () { UIx.closeOverlay(); self.showSteps(); } },
          { label: 'Selesai sekarang', action: function () { UIx.closeOverlay(); self.finish('child'); } }
        ]
      });
    },

    resume: function () {
      if (!this.running || this.ended) return;
      this.paused = false;
      this.frozen = false;
      this.frozenPaused = false;
      this._lastTs = performance.now();
      try { if (this.game && this.game.resume) this.game.resume(); } catch (e) {}
      const btnPause = document.getElementById('btnStagePause');
      if (btnPause) { btnPause.setAttribute('aria-pressed', 'false'); btnPause.innerHTML = '<span aria-hidden="true">⏸️</span> Jeda'; }
    },

    togglePause: function () {
      if (this.paused) { UIx.closeOverlay(); this.resume(); }
      else this.pause();
    },

    /* Pengingat langkah kapan saja — penopang memori kerja */
    showSteps: function () {
      if (!this.game) return;
      const self = this;
      UIx.overlay({
        title: 'Langkah ' + this.game.title,
        list: this.game.steps || [],
        actions: [
          { label: 'Mengerti, lanjut', primary: true, action: function () { UIx.closeOverlay(); self.resume(); } },
          { label: 'Bacakan', action: function () { global.Sound.say((self.game.steps || []).join('. ')); } },
          { label: 'Selesai sekarang', action: function () { UIx.closeOverlay(); self.finish('child'); } }
        ]
      });
      global.Sound.play('hint');
    },

    /* ── selesai ── */
    finish: function (reason) {
      if (this.ended || !this.running) return;
      this.ended = true;
      this.running = false;
      this.stopClock();
      try { if (this.game && this.game.unmount) this.game.unmount(); } catch (e) {}
      global.Sound.hush();

      const seconds = Math.round(this.elapsedActive);
      const finishedAll = reason === 'complete' || reason === 'time';
      const stoppedByChild = reason === 'child' || reason === 'stuck';
      const completion = this.roundsTotal ? Math.min(1, (this.round - (finishedAll ? 0 : 1)) / this.roundsTotal) : 1;

      const rec = {
        kind: this.game.id,
        title: this.game.title,
        seconds: seconds,
        rounds: Math.max(1, this.round),
        roundsTotal: this.roundsTotal,
        correct: this.correct,
        wrong: this.wrong,
        target: this.game.target || null,
        score: this.score,
        /* Tandai tuntas: 
           - 'complete' berarti game memanggil complete() setelah rondenya
             benar-benar habis. Ronde terakhir belum sempat dinaikkan, jadi
             TIDAK boleh dihitung dari nomor ronde (dulu keliru menghasilkan
             0,5 dan sesi ditandai belum tuntas).
           - 'time' berarti waktu habis; baru dihitung dari ronde yang tercapai. */
        completed: reason === 'complete' ? true : (finishedAll && completion >= 0.999),
        partial: !finishedAll,
        stoppedByChild: stoppedByChild,
        reason: reason
      };

      const res = global.Store.logSession(rec);

      /* ── hadiah token ──
         Aturan: bintang diberikan karena MENYELESAIKAN dan BERUSAHA,
         bukan karena skor sempurna. Ini melindungi harga diri anak
         yang kesulitan menahan impuls atau salah menjawab. */
      let tokens = 0;
      if (rec.completed) tokens += 2;
      else if (completion >= 0.5) tokens += 1;
      if (this.correct >= 5) tokens += 1;
      if (this.wrong > 0 && this.correct > 0) tokens += 1;     // tetap mencoba setelah salah
      if (global.Store.counter('calm') > 0 && reason !== 'child') tokens += 0; // netral
      tokens = Math.max(rec.completed ? 1 : 0, tokens);
      if (tokens > 0) global.Store.addTokens(tokens);
      this.tokenAwarded = tokens;

      if (global.App && global.App.afterSession) {
        global.App.afterSession({
          game: this.game,
          rec: rec,
          tokens: tokens,
          unlocked: res.unlocked,
          seconds: seconds,
          correct: this.correct,
          wrong: this.wrong,
          score: this.score,
          reason: reason,
          completion: completion
        });
      }
    },

    stopSilently: function () {
      this.ended = true;
      this.running = false;
      this.stopClock();
      try { if (this.game && this.game.unmount) this.game.unmount(); } catch (e) {}
      global.Sound.hush();
    }
  };

  global.Session = Session;
})(window);
