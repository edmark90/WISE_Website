/**
 * WISE System - Notification Center Page
 * Summary cards, search/filters, notification history, details panel,
 * delete notifications, and the manual announcement composer.
 *
 * The Notification Module creates General Announcements only. Route alerts
 * (Upcoming / Arriving / Arrived / Delayed / Cancelled / Rescheduled) are
 * generated automatically from the Collection Schedule module.
 */

document.addEventListener('DOMContentLoaded', function () {
  if (!initBasePage()) return;

  // ---------- State ----------
  const state = {
    page: 1,
    pageSize: 12,
    total: 0,
    notifications: [],
    selected: null,
    searchTimer: null,
    routes: []
  };

  // ---------- DOM refs ----------
  const historyBody = $id('history-body');
  const historyCount = $id('history-count');
  const paginationEl = $id('history-pagination');
  const detailEmpty = $id('detail-empty');
  const detailContent = $id('detail-content');

  const searchInput = $id('nt-search');
  const filterType = $id('filter-type');
  const filterBarangay = $id('filter-barangay');
  const filterRoute = $id('filter-route');
  const filterDate = $id('filter-date');

  const newBtn = $id('new-announcement-btn');
  const overlay = $id('announcement-modal-overlay');
  const closeBtn = $id('announcement-close-btn');

  // ---------- Badge helpers ----------
  const TYPE_CLASS = {
    'Upcoming Collection': 'nt-type-updated',
    'Garbage Truck Arriving': 'nt-type-arriving',
    'Garbage Truck Arrived': 'nt-type-arrived',
    'Collection Completed': 'nt-type-completed',
    'Collection Rescheduled': 'nt-type-rescheduled',
    'Delayed Collection': 'nt-type-delayed',
    'Cancelled Collection': 'nt-type-cancelled',
    'General Announcement': 'nt-type-manual'
  };

  const STATUS_CLASS = {
    'Sent': 'nt-status-sent',
    'Draft': 'nt-status-draft',
    'Failed': 'nt-status-failed'
  };

  function typeBadge(type) {
    const t = type || 'General Announcement';
    const cls = TYPE_CLASS[t] || 'nt-type-auto';
    return '<span class="nt-type-badge ' + cls + '">' + escapeHtml(t) + '</span>';
  }

  function statusBadge(status) {
    const s = status || 'Draft';
    const cls = STATUS_CLASS[s] || 'nt-status-draft';
    return '<span class="nt-status-badge ' + cls + '">' + escapeHtml(s) + '</span>';
  }

  function priorityBadge(priority) {
    const p = priority || 'Normal';
    const cls = p === 'Emergency' ? 'nt-priority-emergency' : (p === 'Important' ? 'nt-priority-important' : 'nt-priority-normal');
    return '<span class="nt-priority-badge ' + cls + '">' + escapeHtml(p) + '</span>';
  }

  function parseList(raw) {
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  // ---------- Summary ----------
  async function loadSummary() {
    try {
      const res = await apiRequest('/api/notifications/summary');
      if (!res || !res.ok) return;
      const s = await res.json();
      $id('summary-today').textContent = s.today || 0;
      $id('summary-delayed').textContent = s.delayed_routes || 0;
      $id('summary-cancelled').textContent = s.cancelled_routes || 0;
      $id('summary-manual').textContent = s.manual_announcements || 0;
    } catch (e) { /* non-fatal */ }
  }

  // ---------- History ----------
  function filterQuery() {
    const qs = [];
    qs.push('page=' + state.page);
    qs.push('page_size=' + state.pageSize);
    const search = searchInput.value.trim();
    if (search) qs.push('search=' + encodeURIComponent(search));
    if (filterType.value !== 'All') qs.push('notification_type=' + encodeURIComponent(filterType.value));
    if (filterBarangay.value !== 'All') qs.push('barangay=' + encodeURIComponent(filterBarangay.value));
    if (filterRoute.value !== 'All') qs.push('route=' + encodeURIComponent(filterRoute.value));
    if (filterDate.value) qs.push('collection_date=' + encodeURIComponent(filterDate.value));
    return qs.join('&');
  }

  async function loadHistory() {
    historyBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--nt-text-muted)">Loading notifications...</td></tr>';
    try {
      const res = await apiRequest('/api/notifications/?' + filterQuery());
      if (!res) return;
      if (!res.ok) {
        historyBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--nt-text-muted)">Failed to load notifications.</td></tr>';
        return;
      }
      const data = await res.json();
      state.notifications = data.notifications || [];
      state.total = data.total || 0;
      renderHistory();
    } catch (e) {
      historyBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--nt-text-muted)">Connection error.</td></tr>';
    }
  }

  function barangayList(n) {
    const list = parseList(n.affected_barangays);
    if (list.length === 0) return '-';
    return list.join(', ');
  }

  function renderHistory() {
    historyCount.textContent = state.total + ' notification' + (state.total === 1 ? '' : 's');
    if (state.notifications.length === 0) {
      historyBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--nt-text-muted)">No notifications match your filters.</td></tr>';
      renderPagination();
      return;
    }
    historyBody.innerHTML = state.notifications.map(function (n) {
      const isSel = state.selected && state.selected.id === n.id;
      const reason = n.reason ? escapeHtml(n.reason) : '<span class="nt-cell-muted">-</span>';
      const route = n.route_name ? escapeHtml(n.route_name) : '<span class="nt-cell-muted">-</span>';
      const colDate = n.collection_date ? escapeHtml(n.collection_date) : '<span class="nt-cell-muted">-</span>';
      const createdBy = n.created_by_name ? escapeHtml(n.created_by_name) : '<span class="nt-cell-muted">Auto</span>';
      const created = n.created_at ? new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
      return '<tr class="' + (isSel ? 'selected' : '') + '" data-id="' + n.id + '" title="' + escapeHtml(created) + '">' +
        '<td>' + typeBadge(n.notification_type) + '</td>' +
        '<td class="nt-cell-route">' + route + '</td>' +
        '<td>' + escapeHtml(barangayList(n)) + '</td>' +
        '<td>' + reason + '</td>' +
        '<td>' + statusBadge(n.status) + '</td>' +
        '<td>' + colDate + '</td>' +
        '<td>' + createdBy + '</td>' +
        '<td><button class="nt-delete-btn" data-delete-id="' + n.id + '" title="Delete notification">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
          'Delete</button></td>' +
      '</tr>';
    }).join('');
    $all('#history-body tr').forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.closest('.nt-delete-btn')) return;
        const id = parseInt(this.dataset.id);
        const n = state.notifications.find(function (x) { return x.id === id; });
        if (n) selectNotification(n);
      });
    });
    $all('#history-body .nt-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const id = parseInt(this.dataset.deleteId);
        deleteNotification(id);
      });
    });
    renderPagination();
  }

  function renderPagination() {
    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    let btns = '';
    btns += '<button class="nt-page-btn" data-page="' + (state.page - 1) + '" ' + (state.page <= 1 ? 'disabled' : '') + '>&#8592;</button>';
    const start = Math.max(1, state.page - 2);
    const end = Math.min(totalPages, state.page + 2);
    for (let p = start; p <= end; p++) {
      btns += '<button class="nt-page-btn ' + (p === state.page ? 'active' : '') + '" data-page="' + p + '">' + p + '</button>';
    }
    btns += '<button class="nt-page-btn" data-page="' + (state.page + 1) + '" ' + (state.page >= totalPages ? 'disabled' : '') + '>&#8594;</button>';
    paginationEl.innerHTML =
      '<span class="nt-pagination-info">Page ' + state.page + ' of ' + totalPages + '</span>' +
      '<span class="nt-pagination-btns">' + btns + '</span>';
    $all('.nt-page-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const p = parseInt(this.dataset.page);
        if (!p || p < 1 || p > totalPages || p === state.page) return;
        state.page = p;
        loadHistory();
      });
    });
  }

  // ---------- Details panel ----------
  function selectNotification(n) {
    state.selected = n;
    detailEmpty.style.display = 'none';
    detailContent.style.display = 'block';

    const type = n.notification_type || 'General Announcement';
    const isRouteBased = type !== 'General Announcement';
    const list = parseList(n.affected_barangays);
    const recipientsRaw = n.recipients;
    const recipients = (recipientsRaw && recipientsRaw !== 'All') ? parseList(recipientsRaw) : [];

    let recipientsLabel;
    if (!isRouteBased) {
      recipientsLabel = 'All citizens (filtered by notification settings)';
    } else if (recipients.length) {
      recipientsLabel = recipients.join(', ');
    } else if (list.length) {
      recipientsLabel = list.join(', ');
    } else {
      recipientsLabel = 'Matched citizens';
    }

    const timelineStatus = [
      { label: 'Notification Created', done: true, sub: formatFullDate(n.created_at) },
      { label: 'Recipients Resolved', done: true, sub: 'Matched against preferred barangays + notification settings' },
      { label: 'Notification Sent', done: n.status === 'Sent', sub: n.status === 'Failed' ? 'Delivery failed' : (n.status === 'Sent' ? 'Delivered to matched citizens' : 'Awaiting dispatch') }
    ].map(function (t) {
      return '<div class="nt-timeline-item ' + (t.done ? 'done' : 'pending') + '">' +
        '<div class="nt-timeline-label">' + t.label + '</div>' +
        '<div class="nt-timeline-sub">' + escapeHtml(t.sub) + '</div>' +
      '</div>';
    }).join('');

    const commonItems =
      '<div class="nt-detail-item"><span class="nt-detail-label">Category</span><span class="nt-detail-value">' + escapeHtml(n.category || '-') + '</span></div>' +
      '<div class="nt-detail-item"><span class="nt-detail-label">Priority</span><span class="nt-detail-value">' + priorityBadge(n.priority) + '</span></div>' +
      '<div class="nt-detail-item"><span class="nt-detail-label">Recipients</span><span class="nt-detail-value">' + escapeHtml(recipientsLabel) + '</span></div>' +
      '<div class="nt-detail-item"><span class="nt-detail-label">Created By</span><span class="nt-detail-value">' + escapeHtml(n.created_by_name || 'System') + '</span></div>' +
      '<div class="nt-detail-item"><span class="nt-detail-label">Created Date</span><span class="nt-detail-value">' + escapeHtml(formatFullDate(n.created_at)) + '</span></div>';

    const routeItems = isRouteBased
      ? '<div class="nt-detail-item"><span class="nt-detail-label">Route Name</span><span class="nt-detail-value">' + escapeHtml(n.route_name || '-') + '</span></div>' +
        '<div class="nt-detail-item"><span class="nt-detail-label">Starting Point</span><span class="nt-detail-value">' + escapeHtml(n.starting_point || '-') + '</span></div>' +
        '<div class="nt-detail-item"><span class="nt-detail-label">Affected Barangays</span><span class="nt-detail-value">' + escapeHtml(list.join(', ') || '-') + '</span></div>' +
        '<div class="nt-detail-item"><span class="nt-detail-label">Collection Date</span><span class="nt-detail-value">' + escapeHtml(n.collection_date || '-') + '</span></div>' +
        '<div class="nt-detail-item"><span class="nt-detail-label">Collection Time</span><span class="nt-detail-value">' + escapeHtml(n.collection_time ? formatTime12(n.collection_time.substring(0, 5)) : '-') + '</span></div>' +
        '<div class="nt-detail-item"><span class="nt-detail-label">Assigned Personnel</span><span class="nt-detail-value">' + escapeHtml(n.assigned_personnel || '-') + '</span></div>' +
        '<div class="nt-detail-item"><span class="nt-detail-label">Reason</span><span class="nt-detail-value">' + escapeHtml(n.reason || '-') + '</span></div>' +
        '<div class="nt-detail-item"><span class="nt-detail-label">Additional Message</span><span class="nt-detail-value">' + escapeHtml(n.additional_message || '-') + '</span></div>'
      : '';

    detailContent.innerHTML =
      '<div class="nt-detail-head">' +
        '<div class="nt-detail-head-row"><span class="nt-detail-type">' + typeBadge(type) + '</span><span class="nt-detail-time">' + escapeHtml(formatFullDate(n.created_at)) + '</span></div>' +
        '<h4 class="nt-detail-title">' + escapeHtml(n.title) + '</h4>' +
      '</div>' +
      '<div class="nt-detail-body">' +
        '<p class="nt-detail-message">' + escapeHtml(n.message) + '</p>' +
        '<div class="nt-detail-grid">' +
          routeItems + commonItems +
        '</div>' +
        '<div class="nt-timeline"><div class="nt-timeline-title">Timeline</div>' + timelineStatus + '</div>' +
      '</div>' +
      '<div class="nt-detail-foot">' +
        '<span class="nt-detail-foot-label">Delivery Status</span>' + statusBadge(n.status) +
        '<button class="nt-delete-btn" id="detail-delete-btn">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
          'Delete</button>' +
      '</div>';

    $id('detail-delete-btn').addEventListener('click', function () {
      deleteNotification(n.id);
    });
  }

  function formatFullDate(d) {
    if (!d) return '-';
    try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return d; }
  }

  // ---------- Delete notification ----------
  async function deleteNotification(id) {
    const n = state.notifications.find(function (x) { return x.id === id; });
    const label = n && n.title ? n.title : 'this notification';
    if (!window.confirm('Delete "' + label + '"? This action cannot be undone.')) return;
    try {
      const res = await apiRequest('/api/notifications/' + id, { method: 'DELETE' });
      if (!res) return;
      if (!res.ok) {
        const e = await res.json().catch(function () { return {}; });
        showToast(e.detail || 'Failed to delete notification.', 'error');
        return;
      }
      showToast('Notification deleted.', 'success');
      if (state.selected && state.selected.id === id) {
        state.selected = null;
        detailEmpty.style.display = 'flex';
        detailContent.style.display = 'none';
      }
      loadSummary();
      loadHistory();
    } catch (e) {
      showToast('Connection error.', 'error');
    }
  }

  // ---------- Route filter options ----------
  async function loadRouteOptions() {
    try {
      const res = await apiRequest('/api/collection-schedules/?page_size=100');
      if (!res || !res.ok) return;
      const data = await res.json();
      state.routes = data.schedules || [];
      const routes = new Set();
      state.routes.forEach(function (s) {
        const name = s.route_name || s.barangay;
        if (name) routes.add(name);
      });
      const sel = filterRoute;
      sel.innerHTML = '<option value="All">All Routes</option>' +
        Array.from(routes).sort().map(function (r) { return '<option value="' + escapeHtml(r) + '">' + escapeHtml(r) + '</option>'; }).join('');
    } catch (e) { /* non-fatal */ }
  }

  // ---------- Manual announcement modal ----------
  function openAnnouncementModal() {
    $id('a-title').value = '';
    $id('a-message').value = '';
    $id('a-category').value = 'General Announcement';
    $id('a-priority').value = 'Normal';
    overlay.classList.add('show');
  }

  function closeAnnouncementModal() {
    overlay.classList.remove('show');
  }

  async function submitAnnouncement() {
    const title = $id('a-title').value.trim();
    if (!title) {
      showToast('Please enter an announcement title.', 'error');
      return;
    }
    const message = $id('a-message').value.trim();
    if (!message) {
      showToast('Please enter the announcement message.', 'error');
      return;
    }
    const payload = {
      title: title,
      message: message,
      notification_type: 'General Announcement',
      category: $id('a-category').value,
      priority: $id('a-priority').value,
      send_now: true,
      recipients: null
    };

    const btn = $id('a-send-btn');
    btn.disabled = true;
    btn.classList.add('loading');
    try {
      const res = await apiRequest('/api/notifications/', { method: 'POST', body: JSON.stringify(payload) });
      if (!res) return;
      if (!res.ok) {
        const e = await res.json().catch(function () { return {}; });
        showToast(e.detail || 'Failed to send notification.', 'error');
        return;
      }
      showToast('Notification sent to matched citizens.', 'success');
      closeAnnouncementModal();
      state.page = 1;
      loadSummary();
      loadHistory();
    } catch (e) {
      showToast('Connection error.', 'error');
    } finally {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  }

  // ---------- Wiring ----------
  searchInput.addEventListener('input', function () {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(function () { state.page = 1; loadHistory(); }, 350);
  });
  filterType.addEventListener('change', function () { state.page = 1; loadHistory(); });
  filterBarangay.addEventListener('change', function () { state.page = 1; loadHistory(); });
  filterRoute.addEventListener('change', function () { state.page = 1; loadHistory(); });
  filterDate.addEventListener('change', function () { state.page = 1; loadHistory(); });
  $id('filter-reset').addEventListener('click', function () {
    searchInput.value = '';
    filterType.value = 'All';
    filterBarangay.value = 'All';
    filterRoute.value = 'All';
    filterDate.value = '';
    state.page = 1;
    loadHistory();
  });

  newBtn.addEventListener('click', openAnnouncementModal);
  closeBtn.addEventListener('click', closeAnnouncementModal);
  $id('a-cancel-btn').addEventListener('click', closeAnnouncementModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeAnnouncementModal(); });
  $id('a-send-btn').addEventListener('click', submitAnnouncement);

  // ---------- Init ----------
  filterBarangay.innerHTML = '<option value="All">All Barangays</option>' +
    BARANGAYS.map(function (b) { return '<option value="' + escapeHtml(b) + '">' + escapeHtml(b) + '</option>'; }).join('');
  loadSummary();
  loadRouteOptions();
  loadHistory();
});
