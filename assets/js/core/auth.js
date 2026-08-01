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
    const res = await fetch(API_BASE + '/api/auth/me', { headers: getHeaders() });
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
 * Returns true when the user is authenticated.
 */
function initBasePage() {
  if (!checkAuth()) return false;
  populateSidebarUserFromStorage();
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', function (e) { e.preventDefault(); logout(); });
  return true;
}
