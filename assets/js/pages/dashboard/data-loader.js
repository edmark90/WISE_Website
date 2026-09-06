/**
 * WISE System - Dashboard Data Loader
 * Handles data fetching for dashboard components.
 */

const DashboardDataLoader = {
  /**
   * Load main dashboard data (activity feed, collection rail, notifications)
   */
  async loadDashboard() {
    // Activity Feed
    try {
      const activityData = await DashboardService.fetchActivity();
      if (activityData && activityData.activities) {
        DashboardState.rawActivities = activityData.activities;
        DashboardActivityFeed.renderFilteredActivities();
      } else {
        DashboardActivityFeed.renderActivities([]);
      }
    } catch (error) {
      console.error('Activity load error:', error);
      DashboardActivityFeed.renderActivities([]);
    }

    // Collection Rail
    try {
      const railData = await DashboardService.fetchCollectionRail();
      if (railData && railData.days) {
        DashboardRail.render(railData);
      } else {
        DashboardRail.render({ days: [] });
      }
    } catch (error) {
      console.error('Rail load error:', error);
      DashboardRail.render({ days: [] });
    }

    // Notifications Summary
    try {
      const notifData = await NotificationService.fetchSummary();
      if (notifData) {
        DashboardNotifications.renderSummary(notifData);
      } else {
        DashboardNotifications.renderEmpty();
      }
    } catch (error) {
      console.error('Notification summary load error:', error);
      DashboardNotifications.renderEmpty();
    }
  },

  /**
   * Load monthly analytics data
   */
  async loadMonthly() {
    try {
      const monthlyData = await DashboardService.fetchMonthlyData(DashboardState.year, DashboardState.month);
      if (monthlyData) {
        DashboardState.monthlyData = monthlyData;
        DashboardCharts.renderLineChart(monthlyData);
        DashboardCharts.renderDonutChart(monthlyData);
        DashboardStats.renderSummaryStats(monthlyData);
      }
    } catch (error) {
      console.error('Monthly data load error:', error);
    }
  }
};
