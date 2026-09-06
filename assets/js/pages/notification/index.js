/**
 * WISE System - Notification Center Main Entry Point
 * Main initialization and orchestration for notification components.
 */

document.addEventListener('DOMContentLoaded', function () {
  if (!initBasePage()) return;
  initNotificationCenter();
});

// Notification state
const NotificationState = {
  page: 1,
  pageSize: 12,
  total: 0,
  notifications: [],
  selected: null,
  searchTimer: null,
  routes: []
};

// Initialize notification center
function initNotificationCenter() {
  NotificationHistory.wireControls();
  NotificationSummary.load();
  NotificationHistory.load();
}
