/**
 * WISE System - Dashboard Notifications Summary Component
 * Renders notification summary stats into the dashboard notifications card.
 */

const DashboardNotifications = {
  /**
   * Render notification summary data
   * @param {object} data - Summary data from /api/notifications/summary
   */
  renderSummary: function(data) {
    const container = $id('db-notif-body');
    if (!container) return;

    const items = [
      { label: "Today's Alerts", value: data.today || 0, icon: '🔔', color: '#3b82f6' },
      { label: 'Delayed Routes', value: data.delayed_routes || 0, icon: '⚠️', color: '#f59e0b' },
      { label: 'Cancelled Routes', value: data.cancelled_routes || 0, icon: '🚫', color: '#ef4444' },
      { label: 'Manual Announcements', value: data.manual_announcements || 0, icon: '📢', color: '#8b5cf6' },
    ];

    container.innerHTML = items.map(item => `
      <div class="db-notif-stat-row">
        <div class="db-notif-stat-icon" style="background:${item.color}15;color:${item.color}">
          <span>${item.icon}</span>
        </div>
        <div class="db-notif-stat-label">${escapeHtml(item.label)}</div>
        <div class="db-notif-stat-value" style="color:${item.color}">${item.value.toLocaleString()}</div>
      </div>
    `).join('');
  },

  /**
   * Render empty state when data is unavailable
   */
  renderEmpty: function() {
    const container = $id('db-notif-body');
    if (!container) return;

    container.innerHTML = `
      <div class="db-notif-stat-row">
        <div class="db-notif-stat-icon" style="background:#3b82f615;color:#3b82f6"><span>🔔</span></div>
        <div class="db-notif-stat-label">Today's Alerts</div>
        <div class="db-notif-stat-value" style="color:#3b82f6">--</div>
      </div>
      <div class="db-notif-stat-row">
        <div class="db-notif-stat-icon" style="background:#f59e0b15;color:#f59e0b"><span>⚠️</span></div>
        <div class="db-notif-stat-label">Delayed Routes</div>
        <div class="db-notif-stat-value" style="color:#f59e0b">--</div>
      </div>
      <div class="db-notif-stat-row">
        <div class="db-notif-stat-icon" style="background:#ef444415;color:#ef4444"><span>🚫</span></div>
        <div class="db-notif-stat-label">Cancelled Routes</div>
        <div class="db-notif-stat-value" style="color:#ef4444">--</div>
      </div>
      <div class="db-notif-stat-row">
        <div class="db-notif-stat-icon" style="background:#8b5cf615;color:#8b5cf6"><span>📢</span></div>
        <div class="db-notif-stat-label">Manual Announcements</div>
        <div class="db-notif-stat-value" style="color:#8b5cf6">--</div>
      </div>
    `;
  }
};
