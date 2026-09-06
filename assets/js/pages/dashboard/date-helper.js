/**
 * WISE System - Dashboard Date Helper
 * Philippines timezone date handling for dashboard.
 */

const DashboardDateHelper = {
  /**
   * Current instant shifted to the Philippines (UTC+8)
   * @returns {Date} Current PH time
   */
  phNow: function() {
    return new Date(Date.now() + 8 * 3600 * 1000);
  },

  /**
   * Get today's date in YYYY-MM-DD format for Philippines
   * @returns {string} Today's date in YYYY-MM-DD format
   */
  phToday: function() {
    return this.phNow().toISOString().slice(0, 10);
  },

  /**
   * Fill the eyebrow/rail date + updated stamp from the PH clock
   */
  setPHDateLabels: function() {
    const iso = this.phToday().split('-');
    const d = new Date(iso[0], iso[1] - 1, iso[2]);
    const dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    
    const eyebrow = $id('db-eyebrow');
    if (eyebrow) eyebrow.innerHTML = 'Operations &middot; ' + escapeHtml(dateLabel);
    
    const railDate = $id('db-rail-date');
    if (railDate) railDate.textContent = dateLabel;
    
    this.touchUpdated();
  },

  /**
   * Update the "Updated" timestamp
   */
  touchUpdated: function() {
    const iso = this.phNow().toISOString().slice(0, 16);
    const el = $id('db-updated');
    if (el) el.textContent = 'Updated ' + formatTime12(iso.slice(11));
  }
};
