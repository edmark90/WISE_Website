/**
 * WISE System - State Store
 * Simple centralized state management for the application.
 */

const StateStore = {
  _state: {},
  _listeners: {},

  /**
   * Initialize the state store with initial state
   * @param {object} initialState - Initial state object
   */
  initialize: function(initialState = {}) {
    this._state = { ...initialState };
  },

  /**
   * Get current state or specific state slice
   * @param {string} key - Optional state key to retrieve
   * @returns {*} State value or entire state
   */
  getState: function(key = null) {
    if (key) {
      return this._getNestedValue(this._state, key);
    }
    return { ...this._state };
  },

  /**
   * Set state value(s)
   * @param {string|object} keyOrObject - State key or object of key-value pairs
   * @param {*} value - Value to set (if key is string)
   */
  setState: function(keyOrObject, value = undefined) {
    if (typeof keyOrObject === 'string') {
      this._setNestedValue(this._state, keyOrObject, value);
    } else if (typeof keyOrObject === 'object') {
      Object.assign(this._state, keyOrObject);
    }
    
    this._notifyListeners();
  },

  /**
   * Update state using a function (for complex updates)
   * @param {Function} updateFn - Function that receives current state and returns updates
   */
  updateState: function(updateFn) {
    if (typeof updateFn === 'function') {
      const updates = updateFn({ ...this._state });
      if (updates) {
        Object.assign(this._state, updates);
        this._notifyListeners();
      }
    }
  },

  /**
   * Subscribe to state changes
   * @param {Function} listener - Function to call when state changes
   * @returns {Function} Unsubscribe function
   */
  subscribe: function(listener) {
    if (typeof listener !== 'function') return () => {};

    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    this._listeners[id] = listener;

    // Return unsubscribe function
    return () => {
      delete this._listeners[id];
    };
  },

  /**
   * Reset state to initial or provided state
   * @param {object} newState - New state (optional)
   */
  reset: function(newState = {}) {
    this._state = { ...newState };
    this._notifyListeners();
  },

  /**
   * Get nested value from state object
   * @param {object} obj - State object
   * @param {string} path - Dot notation path
   * @returns {*} Nested value
   */
  _getNestedValue: function(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  },

  /**
   * Set nested value in state object
   * @param {object} obj - State object
   * @param {string} path - Dot notation path
   * @param {*} value - Value to set
   */
  _setNestedValue: function(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  },

  /**
   * Notify all listeners of state change
   */
  _notifyListeners: function() {
    Object.values(this._listeners).forEach(listener => {
      try {
        listener({ ...this._state });
      } catch (error) {
        console.error('State listener error:', error);
      }
    });
  }
};

// Initialize with empty state
StateStore.initialize({});
