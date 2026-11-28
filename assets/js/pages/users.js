/**
 * WISE System - Users Page
 * Page state, DOM references, data fetching, and event wiring for users.html.
 * Rendering logic lives in components/user-table.js and components/user-modal.js.
 */

// ---------- State ----------
let state = {
  users: [], total: 0, page: 1, pageSize: 10,
  search: '', role: '', editingId: null, deletingId: null,
};

// ---------- DOM refs ----------
const tbody = $id('user-tbody');
const stateContainer = $id('table-state-container');
const paginationInfo = $id('pagination-info');
const paginationControls = $id('pagination-controls');
const searchInput = $id('search-input');
const roleFilter = $id('role-filter');
const resetFilterBtn = $id('reset-filter-btn');
const addUserBtn = $id('add-user-btn');
const userModal = $id('user-modal');
const deleteModal = $id('delete-modal');
const modalTitle = $id('modal-title');
const modalSaveText = $id('modal-save-text');
const modalSave = $id('modal-save');
const modalCancel = $id('modal-cancel');
const modalClose = $id('modal-close');
const userIdInput = $id('user-id');
const formFullname = $id('form-fullname');
const formEmail = $id('form-email');
const formPhone = $id('form-phone');
const formRole = $id('form-role');
const formPassword = $id('form-password');
const formConfirm = $id('form-confirm');
const passwordRequired = $id('password-required');
const passwordFields = $id('password-fields');
const accountStatusFields = $id('account-status-fields');
const formActive = $id('form-active');
const statusToggleLabel = $id('status-toggle-label');
const deleteUserName = $id('delete-user-name');
const deleteConfirm = $id('delete-confirm');
const deleteCancel = $id('delete-cancel');

// ---------- Data Fetching ----------
async function fetchUsers() {
  if (!checkAuth()) return;
  const p = new URLSearchParams({ page: state.page, page_size: state.pageSize });
  if (state.search) p.set('search', state.search);
  if (state.role) p.set('role', state.role);
  tbody.innerHTML = '';
  stateContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading users...</p></div>';
  paginationControls.innerHTML = '';
  paginationInfo.textContent = 'Loading...';
  try {
    const res = await apiRequest('/api/users/?' + p.toString());
    if (!res) return;
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    state.users = data.users || [];
    state.total = data.total || 0;
    updateStats(data.users || [], data.role_counts);
    renderTable();
  } catch (err) {
    console.error('Failed to fetch users:', err);
    tbody.innerHTML = '';
    stateContainer.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><h4>Could not load users</h4><p>Check your connection and try again.</p><button type="button" class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="fetchUsers()">Retry</button></div>';
  }
}

// ---------- Event Wiring ----------
var searchTimeout;
searchInput.addEventListener('input', function () {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(function () {
    state.search = searchInput.value.trim();
    state.page = 1;
    fetchUsers();
  }, 350);
});

roleFilter.addEventListener('change', function () {
  state.role = roleFilter.value;
  state.page = 1;
  fetchUsers();
});

if (resetFilterBtn) {
  resetFilterBtn.addEventListener('click', function () {
    searchInput.value = '';
    if ($id('search-clear-btn')) $id('search-clear-btn').classList.remove('visible');
    roleFilter.value = '';
    state.search = '';
    state.role = '';
    state.page = 1;
    fetchUsers();
  });
}

wireSearchClear(searchInput, $id('search-clear-btn'), function () {
  state.search = '';
  state.page = 1;
  fetchUsers();
});

$all('.password-toggle-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var target = $id(btn.dataset.toggleTarget);
    if (!target) return;
    var showing = target.type === 'text';
    target.type = showing ? 'password' : 'text';
    btn.setAttribute('aria-pressed', showing ? 'false' : 'true');
    btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    btn.innerHTML = showing
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  });
});

addUserBtn.addEventListener('click', openAddModal);
formActive.addEventListener('change', updateStatusToggleLabel);
modalCancel.addEventListener('click', closeUserModal);
modalClose.addEventListener('click', closeUserModal);
userModal.addEventListener('click', function (e) { if (e.target === userModal) closeUserModal(); });
modalSave.addEventListener('click', saveUser);
document.getElementById('user-form').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveUser(); } });
deleteCancel.addEventListener('click', closeDeleteModal);
deleteConfirm.addEventListener('click', deleteUser);
deleteModal.addEventListener('click', function (e) { if (e.target === deleteModal) closeDeleteModal(); });
if ($id('collector-modal-close')) $id('collector-modal-close').addEventListener('click', closeCollectorAssignmentsModal);
if ($id('collector-modal-close-btn')) $id('collector-modal-close-btn').addEventListener('click', closeCollectorAssignmentsModal);
if ($id('collector-assignments-modal')) {
  $id('collector-assignments-modal').addEventListener('click', function (e) {
    if (e.target === $id('collector-assignments-modal')) closeCollectorAssignmentsModal();
  });
}
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    if (userModal.classList.contains('active')) closeUserModal();
    if (deleteModal.classList.contains('active')) closeDeleteModal();
    if ($id('collector-assignments-modal') && $id('collector-assignments-modal').classList.contains('active')) closeCollectorAssignmentsModal();
  }
});

// ---------- Init ----------
async function init() {
  if (!initBasePage()) return;
  await fetchUsers();
}
init();
