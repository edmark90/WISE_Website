/**
 * WISE System - Dashboard Activity Feed Component
 * Activity feed rendering and filtering.
 */

const DashboardActivityFeed = {
  /**
   * Render filtered activities based on current filter
   */
  renderFilteredActivities: function() {
    const processedActivities = DashboardService.processActivityFeed(
      { activities: DashboardState.rawActivities },
      DashboardState.activityFilter
    );
    
    this.renderActivities(processedActivities);
  },

  /**
   * Render activities to DOM
   * @param {Array} activities - Processed activity data
   */
  renderActivities: function(activities) {
    const container = $id('db-activity-body');
    if (!container) return;

    if (activities.length === 0) {
      container.innerHTML = '<div class="db-activity-empty">No recent activity</div>';
      return;
    }

    const html = activities.map(activity => `
      <div class="db-activity-item">
        <div class="db-activity-icon">${this._getActivityIcon(activity.type)}</div>
        <div class="db-activity-content">
          <div class="db-activity-message">${escapeHtml(activity.message)}</div>
          <div class="db-activity-meta">
            <span>${activity.timestamp}</span>
            ${activity.barangay ? `<span>· ${escapeHtml(activity.barangay)}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    container.innerHTML = html;
  },

  /**
   * Get icon for activity type
   * @param {string} type - Activity type
   * @returns {string} Icon emoji
   */
  _getActivityIcon: function(type) {
    const icons = {
      'waste_classified': '♻️',
      'collection_complete': '🚛',
      'user_created': '👤',
      'notification_sent': '📢'
    };
    return icons[type] || '📌';
  }
};
