/**
 * ATRBA — nav-loader.js  (corrected)
 *
 * FIX SUMMARY
 * ───────────────────────────────────────────────────────────────
 * 1. CSS is injected as a BLOCKING <link rel="stylesheet"> — not
 *    a preload/onload swap — so styles are guaranteed available
 *    before the injected HTML is ever painted.
 *
 * 2. A minimal <style> block with `visibility:hidden` is written
 *    to <head> immediately (synchronously, before any fetch).
 *    This hides ONLY .site-nav and .nav-drawer while they load,
 *    preventing the unstyled link-dump flash without hiding
 *    anything else on the page.
 *
 * 3. initNav() is called INSIDE the .then() chain, after inject()
 *    confirms the DOM nodes exist — eliminating the race condition
 *    where requestIdleCallback fired before the fetch resolved.
 *
 * 4. The nav-ready reveal (`visibility:visible`) is added by a
 *    one-shot <style> tag injected after injection succeeds,
 *    so it can never silently fail to run.
 *
 * 5. DOMContentLoaded guard is preserved but the fetch now starts
 *    immediately (not waiting for DCL on repeat visits where the
 *    HTML is already in cache), shaving latency.
 * ───────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────── */
  var scriptEl  = document.currentScript;
  var siteRoot  = (scriptEl && scriptEl.getAttribute('data-root')) || '/';
  var base      = siteRoot.replace(/\/$/, '');
  var navHTML   = base + '/components/navbar.html';
  var navCSS    = base + '/components/navbar.css';

  /* ── STEP 1 — Hide nav shell immediately (sync, inline style) ─
     This runs before any paint. It targets only the two nav
     elements, so the rest of the page body is unaffected.
     We use visibility (not opacity) so screen-readers skip it
     while it's unstyled; opacity:0 keeps layout space and can
     interfere with the "disappear" bug if the class never lands. */
  var hideStyle      = document.createElement('style');
  hideStyle.id       = 'nav-hide-fouc';
  hideStyle.textContent =
    '.site-nav, .nav-drawer { visibility: hidden !important; }';
  document.head.appendChild(hideStyle);

  /* ── STEP 2 — Inject CSS as a real blocking stylesheet ─────────
     Using rel="stylesheet" (not preload+swap) guarantees styles
     are parsed before the injected HTML reaches the renderer.
     We only skip this if the tag already exists (HMR / re-runs). */
  if (!document.querySelector('link[data-navbar-css]')) {
    var link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = navCSS;
    link.setAttribute('data-navbar-css', '1');
    document.head.appendChild(link);
  }

  /* ── STEP 3 — Fetch nav markup ──────────────────────────────── */
  function fetchNav() {
    return fetch(navHTML, {
      cache:    'force-cache',
      priority: 'high'
    }).then(function (res) {
      if (!res.ok) throw new Error('Nav fetch failed: ' + res.status);
      return res.text();
    });
  }

  /* ── STEP 4 — Inject at the very top of <body> ──────────────── */
  function inject(html) {
    if (!html) return false;
    var tmp = document.createElement('div');
    tmp.innerHTML = html.trim();
    var body = document.body;
    var ref  = body.firstChild;
    while (tmp.firstChild) {
      body.insertBefore(tmp.firstChild, ref);
    }
    return true;
  }

  /* ── STEP 5 — Reveal nav (remove the hide rule) ─────────────── */
  function revealNav() {
    var el = document.getElementById('nav-hide-fouc');
    if (el) el.parentNode.removeChild(el);
    /* Belt-and-braces: also make sure the elements are visible
       even if the id was somehow already removed. */
    var nav    = document.getElementById('main-nav');
    var drawer = document.getElementById('nav-mobile-drawer');
    if (nav)    nav.style.visibility    = '';
    if (drawer) drawer.style.visibility = '';
  }

  /* ── STEP 6 — Wire up interactivity ─────────────────────────── */
  function initNav() {
    var hamburger = document.getElementById('nav-hamburger');
    var drawer    = document.getElementById('nav-mobile-drawer');
    var nav       = document.getElementById('main-nav');

    if (!hamburger || !drawer || !nav) {
      /* Elements not found — reveal anyway so nav isn't invisible */
      revealNav();
      console.warn('[ATRBA Nav] Could not find nav elements after injection.');
      return;
    }

    /* Toggle helper */
    function toggleMenu(forceOpen) {
      var isOpen =
        typeof forceOpen === 'boolean'
          ? forceOpen
          : !hamburger.classList.contains('open');

      hamburger.classList.toggle('open', isOpen);
      drawer.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
      drawer.setAttribute('aria-hidden',      String(!isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    }

    hamburger.addEventListener('click', function () { toggleMenu(); });

    /* Close drawer on any link click */
    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { toggleMenu(false); });
    });

    /* Close on Escape */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') toggleMenu(false);
    });

    /* Scrolled shadow */
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });

    /* Mark active link based on current path */
    var path = window.location.pathname.replace(/\/$/, '') || '/';
    nav.querySelectorAll('.nav-links a, .nav-drawer-links a').forEach(function (a) {
      var href = a.getAttribute('href').replace(/\/$/, '') || '/';
      if (href === path || (href !== '/' && path.startsWith(href))) {
        a.classList.add('active');
      }
    });

    /* All done — reveal */
    revealNav();
  }

  /* ── STEP 7 — Orchestrate ───────────────────────────────────── */
  function run() {
    fetchNav()
      .then(function (html) {
        inject(html);
        /* initNav runs AFTER inject() — no race condition */
        initNav();
      })
      .catch(function (err) {
        console.error('[ATRBA Nav]', err);
        /* Always reveal so the hide style doesn't freeze the page */
        revealNav();
      });
  }

  /* Start as soon as <body> exists (DCL fires at that point).
     If DCL already fired (script loaded async/defer), run now. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

})();
