/* ═══════════════════════════════════════════════════════════════
   store.js — state, penyimpanan lokal, ekonomi token, lencana
   Semua data tersimpan di localStorage perangkat. Tidak ada jaringan.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const KEY = 'ruangfokus.v1';
  const TOKENS_PER_REWARD = 5;

  const DEFAULT = {
    version: 1,
    settings: {
      sound: true,        // efek suara
      voice: true,        // instruksi bersuara (opsional)
      motion: true,       // animasi & konfeti
      readable: false,    // mode baca (huruf besar & lega)
      sessionMinutes: 3,  // durasi satu game
      rounds: 3,          // jumlah ronde/tugas per sesi
      movementBreaks: true, // jeda gerak antar ronde
      autoTimer: true,    // timer visual selalu tampil
      praiseEffort: true  // pujian fokus pada usaha
    },
    /* URL repositori GitHub proyek ini. Bila diisi, tautan di footer dan
       panel "Tentang & GitHub" mengarah ke repo tersebut.
       Contoh: https://github.com/nama-pengguna/ruang-fokus */
    repoUrl: '',
    tokens: 0,            // bintang yang bisa dipakai
    lifetimeTokens: 0,    // total bintang sepanjang waktu
    rewardsClaimed: 0,
    streakDays: [],
    badges: [],
    favorites: [],
    sessions: [],         // riwayat sesi (maks 300)
    notes: [],
    tasks: [],
    rewardPool: [
      { id: 'r1', ico: '🎬', title: 'Pilih tontonan 15 menit', note: 'Waktu layar pilihanmu' },
      { id: 'r2', ico: '🍎', title: 'Camilan sehat favorit', note: 'Satu porsi kecil' },
      { id: 'r3', ico: '🧩', title: 'Waktu main bebas 10 menit', note: 'Tanpa syarat' },
      { id: 'r4', ico: '📚', title: 'Baca buku bersama', note: 'Pilih bukunya sendiri' },
      { id: 'r5', ico: '🚲', title: 'Main di luar 20 menit', note: 'Bergerak itu bagus' },
      { id: 'r6', ico: '🎵', title: 'Pilih lagu di perjalanan', note: 'Jadi DJ keluarga' }
    ]
  };

  let state = load();
  const listeners = new Set();

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function merge(base, saved) {
    const out = clone(base);
    if (!saved || typeof saved !== 'object') return out;
    Object.keys(saved).forEach(function (k) {
      const v = saved[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
        out[k] = merge(out[k], v);
      } else if (v !== undefined) {
        out[k] = v;
      }
    });
    return out;
  }

  function load() {
    try {
      const raw = global.localStorage.getItem(KEY);
      return merge(DEFAULT, raw ? JSON.parse(raw) : null);
    } catch (e) {
      return clone(DEFAULT);
    }
  }

  function persist() {
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { /* mode privat / kuota penuh: aplikasi tetap jalan */ }
  }

  function emit() { listeners.forEach(function (fn) { try { fn(state); } catch (e) {} }); }

  /* ── hari (yyyy-mm-dd lokal) ── */
  function dayKey(d) {
    d = d || new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + dd;
  }

  function daysBack(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push(dayKey(d));
    }
    return out;
  }

  /* ══════════ LENCANA ══════════ */
  /* Lencana menghargai usaha & kebiasaan, bukan hanya skor tinggi. */
  const BADGES = [
    { id: 'first',    ico: '🌱', title: 'Langkah Pertama',  desc: 'Menyelesaikan 1 sesi' },
    { id: 'three',    ico: '🔥', title: 'Tiga Kali',        desc: 'Menyelesaikan 3 sesi' },
    { id: 'ten',      ico: '🏅', title: 'Sepuluh Sesi',     desc: 'Menyelesaikan 10 sesi' },
    { id: 'streak3',  ico: '📅', title: 'Tiga Hari',        desc: 'Latihan 3 hari berbeda' },
    { id: 'streak5',  ico: '🗓️', title: 'Lima Hari',        desc: 'Latihan 5 hari berbeda' },
    { id: 'calm5',    ico: '🌬️', title: 'Napas Tenang',     desc: '5 kali latihan menenangkan diri' },
    { id: 'break5',   ico: '🤸', title: 'Suka Bergerak',    desc: '5 kali jeda gerak' },
    { id: 'finish',   ico: '🎯', title: 'Selesai Sendiri',  desc: '10 sesi tanpa berhenti di tengah' },
    { id: 'variety',  ico: '🧭', title: 'Penjelajah',       desc: 'Mencoba semua jenis game' },
    { id: 'honest',   ico: '💛', title: 'Berusaha Terus',   desc: '5 kali mengulang setelah salah' }
  ];

  function badgeById(id) { return BADGES.find(function (b) { return b.id === id; }); }

  function checkBadges() {
    const s = state.sessions.filter(function (x) { return x.completed; });
    const unlocked = [];
    const total = s.length;
    const counts = state.counters || {};
    const kinds = new Set(s.map(function (x) { return x.kind; }));

    const maybe = function (id, cond) {
      if (cond && state.badges.indexOf(id) === -1) { state.badges.push(id); unlocked.push(id); }
    };
    maybe('first', total >= 1);
    maybe('three', total >= 3);
    maybe('ten', total >= 10);
    maybe('streak3', state.streakDays.length >= 3);
    maybe('streak5', state.streakDays.length >= 5);
    maybe('calm5', (counts.calm || 0) >= 5);
    maybe('break5', (counts.break || 0) >= 5);
    maybe('finish', total >= 10);
    maybe('variety', kinds.size >= 5);
    maybe('honest', (counts.retry || 0) >= 5);
    return unlocked;
  }

  /* ══════════ API ══════════ */
  const Store = {
    BADGES: BADGES,
    TOKENS_PER_REWARD: TOKENS_PER_REWARD,
    DEFAULT: DEFAULT,

    get: function () { return state; },
    subscribe: function (fn) { listeners.add(fn); return function () { listeners.delete(fn); }; },

    save: function () { persist(); emit(); },

    setSetting: function (k, v) {
      state.settings[k] = v;
      persist(); emit();
      return v;
    },
    /* pengaturan tingkat atas (di luar settings), mis. repoUrl */
    setTop: function (k, v) {
      state[k] = v;
      persist(); emit();
      return v;
    },
    getTop: function (k) { return state[k]; },
    toggleSetting: function (k) {
      state.settings[k] = !state.settings[k];
      persist(); emit();
      return state.settings[k];
    },

    /* ── token ── */
    addTokens: function (n) {
      n = Math.max(0, Math.round(n || 0));
      state.tokens += n;
      state.lifetimeTokens += n;
      persist(); emit();
      return n;
    },
    /* Buang token untuk hadiah — mengajarkan penundaan hadiah (delay of reward) */
    canRedeem: function () { return state.tokens >= TOKENS_PER_REWARD; },
    redeem: function () {
      if (state.tokens < TOKENS_PER_REWARD) return null;
      state.tokens -= TOKENS_PER_REWARD;
      state.rewardsClaimed += 1;
      const pool = state.rewardPool && state.rewardPool.length ? state.rewardPool : DEFAULT.rewardPool;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      persist(); emit();
      return pick;
    },
    addReward: function (r) {
      if (!r || !r.title) return;
      state.rewardPool.push({ id: 'c' + Date.now(), ico: r.ico || '🎁', title: r.title, note: r.note || '' });
      persist(); emit();
    },
    removeReward: function (id) {
      state.rewardPool = state.rewardPool.filter(function (r) { return r.id !== id; });
      persist(); emit();
    },

    /* ── favorit ── */
    isFavorite: function (id) { return state.favorites.indexOf(id) !== -1; },
    toggleFavorite: function (id) {
      const i = state.favorites.indexOf(id);
      if (i === -1) state.favorites.push(id); else state.favorites.splice(i, 1);
      persist(); emit();
      return i === -1;
    },

    /* ── penghitung kejadian (jeda, napas, ulang) ── */
    bump: function (key, n) {
      state.counters = state.counters || {};
      state.counters[key] = (state.counters[key] || 0) + (n || 1);
      persist(); emit();
      return state.counters[key];
    },
    counter: function (key) { return (state.counters || {})[key] || 0; },

    /* ── catat sesi ──
       rec = { kind, title, seconds, rounds, correct, wrong, target, completed,
               stoppedByChild, maxFocusSeconds } */
    logSession: function (rec) {
      const r = Object.assign({
        at: Date.now(), day: dayKey(), kind: 'unknown', title: '',
        seconds: 0, rounds: 0, correct: 0, wrong: 0, target: 0,
        completed: false, stoppedByChild: false
      }, rec || {});
      r.accuracy = (r.correct + r.wrong) > 0
        ? Math.round((r.correct / (r.correct + r.wrong)) * 100) : null;

      state.sessions.push(r);
      if (state.sessions.length > 300) state.sessions = state.sessions.slice(-300);

      const dk = dayKey();
      if (state.streakDays.indexOf(dk) === -1) state.streakDays.push(dk);
      if (state.streakDays.length > 400) state.streakDays = state.streakDays.slice(-400);

      const unlocked = checkBadges();
      persist(); emit();
      return { session: r, unlocked: unlocked.map(badgeById).filter(Boolean) };
    },

    /* ── statistik ringkas ── */
    stats: function () {
      const s = state.sessions;
      const done = s.filter(function (x) { return x.completed; });
      const sum = function (arr, f) { return arr.reduce(function (a, x) { return a + (f(x) || 0); }, 0); };
      const avg = function (arr, f) { return arr.length ? sum(arr, f) / arr.length : 0; };
      const acc = s.filter(function (x) { return x.accuracy != null; });

      /* hari berurutan dari hari ini ke belakang */
      const days = daysBack(60);
      let streak = 0;
      for (let i = days.length - 1; i >= 0; i--) {
        if (state.streakDays.indexOf(days[i]) !== -1) streak++;
        else if (i < days.length - 1) break;
        else if (i === days.length - 1) continue;
      }

      /* streak sebenarnya: hitung mundur dari hari ini */
      let realStreak = 0;
      for (let i = days.length - 1; i >= 0; i--) {
        if (state.streakDays.indexOf(days[i]) !== -1) realStreak++;
        else break;
      }

      /* jenis game yang berbeda */
      const kinds = {};
      s.forEach(function (x) {
        kinds[x.kind] = kinds[x.kind] || { kind: x.kind, title: x.title, count: 0, seconds: 0 };
        kinds[x.kind].count++;
        kinds[x.kind].seconds += x.seconds || 0;
      });
      const top = Object.keys(kinds).map(function (k) { return kinds[k]; })
        .sort(function (a, b) { return b.count - a.count; });

      const week = daysBack(7).map(function (d) {
        const items = s.filter(function (x) { return x.day === d; });
        return {
          day: d,
          count: items.length,
          seconds: sum(items, function (x) { return x.seconds; }),
          accuracy: (function () {
            const a = items.filter(function (x) { return x.accuracy != null; });
            return a.length ? Math.round(avg(a, function (x) { return x.accuracy; })) : null;
          })()
        };
      });

      return {
        totalSessions: s.length,
        completed: done.length,
        completionRate: s.length ? Math.round((done.length / s.length) * 100) : 0,
        totalMinutes: Math.round(sum(s, function (x) { return x.seconds; }) / 60),
        avgSeconds: Math.round(avg(done.length ? done : s, function (x) { return x.seconds; })),
        avgAccuracy: acc.length ? Math.round(avg(acc, function (x) { return x.accuracy; })) : null,
        longestFocus: Math.round(Math.max(0, sum([], function () { return 0; }), Math.max.apply(null, [0].concat(s.map(function (x) { return x.seconds || 0; }))))),
        independence: done.length ? Math.round((done.filter(function (x) { return !x.stoppedByChild; }).length / done.length) * 100) : 0,
        streak: realStreak,
        activeDays: state.streakDays.length,
        tokens: state.tokens,
        lifetimeTokens: state.lifetimeTokens,
        rewardsClaimed: state.rewardsClaimed,
        top: top,
        week: week,
        counters: state.counters || {},
        badges: state.badges.slice()
      };
    },

    /* ── catatan pendamping ── */
    addNote: function (text) {
      text = String(text || '').trim();
      if (!text) return null;
      const n = { id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6), at: Date.now(), text: text };
      state.notes.unshift(n);
      if (state.notes.length > 200) state.notes = state.notes.slice(0, 200);
      persist(); emit();
      return n;
    },
    removeNote: function (id) {
      state.notes = state.notes.filter(function (n) { return n.id !== id; });
      persist(); emit();
    },

    /* ── tugas (pecah langkah) ── */
    getTasks: function () { return state.tasks || (state.tasks = []); },
    setTasks: function (list) { state.tasks = list; persist(); emit(); },

    /* ── ekspor / impor / hapus ── */
    exportData: function () {
      return {
        app: 'Ruang Fokus',
        exportedAt: new Date().toISOString(),
        summary: this.stats(),
        state: clone(state)
      };
    },
    wipe: function () {
      state = clone(DEFAULT);
      persist(); emit();
    }
  };

  global.Store = Store;
})(window);
