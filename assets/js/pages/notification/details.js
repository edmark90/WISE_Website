/**
 * WISE System - Notification Details Component
 * Display detailed information about selected notifications.
 */

const NotificationDetails = {
  /**
   * Select and display notification details
   * @param {object} notification - Notification object
   */
  select: function(notification) {
    NotificationState.selected = notification;
    this.render(notification);
  },

  /**
   * Clear selected notification details
   */
  clear: function() {
    NotificationState.selected = null;
    
    const detailEmpty = $id('detail-empty');
    const detailContent = $id('detail-content');
    
    if (detailEmpty) detailEmpty.style.display = 'block';
    if (detailContent) detailContent.style.display = 'none';
  },

  /**
   * Render notification details
   * @param {object} notification - Notification object
   */
  render: function(notification) {
    const detailEmpty = $id('detail-empty');
    const detailContent = $id('detail-content');
    
    if (!detailEmpty || !detailContent) return;

    detailEmpty.style.display = 'none';
    detailContent.style.display = 'block';

    const typeBadgeInfo = NotificationService.getTypeBadgeInfo(notification.notification_type);
    const statusBadgeInfo = NotificationService.getStatusBadgeInfo(notification.status);
    const priorityBadgeInfo = NotificationService.getPriorityBadgeInfo(notification.priority);

    const detailsHtml = `
      <div class="nt-detail-header">
        <div class="nt-detail-type">${this._renderTypeBadge(typeBadgeInfo)}</div>
        <div class="nt-detail-status">${this._renderStatusBadge(statusBadgeInfo)}</div>
        <div class="nt-detail-priority">${this._renderPriorityBadge(priorityBadgeInfo)}</div>
      </div>
      
      <div class="nt-detail-title">${escapeHtml(notification.title || 'No Title')}</div>
      
      <div class="nt-detail-body">
        <div class="nt-detail-message">${escapeHtml(notification.message || 'No message')}</div>
      </div>
      
      <div class="nt-detail-meta">
        <div class="nt-detail-meta-item">
          <span class="nt-detail-label">Created:</span>
          <span class="nt-detail-value">${NotificationService.formatTimestamp(notification.created_at)}</span>
        </div>
        
        ${notification.created_by_name ? `
          <div class="nt-detail-meta-item">
            <span class="nt-detail-label">Created By:</span>
            <span class="nt-detail-value">${escapeHtml(notification.created_by_name)}</span>
          </div>
        ` : ''}
        
        ${notification.collection_date ? `
          <div class="nt-detail-meta-item">
            <span class="nt-detail-label">Collection Date:</span>
            <span class="nt-detail-value">${escapeHtml(notification.collection_date)}</span>
          </div>
        ` : ''}
        
        ${notification.route_name ? `
          <div class="nt-detail-meta-item">
            <span class="nt-detail-label">Route:</span>
            <span class="nt-detail-value">${escapeHtml(notification.route_name)}</span>
          </div>
        ` : ''}
        
        ${notification.affected_barangays ? `
          <div class="nt-detail-meta-item">
            <span class="nt-detail-label">Affected Barangays:</span>
            <span class="nt-detail-value">${this._renderBarangayList(notification)}</span>
          </div>
        ` : ''}
        
        ${notification.reason ? `
          <div class="nt-detail-meta-item">
            <span class="nt-detail-label">Reason:</span>
            <span class="nt-detail-value">${escapeHtml(notification.reason)}</span>
          </div>
        ` : ''}
      </div>
    `;

    detailContent.innerHTML = detailsHtml;
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
   * Render priority badge
   * @param {object} badgeInfo - Badge information
   * @returns {string} Badge HTML
   */
  _renderPriorityBadge: function(badgeInfo) {
    return '<span class="nt-priority-badge ' + badgeInfo.className + '">' + escapeHtml(badgeInfo.label) + '</span>';
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
  }
};
