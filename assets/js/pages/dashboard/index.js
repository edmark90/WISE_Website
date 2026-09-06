/**
 * WISE System - Dashboard Main Entry Point
 * Main initialization and orchestration for dashboard components.
 */

document.addEventListener('DOMContentLoaded', function () {
  if (!initBasePage()) return;
  initDashboard();
});

// Dashboard state
const DashboardState = {
  nowMarkerPlaced: false,
  refreshTimer: null,
  monthInput: null,
  year: 2026,
  month: 8,
  monthlyData: null,
  lineChartMode: 'category',
  activeClassFilters: {},
  activityFilter: 'all',
  rawActivities: []
};

// Initialize dashboard
function initDashboard() {
  DashboardDateHelper.setPHDateLabels();

  // Default period = current PH month
  const now = DashboardDateHelper.phNow();
  DashboardState.year = now.getFullYear();
  DashboardState.month = now.getMonth() + 1;
  DashboardPeriodControls.renderPeriodLabel();

  DashboardPeriodControls.wireControls();
  DashboardDataLoader.loadDashboard();
  DashboardWeather.loadWeather();
  DashboardDataLoader.loadMonthly();

  // Auto-refresh live data every 60s
  DashboardState.refreshTimer = setInterval(function () {
    DashboardDataLoader.loadDashboard();
    DashboardDateHelper.touchUpdated();
  }, 60000);

  window.addEventListener('beforeunload', function () {
    if (DashboardState.refreshTimer) clearInterval(DashboardState.refreshTimer);
  });

  // Re-render chart on window resize with debounce
  let resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (DashboardState.monthlyData) {
        DashboardCharts.renderLineChart(DashboardState.monthlyData);
      }
    }, 120);
  });
}
