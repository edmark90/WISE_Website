/**
 * WISE System - Notification Composer Component
 * Manual announcement creation and editing.
 */

const NotificationComposer = {
  /**
   * Open announcement composer modal
   */
  open: function() {
    const overlay = $id('announcement-modal-overlay');
    if (!overlay) return;

    // Reset form fields
    const titleInput = $id('a-title');
    if (titleInput) titleInput.value = '';

    const messageInput = $id('a-message');
    if (messageInput) messageInput.value = '';

    const categorySelect = $id('a-category');
    if (categorySelect) categorySelect.value = 'General Announcement';

    const prioritySelect = $id('a-priority');
    if (prioritySelect) prioritySelect.value = 'Normal';

    overlay.classList.add('active');
  },

  /**
   * Close announcement composer modal
   */
  close: function() {
    const overlay = $id('announcement-modal-overlay');
    if (overlay) overlay.classList.remove('active');
  },

  /**
   * Load barangay options for multi-select
   */
  _loadBarangayOptions: function() {
    // Note: The current HTML doesn't have a barangay multi-select
    // This is a placeholder for future enhancement
    // For now, announcements are sent to all users
  },

  /**
   * Get selected barangays from multi-select
   * @returns {Array<string>} Selected barangays
   */
  getSelectedBarangays: function() {
    // For now, return empty array (sends to all)
    // This can be enhanced when HTML is updated to include barangay selection
    return [];
  },

  /**
   * Validate announcement form
   * @returns {object} Validation result
   */
  validateForm: function() {
    const errors = {};

    const title = $id('a-title')?.value.trim();
    if (!title) {
      errors.title = 'Title is required';
    } else if (title.length < 5) {
      errors.title = 'Title must be at least 5 characters';
    }

    const message = $id('a-message')?.value.trim();
    if (!message) {
      errors.message = 'Message is required';
    } else if (message.length < 10) {
      errors.message = 'Message must be at least 10 characters';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },

  /**
   * Submit announcement form
   */
  async submit() {
    const validation = this.validateForm();
    if (!validation.isValid) {
      // Show first error
      const firstError = Object.values(validation.errors)[0];
      showToast(firstError, 'error');
      return;
    }

    const submitBtn = $id('a-send-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }

    try {
      const announcementData = {
        title: $id('a-title').value.trim(),
        message: $id('a-message').value.trim(),
        priority: $id('a-priority').value,
        affected_barangays: this.getSelectedBarangays()
      };

      await NotificationService.createAnnouncement(announcementData);
      
      showToast('Announcement sent successfully!', 'success');
      this.close();
      
      // Refresh notification history and summary
      NotificationHistory.load();
      NotificationSummary.load();
      
    } catch (error) {
      console.error('Submit announcement error:', error);
      showToast('Failed to send announcement: ' + error.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Notification';
      }
    }
  }
};

// Wire up composer controls
document.addEventListener('DOMContentLoaded', function() {
  const closeBtn = $id('announcement-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => NotificationComposer.close());
  }

  const cancelBtn = $id('a-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => NotificationComposer.close());
  }

  const overlay = $id('announcement-modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) NotificationComposer.close();
    });
  }

  const submitBtn = $id('a-send-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => NotificationComposer.submit());
  }

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const overlay = $id('announcement-modal-overlay');
      if (overlay && overlay.classList.contains('active')) {
        NotificationComposer.close();
      }
    }
  });
});
