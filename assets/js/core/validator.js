/**
 * WISE System - Validation Utilities
 * Reusable validation functions for forms and user input.
 */

const Validator = {
  /**
   * Validate email address format
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid email format
   */
  email: function(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  },

  /**
   * Validate phone number (Philippine format)
   * @param {string} phone - Phone number to validate
   * @returns {boolean} True if valid phone format
   */
  phone: function(phone) {
    if (!phone) return true; // Phone is optional
    const phoneRegex = /^(\+63|0)?[0-9]{10,11}$/;
    return phoneRegex.test(phone.replace(/[\s-]/g, ''));
  },

  /**
   * Check if value is required and not empty
   * @param {*} value - Value to check
   * @returns {boolean} True if value is present and not empty
   */
  required: function(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  },

  /**
   * Validate minimum string length
   * @param {string} value - String to validate
   * @param {number} min - Minimum length
   * @returns {boolean} True if string meets minimum length
   */
  minLength: function(value, min) {
    if (!value) return false;
    return value.length >= min;
  },

  /**
   * Validate maximum string length
   * @param {string} value - String to validate
   * @param {number} max - Maximum length
   * @returns {boolean} True if string doesn't exceed maximum length
   */
  maxLength: function(value, max) {
    if (!value) return true;
    return value.length <= max;
  },

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {object} Validation result with isValid and message
   */
  password: function(password) {
    if (!password || password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters.' };
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter.' };
    }
    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter.' };
    }
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one number.' };
    }
    return { isValid: true, message: '' };
  },

  /**
   * Validate that two values match (for password confirmation)
   * @param {*} value1 - First value
   * @param {*} value2 - Second value to match
   * @returns {boolean} True if values match
   */
  match: function(value1, value2) {
    return value1 === value2;
  },

  /**
   * Validate date format (YYYY-MM-DD)
   * @param {string} dateStr - Date string to validate
   * @returns {boolean} True if valid date format
   */
  date: function(dateStr) {
    if (!dateStr) return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  },

  /**
   * Validate time format (HH:MM)
   * @param {string} timeStr - Time string to validate
   * @returns {boolean} True if valid time format
   */
  time: function(timeStr) {
    if (!timeStr) return false;
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeStr);
  },

  /**
   * Validate numeric value
   * @param {*} value - Value to validate
   * @returns {boolean} True if value is a valid number
   */
  numeric: function(value) {
    if (value === null || value === undefined || value === '') return false;
    return !isNaN(Number(value));
  },

  /**
   * Validate integer value
   * @param {*} value - Value to validate
   * @returns {boolean} True if value is a valid integer
   */
  integer: function(value) {
    if (!this.numeric(value)) return false;
    return Number.isInteger(Number(value));
  },

  /**
   * Validate value is within range
   * @param {number} value - Value to validate
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {boolean} True if value is within range
   */
  range: function(value, min, max) {
    if (!this.numeric(value)) return false;
    const num = Number(value);
    return num >= min && num <= max;
  },

  /**
   * Validate that value is one of allowed options
   * @param {*} value - Value to validate
   * @param {Array} allowed - Array of allowed values
   * @returns {boolean} True if value is in allowed array
   */
  oneOf: function(value, allowed) {
    if (!Array.isArray(allowed)) return false;
    return allowed.includes(value);
  },

  /**
   * Run multiple validations and return first error
   * @param {*} value - Value to validate
   * @param {Array} validations - Array of validation functions
   * @returns {object} Validation result
   */
  validate: function(value, validations) {
    for (let i = 0; i < validations.length; i++) {
      const validation = validations[i];
      const result = validation(value);
      if (result !== true) {
        return { isValid: false, message: result };
      }
    }
    return { isValid: true, message: '' };
  }
};
