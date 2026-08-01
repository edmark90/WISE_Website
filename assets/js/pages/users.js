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
    updateStats(data.users || []);
    renderTable();
  } catch (err) {
    console.error('Failed to fetch users:', err);
    tbody.innerHTML = '';
    stateContainer.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><h4>Something went wrong</h4><p>Failed to load users. Make sure the server is running.</p></div>';
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
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    if (userModal.classList.contains('active')) closeUserModal();
    if (deleteModal.classList.contains('active')) closeDeleteModal();
  }
});

// ---------- Init ----------
async function init() {
  if (!initBasePage()) return;
  await loadSidebarUserFromApi();
  await fetchUsers();
}
init();
