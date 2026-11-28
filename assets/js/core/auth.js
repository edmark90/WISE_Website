/**
 * WISE System - Authentication & Session
 * JWT helpers, login guard, logout, sidebar user profile card, and mobile drawer.
 */

/** Build the Authorization header from the stored JWT. */
function getHeaders() {
  const token = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}

/** Redirect to the login page when there is no stored token. */
function checkAuth() {
  if (!localStorage.getItem('access_token')) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

/** Clear the session and go back to the login page. */
function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('token_type');
  localStorage.removeItem('user_role');
  localStorage.removeItem('user_name');
  window.location.href = 'index.html';
}

/** Ensure the sidebar brand title has the two-tone WISE / SYSTEM styling and footer has the Admin identity card. */
function ensureSidebarUserCard() {
  const brandTitle = document.querySelector('.sidebar-brand h1');
  if (brandTitle && !brandTitle.querySelector('.brand-sub')) {
    brandTitle.innerHTML = 'WISE<br><span class="brand-sub">SYSTEM</span>';
  }

  const footer = document.querySelector('.sidebar-footer');
  if (!footer || document.getElementById('user-name')) return;
  const card = document.createElement('div');
  card.className = 'sidebar-user';
  card.innerHTML =
    '<div class="sidebar-user-avatar" id="user-avatar-initials">' +
      '<svg viewBox="0 0 24 24" fill="none">' +
        '<circle cx="12" cy="8.5" r="4" fill="#ffffff"/>' +
        '<path d="M5 20.5c0-3.6 3.1-6 7-6s7 2.4 7 6" fill="#93c5fd"/>' +
      '</svg>' +
    '</div>' +
    '<div class="sidebar-user-info">' +
      '<div class="sidebar-user-name" id="user-name">Admin</div>' +
      '<div class="sidebar-user-role" id="user-role">Administrator</div>' +
    '</div>' +
    '<span class="sidebar-user-dot" title="Online"></span>';
  footer.insertBefore(card, footer.firstChild);
}

/** Sync the mobile topbar user avatar initials & tooltip. */
function syncMobileUserAvatar(fullName, roleText) {
  const mobileAvatar = document.getElementById('mobile-user-avatar');
  if (!mobileAvatar) return;
  const name = fullName || localStorage.getItem('user_name') || 'Admin';
  const role = roleText || localStorage.getItem('user_role') || 'Administrator';
  const initials = typeof getInitials === 'function'
    ? getInitials(name)
    : name.split(' ').filter(Boolean).map(function (w) { return w[0].toUpperCase(); }).slice(0, 2).join('') || 'A';
  mobileAvatar.textContent = initials;
  mobileAvatar.title = name + ' (' + role + ')';
  mobileAvatar.setAttribute('aria-label', name + ', ' + role);
}

/** Fill the sidebar user name/role from localStorage. */
function populateSidebarUserFromStorage() {
  ensureSidebarUserCard();
  const nameEl = document.getElementById('user-name');
  const roleEl = document.getElementById('user-role');
  const storedName = localStorage.getItem('user_name') || 'Admin';
  const storedRole = localStorage.getItem('user_role') || 'Administrator';
  const normalizedRole = storedRole.toLowerCase() === 'admin' ? 'Administrator' : storedRole;
  if (nameEl) nameEl.textContent = storedName;
  if (roleEl) roleEl.textContent = normalizedRole;
  syncMobileUserAvatar(storedName, normalizedRole);
}

/** Fill the sidebar user name/role from the API (/api/auth/me). */
async function loadSidebarUserFromApi() {
  try {
    const res = await fetch(CONFIG.API_BASE_URL + '/api/auth/me', { headers: getHeaders() });
    if (!res.ok) throw new Error('Auth failed');
    const user = await res.json();
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    const fullName = user.fullname || 'Admin';
    const r = (user.role || 'admin').toLowerCase();
    const roleText = r === 'admin' ? 'Administrator' : (r.charAt(0).toUpperCase() + r.slice(1));
    localStorage.setItem('user_name', fullName);
    localStorage.setItem('user_role', roleText);
    if (nameEl) nameEl.textContent = fullName;
    if (roleEl) roleEl.textContent = roleText;
    syncMobileUserAvatar(fullName, roleText);
  } catch (e) {
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    if (nameEl && !nameEl.textContent) nameEl.textContent = 'Admin';
    if (roleEl && !roleEl.textContent) roleEl.textContent = 'Administrator';
  }
}

/**
 * Reusable styled confirmation modal (replaces raw window.confirm).
 * Resolves to true when confirmed, false when cancelled.
 */
function wiseConfirmDialog(options) {
  const opts = options || {};
  const title = opts.title || 'Confirm Action';
  const message = opts.message || 'Are you sure you want to continue?';
  const confirmText = opts.confirmText || 'Confirm';
  const cancelText = opts.cancelText || 'Cancel';
  const variant = opts.variant || 'danger'; // 'danger' | 'warning' | 'info'

  const iconSvg = variant === 'danger'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
    : (variant === 'warning'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>');

  const btnClass = variant === 'danger' ? 'btn-danger' : (variant === 'warning' ? 'btn-warning' : 'btn-primary');

  return new Promise(function (resolve) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay wise-dialog-overlay';
    overlay.innerHTML =
      '<div class="modal wise-dialog-modal" role="dialog" aria-modal="true" aria-labelledby="wise-dlg-title">' +
        '<div class="wise-dialog-body">' +
          '<div class="confirm-icon ' + variant + '">' + iconSvg + '</div>' +
          '<div class="confirm-text">' +
            '<h3 id="wise-dlg-title"></h3>' +
            '<p id="wise-dlg-msg"></p>' +
          '</div>' +
        '</div>' +
        '<div class="wise-dialog-actions">' +
          '<button type="button" class="btn btn-secondary" data-action="cancel"></button>' +
          '<button type="button" class="btn ' + btnClass + '" data-action="confirm"></button>' +
        '</div>' +
      '</div>';

    overlay.querySelector('#wise-dlg-title').textContent = title;
    overlay.querySelector('#wise-dlg-msg').textContent = message;
    const cancelBtn = overlay.querySelector('[data-action="cancel"]');
    const confirmBtn = overlay.querySelector('[data-action="confirm"]');
    cancelBtn.textContent = cancelText;
    confirmBtn.textContent = confirmText;

    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('active'); });

    let settled = false;
    function close(result) {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      overlay.classList.remove('active');
      setTimeout(function () { overlay.remove(); }, 200);
      resolve(result);
    }

    function onKey(e) {
      if (e.key === 'Escape') close(false);
    }

    cancelBtn.addEventListener('click', function () { close(false); });
    confirmBtn.addEventListener('click', function () { close(true); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', onKey);
    confirmBtn.focus();
  });
}

/**
 * Reusable styled prompt modal (replaces raw window.prompt).
 * Resolves to trimmed string when confirmed, or null when cancelled.
 */
function wisePromptDialog(options) {
  const opts = options || {};
  const title = opts.title || 'Enter Details';
  const message = opts.message || '';
  const label = opts.label || 'Reason';
  const defaultValue = opts.defaultValue || '';
  const placeholder = opts.placeholder || '';
  const confirmText = opts.confirmText || 'Submit';
  const cancelText = opts.cancelText || 'Cancel';
  const variant = opts.variant || 'warning';

  const btnClass = variant === 'danger' ? 'btn-danger' : (variant === 'warning' ? 'btn-warning' : 'btn-primary');

  return new Promise(function (resolve) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay wise-dialog-overlay';
    overlay.innerHTML =
      '<div class="modal wise-dialog-modal" role="dialog" aria-modal="true" aria-labelledby="wise-pr-title">' +
        '<div class="modal-header">' +
          '<h3 id="wise-pr-title"></h3>' +
          '<button type="button" class="modal-close-btn" data-action="cancel" aria-label="Close dialog">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="modal-body">' +
          (message ? '<p id="wise-pr-msg" style="margin:0 0 12px;font-size:13.5px;color:var(--text-muted);"></p>' : '') +
          '<div class="wise-dialog-field" style="margin-top:0;">' +
            '<label for="wise-pr-input" id="wise-pr-label"></label>' +
            '<input type="text" id="wise-pr-input" autocomplete="off">' +
            '<p class="wise-dialog-error" id="wise-pr-err">Please enter a reason.</p>' +
          '</div>' +
        '</div>' +
        '<div class="wise-dialog-actions">' +
          '<button type="button" class="btn btn-secondary" data-action="cancel"></button>' +
          '<button type="button" class="btn ' + btnClass + '" data-action="confirm"></button>' +
        '</div>' +
      '</div>';

    overlay.querySelector('#wise-pr-title').textContent = title;
    if (message) overlay.querySelector('#wise-pr-msg').textContent = message;
    overlay.querySelector('#wise-pr-label').textContent = label;
    const input = overlay.querySelector('#wise-pr-input');
    input.value = defaultValue;
    input.placeholder = placeholder;
    const errEl = overlay.querySelector('#wise-pr-err');
    const confirmBtn = overlay.querySelector('[data-action="confirm"]');
    const cancelBtns = overlay.querySelectorAll('[data-action="cancel"]');
    confirmBtn.textContent = confirmText;
    cancelBtns.forEach(function (b) { if (!b.classList.contains('modal-close-btn')) b.textContent = cancelText; });

    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('active'); });

    let settled = false;
    function close(val) {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      overlay.classList.remove('active');
      setTimeout(function () { overlay.remove(); }, 200);
      resolve(val);
    }

    function submit() {
      const v = input.value.trim();
      if (!v) {
        errEl.style.display = 'block';
        input.focus();
        return;
      }
      close(v);
    }

    function onKey(e) {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    }

    input.addEventListener('input', function () { errEl.style.display = 'none'; });
    cancelBtns.forEach(function (b) { b.addEventListener('click', function () { close(null); }); });
    confirmBtn.addEventListener('click', submit);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(null); });
    document.addEventListener('keydown', onKey);
    input.focus();
    input.select();
  });
}

/** Attach a clean clear (×) button behavior to any search input & button pair. */
function wireSearchClear(inputEl, clearBtnEl, onClear) {
  if (!inputEl || !clearBtnEl) return;
  function sync() {
    clearBtnEl.classList.toggle('visible', inputEl.value.length > 0);
  }
  inputEl.addEventListener('input', sync);
  clearBtnEl.addEventListener('click', function () {
    inputEl.value = '';
    sync();
    inputEl.focus();
    if (typeof onClear === 'function') onClear();
  });
  sync();
}

/**
 * Common bootstrap for every admin page:
 *  1) Redirect to login when unauthenticated.
 *  2) Populate the sidebar user card & asynchronously sync with /api/auth/me.
 *  3) Wire the logout button with confirmation.
 *  4) Initialize responsive mobile navigation drawer.
 * Returns true when the user is authenticated.
 */
function initBasePage() {
  if (!checkAuth()) return false;
  initMobileNav();
  populateSidebarUserFromStorage();
  loadSidebarUserFromApi();
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function (e) {
      e.preventDefault();
      const confirmed = await wiseConfirmDialog({
        title: 'Sign Out?',
        message: 'You will be signed out of the WISE Admin Portal.',
        confirmText: 'Sign Out',
        cancelText: 'Stay',
        variant: 'danger'
      });
      if (confirmed) logout();
    });
  }
  return true;
}

function initMobileNav() {
  var app = document.querySelector('.app');
  var sidebar = document.querySelector('.sidebar');
  if (!app || !sidebar) return;

  function closeDrawer() {
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
    document.body.classList.remove('nav-drawer-open');
    var mb = document.getElementById('mobile-menu-btn');
    if (mb) mb.setAttribute('aria-expanded', 'false');
  }

  function openDrawer() {
    sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('active');
    document.body.classList.add('nav-drawer-open');
    var mb = document.getElementById('mobile-menu-btn');
    if (mb) mb.setAttribute('aria-expanded', 'true');
  }

  // Derive active page title from sidebar nav for mobile orientation
  var activeNavSpan = sidebar.querySelector('.nav-item.active span');
  var activePageTitle = activeNavSpan ? activeNavSpan.textContent.trim() : 'WISE SYSTEM';

  // Create mobile topbar if not present
  if (!document.querySelector('.mobile-topbar')) {
    var topbar = document.createElement('header');
    topbar.className = 'mobile-topbar';
    topbar.innerHTML =
      '<button type="button" class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle navigation menu" aria-expanded="false">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
          '<line x1="4" y1="12" x2="20" y2="12"></line>' +
          '<line x1="4" y1="6" x2="20" y2="6"></line>' +
          '<line x1="4" y1="18" x2="20" y2="18"></line>' +
        '</svg>' +
      '</button>' +
      '<div class="mobile-brand">' +
        '<img src="assets/images/logo wise.png" alt="WISE Logo" class="mobile-logo-img">' +
        '<span class="mobile-title"></span>' +
      '</div>' +
      '<div class="mobile-top-right">' +
        '<span class="mobile-user-avatar" id="mobile-user-avatar" title="Administrator">A</span>' +
      '</div>';
    topbar.querySelector('.mobile-title').textContent = activePageTitle;
    app.insertBefore(topbar, app.firstChild);
  }

  // Create backdrop if not present
  var backdrop = document.querySelector('.sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    app.appendChild(backdrop);
  }

  // Add mobile close button inside sidebar header if not present
  var brand = sidebar.querySelector('.sidebar-brand');
  if (brand && !sidebar.querySelector('.sidebar-drawer-close')) {
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'sidebar-drawer-close';
    closeBtn.setAttribute('aria-label', 'Close menu');
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    brand.appendChild(closeBtn);
    closeBtn.addEventListener('click', function () {
      closeDrawer();
    });
  }

  // Event wiring
  var menuBtn = document.getElementById('mobile-menu-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (sidebar.classList.contains('open')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });
  }

  backdrop.addEventListener('click', function () {
    closeDrawer();
  });

  sidebar.querySelectorAll('.nav-item').forEach(function (link) {
    link.addEventListener('click', function () {
      closeDrawer();
    });
  });

  // Close drawer on ESC key
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      closeDrawer();
    }
  });

  // Close drawer if window is resized past mobile/tablet breakpoint (> 1024px)
  window.addEventListener('resize', function () {
    if (window.innerWidth > 1024 && sidebar.classList.contains('open')) {
      closeDrawer();
    }
  });
}
