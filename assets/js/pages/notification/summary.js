/**
 * WISE System - Notification Summary Component
 * Summary statistics cards for notification center.
 */

const NotificationSummary = {
  /**
   * Load and display summary statistics
   */
  async load() {
    try {
      const summaryData = await NotificationService.fetchSummary();
      if (summaryData) {
        this.render(summaryData);
      }
    } catch (error) {
      console.error('Notification summary load error:', error);
    }
  },

  /**
   * Render summary statistics to DOM
   * @param {object} summaryData - Summary data from API
   */
  render: function(summaryData) {
    const todayEl = $id('summary-today');
    if (todayEl) todayEl.textContent = summaryData.today || 0;

    const delayedEl = $id('summary-delayed');
    if (delayedEl) delayedEl.textContent = summaryData.delayed_routes || 0;

    const cancelledEl = $id('summary-cancelled');
    if (cancelledEl) cancelledEl.textContent = summaryData.cancelled_routes || 0;

    const manualEl = $id('summary-manual');
    if (manualEl) manualEl.textContent = summaryData.manual_announcements || 0;
  }
};
