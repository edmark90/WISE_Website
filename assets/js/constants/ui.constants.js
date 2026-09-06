/**
 * WISE System - UI Constants
 * Centralized UI-related constants for consistent styling and behavior.
 */

const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
  MAX_VISIBLE_PAGES: 5
};

const TABLE_CONFIG = {
  DEFAULT_SORT_COLUMN: 'id',
  DEFAULT_SORT_ORDER: 'asc',
  EMPTY_STATE_MESSAGE: 'No data available',
  LOADING_STATE_MESSAGE: 'Loading...',
  ERROR_STATE_MESSAGE: 'Failed to load data'
};

const MODAL_CONFIG = {
  DEFAULT_WIDTH: '500px',
  LARGE_WIDTH: '800px',
  SMALL_WIDTH: '400px',
  ANIMATION_DURATION: 300,
  CLOSE_ON_BACKDROP_CLICK: true,
  CLOSE_ON_ESCAPE_KEY: true
};

const TOAST_CONFIG = {
  DEFAULT_DURATION: 3500,
  SUCCESS_DURATION: 3000,
  ERROR_DURATION: 5000,
  INFO_DURATION: 4000,
  POSITION: 'top-right',
  MAX_VISIBLE: 5
};

const FORM_CONFIG = {
  DEBOUNCE_DELAY: 350,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  EMAIL_MAX_LENGTH: 255,
  PHONE_MAX_LENGTH: 20,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100
};

const COLOR_SCHEMES = {
  WASTE_CATEGORIES: {
    Biodegradable: '#10b981',
    Recyclable: '#3b82f6',
    Electronic: '#8b5cf6',
    Hazardous: '#ef4444',
    Residual: '#64748b'
  },
  STATUS_COLORS: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6'
  },
  ROLE_COLORS: {
    admin: '#3b82f6',
    citizen: '#10b981'
  }
};

const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1280
};

const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500
};
