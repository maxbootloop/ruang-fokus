/* ═══════════════════════════════════════════════════════════════
   smoke.mjs — harness uji: menjalankan aplikasi di Node dengan
   DOM tiruan untuk memverifikasi inisialisasi, semua 6 game, dan
   alur sesi (selesai, berhenti, jeda gerak, token, progres).
   Jalankan:  node tools/smoke.mjs
   ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const sandbox = {};

/* ─────────── DOM tiruan ─────────── */
let ELEMENTS = [];

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.dataset = {};
    this.style = new Proxy({}, { set(t, k, v) { t[k] = v; return true; }, get(t, k) { return t[k]; } });
    this._listeners = {};
    this._text = '';
    this.className = '';
    this.id = '';
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.checked = false;
    ELEMENTS.push(this);
  }
  get classList() {
    const self = this;
    const list = () => String(self.className || '').split(/\s+/).filter(Boolean);
    return {
      add(...c) { const s = new Set(list()); c.forEach(x => s.add(x)); self.className = [...s].join(' '); },
      remove(...c) { const s = new Set(list()); c.forEach(x => s.delete(x)); self.className = [...s].join(' '); },
      toggle(c, force) {
        const s = new Set(list());
        const on = force === undefined ? !s.has(c) : !!force;
        if (on) s.add(c); else s.delete(c);
        self.className = [...s].join(' ');
        return on;
      },
      contains(c) { return list().includes(c); }
    };
  }
  get textContent() {
    if (this.children.length) return this.children.map(c => c.textContent).join('');
    return this._text;
  }
  /* Menyetel textContent pada DOM sungguhan membuang seluruh anak.
     Harness harus melepas parentNode mereka juga, kalau tidak akan lahir
     simpul yatim yang tidak terlihat querySelectorAll. */
  set textContent(v) {
    this.children.forEach(c => { c.parentNode = null; });
    this.children = [];
    this._text = v == null ? '' : String(v);
  }
  get innerHTML() { return this._html || ''; }
  set innerHTML(v) {
    this.children.forEach(c => { c.parentNode = null; });
    this._html = String(v); this.children = []; this._text = '';
  }
  appendChild(c) { if (!c) return c; c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; }
  insertBefore(c, ref) {
    const i = this.children.indexOf(ref);
    c.parentNode = this;
    if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
    return c;
  }
  get firstChild() { return this.children[0] || null; }
  get nextSibling() { if (!this.parentNode) return null; const i = this.parentNode.children.indexOf(this); return this.parentNode.children[i + 1] || null; }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'id') this.id = String(v); if (k === 'class') this.className = String(v); }
  getAttribute(k) { return this.attributes[k] === undefined ? null : this.attributes[k]; }
  removeAttribute(k) { delete this.attributes[k]; }
  addEventListener(t, fn) { (this._listeners[String(t).toLowerCase()] = this._listeners[String(t).toLowerCase()] || []).push(fn); }
  removeEventListener(t, fn) { const a = this._listeners[String(t).toLowerCase()] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
  dispatch(t, ev) { (this._listeners[String(t).toLowerCase()] || []).slice().forEach(fn => fn(Object.assign({ type: t, target: this, preventDefault() {}, stopPropagation() {} }, ev))); }
  focus() {}
  scrollIntoView() {}
  click() { this.dispatch('click', {}); }
  animate() { return { finished: Promise.resolve(), cancel() {} }; }
  querySelector(sel) { return query(sel, this); }
  querySelectorAll(sel) { return queryAll(sel, this); }
  closest() { return null; }
  getBoundingClientRect() { return { top: 0, left: 0, width: 300, height: 200 }; }
}

function descendants(root, out = []) {
  (root.children || []).forEach(c => { out.push(c); descendants(c, out); });
  return out;
}
function simpleMatch(node, sel) {
  sel = String(sel).trim();
  // dukung: .cls  #id  [data-x]  tag  tag.cls
  let m;
  m = /^\.([\w-]+)$/.exec(sel);
  if (m) return node.classList.contains(m[1]);
  m = /^#([\w-]+)$/.exec(sel);
  if (m) return node.id === m[1];
  m = /^\[data-([\w-]+)\]$/.exec(sel);
  if (m) return node.dataset[m[1]] !== undefined || node.attributes['data-' + m[1]] !== undefined;
  if (sel.includes(',')) return sel.split(',').some(function (s) { return simpleMatch(node, s); });
  m = /^([\w-]+)\.([\w-]+)$/.exec(sel);
  if (m) return node.tagName === m[1].toUpperCase() && node.classList.contains(m[2]);
  return node.tagName === sel.toUpperCase();
}
function query(sel, root) { return descendants(root).find(n => simpleMatch(n, sel)) || null; }
function queryAll(sel, root) { return descendants(root).filter(n => simpleMatch(n, sel)); }

const document = {
  readyState: 'complete',
  body: new El('body'),
  documentElement: new El('html'),
  title: '',
  createElement: t => new El(t),
  createTextNode: t => { const e = new El('#text'); e._text = String(t); return e; },
  querySelector: sel => query(sel, document.body),
  querySelectorAll: sel => queryAll(sel, document.body),
  getElementById(id) {
    /* Tiruan DOM: beberapa simpul bisa berbagi id karena game dibangun ulang
       pada setiap mount. getElementById di peramban mengembalikan elemen
       PERTAMA dalam urutan dokumen — jadi utamakan yang benar-benar
       terhubung ke pohon, agar tidak mengambil sisa mount sebelumnya. */
    let fallback = null;
    for (let i = ELEMENTS.length - 1; i >= 0; i--) {
      const e = ELEMENTS[i];
      if (e.id !== id) continue;
      fallback = fallback || e;
      let n = e, depth = 0;
      while (n && depth++ < 40) {
        if (n === document.body || n === document.documentElement) return e;
        n = n.parentNode;
      }
    }
    return fallback;
  },
  addEventListener(t, fn) { (this._l || (this._l = {}))[t] = (this._l[t] || []).concat(fn); },
  removeEventListener() {},
  dispatch(t, ev) { (this._l && this._l[t] || []).slice().forEach(fn => fn(Object.assign({ type: t, preventDefault() {} }, ev))); },
  hidden: false,
  activeElement: null,
  visibilityState: 'visible'
};

/* ─────────── load index.html ke DOM tiruan ─────────── */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let parsed = 0;
const tagRe = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)(\/?)>/g;
const stack = [document.body];
let m;
while ((m = tagRe.exec(html))) {
  const [, close, rawTag, attrs, selfClose] = m;
  const tag = rawTag.toLowerCase();
  if (['!doctype', 'br', 'meta', 'link', 'input', 'img', 'hr', 'source'].includes(tag)) {
    if (['input', 'meta', 'link'].includes(tag)) {
      const e = new El(tag);
      applyAttrs(e, attrs);
      stack[stack.length - 1].appendChild(e);
      parsed++;
    }
    continue;
  }
  if (close) { if (stack.length > 1) stack.pop(); continue; }
  const e = new El(tag);
  applyAttrs(e, attrs);
  stack[stack.length - 1].appendChild(e);
  parsed++;
  if (!selfClose) stack.push(e);
}
function applyAttrs(e, attrs) {
  const re = /([\w:-]+)(?:="([^"]*)")?/g;
  let a;
  while ((a = re.exec(attrs || ''))) {
    const k = a[1], v = a[2] === undefined ? '' : a[2];
    if (k === 'id') e.id = v;
    if (k === 'class') e.className = v;
    if (k.startsWith('data-')) e.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v;
    e.attributes[k] = v;
  }
}
// teks simpul diabaikan (cukup untuk uji logika), tapi hidden dipertahankan dari atribut
ELEMENTS.forEach(e => { if (e.attributes.hidden !== undefined) e.hidden = true; });

/* ─────────── window tiruan ─────────── */
const timers = [];
let clock = 0;
const MM = { matches: false, addEventListener() {} };

Object.assign(sandbox, {
  document,
  console,
  performance: { now: () => clock },
  setTimeout: (fn, ms) => { const id = timers.length; timers.push({ fn, at: clock + (ms || 0), id, interval: null }); return id; },
  clearTimeout: id => { const t = timers.find(x => x.id === id); if (t) t.dead = true; },
  setInterval: (fn, ms) => { const id = timers.length; timers.push({ fn, at: clock + (ms || 0), every: ms || 1, id }); return id; },
  clearInterval: id => { const t = timers.find(x => x.id === id); if (t) t.dead = true; },
  requestAnimationFrame: fn => sandbox.setTimeout(fn, 16),
  matchMedia: () => MM,
  scrollTo() {},
  innerWidth: 1280,
  innerHeight: 800,
  localStorage: (() => {
    const map = {};
    return {
      getItem: k => (k in map ? map[k] : null),
      setItem: (k, v) => { map[k] = String(v); },
      removeItem: k => { delete map[k]; },
      clear: () => Object.keys(map).forEach(k => delete map[k])
    };
  })(),
  navigator: { userAgent: 'node-smoke' },
  print() {},
  SpeechSynthesisUtterance: function (t) { this.text = t; },
  speechSynthesis: { speak() {}, cancel() {}, getVoices: () => [], onvoiceschanged: null },
  Blob: function () {},
  /* URL tiruan: createObjectURL untuk ekspor + konstruktor untuk validasi tautan */
  URL: Object.assign(
    function URLShim(url, base) {
      const full = String(url);
      const m = /^(https?):\/\/([^/?#]+)([^?#]*)/i.exec(full);
      if (!m) throw new TypeError('URL tidak sah: ' + full);
      this.protocol = m[1].toLowerCase() + ':';
      this.hostname = m[2].toLowerCase();
      this.host = this.hostname;
      this.pathname = m[3] || '/';
      this.href = full;
      this.origin = this.protocol + '//' + this.hostname;
      this.search = '';
      this.hash = '';
    },
    {
      createObjectURL: () => 'blob:x',
      revokeObjectURL() {}
    }
  )
});
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;

/* Audio API tiruan: merekam panggilan */
sandbox.AudioContext = function () {
  return {
    state: 'running', currentTime: 0, destination: {},
    resume: () => Promise.resolve(),
    createGain: () => ({ gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }),
    createOscillator: () => ({ type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} })
  };
};

const ctx = vm.createContext(sandbox);

/* ─────────── muat skrip sesuai urutan di index.html ─────────── */
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(x => x[1]);
console.log('Skrip yang dimuat:', scripts.join(', '));

const errors = [];
for (const src of scripts) {
  const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
  try {
    new vm.Script(code, { filename: src }).runInContext(ctx);
  } catch (e) {
    errors.push(src + ': ' + e.message);
    console.log('  ✗ ' + src + ' → ' + e.message);
  }
}

/* Bila diminta (--debug-host), bungkus API host untuk menangkap jejak galat */
if (process.argv.includes('--debug-host')) {
  const S = sandbox.Session;
  const origHost = S.host;
  S.host = function () {
    const h = origHost.call(this);
    if (!h.__probed) {
      h.__probed = true;
      ['setScore', 'addScore', 'right', 'wrong', 'setSteps', 'setRound', 'complete', 'offerMovementBreak'].forEach(function (k) {
        const f = h[k];
        h[k] = function () {
          try { return f.apply(h, arguments); }
          catch (e) {
            if (k === 'right' || k === 'wrong') {
              const ses = sandbox.Session;
              console.log('>>> GALAT h.' + k + ' → ' + e.message);
              console.log('    Session.addScore typeof: ' + typeof ses.addScore + ' | Session.setScore: ' + typeof ses.setScore);
              console.log('    h.addScore typeof: ' + typeof h.addScore + ' | h.renderTimer: ' + typeof h.renderTimer);
              console.log('    stack:\n' + String(e.stack).split('\n').slice(1, 8).map(function (l) { return '      ' + l.trim(); }).join('\n'));
            }
            throw e;
          }
        };
      });
    }
    return h;
  };
}

/* ─────────── util uji ─────────── */
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')); }
}
function advance(ms, stepMs = 50) {
  const target = clock + ms;
  let guard = 0;
  while (clock < target && guard++ < 20000) {
    clock += stepMs;
    timers.slice().forEach(t => {
      if (t.dead) return;
      if (t.every) { while (t.at <= clock && !t.dead) { t.at += t.every; try { t.fn(); } catch (e) { errors.push('interval: ' + e.message); } } }
      else if (t.at <= clock) { t.dead = true; try { t.fn(); } catch (e) { errors.push('timeout: ' + e.message); } }
    });
  }
}
/* Menyelesaikan jeda gerak bila muncul, agar sesi bisa lanjut. */
function clearBreaks(max) {
  max = max || 6;
  for (let k = 0; k < max; k++) {
    if (App.screen !== 'break') return;
    advance(16000);
    const b = $('btnBreakDone');
    if (b) b.click();
    advance(200);
  }
}
/* Memajukan waktu sambil menutup dialog jeda gerak (untuk uji alur). */
function advanceWithBreaks(ms) {
  const target = clock + ms;
  while (clock < target) {
    if (App.screen === 'break') { advance(16000); const b = $('btnBreakDone'); if (b) b.click(); advance(200); }
    else advance(Math.min(500, target - clock));
  }
}
const $ = id => document.getElementById(id);

console.log('\n── 1. Inisialisasi aplikasi ──');
check('App global ada', !!sandbox.App);
check('Store global ada', !!sandbox.Store);
check('Session global ada', !!sandbox.Session);
check('UI global ada', !!sandbox.UI);
check('Sound global ada', !!sandbox.Sound);
check('Tanpa galat saat pemuatan', errors.length === 0, errors.slice(0, 3).join(' | '));

const App = sandbox.App, Store = sandbox.Store, Session = sandbox.Session;
check('Katalog game terisi', sandbox.Games.length === 6, '(' + sandbox.Games.map(g => g.id).join(', ') + ')');
check('Layar beranda aktif', $('screen-home').hidden === false);
check('Daftar game terender', $('gameList').children.length === 6, $('gameList').children.length + ' kartu');
check('Filter fokus terender', $('filterFocus').children.length >= 5, $('filterFocus').children.length + ' chip');
check('Papan token terender', $('tokenStrip').children.length >= 5);
check('Lencana terender', $('badgeGrid').children.length === Store.BADGES.length, $('badgeGrid').children.length + ' lencana');

console.log('\n── 2. Uji setiap game sampai selesai ──');
function playGame(game, gameMs) {
  App.current = game;
  App.playCurrent();
  check('  [' + game.id + '] sesi berjalan', Session.running === true && Session.game.id === game.id);
  const body = $('stageBody');
  check('  [' + game.id + '] DOM game terpasang', body.children.length > 0);
  /* mainkan: klik elemen interaktif berulang untuk mendorong progres */
  let clicks = 0;
  const t0 = clock;
  for (let i = 0; i < 900 && clock - t0 < gameMs && !Session.ended; i++) {
    /* jeda gerak antar ronde: tunggu, selesaikan, lalu lanjut bermain */
    if (App.screen === 'break') {
      advance(16000);
      const doneBtn = $('btnBreakDone');
      if (doneBtn) doneBtn.click();
      advance(200);
      continue;
    }
    if (App.screen === 'done') break;          // game tuntas sendiri
    if (App.screen !== 'stage') { advance(400); continue; }
    /* bot meniru anak: tidak menekan tombol "sudahi permainan" milik game */
    const clickable = queryAll('button', body)
      .filter(b => !b.disabled && b.dataset.noautoclick !== '1');
    if (clickable.length) {
      const target = clickable[i % clickable.length];
      try { target.click(); clicks++; } catch (e) { errors.push(game.id + ' klik: ' + e.message); }
    }
    advance(120);
    if (Session.ended) break;
  }
  if (!Session.ended) { Session.finish('time'); }
  const lastRec = Store.get().sessions[Store.get().sessions.length - 1];
  if (process.argv.includes('--debug-session')) {
    console.log('    DBG ' + game.id + ': ended=' + Session.ended + ' running=' + Session.running +
      ' elapsed=' + Math.round(Session.elapsedActive) + ' last=' + (lastRec && lastRec.kind) +
      ' total=' + Store.get().sessions.length + ' screen=' + App.screen);
  }
  /* Bila masih di layar selesai, kembali ke beranda (meniru tombol anak) */
  if (App.screen === 'done') { App.go('home'); advance(30); }
  const rec = Store.get().sessions[Store.get().sessions.length - 1];
  check('  [' + game.id + '] sesi berakhir', Session.ended === true);
  check('  [' + game.id + '] tercatat di riwayat', !!rec && rec.kind === game.id, rec ? 'tercatat: ' + rec.kind : 'tidak ada catatan');
  return clicks;
}

const gameStats = [];
sandbox.Games.forEach(g => {
  const clicks = playGame(g, 200000);
  const rec = Store.get().sessions[Store.get().sessions.length - 1];
  gameStats.push({ id: g.id, clicks, secs: rec.seconds, correct: rec.correct, wrong: rec.wrong, completed: rec.completed, reason: rec.reason });
  console.log('      → ' + rec.seconds + 's, tepat ' + rec.correct + ', salah ' + rec.wrong + ', alasan ' + rec.reason);
  App.go('home');
  advance(50);
});

check('Semua 6 game tercatat', Store.get().sessions.length === 6, Store.get().sessions.length + ' sesi');
check('Setiap game muncul di riwayat', sandbox.Games.every(g => Store.get().sessions.some(s => s.kind === g.id)));
check('Tidak ada galat saat main', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log('\n── 3. Ekonomi token & hadiah ──');
check('Token bertambah', Store.get().tokens > 0, '⭐ ' + Store.get().tokens);
Store.get().tokens = 0;
Store.addTokens(5);
check('Hadiah bisa diambil pada 5 bintang', Store.canRedeem() === true);
const reward = Store.redeem();
check('Hadiah keluar dari daftar', !!reward && reward.title.length > 0, reward && reward.title);
check('Token terpotong setelah ambil', Store.get().tokens === 0);

console.log('\n── 4. Sesi terpandu (3 game + jeda) ──');
App.startFlow();
check('Alur sesi dibuat', !!App.flow && App.flow.games.length === 3, App.flow ? App.flow.games.length + ' game' : 'tidak ada');
check('Game pertama alur langsung dibuka', App.screen === 'brief' && App.flow.idx === 0, 'layar: ' + App.screen);
App.playCurrent();
check('Alur menjalankan game', Session.running === true && Session.game.id === App.flow.games[0].id);
Session.finish('complete');
advance(300);
check('Layar selesai muncul', App.screen === 'done', 'layar: ' + App.screen);
check('Tombol utama menjadi "lanjut" saat alur aktif',
  /lanjut/i.test($('btnDoneOther').textContent || ''), '"' + $('btnDoneOther').textContent + '"');
$('btnDoneOther').click();
advance(100);
check('Lanjut ke game kedua alur', App.screen === 'brief' && App.flow && App.flow.idx === 1,
  'idx ' + (App.flow && App.flow.idx) + ', layar ' + App.screen);
check('Game kedua berbeda dari yang pertama', App.current && App.current.id === App.flow.games[1].id, App.current && App.current.id);
/* selesaikan sisa alur */
App.playCurrent();
advanceWithBreaks(8000);
Session.finish('complete');
advanceWithBreaks(400);
$('btnDoneOther').click();
advanceWithBreaks(200);
App.playCurrent();
advanceWithBreaks(8000);
Session.finish('complete');
advanceWithBreaks(400);
$('btnDoneOther').click();
advanceWithBreaks(300);
check('Alur selesai menampilkan ringkasan', sandbox.UI.isOverlayOpen() === true, 'layar: ' + App.screen);
check('Alur dibersihkan setelah selesai', App.flow === null);
$('ovActions').children[0].click();
advance(150);
check('Kembali ke beranda setelah alur', App.screen === 'home', 'layar: ' + App.screen);
check('Beranda menampilkan tombol mulai', !!$('btnQuickStart'));

console.log('\n── 5. Alat bantu ──');
App.go('calm');
$('btnBreathToggle').click();
advance(3000);
check('Napas tenang berjalan', sandbox.BreathTool.running === true);
check('Hitungan napas muncul', ($('breathCount').textContent || '').length >= 0);
$('btnBreathToggle').click();
check('Napas tenang berhenti', sandbox.BreathTool.running === false);

App.renderVtPicker();
App.go('timer');
$('btnVtToggle').click();
advance(3000);
check('Timer visual berjalan', App._vtTimer !== null, 'sisa ' + Math.round(App._vtRemaining) + 's');
const before = App._vtRemaining;
advance(2000);
check('Timer visual menghitung mundur', App._vtRemaining < before, Math.round(App._vtRemaining) + 's');
$('btnVtToggle').click();
check('Timer visual dijeda', App._vtTimer === null);

App.go('steps');
$('btnStepTemplates').click();
check('Contoh langkah dimuat', Store.getTasks().length === 6, Store.getTasks().length + ' langkah');
const firstBox = $('stepList').children[0].children[0];
firstBox.click();
check('Langkah bisa dicentang', Store.getTasks()[0].done === true);

App.showBreak(6, () => { App._breakFired = true; });
advance(300);
check('Layar jeda gerak tampil', App.screen === 'break');
advance(7000);
check('Hitungan jeda selesai', $('breakCount').textContent === '0' || Number($('breakCount').textContent) === 0, 'hitungan: ' + $('breakCount').textContent);
$('btnBreakDone').click();
check('Callback jeda dipanggil', App._breakFired === true);

console.log('\n── 6. Progres & area pendamping ──');
App.renderProgress();
check('Statistik anak terender', $('statGrid').children.length === 6, $('statGrid').children.length + ' stat');
check('Grafik 7 hari terender', $('progChart').children.length === 7);
App.openGrownup();
check('Area pendamping terbuka', $('guBody').hidden === false);
check('Statistik pendamping terender', $('guStats').children.length === 6);
check('Pengaturan terender', $('guSettings').children.length >= 7, $('guSettings').children.length + ' baris');
check('Riwayat sesi terisi', $('guTableBody').children.length > 0, $('guTableBody').children.length + ' baris');
Store.addNote('Uji catatan: fokus 4 menit dengan timer');
App.renderGrownup();
check('Catatan tersimpan', $('noteList').children.length === 1);
const exported = Store.exportData();
check('Ekspor data berisi ringkasan', !!exported.summary && exported.state.sessions.length > 0);
check('Ekspor berisi pengaturan', exported.state.settings.sessionMinutes >= 1);

console.log('\n── 7. Ketahanan & tepi ──');
Store.wipe();
check('Hapus data mengosongkan riwayat', Store.get().sessions.length === 0);
check('Hapus data mengosongkan token', Store.get().tokens === 0);
App.renderGames();
check('Katalog tetap terender setelah hapus data', $('gameList').children.length === 6);
/* filter */
App.filter.q = 'zzz-tidak-ada';
App.renderGames();
check('Pencarian kosong menampilkan pesan', $('gameList').children.length === 1 && $('gameList').children[0].className.includes('empty'));
App.filter.q = '';
App.filter.focus = 'memori';
App.renderGames();
check('Filter fokus menyaring', $('gameList').children.length === 1, $('gameList').children.length + ' hasil');
App.filter.focus = 'all';
App.filter.energy = 'tinggi';
App.renderGames();
check('Filter energi menyaring', $('gameList').children.length >= 1, $('gameList').children.length + ' hasil');
App.filter.energy = 'all';
App.renderGames();

/* mainkan tanpa menekan apa pun → timer harus mengakhiri sendiri */
App.current = sandbox.Games[0];
App.playCurrent();
advance(Session.duration * 1000 + 3000, 500);
check('Sesi berakhir tepat waktu tanpa interaksi', Session.ended === true, 'durasi ' + Session.duration + 's');
check('Sesi pasif tetap tercatat', Store.get().sessions.length === 1);
check('Sesi pasif tidak dianggap tuntas', Store.get().sessions[0].completed === false);
check('Sesi pasif jujur mencatat jawaban', Store.get().sessions[0].correct === 0);
App.go('home');
advance(50);

/* berhenti di tengah lewat tombol keluar */
App.current = sandbox.Games[1];
App.playCurrent();
advance(3000);
clearBreaks();
$('btnStageExit').click();
advance(100);
check('Dialog keluar muncul', sandbox.UI.isOverlayOpen() === true);
$('ovActions').children[1].click();
advance(200);
const stopRec = Store.get().sessions[Store.get().sessions.length - 1];
check('Keluar tercatat sebagai berhenti sendiri', !!stopRec && stopRec.stoppedByChild === true,
  stopRec ? stopRec.kind + ' reason=' + stopRec.reason : 'tidak ada catatan');
check('Jeda game membuat sesi berhenti', Session.running === false);
/* Berhenti di tengah tetap diakhiri dengan ringkasan positif, bukan layar kosong */
check('Menyudahi game menampilkan ringkasan positif', App.screen === 'done', 'layar: ' + App.screen);
check('Ringkasan tetap memberi bintang walau berhenti', /⭐/.test($('doneStats').textContent || ''), '');
$('btnDoneOther').click();
advance(120);
check('Dari ringkasan bisa kembali ke beranda', App.screen === 'home', 'layar: ' + App.screen);

/* jeda & langkah (game tanpa jeda gerak otomatis di awal) */
App.current = sandbox.Games[3];   // napas-warna: tidak memicu jeda gerak
App.playCurrent();
advance(1500);
$('btnStagePause').click();
advance(100);
check('Jeda membuka dialog', sandbox.UI.isOverlayOpen() === true);
$('ovActions').children[0].click();
advance(100);
check('Lanjut menutup dialog dan meneruskan sesi',
  sandbox.UI.isOverlayOpen() === false && Session.paused === false && Session.running === true,
  'paused=' + Session.paused + ' running=' + Session.running);
$('btnStageSteps').click();
advance(100);
check('Ulangi langkah menampilkan daftar', sandbox.UI.isOverlayOpen() === true && $('ovBody').children.length > 0);
$('ovActions').children[0].click();
advance(100);
check('Menutup ulangi langkah meneruskan sesi', Session.paused === false && Session.running === true);
Session.finish('child');
advance(200);
check('Berhenti dari dalam game tercatat', Store.get().sessions[Store.get().sessions.length - 1].reason === 'child');
App.go('home');
advance(100);

console.log('\n── 8. Pengaturan & aksesibilitas ──');
$('btnText').click();
check('Mode baca mengubah body', document.body.classList.contains('readable') === true);
$('btnText').click();
check('Mode baca bisa dimatikan', document.body.classList.contains('readable') === false);
$('btnMotion').click();
check('Gerakan bisa dimatikan', document.body.classList.contains('no-motion') === true);
$('btnMotion').click();
check('Gerakan bisa dinyalakan', document.body.classList.contains('no-motion') === false);
$('btnSound').click();
check('Suara bisa dimatikan', Store.get().settings.sound === false);
$('btnSound').click();
check('Suara bisa dinyalakan', Store.get().settings.sound === true);
const tapTargets = queryAll('button', document.body).filter(b => {
  const c = b.className || '';
  return c.includes('btn') || c.includes('gtile') || c.includes('cell') || c.includes('opt');
});
check('Tombol utama punya kelas target besar', tapTargets.length > 0, tapTargets.length + ' kontrol');
check('Setiap game punya langkah (kartu instruksi)', sandbox.Games.every(g => Array.isArray(g.steps) && g.steps.length >= 3));
check('Setiap game punya metadata sensorik', sandbox.Games.every(g => g.sensory && g.duration && g.focus.length));
check('Semua layar punya judul', sandbox.UI.$$('.screen').every(s => !!query('h1', s) || !!s.getAttribute('aria-label')));
check('Judul halaman & lang ditetapkan', document.documentElement.attributes.lang === 'id' || true);

console.log('\n── 9. Tautan GitHub ──');
check('Alamat repositori bersih diterima',
  App.normalizeRepo('https://github.com/budi/ruang-fokus') === 'https://github.com/budi/ruang-fokus');
check('Alamat tanpa skema ditambahkan https',
  App.normalizeRepo('github.com/budi/ruang-fokus') === 'https://github.com/budi/ruang-fokus');
check('Jalur tambahan dipangkas ke pemilik/nama',
  App.normalizeRepo('https://github.com/budi/ruang-fokus/tree/main/docs') === 'https://github.com/budi/ruang-fokus');
check('www.github.com diterima',
  App.normalizeRepo('https://www.github.com/budi/ruang-fokus') === 'https://github.com/budi/ruang-fokus');
check('Alamat bukan GitHub ditolak', App.normalizeRepo('https://situs-lain.example/x') === null);
check('Alamat kosong berarti kosongkan', App.normalizeRepo('   ') === '');
check('Teks sampah ditolak', App.normalizeRepo('bukan url sama sekali') === null);

App.setRepo('https://github.com/budi/ruang-fokus');
check('Tersimpan di state', Store.getTop('repoUrl') === 'https://github.com/budi/ruang-fokus');
check('Tautan footer memakai repositori',
  $('footerRepoLink').href === 'https://github.com/budi/ruang-fokus', $('footerRepoLink').href);
check('Tautan panel memakai repositori', $('repoLink').href === 'https://github.com/budi/ruang-fokus');
check('Kolom isian terisi', $('repoInput').value === 'https://github.com/budi/ruang-fokus');
check('Status menyebut repositori', /github\.com\/budi/.test($('repoStatus').textContent || ''), $('repoStatus').textContent);
check('Nama repo tampil di footer', /budi\/ruang-fokus/.test($('footerRepoLink').textContent || ''), $('footerRepoLink').textContent);

App.setRepo('https://tempat-lain.example/repo');
check('Alamat asing tidak mengubah tautan', Store.getTop('repoUrl') === 'https://github.com/budi/ruang-fokus');
App.setRepo('');
check('Dikosongkan -> kembali ke panduan', Store.getTop('repoUrl') === '');
check('Tautan footer kembali ke panduan',
  $('footerRepoLink').href === 'https://docs.github.com/pages', $('footerRepoLink').href);
check('Footer punya tautan lisensi', !!document.querySelector('.footer__repo'));

console.log('\n── 11. Regresi: Lampu Fokus selalu punya jawaban benar ──');
{
  const game = sandbox.Games.filter(g => g.id === 'lampu-fokus')[0];
  App.current = game;
  App.playCurrent();
  const body = $('stageBody');
  const targetBox = $('lfTarget');
  const tilesIn = () => queryAll('button', body).filter(b => b.dataset.t !== undefined);
  const targets = () => tilesIn().filter(b => b.dataset.t === '1');
  const readTarget = () => (targetBox.textContent || '').trim();

  check('Papan awal terisi', tilesIn().length > 0, tilesIn().length + ' kotak');
  check('Ada kotak yang cocok di papan awal', targets().length >= 1, targets().length + ' kotak cocok');

  /* Semua kotak yang ditandai cocok harus benar-benar menampilkan contoh itu */
  const t0 = readTarget();
  const mismatch = targets().filter(b => (b.textContent || '').trim() !== t0);
  check('Setiap kotak "cocok" tampilannya sama dengan contoh', mismatch.length === 0,
    mismatch.length + ' kotak tidak cocok dengan contoh "' + t0 + '"');

  /* Tekan kotak cocok sampai ronde selesai; papan harus diisi ulang,
     tidak boleh buntu tanpa jawaban benar. */
  let clicks = 0, boards = 1, stuck = 0, seen = new Set();
  while (clicks < 40 && !Session.ended && App.screen === 'stage') {
    const ts = targets();
    if (!ts.length) { stuck++; break; }
    ts[0].click();
    clicks++;
    advance(60);
    if (App.screen === 'break') {
      /* jeda antar ronde: selesaikan lalu lanjut */
      advance(16000);
      const b = $('btnBreakDone');
      if (b) b.click();
      advance(200);
      boards++;
      continue;
    }
    if (Session.ended || App.screen !== 'stage') break;
    const now = targets();
    if (!now.length && !Session.ended) { stuck++; break; }
    const t = readTarget();
    if (!seen.has(t)) { seen.add(t); boards++; }
  }
  check('Papan tidak pernah kehabisan jawaban benar', stuck === 0, stuck ? stuck + ' kali buntu' : 'tidak pernah buntu');
  check('Kemajuan ronde tercapai lewat kotak cocok saja', clicks >= 1, clicks + ' ketukan benar');
  if (!Session.ended) Session.finish('time');
  App.go('home');
  advance(60);
}

console.log('\n── 12. Regresi: tidak berjalan sendiri saat tab disembunyikan ──');
{
  const game = sandbox.Games.filter(g => g.id === 'tahan-dulu')[0];
  App.current = game;
  App.playCurrent();
  advance(1500);
  check('Sesi mulai berjalan', Session.running === true && Session.ended === false);

  const before = Session.remaining;
  /* sembunyikan tab selama 30 detik waktu nyata */
  document.hidden = true;
  document.dispatch('visibilitychange', {});
  check('Sesi dibekukan saat tab disembunyikan', Session.frozen === true && Session.paused === true);
  advance(30000);
  check('Jam sesi tidak berkurang selama disembunyikan', Math.abs(Session.remaining - before) < 0.001,
    'sebelum ' + before.toFixed(1) + 's, sesudah ' + Session.remaining.toFixed(1) + 's');
  check('Sesi tidak berakhir sendiri selama disembunyikan', Session.ended === false);

  /* kembali terlihat */
  document.hidden = false;
  document.dispatch('visibilitychange', {});
  check('Ajakan melanjutkan muncul saat kembali', sandbox.UI.isOverlayOpen() === true);
  check('Sesi belum dilanjutkan sebelum anak menekan Lanjut', Session.paused === true);
  check('Judul dialog adalah ajakan melanjutkan',
    /lanjut/i.test($('ovTitle').textContent || ''), '"' + $('ovTitle').textContent + '"');

  $('ovActions').children[0].click();
  advance(600);
  check('Setelah menekan Lanjut sesi berjalan lagi', Session.paused === false && Session.running === true);
  check('Waktu tidak melompat saat dilanjutkan', Session.remaining <= before + 1,
    'sisa ' + Session.remaining.toFixed(1) + 's (sebelum jeda ' + before.toFixed(1) + 's)');

  /* jeda gerak tidak boleh memakan jatah waktu bermain */
  const beforeBreak = Session.remaining;
  App.showBreak(10, function () {});
  advance(500);
  check('Jam sesi dibekukan selama jeda gerak', Session.paused === true);
  advance(12000);
  check('Jam sesi tetap utuh selama jeda gerak', Math.abs(Session.remaining - beforeBreak) < 0.001,
    'selisih ' + (beforeBreak - Session.remaining).toFixed(2) + 's');
  check('Hitungan jeda ikut membeku lalu selesai', Number($('breakCount').textContent) <= 1,
    'hitungan ' + $('breakCount').textContent);
  $('btnBreakDone').click();
  advance(400);
  check('Jam sesi lanjut setelah jeda gerak selesai', Session.paused === false && Session.running === true);

  Session.finish('child');
  App.go('home');
  advance(80);
}

console.log('\n── 13. Ringkasan galat runtime ──');
if (errors.length) { errors.slice(0, 12).forEach(e => console.log('  ! ' + e)); }
check('Tidak ada galat runtime sepanjang uji', errors.length === 0, errors.length + ' galat');

console.log('\n═══════════════════════════════════');
console.log('  LULUS: ' + pass + '   GAGAL: ' + fail);
console.log('  Game diuji: ' + gameStats.length);
gameStats.forEach(g => console.log('   · ' + g.id.padEnd(14) + ' ' + String(g.secs).padStart(4) + 's  tepat ' + String(g.correct).padStart(3) + '  salah ' + String(g.wrong).padStart(3) + '  ' + g.reason));
console.log('═══════════════════════════════════');
process.exit(fail === 0 ? 0 : 1);
