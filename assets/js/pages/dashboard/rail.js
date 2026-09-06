/**
 * WISE System - Dashboard Collection Rail Component
 * 7-day operations rail rendering.
 */

const DashboardRail = {
  /**
   * Render collection rail data
   * @param {object} railData - Collection rail data from API
   */
  render: function(railData) {
    const container = $id('db-rail-body');
    if (!container) return;

    if (!railData || !railData.days) {
      container.innerHTML = '<div class="db-rail-empty">No collection data available</div>';
      return;
    }

    const html = railData.days.map(day => `
      <div class="db-rail-day ${day.is_today ? 'today' : ''} ${day.is_past ? 'past' : ''}">
        <div class="db-rail-date">${this._formatDate(day.date)}</div>
        <div class="db-rail-status ${this._getStatusClass(day.status)}">
          ${this._getStatusIcon(day.status)}
        </div>
        <div class="db-rail-count">${day.completed_count}/${day.total_count}</div>
      </div>
    `).join('');

    container.innerHTML = html;
  },

  /**
   * Format date for rail display
   * @param {string} dateStr - Date string
   * @returns {string} Formatted date
   */
  _formatDate: function(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  /**
   * Get CSS class for status
   * @param {string} status - Collection status
   * @returns {string} CSS class
   */
  _getStatusClass: function(status) {
    const classes = {
      'completed': 'status-completed',
      'in_progress': 'status-progress',
      'pending': 'status-pending',
      'delayed': 'status-delayed',
      'cancelled': 'status-cancelled'
    };
    return classes[status] || 'status-pending';
  },

  /**
   * Get icon for status
   * @param {string} status - Collection status
   * @returns {string} Status icon
   */
  _getStatusIcon: function(status) {
    const icons = {
      'completed': '✓',
      'in_progress': '⟳',
      'pending': '○',
      'delayed': '⚠',
      'cancelled': '✕'
    };
    return icons[status] || '○';
  }
};
