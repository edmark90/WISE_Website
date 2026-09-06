/**
 * WISE System - API Response Handler
 * Centralized API response handling with consistent error management,
 * loading states, and response processing.
 */

const ApiHandler = {
  /**
   * Handle API response with automatic error handling and loading states
   * @param {Promise<Response>} responsePromise - Promise resolving to Response
   * @param {object} options - Handling options
   * @param {boolean} options.showLoading - Show loading state (default: true)
   * @param {boolean} options.showError - Show error toast (default: true)
   * @param {string} options.loadingMessage - Custom loading message
   * @param {Function} options.onSuccess - Success callback
   * @param {Function} options.onError - Error callback
   * @returns {Promise<object|null>} Parsed response data or null on error
   */
  async handle(responsePromise, options = {}) {
    const {
      showLoading = true,
      showError = true,
      loadingMessage = 'Loading...',
      onSuccess = null,
      onError = null,
      context = {}
    } = options;

    try {
      // Show loading state if requested
      if (showLoading && typeof showToast === 'function') {
        // Note: We might want a different loading indicator than toast
        // For now, we'll just log it
        console.log(`[API] ${loadingMessage}`);
      }

      const response = await responsePromise;

      // Handle null response (auth failure)
      if (!response) {
        if (showError && typeof showToast === 'function') {
          showToast('Authentication required. Please log in.', 'error');
        }
        if (typeof onError === 'function') {
          onError({ message: 'Authentication required' });
        }
        return null;
      }

      // Handle HTTP errors
      if (!response.ok) {
        const errorData = await this._parseError(response);
        
        if (showError) {
          const userMessage = this._getUserMessage(response.status, errorData);
          if (typeof showToast === 'function') {
            showToast(userMessage, 'error');
          }
        }

        if (typeof onError === 'function') {
          onError(errorData);
        }

        return null;
      }

      // Parse successful response
      const data = await response.json();

      if (typeof onSuccess === 'function') {
        onSuccess(data);
      }

      return data;

    } catch (error) {
      console.error('[API Handler Error]:', error);
      
      if (showError && typeof showToast === 'function') {
        showToast('Connection error. Please try again.', 'error');
      }

      if (typeof onError === 'function') {
        onError(error);
      }

      return null;
    }
  },

  /**
   * Parse error response body
   * @param {Response} response - Error response
   * @returns {object} Parsed error data
   */
  async _parseError(response) {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return { message: response.statusText || 'HTTP Error' };
    } catch (error) {
      return { message: 'Failed to parse error response' };
    }
  },

  /**
   * Get user-friendly error message from HTTP status
   * @param {number} status - HTTP status code
   * @param {object} errorData - Parsed error data
   * @returns {string} User-friendly message
   */
  _getUserMessage(status, errorData) {
    // Use server-provided message if available
    if (errorData && errorData.detail) {
      return errorData.detail;
    }
    if (errorData && errorData.message) {
      return errorData.message;
    }

    // Fallback to status-based messages
    const statusMessages = {
      400: 'Invalid request. Please check your input.',
      401: 'Authentication required. Please log in.',
      403: 'You do not have permission to perform this action.',
      404: 'The requested resource was not found.',
      409: 'This record already exists or conflicts with existing data.',
      422: 'Validation error. Please check your input.',
      429: 'Too many requests. Please wait and try again.',
      500: 'Server error. Please try again later.',
      502: 'Service unavailable. Please try again later.',
      503: 'Service temporarily unavailable. Please try again later.'
    };

    return statusMessages[status] || `An error occurred (Status: ${status})`;
  },

  /**
   * Handle paginated API responses
   * @param {Promise<Response>} responsePromise - Promise resolving to Response
   * @param {object} options - Handling options
   * @returns {Promise<object|null>} Object with data and pagination info
   */
  async handlePaginated(responsePromise, options = {}) {
    const data = await this.handle(responsePromise, options);
    
    if (!data) return null;

    return {
      items: data.items || data.results || data.data || [],
      total: data.total || data.count || 0,
      page: data.page || 1,
      pageSize: data.page_size || data.pageSize || 10,
      hasMore: data.has_more || data.hasMore || false
    };
  },

  /**
   * Handle file upload responses
   * @param {Promise<Response>} responsePromise - Promise resolving to Response
   * @param {object} options - Handling options
   * @returns {Promise<object|null>} Upload response data
   */
  async handleUpload(responsePromise, options = {}) {
    const defaultOptions = {
      ...options,
      loadingMessage: 'Uploading...'
    };
    
    return await this.handle(responsePromise, defaultOptions);
  },

  /**
   * Handle file download responses
   * @param {Promise<Response>} responsePromise - Promise resolving to Response
   * @param {string} filename - Default filename for download
   * @param {object} options - Handling options
   * @returns {Promise<boolean>} Success status
   */
  async handleDownload(responsePromise, filename, options = {}) {
    const {
      showLoading = true,
      showError = true,
      onSuccess = null,
      onError = null
    } = options;

    try {
      if (showLoading) {
        console.log('[API] Downloading file...');
      }

      const response = await responsePromise;

      if (!response || !response.ok) {
        if (showError && typeof showToast === 'function') {
          showToast('Failed to download file.', 'error');
        }
        if (typeof onError === 'function') {
          onError({ message: 'Download failed' });
        }
        return false;
      }

      // Get filename from Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition');
      let downloadFilename = filename;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          downloadFilename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      if (typeof showToast === 'function') {
        showToast('File downloaded successfully.', 'success');
      }

      if (typeof onSuccess === 'function') {
        onSuccess({ filename: downloadFilename });
      }

      return true;

    } catch (error) {
      console.error('[Download Error]:', error);
      
      if (showError && typeof showToast === 'function') {
        showToast('Download failed. Please try again.', 'error');
      }

      if (typeof onError === 'function') {
        onError(error);
      }

      return false;
    }
  },

  /**
   * Retry failed API requests with exponential backoff
   * @param {Function} requestFn - Function that returns a Promise
   * @param {object} options - Retry options
   * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
   * @param {number} options.delay - Initial delay in ms (default: 1000)
   * @param {Function} options.shouldRetry - Function to determine if should retry
   * @returns {Promise<object>} Response data
   */
  async retry(requestFn, options = {}) {
    const {
      maxRetries = 3,
      delay = 1000,
      shouldRetry = (error) => true
    } = options;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        // Don't retry if it's the last attempt or shouldn't retry
        if (attempt === maxRetries || !shouldRetry(error)) {
          throw error;
        }

        // Exponential backoff
        const backoffDelay = delay * Math.pow(2, attempt);
        console.log(`[API] Retry attempt ${attempt + 1}/${maxRetries} after ${backoffDelay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    throw lastError;
  }
};
