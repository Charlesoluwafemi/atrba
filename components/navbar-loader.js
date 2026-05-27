/**
 * ATRBA — Optimized navbar-loader.js
 * Faster fetch + cache-first + priority hints
 */

(function () {
  'use strict';

  var scriptEl = document.currentScript;
  var siteRoot = (scriptEl && scriptEl.getAttribute('data-root')) || '/';

  var base = siteRoot.replace(/\/$/, '');
  var navbarURL = base + '/components/navbar.html';
  var cssURL = base + '/components/navbar.css';

  /* ── 1. Inject CSS ASAP (non-blocking) ── */
  if (!document.querySelector('link[data-navbar-css]')) {
    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = cssURL;
    link.onload = function () {
      this.rel = 'stylesheet';
    };
    link.setAttribute('data-navbar-css', '1');
    document.head.appendChild(link);
  }

  /* ── 2. Fast fetch with cache + priority hint ── */
  async function fetchNavbar() {
    try {
      var res = await fetch(navbarURL, {
        cache: 'force-cache', // 👈 key speed boost for repeat visits
        priority: 'high'      // 👈 modern browsers
      });

      if (!res.ok) throw new Error('Navbar fetch failed: ' + res.status);
      return await res.text();
    } catch (e) {
      console.error('[ATRBA Navbar]', e);
      return '';
    }
  }

  /* ── 3. Inject ASAP ── */
  function inject(html) {
    if (!html) return;

    var tmp = document.createElement('div');
    tmp.innerHTML = html;

    var body = document.body;
    var ref = body.firstChild;

    while (tmp.firstChild) {
      body.insertBefore(tmp.firstChild, ref);
    }
  }

  /* ── 4. Init logic AFTER paint-ready ── */
  function initNav() {
    var hamburger = document.getElementById('nav-hamburger');
    var drawer = document.getElementById('nav-mobile-drawer');
    var nav = document.getElementById('main-nav');

    if (!hamburger || !drawer || !nav) return;

    function toggleMenu(forceOpen) {
      var isOpen =
        typeof forceOpen === 'boolean'
          ? forceOpen
          : !hamburger.classList.contains('open');

      hamburger.classList.toggle('open', isOpen);
      drawer.classList.toggle('open', isOpen);

      hamburger.setAttribute('aria-expanded', String(isOpen));
      drawer.setAttribute('aria-hidden', String(!isOpen));

      document.body.style.overflow = isOpen ? 'hidden' : '';
    }

    hamburger.addEventListener('click', toggleMenu);

    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        toggleMenu(false);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') toggleMenu(false);
    });

    window.addEventListener(
      'scroll',
      function () {
        nav.classList.toggle('scrolled', window.scrollY > 20);
      },
      { passive: true }
    );
  }

  /* ── 5. Main flow (fast path first) ── */
  (async function main() {
    var html = await fetchNavbar();
    inject(html);

    /* run after DOM insertion */
    requestAnimationFrame(initNav);
  })();
})(); 
