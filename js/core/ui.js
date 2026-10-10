/* ═══════════════════════════════════════════════════════════════
   ui.js — helper DOM, toast, overlay, konfeti lunak, utilitas
   Semua animasi menghormati preferensi "kurangi gerakan".
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const motionQuery = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let userMotion = true;

  function motionAllowed() {
    if (!userMotion) return false;
    return !(motionQuery && motionQuery.matches);
  }

  function setMotion(on) { userMotion = !!on; }

  /* ── elemen ── */
  function el(tag, opts, children) {
    const node = document.createElement(tag);
    opts = opts || {};
    Object.keys(opts).forEach(function (k) {
      const v = opts[k];
      if (v == null || v === false) return;
      if (k === 'class' || k === 'className') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, String(v));
    });
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null || c === false) return;
        node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return node;
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ── utilitas ── */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fmtClock(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return sec + ' detik';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? m + ' mnt ' + s + ' dtk' : m + ' menit';
  }
  function fmtDate(ts) {
    const d = new Date(ts);
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function dayName(key) {
    const hari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const p = String(key).split('-');
    const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return hari[d.getDay()];
  }

  /* ── toast ── */
  function toast(msg, kind, ms) {
    const box = $('#toaster');
    if (!box) return;
    const t = el('div', { class: 'toast' + (kind ? ' toast--' + kind : '') }, [
      el('span', { text: msg })
    ]);
    box.appendChild(t);
    global.setTimeout(function () {
      t.style.transition = 'opacity .3s, transform .3s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(12px)';
      global.setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, ms || 2600);
  }

  /* ── overlay ── */
  let lastFocus = null;
  function overlay(opt) {
    const ov = $('#overlay');
    const title = $('#ovTitle');
    const body = $('#ovBody');
    const acts = $('#ovActions');
    if (!ov) return;
    lastFocus = document.activeElement;
    title.textContent = opt.title || '';
    clear(body);
    if (opt.html) body.innerHTML = opt.html;
    if (opt.node) body.appendChild(opt.node);
    if (opt.list) body.appendChild(el('ol', {}, opt.list.map(function (x) { return el('li', { text: x }); })));
    clear(acts);
    (opt.actions || [{ label: 'Tutup', primary: true, action: closeOverlay }]).forEach(function (a) {
      acts.appendChild(el('button', {
        class: 'btn ' + (a.primary ? 'btn--primary' : 'btn--ghost'),
        type: 'button',
        text: a.label,
        onClick: function () { if (a.action) a.action(); else closeOverlay(); }
      }));
    });
    ov.hidden = false;
    const first = acts.querySelector('button');
    if (first) first.focus();
  }
  function closeOverlay() {
    const ov = $('#overlay');
    if (ov) ov.hidden = true;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }
  function isOverlayOpen() { const ov = $('#overlay'); return ov && !ov.hidden; }

  /* ── konfeti lunak: sedikit partikel, tidak membanjiri layar ── */
  function celebrate(opts) {
    if (!motionAllowed()) { toast((opts && opts.fallback) || 'Kerja bagus!', 'good'); return; }
    const n = (opts && opts.count) || 22;
    const colors = (opts && opts.colors) || ['#0E6E64', '#D97706', '#15803D', '#1D4ED8', '#F5C24B'];
    const host = el('div', {
      style: {
        position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '160', overflow: 'hidden'
      },
      'aria-hidden': 'true'
    });
    for (let i = 0; i < n; i++) {
      const size = randInt(7, 15);
      const p = el('span', {
        style: {
          position: 'absolute',
          left: randInt(6, 94) + '%',
          top: '-6%',
          width: size + 'px',
          height: size * (Math.random() > 0.5 ? 1 : 0.45) + 'px',
          background: pick(colors),
          borderRadius: Math.random() > 0.6 ? '50%' : '3px',
          opacity: '0.95'
        }
      });
      host.appendChild(p);
      const dur = randInt(1400, 2600);
      const drift = randInt(-90, 90);
      try {
        p.animate([
          { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
          { transform: 'translate(' + drift + 'px, ' + (global.innerHeight + 80) + 'px) rotate(' + randInt(180, 720) + 'deg)', opacity: 0.85 }
        ], { duration: dur, easing: 'cubic-bezier(.3,.7,.5,1)', fill: 'forwards' });
      } catch (e) {
        p.style.transition = 'transform ' + dur + 'ms linear, opacity ' + dur + 'ms linear';
        global.setTimeout(function () {
          p.style.transform = 'translate(' + drift + 'px,' + (global.innerHeight + 80) + 'px)';
          p.style.opacity = '0';
        }, 20);
      }
    }
    document.body.appendChild(host);
    global.setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 3000);
  }

  /* ── umpan balik teks utama di layar game ── */
  function prompt(text, kind) {
    const p = $('#stagePrompt');
    if (!p) return;
    p.className = 'stage__prompt' + (kind ? ' is-' + kind : '');
    p.textContent = text || '';
  }

  global.UI = {
    el: el, clear: clear, $: $, $$: $$,
    shuffle: shuffle, pick: pick, randInt: randInt, clamp: clamp,
    fmtClock: fmtClock, fmtDur: fmtDur, fmtDate: fmtDate, dayName: dayName,
    toast: toast, overlay: overlay, closeOverlay: closeOverlay, isOverlayOpen: isOverlayOpen,
    celebrate: celebrate, prompt: prompt,
    motionAllowed: motionAllowed, setMotion: setMotion
  };
})(window);
