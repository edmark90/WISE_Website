/**
 * WISE System - Report Service
 * Handles report generation, summary data, and export functionality.
 */

const ReportService = {
  /**
   * Fetch report summary for a given period
   * @param {object} params - Query parameters
   * @param {number} params.year - Year
   * @param {number} params.month - Month (optional, for monthly reports)
   * @returns {Promise<object|null>} Summary data or null on error
   */
  async fetchSummary(params = {}) {
    try {
      const queryParams = new URLSearchParams({ year: params.year });
      
      if (params.month) {
        queryParams.set('month', params.month);
      }

      const res = await apiRequest('/api/reports/summary?' + queryParams.toString());
      if (!res || !res.ok) return null;
      return await res.json();
    } catch (error) {
      console.error('Report summary fetch error:', error);
      return null;
    }
  },

  /**
   * Generate and download a report
   * @param {object} options - Report options
   * @param {string} options.format - Export format ('excel' or 'pdf')
   * @param {number} options.year - Year
   * @param {number} options.month - Month (optional)
   * @param {Array<string>} options.types - Report types to include
   * @returns {Promise<boolean>} Success status
   */
  async downloadReport(options = {}) {
    const {
      format = 'excel',
      year,
      month = null,
      types = ['barangay_performance', 'waste_trends', 'route_efficiency']
    } = options;

    try {
      const queryParams = new URLSearchParams({
        format: format,
        year: year,
        types: types.join(',')
      });

      if (month) {
        queryParams.set('month', month);
      }

      const url = CONFIG.API_BASE_URL + '/api/reports/export?' + queryParams.toString();
      
      const response = await fetch(url, { headers: getHeaders() });
      
      if (!response) {
        showToast('Authentication required.', 'error');
        return false;
      }

      if (response.status === 401) {
        logout();
        return false;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate report');
      }

      // Handle file download
      const blob = await response.blob();
      const filename = this._generateFilename(format, year, month);
      
      this._triggerDownload(blob, filename);
      showToast(`${format === 'excel' ? 'Excel' : 'PDF'} report downloaded.`, 'success');
      
      return true;
      
    } catch (error) {
      console.error('Report download error:', error);
      showToast('Download failed: ' + error.message, 'error');
      return false;
    }
  },

  /**
   * Generate filename for report download
   * @param {string} format - File format
   * @param {number} year - Year
   * @param {number} month - Month (optional)
   * @returns {string} Generated filename
   */
  _generateFilename(format, year, month) {
    const period = month 
      ? `${year}-${String(month).padStart(2, '0')}` 
      : `${year}`;
    
    const extension = format === 'excel' ? 'xlsx' : 'pdf';
    return `WISE_Report_${period}.${extension}`;
  },

  /**
   * Trigger browser download for blob
   * @param {Blob} blob - File blob
   * @param {string} filename - Filename
   */
  _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  /**
   * Format summary data for display
   * @param {object} summaryData - Raw summary data
   * @returns {object} Formatted summary data
   */
  formatSummaryForDisplay(summaryData) {
    if (!summaryData) {
      return this._getEmptySummary();
    }

    return {
      waste: {
        total: summaryData.waste_records || 0,
        avgConfidence: summaryData.waste_avg_confidence !== null 
          ? summaryData.waste_avg_confidence.toFixed(1) + '%' 
          : '—',
        lowConfidence: summaryData.waste_low_confidence || 0,
        commonType: summaryData.waste_most_common_type || '—'
      },
      schedule: {
        total: summaryData.collection_schedules || 0,
        completed: summaryData.routes_completed || 0,
        cancelled: summaryData.routes_cancelled || 0,
        delayed: summaryData.routes_delayed || 0,
        completionRate: summaryData.completion_rate !== null 
          ? summaryData.completion_rate + '%' 
          : '—'
      },
      users: {
        total: summaryData.users || 0
      }
    };
  },

  /**
   * Get empty summary data structure
   * @returns {object} Empty summary data
   */
  _getEmptySummary() {
    return {
      waste: {
        total: '—',
        avgConfidence: '—',
        lowConfidence: '—',
        commonType: '—'
      },
      schedule: {
        total: '—',
        completed: '—',
        cancelled: '—',
        delayed: '—',
        completionRate: '—'
      },
      users: {
        total: '—'
      }
    };
  },

  /**
   * Validate report parameters
   * @param {object} params - Parameters to validate
   * @returns {object} Validation result
   */
  validateParameters(params = {}) {
    const errors = [];

    if (!params.year || params.year < 2000 || params.year > 2100) {
      errors.push('Invalid year');
    }

    if (params.month && (params.month < 1 || params.month > 12)) {
      errors.push('Invalid month');
    }

    if (!params.types || !Array.isArray(params.types) || params.types.length === 0) {
      errors.push('At least one report type must be selected');
    }

    const validTypes = ['barangay_performance', 'waste_trends', 'route_efficiency', 'environmental_impact', 'comparative_performance', 'collection_calendar', 'peak_analysis', 'notification_effectiveness'];
    const invalidTypes = params.types.filter(type => !validTypes.includes(type));
    if (invalidTypes.length > 0) {
      errors.push('Invalid report types: ' + invalidTypes.join(', '));
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Get available report types
   * @returns {Array<object>} Available report types
   */
  getAvailableTypes() {
    return [
      { value: 'barangay_performance', label: 'Barangay Performance', description: 'Per barangay collection statistics and completion rates' },
      { value: 'waste_trends', label: 'Waste Type Trends', description: 'Monthly breakdown and yearly waste type analysis' },
      { value: 'route_efficiency', label: 'Collection Route Efficiency', description: 'Route completion rates and timing analysis' },
      { value: 'environmental_impact', label: 'Environmental Impact', description: 'Recycling rates and environmental metrics' },
      { value: 'comparative_performance', label: 'Comparative Performance', description: 'Month-over-month and year-over-year comparisons' },
      { value: 'collection_calendar', label: 'Collection Calendar Summary', description: 'Visual calendar of completed collections' },
      { value: 'peak_analysis', label: 'Peak Collection Analysis', description: 'Peak times and volume patterns' },
      { value: 'notification_effectiveness', label: 'Notification Effectiveness', description: 'Notification delivery and response rates' }
    ];
  }
};
