/**
 * WISE System - Dashboard Service
 * Handles dashboard data fetching, analytics processing, and activity feed management.
 */

const DashboardService = {
  /**
   * Fetch dashboard activity data
   * @returns {Promise<object|null>} Activity data or null on error
   */
  async fetchActivity() {
    try {
      const res = await apiRequest('/api/dashboard/activity');
      if (!res || !res.ok) return null;
      return await res.json();
    } catch (error) {
      console.error('Dashboard activity fetch error:', error);
      return null;
    }
  },

  /**
   * Fetch monthly analytics data
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {Promise<object|null>} Monthly data or null on error
   */
  async fetchMonthlyData(year, month) {
    try {
      const params = new URLSearchParams({ year, month });
      const res = await apiRequest('/api/dashboard/monthly?' + params.toString());
      if (!res || !res.ok) return null;
      return await res.json();
    } catch (error) {
      console.error('Dashboard monthly data fetch error:', error);
      return null;
    }
  },

  /**
   * Fetch collection rail data (7-day operations)
   * @returns {Promise<object|null>} Collection rail data or null on error
   */
  async fetchCollectionRail() {
    try {
      const res = await apiRequest('/api/dashboard/collection-rail');
      if (!res || !res.ok) return null;
      return await res.json();
    } catch (error) {
      console.error('Collection rail fetch error:', error);
      return null;
    }
  },

  /**
   * Process monthly data for charts
   * @param {object} monthlyData - Raw monthly data
   * @param {string} mode - Chart mode ('category' or 'total')
   * @returns {object} Processed chart data
   */
  processChartData(monthlyData, mode = 'category') {
    if (!monthlyData || !monthlyData.daily_records) {
      return { labels: [], datasets: [] };
    }

    const dailyRecords = monthlyData.daily_records;
    const labels = dailyRecords.map(record => {
      const date = new Date(record.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    if (mode === 'total') {
      // Total volume mode
      const totals = dailyRecords.map(record => record.total_count || 0);
      return {
        labels,
        datasets: [{
          label: 'Total Classifications',
          data: totals,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true
        }]
      };
    } else {
      // Category breakdown mode
      const categories = ['Biodegradable', 'Recyclable', 'Electronic', 'Hazardous', 'Residual'];
      const colors = {
        Biodegradable: '#10b981',
        Recyclable: '#3b82f6',
        Electronic: '#8b5cf6',
        Hazardous: '#ef4444',
        Residual: '#64748b'
      };

      const datasets = categories.map(category => ({
        label: category,
        data: dailyRecords.map(record => record[category.toLowerCase()] || 0),
        borderColor: colors[category],
        backgroundColor: colors[category] + '20', // Add transparency
        fill: false
      }));

      return { labels, datasets };
    }
  },

  /**
   * Process activity feed data
   * @param {object} activityData - Raw activity data
   * @param {string} filter - Activity filter ('all', 'complete', 'classify')
   * @returns {Array} Filtered and formatted activities
   */
  processActivityFeed(activityData, filter = 'all') {
    if (!activityData || !activityData.activities) {
      return [];
    }

    let activities = [...activityData.activities];

    // Apply filter
    if (filter === 'complete') {
      activities = activities.filter(a => a.type === 'collection_complete');
    } else if (filter === 'classify') {
      activities = activities.filter(a => a.type === 'waste_classified');
    }

    // Format activities for display
    return activities.map(activity => ({
      id: activity.id,
      type: activity.type,
      message: activity.message,
      timestamp: this._formatActivityTime(activity.created_at),
      barangay: activity.barangay,
      metadata: activity.metadata || {}
    }));
  },

  /**
   * Format activity timestamp for display
   * @param {string} isoString - ISO timestamp
   * @returns {string} Formatted time
   */
  _formatActivityTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  /**
   * Calculate summary statistics from monthly data
   * @param {object} monthlyData - Raw monthly data
   * @returns {object} Summary statistics
   */
  calculateSummaryStats(monthlyData) {
    if (!monthlyData || !monthlyData.daily_records) {
      return {
        total: 0,
        byCategory: {},
        averageDaily: 0,
        trend: null
      };
    }

    const dailyRecords = monthlyData.daily_records;
    const total = dailyRecords.reduce((sum, day) => sum + (day.total_count || 0), 0);
    const averageDaily = total / dailyRecords.length;

    const byCategory = {
      Biodegradable: 0,
      Recyclable: 0,
      Electronic: 0,
      Hazardous: 0,
      Residual: 0
    };

    dailyRecords.forEach(day => {
      Object.keys(byCategory).forEach(category => {
        byCategory[category] += day[category.toLowerCase()] || 0;
      });
    });

    // Calculate simple trend (compare first half vs second half)
    const midPoint = Math.floor(dailyRecords.length / 2);
    const firstHalf = dailyRecords.slice(0, midPoint).reduce((sum, day) => sum + (day.total_count || 0), 0);
    const secondHalf = dailyRecords.slice(midPoint).reduce((sum, day) => sum + (day.total_count || 0), 0);
    const trend = secondHalf > firstHalf ? 'up' : (secondHalf < firstHalf ? 'down' : 'stable');

    return {
      total,
      byCategory,
      averageDaily: Math.round(averageDaily),
      trend
    };
  }
};
