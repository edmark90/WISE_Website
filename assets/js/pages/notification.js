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

  function isValidValue(val) {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') {
      var trimmed = val.trim();
      return trimmed.length > 0 && trimmed !== '-' && trimmed !== 'null' && trimmed !== 'undefined' && trimmed !== 'N/A' && trimmed !== 'none';
    }
    if (Array.isArray(val)) {
      return val.length > 0;
    }
    return true;
  }

  function formatSimpleDate(d) {
    if (!d) return '';
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        var parts = d.split('-');
        var dateObj = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        return dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      }
      return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return d;
    }
  }

  function formatFullDate(d) {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      return d;
    }
  }

  // ---------- Details panel ----------
  function selectNotification(n) {
    state.selected = n;
    detailEmpty.style.display = 'none';
    detailContent.style.display = 'block';

    // Highlight row in table
    $all('#history-body tr').forEach(function (tr) {
      tr.classList.toggle('selected', tr.dataset.id === String(n.id));
    });

    var type = n.notification_type || 'General Announcement';
    var isRouteBased = type !== 'General Announcement';

    // 1. Dynamic Info Cards (ONLY include fields that actually exist and are non-empty)
    var infoCards = [];

    // Route Name
    if (isValidValue(n.route_name)) {
      infoCards.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>',
        label: 'Route Name',
        value: escapeHtml(n.route_name)
      });
    }

    // Starting Point
    if (isValidValue(n.starting_point)) {
      infoCards.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"></circle><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"></path></svg>',
        label: 'Starting Point',
        value: escapeHtml(n.starting_point)
      });
    }

    // Affected Barangays
    var barangays = parseList(n.affected_barangays);
    if (barangays.length > 0) {
      infoCards.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
        label: 'Affected Barangays',
        value: barangays.map(function (b) { return '<span class="nt-badge-chip">' + escapeHtml(b) + '</span>'; }).join(' '),
        isHtml: true,
        fullWidth: barangays.length > 2
      });
    } else if (isValidValue(n.barangay)) {
      infoCards.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
        label: 'Barangay',
        value: '<span class="nt-badge-chip">' + escapeHtml(n.barangay) + '</span>',
        isHtml: true
      });
    }

    // Collection Date
    if (isValidValue(n.collection_date)) {
      infoCards.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
        label: 'Collection Date',
        value: escapeHtml(formatSimpleDate(n.collection_date))
      });
    }

    // Collection Time
    if (isValidValue(n.collection_time)) {
      var timeStr = formatTime12(String(n.collection_time).substring(0, 5));
      infoCards.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
        label: 'Collection Time',
        value: escapeHtml(timeStr)
      });
    }

    // Assigned Personnel
    if (isValidValue(n.assigned_personnel)) {
      infoCards.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>',
        label: 'Assigned Personnel',
        value: escapeHtml(n.assigned_personnel)
      });
    }

    // Category (if defined and non-empty)
    if (isValidValue(n.category)) {
      infoCards.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16"></path><path d="M4 15h16"></path><path d="M10 3L8 21"></path><path d="M16 3l-2 18"></path></svg>',
        label: 'Category',
        value: escapeHtml(n.category)
      });
    }

    // Priority (if defined and non-empty)
    if (isValidValue(n.priority)) {
      infoCards.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
        label: 'Priority Level',
        value: priorityBadge(n.priority),
        isHtml: true
      });
    }

    // Recipients / Target Audience
    var recipientsRaw = n.recipients;
    var recipientsList = (recipientsRaw && recipientsRaw !== 'All') ? parseList(recipientsRaw) : [];
    if (recipientsList.length > 0) {
      infoCards.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
        label: 'Target Audience',
        value: recipientsList.map(function (r) { return '<span class="nt-badge-chip">' + escapeHtml(r) + '</span>'; }).join(' '),
        isHtml: true,
        fullWidth: recipientsList.length > 2
      });
    } else if (recipientsRaw === 'All' || !isRouteBased) {
      infoCards.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
        label: 'Target Audience',
        value: 'All Registered Citizens'
      });
    }

    // Created By / Sender
    if (isValidValue(n.created_by_name)) {
      infoCards.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path></svg>',
        label: 'Created By',
        value: escapeHtml(n.created_by_name)
      });
    }

    // Sent Timestamp
    if (isValidValue(n.created_at)) {
      infoCards.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
        label: 'Sent / Dispatched At',
        value: escapeHtml(formatFullDate(n.created_at))
      });
    }

    // Mobile update specific fields if present
    if (isValidValue(n.version) || isValidValue(n.version_name)) {
      var vStr = n.version || n.version_name;
      infoCards.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>',
        label: 'Target App Version',
        value: '<span class="nt-badge-chip primary">' + escapeHtml(vStr) + '</span>',
        isHtml: true
      });
    }
    if (isValidValue(n.apk_url)) {
      infoCards.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
        label: 'APK Download',
        value: '<a href="' + escapeHtml(n.apk_url) + '" target="_blank" rel="noopener noreferrer" class="nt-link-btn">Download Package</a>',
        isHtml: true
      });
    }

    // 2. Reason Alert Banner (ONLY if reason is present and non-empty)
    var reasonBannerHtml = '';
    if (isValidValue(n.reason)) {
      var isDanger = String(type).indexOf('Cancelled') !== -1;
      reasonBannerHtml =
        '<div class="nt-detail-alert-box ' + (isDanger ? 'danger' : 'warn') + '">' +
          '<div class="nt-detail-alert-icon">' +
            (isDanger
              ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
              : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>') +
          '</div>' +
          '<div class="nt-detail-alert-body">' +
            '<div class="nt-detail-alert-title">' + (isDanger ? 'Reason for Cancellation' : 'Reason for Delay / Notice') + '</div>' +
            '<div class="nt-detail-alert-text">' + escapeHtml(n.reason) + '</div>' +
          '</div>' +
        '</div>';
    }

    // 3. Additional Message Banner (ONLY if present and not duplicate of message/reason)
    var addMsgHtml = '';
    if (isValidValue(n.additional_message) && n.additional_message !== n.message && n.additional_message !== n.reason) {
      addMsgHtml =
        '<div class="nt-detail-alert-box info">' +
          '<div class="nt-detail-alert-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>' +
          '</div>' +
          '<div class="nt-detail-alert-body">' +
            '<div class="nt-detail-alert-title">Additional Message</div>' +
            '<div class="nt-detail-alert-text">' + escapeHtml(n.additional_message) + '</div>' +
          '</div>' +
        '</div>';
    }

    // 4. Render Dynamic Grid Items
    var gridHtml = '';
    if (infoCards.length > 0) {
      gridHtml =
        '<div class="nt-detail-grid">' +
          infoCards.map(function (c) {
            return '<div class="nt-detail-item' + (c.fullWidth ? ' full' : '') + '">' +
              '<div class="nt-detail-item-header">' +
                '<span class="nt-detail-item-icon">' + c.icon + '</span>' +
                '<span class="nt-detail-label">' + c.label + '</span>' +
              '</div>' +
              '<div class="nt-detail-value">' + (c.isHtml ? c.value : escapeHtml(c.value)) + '</div>' +
            '</div>';
          }).join('') +
        '</div>';
    }

    // 5. Timeline / Audit Trail
    var timelineStatus = [
      { label: 'Notification Generated', done: true, sub: formatFullDate(n.created_at) },
      { label: 'Audience Resolved', done: true, sub: 'Matched against citizen preferences & barangay filters' },
      { label: 'Dispatch Broadcast', done: n.status === 'Sent', sub: n.status === 'Failed' ? 'Delivery failed' : (n.status === 'Sent' ? 'Delivered to citizen devices' : 'Awaiting scheduled dispatch') }
    ].map(function (t) {
      return '<div class="nt-timeline-item ' + (t.done ? 'done' : 'pending') + '">' +
        '<div class="nt-timeline-label">' + t.label + '</div>' +
        '<div class="nt-timeline-sub">' + escapeHtml(t.sub) + '</div>' +
      '</div>';
    }).join('');

    detailContent.innerHTML =
      '<div class="nt-detail-head">' +
        '<div class="nt-detail-head-top">' +
          '<div class="nt-detail-badge-group">' +
            typeBadge(type) +
            statusBadge(n.status) +
            (isValidValue(n.priority) && n.priority !== 'Normal' ? priorityBadge(n.priority) : '') +
          '</div>' +
          '<span class="nt-detail-time">' + escapeHtml(formatFullDate(n.created_at)) + '</span>' +
        '</div>' +
        '<h4 class="nt-detail-title">' + escapeHtml(n.title || 'Untitled Notification') + '</h4>' +
      '</div>' +
      '<div class="nt-detail-body">' +
        (isValidValue(n.message) ? '<div class="nt-detail-message">' + escapeHtml(n.message) + '</div>' : '') +
        reasonBannerHtml +
        addMsgHtml +
        gridHtml +
        '<div class="nt-timeline"><div class="nt-timeline-title">Delivery Status &amp; Timeline</div>' + timelineStatus + '</div>' +
      '</div>' +
      '<div class="nt-detail-foot">' +
        '<div class="nt-detail-foot-status">' +
          '<span class="nt-detail-foot-label">Dispatch Status:</span>' + statusBadge(n.status) +
        '</div>' +
        '<button class="nt-delete-btn" id="detail-delete-btn" title="Delete notification">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
          'Delete Notification</button>' +
      '</div>';

    var delBtn = $id('detail-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', function () {
        deleteNotification(n.id);
      });
    }
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
