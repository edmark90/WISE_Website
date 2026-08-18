/**
 * WISE System - User Table Component
 * Renders the users table, empty/loading states, and pagination controls.
 */

// ---------- Table Rendering ----------
function renderTable() {
  if (state.users.length === 0) {
    tbody.innerHTML = '';
    stateContainer.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><h4>No users found</h4><p>' + (state.search || state.role ? 'Try adjusting your search or filter.' : 'Click Add User to create the first account.') + '</p></div>';
    paginationControls.innerHTML = '';
    paginationInfo.textContent = '0 users found';
    updateUserCount();
    return;
  }
  stateContainer.innerHTML = '';
  var html = '';
  for (var i = 0; i < state.users.length; i++) {
    var u = state.users[i];
    var initials = getInitials(u.fullname);
    var avatarClass = getRoleClass(u.role);
    var roleLabel = u.role.charAt(0).toUpperCase() + u.role.slice(1);
    var created = formatDisplayDate(u.created_at);
    var safeName = escapeHtml(u.fullname);
    var safeEmail = escapeHtml(u.email);
    var avatarHtml = '<div class="user-avatar-sm ' + avatarClass + '">' + initials + '</div>';
    if (u.profile_image) {
      avatarHtml = '<div class="user-avatar-sm ' + avatarClass + '"><img class="user-avatar-img" src="' + escapeHtml(CONFIG.API_BASE_URL + '/' + u.profile_image) + '" alt="' + safeName + '" onerror="this.style.display=\'none\'"></div>';
    }
    html += '<tr>';
    html += '<td style="font-weight:600;color:var(--text-muted);font-size:13px;">#' + u.id + '</td>';
    html += '<td><div class="user-cell">' + avatarHtml + '<div><div class="user-name-cell">' + safeName + '</div></div></div></td>';
    html += '<td><span class="user-email-cell">' + safeEmail + '</span></td>';
    html += '<td style="color:var(--text-muted);">' + (u.phone || '-') + '</td>';
    html += '<td><span class="role-badge ' + u.role + '">' + roleLabel + '</span></td>';
    html += '<td><span class="user-status-badge ' + (u.is_active === false ? 'disabled' : 'active') + '"><span class="status-dot"></span>' + (u.is_active === false ? 'Disabled' : 'Active') + '</span></td>';
    html += '<td style="color:var(--text-muted);font-size:13px;">' + created + '</td>';
    html += '<td><div class="actions-cell">';
    html += '<button class="btn-icon" onclick="openEditModal(' + u.id + ')" title="Edit user"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
    html += '<button class="btn-icon danger" onclick="openDeleteModal(' + u.id + ')" title="Delete user"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
    html += '</div></td></tr>';
  }
  tbody.innerHTML = html;
  renderPagination();
}

// ---------- Pagination ----------
function renderPagination() {
  var total = state.total, page = state.page, pageSize = state.pageSize;
  var totalPages = Math.ceil(total / pageSize) || 1;
  var start = (page - 1) * pageSize + 1;
  var end = Math.min(page * pageSize, total);
  paginationInfo.innerHTML = 'Showing <strong>' + start + '-' + end + '</strong> of <strong>' + total + '</strong> users';
  updateUserCount();
  if (!total) { paginationControls.innerHTML = ''; return; }
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

function updateUserCount() {
  var el = $id('user-count');
  if (!el) return;
  el.textContent = state.total + ' user' + (state.total === 1 ? '' : 's');
}

// ---------- Stats ----------
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
