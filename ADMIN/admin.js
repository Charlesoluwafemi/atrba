// ─────────────────────────────────────────────────────────────────────────────
// Meridian Admin — Shared JS
// Fixes: reliable auth guard, token expiry check, safe authFetch error handling
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:8000';

const RESOURCES_API = 'http://localhost:8001';

function resourcesFetch(url, options = {}) {
  const token = localStorage.getItem('admin_token');

  return fetch(RESOURCES_API + url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: token ? `Bearer ${token}` : '',
    }
  });
}

// ─── Token storage helpers ────────────────────────────────────────────────────

function getToken()     { return localStorage.getItem('admin_token'); }
function getAdminUser() { return JSON.parse(localStorage.getItem('admin_user') || '{}'); }
function getExpiry()    { return localStorage.getItem('admin_token_expiry'); }

function saveSession(token, expiry, admin) {
  localStorage.setItem('admin_token',        token);
  localStorage.setItem('admin_token_expiry', expiry);   // ISO string
  localStorage.setItem('admin_user',         JSON.stringify(admin));
}

function clearSession() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_token_expiry');
  localStorage.removeItem('admin_user');
}

// ─── Token validity check (client-side expiry + presence) ────────────────────
//
// We check expiry locally before every request.  This eliminates the race where
// a stale token fires a real network call, gets a 401 back, then redirects —
// causing the "401 then redirect loop" visible in the server logs.

function isSessionValid() {
  const token  = getToken();
  const expiry = getExpiry();

  if (!token || !expiry) return false;

  // Treat the session as expired 60 seconds early so we never send a token
  // that will expire mid-request.
  const expiresAt = new Date(expiry).getTime() - 60_000;
  return Date.now() < expiresAt;
}

// ─── Auth guard — call at the top of every protected page ────────────────────
//
// Returns true if the session is valid and the page should proceed.
// Returns false AND redirects to login.html if not — never throws.

function requireAuth() {
  if (isSessionValid()) return true;

  // Token missing, expired, or corrupt — clear debris and go to login
  clearSession();

  // Avoid redirect loop if we're already on login.html
  if (!location.pathname.endsWith('login.html')) {
    location.replace('login.html');
  }
  return false;
}

// ─── Authenticated fetch ──────────────────────────────────────────────────────
//
// Always returns a Response or throws — never returns undefined.
// Callers can safely do:  const data = await authFetch(...).then(r => r.json())
//
// 401 from the server means the token was rejected (e.g. deleted from DB,
// or the server was restarted and sessions cleared).  We clear local storage
// and redirect to login immediately.

async function authFetch(path, options = {}) {
  // Client-side guard first — avoids a pointless network round-trip
  if (!isSessionValid()) {
    clearSession();
    location.replace('login.html');
    // Return a never-resolving promise so the calling code doesn't continue
    return new Promise(() => {});
  }


  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    // Server rejected the token (revoked, DB wiped, etc.) — force re-login
    clearSession();
    location.replace('login.html');
    return new Promise(() => {});   // halt caller execution
  }

  return res;
}

// ─── Login helper (called from login.html) ────────────────────────────────────
//
// Centralised here so the expiry is always stored alongside the token.

async function loginRequest(username, password) {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Invalid credentials');
  }

  const data = await res.json();
  // Store token + expiry together so isSessionValid() can check both
  saveSession(data.token, data.expires_at, data.admin);
  return data;
}

// ─── Logout ───────────────────────────────────────────────────────────────────

async function logout() {
  // Best-effort server-side invalidation — don't block on failure
  if (isSessionValid()) {
    try { await authFetch('/admin/logout', { method: 'POST' }); } catch (_) {}
  }
  clearSession();
  location.replace('login.html');
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function renderSidebar(activePage) {
  const user = getAdminUser();
  const initials = (user.username || 'A').slice(0, 2).toUpperCase();

  const navItems = [
    { id: 'dashboard', icon: 'grid',        label: 'Dashboard', href: 'dashboard.html' },
    { id: 'blogs',     icon: 'file-text',   label: 'All Posts', href: 'blogs.html'    },
    { id: 'create',    icon: 'plus-circle', label: 'New Post',  href: 'editor.html'   },
    { id: 'resource',    icon: 'plus-circle', label: 'Resources',  href: 'resources_admin.html'   },
  ];
  
  const icons = {
    grid:
      '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>' +
      '<rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    'file-text':
      '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>' +
      '<polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>' +
      '<line x1="16" y1="17" x2="8" y2="17"/>',
    'plus-circle':
      '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/>' +
      '<line x1="8" y1="12" x2="16" y2="12"/>',
    'log-out':
      '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>' +
      '<polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    external:
      '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>' +
      '<polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  };

  const expiryMs  = getExpiry() ? new Date(getExpiry()).getTime() : 0;
  const remaining = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000 / 60));
  const sessionLabel = remaining > 60
    ? `Session expires in ${Math.floor(remaining / 60)}h`
    : remaining > 0
      ? `Session expires in ${remaining}m`
      : 'Session expired';

  const html = `
  <aside class="sidebar" id="sidebar">
    <a href="dashboard.html" class="sidebar-logo">
      <div class="sidebar-logo-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M4 6h16M4 12h10M4 18h12"/>
        </svg>
      </div>
      <div>
        <div class="sidebar-brand">ABOVE THE REST BUSINESS ADVISORS</div>
        <div class="sidebar-badge">CMS Admin</div>
      </div>
    </a>

    <nav class="sidebar-nav">
      <div class="nav-section-label">Navigation</div>
      ${navItems.map(item => `
        <a class="nav-item ${activePage === item.id ? 'active' : ''}" href="${item.href}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               width="16" height="16">${icons[item.icon]}</svg>
          ${item.label}
        </a>`).join('')}

      <div class="nav-section-label">Site</div>
      <a class="nav-item" href="index.html" target="_blank">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             width="16" height="16">${icons.external}</svg>
        View Blog
      </a>
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="user-avatar">${initials}</div>
        <div class="user-info">
          <div class="user-name">${user.username || 'Admin'}</div>
          <div class="user-role" id="session-countdown" title="${getExpiry() || ''}"
               style="font-size:.68rem;">${sessionLabel}</div>
        </div>
      </div>
      <button class="nav-item danger" onclick="logout()" style="margin-top:4px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             width="16" height="16">${icons['log-out']}</svg>
        Sign out
      </button>
    </div>
  </aside>`;

  const el = document.getElementById('sidebar-slot');
  if (el) el.outerHTML = html;

  // Live session countdown — updates every 30 s
  startSessionCountdown();
}

// ─── Session countdown ticker ─────────────────────────────────────────────────

function startSessionCountdown() {
  setInterval(() => {
    const el = document.getElementById('session-countdown');
    if (!el) return;

    if (!isSessionValid()) {
      el.textContent = 'Session expired';
      el.style.color = '#dc2626';
      // Give user 2 seconds to see the message, then redirect
      setTimeout(() => {
        clearSession();
        location.replace('login.html');
      }, 2000);
      return;
    }

    const remaining = Math.max(0,
      Math.floor((new Date(getExpiry()).getTime() - Date.now()) / 1000 / 60));
    el.textContent = remaining > 60
      ? `Session expires in ${Math.floor(remaining / 60)}h`
      : `Session expires in ${remaining}m`;

    if (remaining <= 10) el.style.color = '#d97706';   // amber warning
  }, 30_000);
}

// ─── Toast ────────────────────────────────────────────────────────────────────

let _toastContainer = null;

function showToast(msg, type = 'default', duration = 3500) {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'toast-container';
    document.body.appendChild(_toastContainer);
  }

  const iconPaths = {
    success: '<polyline points="20 6 9 17 4 12"/>',
    error:   '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/>' +
             '<line x1="9" y1="9" x2="15" y2="15"/>',
    warning: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3' +
             'L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/>' +
             '<line x1="12" y1="17" x2="12.01" y2="17"/>',
    default: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>' +
             '<line x1="12" y1="16" x2="12.01" y2="16"/>',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'default' ? '' : type}`;
  toast.innerHTML =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
       ${iconPaths[type] || iconPaths.default}
     </svg>
     <span>${msg}</span>`;
  _toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.cssText += 'opacity:0;transform:translateY(8px);transition:all .3s;';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function confirmDialog(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(15,14,13,.5);z-index:9998;' +
      'display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:32px;max-width:400px;
                  width:90%;box-shadow:0 24px 64px rgba(0,0,0,.2);">
        <h3 style="font-family:'Playfair Display',serif;font-size:1.25rem;
                   color:#0f0e0d;margin-bottom:12px;">Are you sure?</h3>
        <p style="font-size:.9375rem;color:#6b6560;line-height:1.6;
                  margin-bottom:28px;">${message}</p>
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button id="confirm-cancel"
            style="padding:9px 20px;border:1.5px solid #e8e3dc;border-radius:10px;
                   background:#fff;cursor:pointer;font-size:.875rem;
                   font-family:'DM Sans',sans-serif;">Cancel</button>
          <button id="confirm-ok"
            style="padding:9px 20px;border:none;border-radius:10px;
                   background:#dc2626;color:#fff;cursor:pointer;font-size:.875rem;
                   font-weight:500;font-family:'DM Sans',sans-serif;">Delete</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirm-cancel').onclick = () => { overlay.remove(); resolve(false); };
    overlay.querySelector('#confirm-ok').onclick    = () => { overlay.remove(); resolve(true);  };
  });
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[-\s]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const CATEGORY_BADGE_CLASS = {
  technology:  'badge-blue',
  engineering: 'badge-green',
  design:      'badge-blue',
  business:    'badge-amber',
  general:     'badge-gray',
};

function categoryBadge(cat) {
  const cls = CATEGORY_BADGE_CLASS[cat?.toLowerCase()] || 'badge-gray';
  return `<span class="badge ${cls}">${cat || 'general'}</span>`;
}