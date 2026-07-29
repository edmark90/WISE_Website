/**
 * WISE System - User Management Module
 * Handles all CRUD operations, search, filtering, pagination, and modals.
 */

const API_BASE = 'http://127.0.0.1:8000';
const $id = (id) => document.getElementById(id);

let state = {
  users: [], total: 0, page: 1, pageSize: 10,
  search: '', role: '', editingId: null, deletingId: null,
};

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
const deleteUserName = $id('delete-user-name');
const deleteConfirm = $id('delete-confirm');
const deleteCancel = $id('delete-cancel');
const toastContainer = $id('toast-container');

function getHeaders() {
  const token = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}

function checkAuth() {
  if (!localStorage.getItem('access_token')) { window.location.href = 'index.html'; return false; }
  return true;
}

async function loadSidebarUser() {
  try {
    const res = await fetch(API_BASE + '/api/auth/me', { headers: getHeaders() });
    if (!res.ok) throw new Error('Auth failed');
    const user = await res.json();
    $id('user-name').textContent = user.fullname || 'Admin';
    const r = (user.role || 'admin');
    $id('user-role').textContent = r.charAt(0).toUpperCase() + r.slice(1);
  } catch (e) {
    $id('user-name').textContent = 'Admin';
    $id('user-role').textContent = 'Administrator';
  }
}

function showToast(msg, type) {
  if (!type) type = 'info';
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = (icons[type] || icons.info) + ' ' + msg;
  toastContainer.appendChild(t);
  setTimeout(function () { t.classList.add('removing'); setTimeout(function () { t.remove(); }, 300); }, 3500);
}

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
    const res = await fetch(API_BASE + '/api/users/?' + p.toString(), { headers: getHeaders() });
    if (res.status === 401) { localStorage.removeItem('access_token'); window.location.href = 'index.html'; return; }
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

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').filter(function (w) { return w.length > 0; }).map(function (w) { return w[0].toUpperCase(); }).slice(0, 2).join('');
}

function getRoleClass(role) {
  return ({ admin: 'admin', citizen: 'citizen' })[role] || 'default';
}

function formatDate(d) {
  if (!d) return '-';
  try { var dt = new Date(d); if (isNaN(dt.getTime())) return d; return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return d; }
}

function escapeHtml(s) {
  if (!s) return '';
  var div = document.createElement('div'); div.textContent = s; return div.innerHTML;
}

function renderTable() {
  if (state.users.length === 0) {
    tbody.innerHTML = '';
    stateContainer.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><h4>No users found</h4><p>' + (state.search || state.role ? 'Try adjusting your search or filter.' : 'Click Add User to create the first account.') + '</p></div>';
    paginationControls.innerHTML = '';
    paginationInfo.textContent = '0 users found';
    return;
  }
  stateContainer.innerHTML = '';
  var html = '';
  for (var i = 0; i < state.users.length; i++) {
    var u = state.users[i];
    var initials = getInitials(u.fullname);
    var avatarClass = getRoleClass(u.role);
    var roleLabel = u.role.charAt(0).toUpperCase() + u.role.slice(1);
    var created = formatDate(u.created_at);
    var safeName = escapeHtml(u.fullname);
    var safeEmail = escapeHtml(u.email);
    html += '<tr>';
    html += '<td style="font-weight:600;color:var(--text-muted);font-size:13px;">#' + u.id + '</td>';
    html += '<td><div class="user-cell"><div class="user-avatar-sm ' + avatarClass + '">' + initials + '</div><div><div class="user-name-cell">' + safeName + '</div></div></div></td>';
    html += '<td><span class="user-email-cell">' + safeEmail + '</span></td>';
    html += '<td style="color:var(--text-muted);">' + (u.phone || '-') + '</td>';
    html += '<td><span class="role-badge ' + u.role + '">' + roleLabel + '</span></td>';
    html += '<td style="color:var(--text-muted);font-size:13px;">' + created + '</td>';
    html += '<td><div class="actions-cell">';
    html += '<button class="btn-icon" onclick="openEditModal(' + u.id + ')" title="Edit user"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
    html += '<button class="btn-icon danger" onclick="openDeleteModal(' + u.id + ')" title="Delete user"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
    html += '</div></td></tr>';
  }
  tbody.innerHTML = html;
  renderPagination();
}

function renderPagination() {
  var total = state.total, page = state.page, pageSize = state.pageSize;
  var totalPages = Math.ceil(total / pageSize) || 1;
  var start = (page - 1) * pageSize + 1;
  var end = Math.min(page * pageSize, total);
  paginationInfo.innerHTML = 'Showing <strong>' + start + '-' + end + '</strong> of <strong>' + total + '</strong> users';
  if (totalPages <= 1) { paginationControls.innerHTML = ''; return; }
  var html = '';
  html += '<button class="page-btn" onclick="goToPage(' + (page - 1) + ')" ' + (page <= 1 ? 'disabled' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>';
  var maxVisible = 5;
  var startPage = Math.max(1, page - Math.floor(maxVisible / 2));
  var endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage + 1 < maxVisible) { startPage = Math.max(1, endPage - maxVisible + 1); }
  if (startPage > 1) {
    html += '<button class="page-btn" onclick="goToPage(1)">1</button>';
    if (startPage > 2) html += '<button class="page-btn" disabled>...</button>';
  }
  for (var i = startPage; i <= endPage; i++) {
    html += '<button class="page-btn' + (i === page ? ' active' : '') + '" onclick="goToPage(' + i + ')">' + i + '</button>';
  }
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += '<button class="page-btn" disabled>...</button>';
    html += '<button class="page-btn" onclick="goToPage(' + totalPages + ')">' + totalPages + '</button>';
  }
  html += '<button class="page-btn" onclick="goToPage(' + (page + 1) + ')" ' + (page >= totalPages ? 'disabled' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>';
  paginationControls.innerHTML = html;
}

function goToPage(p) { if (p < 1) return; state.page = p; fetchUsers(); }

function updateStats(users) {
  $id('stat-total').textContent = state.total;
  var c = 0, a = 0;
  for (var i = 0; i < users.length; i++) {
    if (users[i].role === 'citizen') c++;
    else if (users[i].role === 'admin') a++;
  }
  $id('stat-citizens').textContent = c;
  $id('stat-admins').textContent = a;
}

function openAddModal() {
  state.editingId = null;
  modalTitle.textContent = 'Add New User';
  modalSaveText.textContent = 'Save User';
  userIdInput.value = ''; formFullname.value = ''; formEmail.value = ''; formPhone.value = ''; formRole.value = ''; formPassword.value = ''; formConfirm.value = '';
  formPassword.required = true;
  passwordRequired.style.display = 'inline';
  userModal.classList.add('active');
  setTimeout(function () { formFullname.focus(); }, 100);
}

function openEditModal(id) {
  var user = null;
  for (var i = 0; i < state.users.length; i++) { if (state.users[i].id === id) { user = state.users[i]; break; } }
  if (!user) return;
  state.editingId = id;
  modalTitle.textContent = 'Edit User';
  modalSaveText.textContent = 'Update User';
  userIdInput.value = user.id;
  formFullname.value = user.fullname;
  formEmail.value = user.email;
  formPhone.value = user.phone || '';
  formRole.value = user.role;
  formPassword.value = ''; formConfirm.value = '';
  formPassword.required = false;
  passwordRequired.style.display = 'none';
  userModal.classList.add('active');
  setTimeout(function () { formFullname.focus(); }, 100);
}

function closeUserModal() { userModal.classList.remove('active'); }

function openDeleteModal(id) {
  var user = null;
  for (var i = 0; i < state.users.length; i++) { if (state.users[i].id === id) { user = state.users[i]; break; } }
  if (!user) return;
  state.deletingId = id;
  deleteUserName.textContent = user.fullname;
  deleteModal.classList.add('active');
}

function closeDeleteModal() { deleteModal.classList.remove('active'); state.deletingId = null; }

async function saveUser() {
  if (!formFullname.value.trim()) { showToast('Please enter a full name.', 'error'); formFullname.focus(); return; }
  if (!formEmail.value.trim()) { showToast('Please enter an email address.', 'error'); formEmail.focus(); return; }
  if (!formRole.value) { showToast('Please select a role.', 'error'); formRole.focus(); return; }
  var isEdit = !!state.editingId;
  if (!isEdit) {
    if (!formPassword.value || formPassword.value.length < 8) { showToast('Password must be at least 8 characters.', 'error'); formPassword.focus(); return; }
    if (formPassword.value !== formConfirm.value) { showToast('Passwords do not match.', 'error'); formConfirm.focus(); return; }
  }
  if (isEdit && formPassword.value) {
    if (formPassword.value.length < 8) { showToast('Password must be at least 8 characters.', 'error'); formPassword.focus(); return; }
    if (formPassword.value !== formConfirm.value) { showToast('Passwords do not match.', 'error'); formConfirm.focus(); return; }
  }
  var payload = { fullname: formFullname.value.trim(), email: formEmail.value.trim(), phone: formPhone.value.trim() || null, role: formRole.value };
  if (formPassword.value) { payload.password = formPassword.value; }
  modalSave.disabled = true;
  modalSaveText.textContent = isEdit ? 'Updating...' : 'Saving...';
  try {
    var res;
    if (isEdit) {
      res = await fetch(API_BASE + '/api/users/' + state.editingId, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(payload) });
    } else {
      res = await fetch(API_BASE + '/api/users/', { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) });
    }
    if (res.status === 401) { localStorage.removeItem('access_token'); window.location.href = 'index.html'; return; }
    var data = await res.json();
    if (!res.ok) {
      var detail = data.detail || data.message || 'Something went wrong.';
      showToast(typeof detail === 'string' ? detail : 'Validation failed.', 'error');
      modalSave.disabled = false; modalSaveText.textContent = isEdit ? 'Update User' : 'Save User'; return;
    }
    showToast(isEdit ? 'User updated successfully!' : 'User created successfully!', 'success');
    closeUserModal();
    state.page = 1;
    await fetchUsers();
  } catch (err) {
    console.error('Save user error:', err);
    showToast('Connection error. Please try again.', 'error');
  } finally {
    modalSave.disabled = false;
    modalSaveText.textContent = isEdit ? 'Update User' : 'Save User';
  }
}

async function deleteUser() {
  if (!state.deletingId) return;
  deleteConfirm.disabled = true;
  deleteConfirm.innerHTML = 'Deleting...';
  try {
    var res = await fetch(API_BASE + '/api/users/' + state.deletingId, { method: 'DELETE', headers: getHeaders() });
    if (res.status === 401) { localStorage.removeItem('access_token'); window.location.href = 'index.html'; return; }
    if (!res.ok) {
      var data = await res.json().catch(function () { return {}; });
      showToast(data.detail || 'Failed to delete user.', 'error');
      deleteConfirm.disabled = false; deleteConfirm.innerHTML = 'Delete'; return;
    }
    showToast('User deleted successfully.', 'success');
    closeDeleteModal();
    if (state.users.length === 1 && state.page > 1) { state.page--; }
    await fetchUsers();
  } catch (err) {
    console.error('Delete user error:', err);
    showToast('Connection error. Please try again.', 'error');
  } finally {
    deleteConfirm.disabled = false;
    deleteConfirm.innerHTML = 'Delete';
  }
}

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
modalCancel.addEventListener('click', closeUserModal);
modalClose.addEventListener('click', closeUserModal);
userModal.addEventListener('click', function (e) { if (e.target === userModal) closeUserModal(); });
modalSave.addEventListener('click', saveUser);
document.getElementById('user-form').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveUser(); } });
deleteCancel.addEventListener('click', closeDeleteModal);
deleteConfirm.addEventListener('click', deleteUser);
deleteModal.addEventListener('click', function (e) { if (e.target === deleteModal) closeDeleteModal(); });
$id('logout-btn').addEventListener('click', function (e) {
  e.preventDefault();
  localStorage.removeItem('access_token');
  localStorage.removeItem('token_type');
  localStorage.removeItem('user_role');
  window.location.href = 'index.html';
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    if (userModal.classList.contains('active')) closeUserModal();
    if (deleteModal.classList.contains('active')) closeDeleteModal();
  }
});

async function init() {
  if (!checkAuth()) return;
  await loadSidebarUser();
  await fetchUsers();
}
init();