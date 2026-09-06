/**
 * WISE System - Dashboard Stats Component
 * Summary statistics rendering for monthly data.
 */

const DashboardStats = {
  /**
   * Render summary statistics from monthly data
   * @param {object} monthlyData - Monthly data from API
   */
  renderSummaryStats: function(monthlyData) {
    const stats = DashboardService.calculateSummaryStats(monthlyData);
    this._renderTotalRecords(stats.total);
    this._renderCategoryBreakdown(stats.byCategory);
    this._renderAverageDaily(stats.averageDaily);
    this._renderTrend(stats.trend);
  },

  /**
   * Render total records
   * @param {number} total - Total records
   */
  _renderTotalRecords: function(total) {
    const el = $id('db-total-records');
    if (el) el.textContent = total.toLocaleString();
  },

  /**
   * Render category breakdown
   * @param {object} byCategory - Category counts
   */
  _renderCategoryBreakdown: function(byCategory) {
    const categories = ['Biodegradable', 'Recyclable', 'Electronic', 'Hazardous', 'Residual'];
    const colors = {
      Biodegradable: '#10b981',
      Recyclable: '#3b82f6',
      Electronic: '#8b5cf6',
      Hazardous: '#ef4444',
      Residual: '#64748b'
    };

    categories.forEach(category => {
      const el = $id(`db-stat-${category.toLowerCase()}`);
      if (el) {
        el.textContent = byCategory[category].toLocaleString();
        el.style.color = colors[category];
      }
    });
  },

  /**
   * Render average daily records
   * @param {number} averageDaily - Average daily count
   */
  _renderAverageDaily: function(averageDaily) {
    const el = $id('db-avg-daily');
    if (el) el.textContent = averageDaily.toLocaleString();
  },

  /**
   * Render trend indicator
   * @param {string} trend - Trend direction ('up', 'down', 'stable')
   */
  _renderTrend: function(trend) {
    const el = $id('db-trend');
    if (!el) return;

    const trendIcons = {
      'up': '📈',
      'down': '📉',
      'stable': '➡️'
    };

    const trendClasses = {
      'up': 'trend-up',
      'down': 'trend-down',
      'stable': 'trend-stable'
    };

    el.textContent = trendIcons[trend] || '➡️';
    el.className = 'trend-indicator ' + (trendClasses[trend] || 'trend-stable');
  }
};
