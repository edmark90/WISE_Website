/**
 * WISE System - Authentication & Session
 * JWT helpers, login guard, logout, and sidebar user info.
 */

/** Build the Authorization header from the stored JWT. */
function getHeaders() {
  const token = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}

/** Redirect to the login page when there is no stored token. */
function checkAuth() {
  if (!localStorage.getItem('access_token')) { window.location.href = 'index.html'; return false; }
  return true;
}

/** Clear the session and go back to the login page. */
function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('token_type');
  localStorage.removeItem('user_role');
  window.location.href = 'index.html';
}

/** Fill the sidebar user name/role from localStorage. */
function populateSidebarUserFromStorage() {
  const nameEl = document.getElementById('user-name');
  const roleEl = document.getElementById('user-role');
  if (nameEl) nameEl.textContent = localStorage.getItem('user_name') || 'Admin User';
  if (roleEl) roleEl.textContent = localStorage.getItem('user_role') || 'Administrator';
}

/** Fill the sidebar user name/role from the API (/api/auth/me). */
async function loadSidebarUserFromApi() {
  try {
    const res = await fetch(CONFIG.API_BASE_URL + '/api/auth/me', { headers: getHeaders() });
    if (!res.ok) throw new Error('Auth failed');
    const user = await res.json();
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    if (nameEl) nameEl.textContent = user.fullname || 'Admin';
    const r = (user.role || 'admin');
    if (roleEl) roleEl.textContent = r.charAt(0).toUpperCase() + r.slice(1);
  } catch (e) {
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    if (nameEl) nameEl.textContent = 'Admin';
    if (roleEl) roleEl.textContent = 'Administrator';
  }
}

/**
 * Common bootstrap for every admin page:
 *  1) Redirect to login when unauthenticated.
 *  2) Populate the sidebar user card.
 *  3) Wire the logout button.
 *  4) Initialize responsive mobile navigation drawer.
 * Returns true when the user is authenticated.
 */
function initBasePage() {
  if (!checkAuth()) return false;
  populateSidebarUserFromStorage();
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', function (e) { e.preventDefault(); logout(); });
  initMobileNav();
  return true;
}

function initMobileNav() {
  var app = document.querySelector('.app');
  var sidebar = document.querySelector('.sidebar');
  if (!app || !sidebar) return;

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
        '<span class="mobile-badge">⚙️</span>' +
        '<span class="mobile-title">WISE SYSTEM</span>' +
      '</div>' +
      '<div class="mobile-top-right">' +
        '<a href="profile.html" class="mobile-user-avatar" title="Admin Profile">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path></svg>' +
        '</a>' +
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
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
    });
  }

  // Event wiring
  var menuBtn = document.getElementById('mobile-menu-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = sidebar.classList.toggle('open');
      backdrop.classList.toggle('active', isOpen);
    });
  }

  backdrop.addEventListener('click', function () {
    sidebar.classList.remove('open');
    backdrop.classList.remove('active');
  });

  sidebar.querySelectorAll('.nav-item').forEach(function (link) {
    link.addEventListener('click', function () {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
    });
  });
}

