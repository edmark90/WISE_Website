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

/** Fill the sidebar user name/role from localStorage. */
function populateSidebarUserFromStorage() {
  ensureSidebarUserCard();
  const nameEl = document.getElementById('user-name');
  const roleEl = document.getElementById('user-role');
  if (nameEl) nameEl.textContent = localStorage.getItem('user_name') || 'Admin';
  if (roleEl) {
    const storedRole = localStorage.getItem('user_role') || 'Administrator';
    roleEl.textContent = storedRole.toLowerCase() === 'admin' ? 'Administrator' : storedRole;
  }
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
  } catch (e) {
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    if (nameEl && !nameEl.textContent) nameEl.textContent = 'Admin';
    if (roleEl && !roleEl.textContent) roleEl.textContent = 'Administrator';
  }
}

/**
 * Common bootstrap for every admin page:
 *  1) Redirect to login when unauthenticated.
 *  2) Populate the sidebar user card & asynchronously sync with /api/auth/me.
 *  3) Wire the logout button.
 *  4) Initialize responsive mobile navigation drawer.
 * Returns true when the user is authenticated.
 */
function initBasePage() {
  if (!checkAuth()) return false;
  populateSidebarUserFromStorage();
  loadSidebarUserFromApi();
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      logout();
    });
  }
  initMobileNav();
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
  }

  function openDrawer() {
    sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('active');
    document.body.classList.add('nav-drawer-open');
  }

  // Create mobile topbar if not present
  if (!document.querySelector('.mobile-topbar')) {
    var topbar = document.createElement('header');
    topbar.className = 'mobile-topbar';
    topbar.innerHTML =
      '<button type="button" class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle navigation menu">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
          '<line x1="4" y1="12" x2="20" y2="12"></line>' +
          '<line x1="4" y1="6" x2="20" y2="6"></line>' +
          '<line x1="4" y1="18" x2="20" y2="18"></line>' +
        '</svg>' +
      '</button>' +
      '<div class="mobile-brand">' +
        '<img src="assets/images/logo wise.png" alt="WISE Logo" class="mobile-logo-img">' +
        '<span class="mobile-title">WISE SYSTEM</span>' +
      '</div>' +
      '<div class="mobile-top-right">' +
        '<span class="mobile-user-avatar" id="mobile-user-avatar" title="Administrator">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path></svg>' +
        '</span>' +
      '</div>';
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
