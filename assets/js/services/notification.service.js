/**
 * WISE System - Notification Service
 * Handles notification management, history, and announcement creation.
 */

const NotificationService = {
  /**
   * Fetch notification summary statistics
   * @returns {Promise<object|null>} Summary data or null on error
   */
  async fetchSummary() {
    try {
      const res = await apiRequest('/api/notifications/summary');
      if (!res || !res.ok) return null;
      return await res.json();
    } catch (error) {
      console.error('Notification summary fetch error:', error);
      return null;
    }
  },

  /**
   * Fetch notification history with pagination
   * @param {object} params - Query parameters
   * @param {number} params.page - Page number
   * @param {number} params.page_size - Page size
   * @param {string} params.search - Search query
   * @param {string} params.notification_type - Filter by type
   * @param {string} params.barangay - Filter by barangay
   * @param {string} params.route - Filter by route
   * @param {string} params.collection_date - Filter by date
   * @returns {Promise<object|null>} Paginated notifications or null on error
   */
  async fetchHistory(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        page: params.page || 1,
        page_size: params.page_size || 12
      });

      if (params.search) queryParams.set('search', params.search);
      if (params.notification_type) queryParams.set('notification_type', params.notification_type);
      if (params.barangay) queryParams.set('barangay', params.barangay);
      if (params.route) queryParams.set('route', params.route);
      if (params.collection_date) queryParams.set('collection_date', params.collection_date);

      const res = await apiRequest('/api/notifications/?' + queryParams.toString());
      if (!res || !res.ok) return null;
      return await res.json();
    } catch (error) {
      console.error('Notification history fetch error:', error);
      return null;
    }
  },

  /**
   * Create a new general announcement
   * @param {object} announcementData - Announcement data
   * @param {string} announcementData.title - Announcement title
   * @param {string} announcementData.message - Announcement message
   * @param {string} announcementData.priority - Priority level (Normal, Important, Emergency)
   * @param {Array<string>} announcementData.affected_barangays - List of affected barangays
   * @returns {Promise<object|null>} Created announcement or null on error
   */
  async createAnnouncement(announcementData) {
    try {
      const res = await apiRequest('/api/notifications/', {
        method: 'POST',
        body: JSON.stringify({
          notification_type: 'General Announcement',
          title: announcementData.title,
          message: announcementData.message,
          priority: announcementData.priority || 'Normal',
          affected_barangays: announcementData.affected_barangays || [],
          status: 'Sent'
        })
      });

      if (!res || !res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Failed to create announcement');
      }

      return await res.json();
    } catch (error) {
      console.error('Create announcement error:', error);
      throw error;
    }
  },

  /**
   * Delete a notification
   * @param {number} notificationId - Notification ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteNotification(notificationId) {
    try {
      const res = await apiRequest(`/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });

      if (!res || !res.ok) {
        throw new Error('Failed to delete notification');
      }

      return true;
    } catch (error) {
      console.error('Delete notification error:', error);
      throw error;
    }
  },

  /**
   * Get notification type badge styling
   * @param {string} type - Notification type
   * @returns {object} Badge styling information
   */
  getTypeBadgeInfo(type) {
    const typeClasses = {
      'Upcoming Collection': 'nt-type-updated',
      'Garbage Truck Arriving': 'nt-type-arriving',
      'Garbage Truck Arrived': 'nt-type-arrived',
      'Collection Completed': 'nt-type-completed',
      'Collection Rescheduled': 'nt-type-rescheduled',
      'Delayed Collection': 'nt-type-delayed',
      'Cancelled Collection': 'nt-type-cancelled',
      'General Announcement': 'nt-type-manual'
    };

    return {
      className: typeClasses[type] || 'nt-type-auto',
      label: type || 'General Announcement'
    };
  },

  /**
   * Get status badge styling
   * @param {string} status - Notification status
   * @returns {object} Badge styling information
   */
  getStatusBadgeInfo(status) {
    const statusClasses = {
      'Sent': 'nt-status-sent',
      'Draft': 'nt-status-draft',
      'Failed': 'nt-status-failed'
    };

    return {
      className: statusClasses[status] || 'nt-status-draft',
      label: status || 'Draft'
    };
  },

  /**
   * Get priority badge styling
   * @param {string} priority - Priority level
   * @returns {object} Badge styling information
   */
  getPriorityBadgeInfo(priority) {
    const priorityClasses = {
      'Emergency': 'nt-priority-emergency',
      'Important': 'nt-priority-important',
      'Normal': 'nt-priority-normal'
    };

    return {
      className: priorityClasses[priority] || 'nt-priority-normal',
      label: priority || 'Normal'
    };
  },

  /**
   * Parse affected barangays from JSON string
   * @param {string} jsonString - JSON string of barangays
   * @returns {Array<string>} Parsed barangay array
   */
  parseAffectedBarangays(jsonString) {
    if (!jsonString) return [];
    try {
      const arr = JSON.parse(jsonString);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  },

  /**
   * Format notification timestamp for display
   * @param {string} isoString - ISO timestamp
   * @returns {string} Formatted timestamp
   */
  formatTimestamp(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }
};
