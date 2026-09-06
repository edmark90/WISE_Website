/**
 * WISE System - Error Handler
 * Centralized error handling with logging, user notifications, and recovery strategies.
 */

const ErrorHandler = {
  /**
   * Handle API errors with appropriate user feedback
   * @param {Error} error - Error object
   * @param {object} context - Additional context about the error
   * @param {string} context.operation - Operation that failed
   * @param {string} context.component - Component where error occurred
   */
  handleApiError: function(error, context = {}) {
    console.error(`[API Error] ${context.operation || 'Unknown operation'}:`, error);

    let userMessage = 'An error occurred. Please try again.';
    
    // Handle specific error types
    if (error.message) {
      if (error.message.includes('Network') || error.message.includes('fetch')) {
        userMessage = 'Connection error. Please check your internet connection.';
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        userMessage = 'Session expired. Please log in again.';
        // Trigger logout on auth errors
        if (typeof logout === 'function') {
          logout();
        }
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        userMessage = 'You do not have permission to perform this action.';
      } else if (error.message.includes('404') || error.message.includes('Not Found')) {
        userMessage = 'The requested resource was not found.';
      } else if (error.message.includes('500') || error.message.includes('Server')) {
        userMessage = 'Server error. Please try again later.';
      }
    }

    // Show user notification
    if (typeof showToast === 'function') {
      showToast(userMessage, 'error');
    }

    // Log additional context
    if (context.component) {
      console.error(`[Component] ${context.component}`);
    }
  },

  /**
   * Handle form validation errors
   * @param {object} errors - Object containing field errors
   * @param {object} fieldMap - Map of field IDs to display names
   */
  handleFormErrors: function(errors, fieldMap = {}) {
    if (!errors || typeof errors !== 'object') {
      showToast('Please fix the errors in the form.', 'error');
      return;
    }

    // Focus on first error field
    for (const fieldId in errors) {
      const fieldName = fieldMap[fieldId] || fieldId;
      const errorMessage = errors[fieldId];
      
      if (typeof showToast === 'function') {
        showToast(`${fieldName}: ${errorMessage}`, 'error');
      }

      // Try to focus on the field
      const field = document.getElementById(fieldId);
      if (field) {
        field.focus();
        break;
      }
    }
  },

  /**
   * Handle unexpected errors with graceful degradation
   * @param {Error} error - Error object
   * @param {object} options - Handling options
   * @param {boolean} options.notify - Whether to notify user (default: true)
   * @param {string} options.fallbackMessage - Fallback message for user
   * @param {Function} options.recovery - Recovery function to execute
   */
  handleUnexpectedError: function(error, options = {}) {
    const {
      notify = true,
      fallbackMessage = 'Something went wrong. Please try again.',
      recovery = null
    } = options;

    console.error('[Unexpected Error]:', error);

    if (notify && typeof showToast === 'function') {
      showToast(fallbackMessage, 'error');
    }

    // Execute recovery function if provided
    if (typeof recovery === 'function') {
      try {
        recovery();
      } catch (recoveryError) {
        console.error('[Recovery Error]:', recoveryError);
      }
    }
  },

  /**
   * Log errors for debugging (in development mode)
   * @param {Error} error - Error object
   * @param {string} category - Error category
   */
  log: function(error, category = 'GENERAL') {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      category,
      message: error.message,
      stack: error.stack,
      url: window.location.href
    };

    console.error(`[${category}] ${timestamp}:`, error);

    // In development, you might want to send this to a logging service
    if (CONFIG && CONFIG.API_BASE_URL && !CONFIG.API_BASE_URL.includes('localhost')) {
      // Example: Send to error logging service
      // this.sendToLoggingService(logEntry);
    }
  },

  /**
   * Create a wrapped version of a function that handles errors
   * @param {Function} fn - Function to wrap
   * @param {object} options - Error handling options
   * @returns {Function} Wrapped function
   */
  wrap: function(fn, options = {}) {
    return function(...args) {
      try {
        return fn.apply(this, args);
      } catch (error) {
        ErrorHandler.handleUnexpectedError(error, options);
        return null;
      }
    };
  },

  /**
   * Create a wrapped version of an async function that handles errors
   * @param {Function} fn - Async function to wrap
   * @param {object} options - Error handling options
   * @returns {Function} Wrapped async function
   */
  wrapAsync: function(fn, options = {}) {
    return async function(...args) {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        ErrorHandler.handleUnexpectedError(error, options);
        return null;
      }
    };
  }
};
