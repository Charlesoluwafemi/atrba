/**
 * ATRBA — navbar-loader.js
 *
 * Drop ONE <script> tag into every page, before </body>:
 *
 *   <script src="/components/navbar-loader.js"></script>
 *
 * That's it. This script:
 *   1. Fetches /components/navbar.html
 *   2. Injects it at the very top of <body>
 *   3. Wires up: hamburger toggle, Escape key, scroll shadow,
 *      active link highlighting, body-scroll lock
 *
 * Works on GitHub Pages, Vercel, Netlify, and any static host.
 * NOTE: fetch() requires HTTP/HTTPS — open via a local server
 *       (e.g. VS Code Live Server, `npx serve`, etc.),
 *       not by double-clicking the HTML file.
 */

(function () {
  'use strict';

  /* ── 1. Determine the root-relative path to the component ── */
  // Reads data-root on the script tag so deep pages work too.
  // Example for a page at /blog/post.html:
  //   <script src="/components/navbar-loader.js" data-root="/"></script>
  // Default assumes root-relative paths work (Vercel / GH Pages).
  var scriptEl   = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  }());

  var siteRoot   = (scriptEl && scriptEl.getAttribute('data-root')) || '/';
  var navbarURL  = siteRoot.replace(/\/$/, '') + 'navbar.html';

  /* ── 2. Inject navbar CSS into <head> if not already there ─ */
  if (!document.querySelector('link[data-navbar-css]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = siteRoot.replace(/\/$/, '') + 'navbar.css';
    link.setAttribute('data-navbar-css', '1');
    document.head.appendChild(link);
  }

  /* ── 3. Fetch the navbar HTML and inject it ─────────────── */
  fetch(navbarURL)
    .then(function (res) {
      if (!res.ok) throw new Error('Navbar fetch failed: ' + res.status);
      return res.text();
    })
    .then(function (html) {
      /* Create a temporary container to parse the HTML */
      var tmp = document.createElement('div');
      tmp.innerHTML = html;

      /* Prepend all child nodes to <body> */
      var body   = document.body;
      var refNode = body.firstChild;
      while (tmp.firstChild) {
        body.insertBefore(tmp.firstChild, refNode);
      }

      /* Now that the DOM is in place, boot the nav logic */
      initNav();
    })
    .catch(function (err) {
      console.error('[ATRBA Navbar]', err);
    });

  /* ── 4. Nav behaviour (runs after HTML is injected) ─────── */
  function initNav() {
    var hamburger = document.getElementById('nav-hamburger');
    var drawer    = document.getElementById('nav-mobile-drawer');
    var nav       = document.getElementById('main-nav');

    if (!hamburger || !drawer || !nav) {
      console.warn('[ATRBA Navbar] Elements not found — check navbar.html IDs.');
      return;
    }

    /* Toggle open / closed */
    function toggleMenu(forceOpen) {
      var isOpen = (typeof forceOpen === 'boolean')
        ? forceOpen
        : !hamburger.classList.contains('open');

      hamburger.classList.toggle('open', isOpen);
      drawer.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
      drawer.setAttribute('aria-hidden', String(!isOpen));

      /* Prevent body scroll while drawer is open */
      document.body.style.overflow = isOpen ? 'hidden' : '';
    }

    /* Hamburger click */
    hamburger.addEventListener('click', function () {
      toggleMenu();
    });

    /* Close when a drawer link is tapped */
    drawer.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        toggleMenu(false);
      });
    });

    /* Escape key closes the drawer */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && hamburger.classList.contains('open')) {
        toggleMenu(false);
        hamburger.focus();
      }
    });

    /* Scroll shadow */
    function onScroll() {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); /* run once on load */

    /* Active link — highlight the link matching the current path */
    var currentPath = window.location.pathname;
    document.querySelectorAll(
      '.nav-links a, .nav-drawer-links a'
    ).forEach(function (a) {
      var href = a.getAttribute('href');
      if (href && href !== '/' && currentPath.startsWith(href)) {
        a.classList.add('active');
      }
    });
  }

}());
