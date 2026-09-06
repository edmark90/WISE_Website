/**
 * WISE System - Notification History Component
 * Notification history list, filtering, and pagination.
 */

const NotificationHistory = {
  /**
   * Wire up control event listeners
   */
  wireControls: function() {
    const searchInput = $id('nt-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(NotificationState.searchTimer);
        NotificationState.searchTimer = setTimeout(() => {
          NotificationState.page = 1;
          this.load();
        }, 350);
      });
    }

    const filterType = $id('filter-type');
    if (filterType) {
      filterType.addEventListener('change', () => {
        NotificationState.page = 1;
        this.load();
      });
    }

    const filterBarangay = $id('filter-barangay');
    if (filterBarangay) {
      filterBarangay.addEventListener('change', () => {
        NotificationState.page = 1;
        this.load();
      });
    }

    const filterRoute = $id('filter-route');
    if (filterRoute) {
      filterRoute.addEventListener('change', () => {
        NotificationState.page = 1;
        this.load();
      });
    }

    const filterDate = $id('filter-date');
    if (filterDate) {
      filterDate.addEventListener('change', () => {
        NotificationState.page = 1;
        this.load();
      });
    }

    const newBtn = $id('new-announcement-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => NotificationComposer.open());
    }
  },

  /**
   * Build filter query string
   * @returns {string} Query string
   */
  buildFilterQuery: function() {
    const qs = [];
    qs.push('page=' + NotificationState.page);
    qs.push('page_size=' + NotificationState.pageSize);

    const searchInput = $id('nt-search');
    if (searchInput) {
      const search = searchInput.value.trim();
      if (search) qs.push('search=' + encodeURIComponent(search));
    }

    const filterType = $id('filter-type');
    if (filterType && filterType.value !== 'All') {
      qs.push('notification_type=' + encodeURIComponent(filterType.value));
    }

    const filterBarangay = $id('filter-barangay');
    if (filterBarangay && filterBarangay.value !== 'All') {
      qs.push('barangay=' + encodeURIComponent(filterBarangay.value));
    }

    const filterRoute = $id('filter-route');
    if (filterRoute && filterRoute.value !== 'All') {
      qs.push('route=' + encodeURIComponent(filterRoute.value));
    }

    const filterDate = $id('filter-date');
    if (filterDate && filterDate.value) {
      qs.push('collection_date=' + encodeURIComponent(filterDate.value));
    }

    return qs.join('&');
  },

  /**
   * Load notification history
   */
  async load() {
    const historyBody = $id('history-body');
    if (historyBody) {
      historyBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--nt-text-muted)">Loading notifications...</td></tr>';
    }

    try {
      const historyData = await NotificationService.fetchHistory({
        page: NotificationState.page,
        page_size: NotificationState.pageSize,
        search: $id('nt-search')?.value.trim(),
        notification_type: $id('filter-type')?.value,
        barangay: $id('filter-barangay')?.value,
        route: $id('filter-route')?.value,
        collection_date: $id('filter-date')?.value
      });

      if (historyData) {
        NotificationState.notifications = historyData.notifications || [];
        NotificationState.total = historyData.total || 0;
        this.render();
      }
    } catch (error) {
      console.error('Notification history load error:', error);
      if (historyBody) {
        historyBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--nt-text-muted)">Connection error.</td></tr>';
      }
    }
  },

  /**
   * Render notification history table
   */
  render: function() {
    const historyCount = $id('history-count');
    if (historyCount) {
      historyCount.textContent = NotificationState.total + ' notification' + (NotificationState.total === 1 ? '' : 's');
    }

    const historyBody = $id('history-body');
    if (!historyBody) return;

    if (NotificationState.notifications.length === 0) {
      historyBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--nt-text-muted)">No notifications match your filters.</td></tr>';
      this.renderPagination();
      return;
    }

    historyBody.innerHTML = NotificationState.notifications.map(notification => {
      const isSelected = NotificationState.selected && NotificationState.selected.id === notification.id;
      const typeBadgeInfo = NotificationService.getTypeBadgeInfo(notification.notification_type);
      const statusBadgeInfo = NotificationService.getStatusBadgeInfo(notification.status);
      
      const reason = notification.reason ? escapeHtml(notification.reason) : '<span class="nt-cell-muted">-</span>';
      const route = notification.route_name ? escapeHtml(notification.route_name) : '<span class="nt-cell-muted">-</span>';
      const colDate = notification.collection_date ? escapeHtml(notification.collection_date) : '<span class="nt-cell-muted">-</span>';
      const createdBy = notification.created_by_name ? escapeHtml(notification.created_by_name) : '<span class="nt-cell-muted">Auto</span>';
      const created = notification.created_at ? new Date(notification.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

      return '<tr class="' + (isSelected ? 'selected' : '') + '" data-id="' + notification.id + '" title="' + escapeHtml(created) + '">' +
        '<td>' + this._renderTypeBadge(typeBadgeInfo) + '</td>' +
        '<td class="nt-cell-route">' + route + '</td>' +
        '<td>' + this._renderBarangayList(notification) + '</td>' +
        '<td>' + reason + '</td>' +
        '<td>' + this._renderStatusBadge(statusBadgeInfo) + '</td>' +
        '<td>' + colDate + '</td>' +
        '<td>' + createdBy + '</td>' +
        '<td><button class="nt-delete-btn" data-delete-id="' + notification.id + '" title="Delete notification">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
          'Delete</button></td>' +
        '</tr>';
    }).join('');

    this._attachRowListeners();
    this.renderPagination();
  },

  /**
   * Render type badge
   * @param {object} badgeInfo - Badge information
   * @returns {string} Badge HTML
   */
  _renderTypeBadge: function(badgeInfo) {
    return '<span class="nt-type-badge ' + badgeInfo.className + '">' + escapeHtml(badgeInfo.label) + '</span>';
  },

  /**
   * Render status badge
   * @param {object} badgeInfo - Badge information
   * @returns {string} Badge HTML
   */
  _renderStatusBadge: function(badgeInfo) {
    return '<span class="nt-status-badge ' + badgeInfo.className + '">' + escapeHtml(badgeInfo.label) + '</span>';
  },

  /**
   * Render barangay list
   * @param {object} notification - Notification object
   * @returns {string} Barangay list HTML
   */
  _renderBarangayList: function(notification) {
    const list = NotificationService.parseAffectedBarangays(notification.affected_barangays);
    if (list.length === 0) return '-';
    return list.join(', ');
  },

  /**
   * Attach event listeners to table rows
   */
  _attachRowListeners: function() {
    const historyBody = $id('history-body');
    if (!historyBody) return;

    $all('#history-body tr').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.nt-delete-btn')) return;
        const id = parseInt(tr.dataset.id);
        const notification = NotificationState.notifications.find(n => n.id === id);
        if (notification) NotificationDetails.select(notification);
      });
    });

    $all('#history-body .nt-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.deleteId);
        this.deleteNotification(id);
      });
    });
  },

  /**
   * Render pagination controls
   */
  renderPagination: function() {
    const paginationEl = $id('history-pagination');
    if (!paginationEl) return;

    const totalPages = Math.max(1, Math.ceil(NotificationState.total / NotificationState.pageSize));
    let btns = '';

    btns += '<button class="nt-page-btn" data-page="' + (NotificationState.page - 1) + '" ' + (NotificationState.page <= 1 ? 'disabled' : '') + '>&#8592;</button>';

    const start = Math.max(1, NotificationState.page - 2);
    const end = Math.min(totalPages, NotificationState.page + 2);
    for (let p = start; p <= end; p++) {
      btns += '<button class="nt-page-btn ' + (p === NotificationState.page ? 'active' : '') + '" data-page="' + p + '">' + p + '</button>';
    }

    btns += '<button class="nt-page-btn" data-page="' + (NotificationState.page + 1) + '" ' + (NotificationState.page >= totalPages ? 'disabled' : '') + '>&#8594;</button>';

    paginationEl.innerHTML =
      '<span class="nt-pagination-info">Page ' + NotificationState.page + ' of ' + totalPages + '</span>' +
      '<span class="nt-pagination-btns">' + btns + '</span>';

    // Attach pagination listeners
    $all('.nt-page-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const newPage = parseInt(btn.dataset.page);
        if (!isNaN(newPage)) {
          NotificationState.page = newPage;
          this.load();
        }
      });
    });
  },

  /**
   * Delete a notification
   * @param {number} notificationId - Notification ID
   */
  async deleteNotification(notificationId) {
    if (!confirm('Delete this notification?')) return;

    try {
      await NotificationService.deleteNotification(notificationId);
      showToast('Notification deleted.', 'success');
      
      // Clear selected if it was the deleted one
      if (NotificationState.selected && NotificationState.selected.id === notificationId) {
        NotificationState.selected = null;
        NotificationDetails.clear();
      }
      
      this.load();
      NotificationSummary.load();
    } catch (error) {
      console.error('Delete notification error:', error);
      showToast('Failed to delete notification.', 'error');
    }
  }
};
