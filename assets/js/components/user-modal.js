/**
 * WISE System - User Modal Component
 * Add/edit user form modal and delete confirmation modal.
 */

// ---------- Add / Edit Modal ----------
function openAddModal() {
  state.editingId = null;
  modalTitle.textContent = 'Add New User';
  modalSaveText.textContent = 'Save User';
  userIdInput.value = ''; formFullname.value = ''; formEmail.value = ''; formPhone.value = ''; formRole.value = ''; formPassword.value = ''; formConfirm.value = '';
  formPassword.required = true;
  passwordRequired.style.display = 'inline';
  passwordFields.style.display = '';
  accountStatusFields.style.display = 'none';
  formActive.checked = true;
  updateStatusToggleLabel();
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
  formPassword.placeholder = 'Leave blank to keep current password';
  passwordRequired.style.display = 'none';
  passwordFields.style.display = '';
  accountStatusFields.style.display = '';
  formActive.checked = user.is_active !== false;
  updateStatusToggleLabel();
  userModal.classList.add('active');
  setTimeout(function () { formFullname.focus(); }, 100);
}

function updateStatusToggleLabel() {
  statusToggleLabel.textContent = formActive.checked ? 'Active' : 'Disabled';
}

function closeUserModal() { userModal.classList.remove('active'); }

// ---------- Delete Modal ----------
function openDeleteModal(id) {
  var user = null;
  for (var i = 0; i < state.users.length; i++) { if (state.users[i].id === id) { user = state.users[i]; break; } }
  if (!user) return;
  state.deletingId = id;
  deleteUserName.textContent = user.fullname;
  deleteModal.classList.add('active');
}

function closeDeleteModal() { deleteModal.classList.remove('active'); state.deletingId = null; }

// ---------- Save / Delete ----------
async function saveUser() {
  if (!formFullname.value.trim()) { showToast('Please enter a full name.', 'error'); formFullname.focus(); return; }
  if (!formEmail.value.trim()) { showToast('Please enter an email address.', 'error'); formEmail.focus(); return; }
  if (!formRole.value) { showToast('Please select a role.', 'error'); formRole.focus(); return; }
  var isEdit = !!state.editingId;
  if (!isEdit) {
    if (!formPassword.value || formPassword.value.length < 8) { showToast('Password must be at least 8 characters.', 'error'); formPassword.focus(); return; }
    if (formPassword.value !== formConfirm.value) { showToast('Passwords do not match.', 'error'); formConfirm.focus(); return; }
  } else if (formPassword.value) {
    if (formPassword.value.length < 8) { showToast('New password must be at least 8 characters.', 'error'); formPassword.focus(); return; }
    if (formPassword.value !== formConfirm.value) { showToast('Passwords do not match.', 'error'); formConfirm.focus(); return; }
  }
  var payload = { fullname: formFullname.value.trim(), email: formEmail.value.trim(), phone: formPhone.value.trim() || null, role: formRole.value };
  if (formPassword.value) { payload.password = formPassword.value; }
  if (isEdit) { payload.is_active = formActive.checked; }
  modalSave.disabled = true;
  modalSaveText.textContent = isEdit ? 'Updating...' : 'Saving...';
  try {
    var res;
    if (isEdit) {
      res = await apiRequest('/api/users/' + state.editingId, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      res = await apiRequest('/api/users/', { method: 'POST', body: JSON.stringify(payload) });
    }
    if (!res) return;
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
    var res = await apiRequest('/api/users/' + state.deletingId, { method: 'DELETE' });
    if (!res) return;
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

// ---------- Collector Assignments Modal ----------
async function openCollectorAssignmentsModal(userId) {
  var modal = $id('collector-assignments-modal');
  var body = $id('collector-assignments-body');
  var title = $id('collector-modal-title');
  if (!modal || !body) return;
  title.textContent = 'Collector Assignments';
  body.innerHTML = '<div class="loading-state" style="padding:28px;text-align:center;"><div class="spinner"></div><p>Loading assigned schedules...</p></div>';
  modal.classList.add('active');
  try {
    var res = await apiRequest('/api/users/' + userId + '/assignments');
    if (!res || !res.ok) throw new Error('Failed to load assignments');
    var data = await res.json();
    var col = data.collector || {};
    var list = data.assignments || [];
    title.textContent = (col.fullname || 'Collector') + ' — Assigned Schedules';
    if (!list.length) {
      body.innerHTML = '<div class="empty-state" style="padding:28px;text-align:center;"><h4>No assigned routes yet</h4><p>Assign this collector to a route in the Collection Schedule module.</p></div>';
      return;
    }
    var html = '<table class="user-table" style="min-width:100%;"><thead><tr><th>Date</th><th>Time</th><th>Route</th><th>Truck</th><th>Status</th></tr></thead><tbody>';
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      html += '<tr>';
      html += '<td>' + escapeHtml(a.collection_date || '—') + '</td>';
      html += '<td class="td-muted">' + escapeHtml(a.collection_time || '—') + '</td>';
      html += '<td><strong>' + escapeHtml(a.route_name || a.barangay || '—') + '</strong></td>';
      html += '<td class="td-muted">' + escapeHtml(a.truck_number || '—') + '</td>';
      html += '<td><span class="role-badge collector">' + escapeHtml(a.status || 'Upcoming') + '</span></td>';
      html += '</tr>';
    }
    html += '</tbody></table>';
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = '<div class="empty-state" style="padding:28px;text-align:center;"><h4>Error loading assignments</h4><p>Could not load schedules for this collector.</p></div>';
  }
}

function closeCollectorAssignmentsModal() {
  var modal = $id('collector-assignments-modal');
  if (modal) modal.classList.remove('active');
}
