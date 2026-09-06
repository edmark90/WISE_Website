/**
 * WISE System - Time/Date Constants
 * Centralized time and date formatting constants.
 */

const TIMEZONE = {
  PHILIPPINES: 'Asia/Manila',
  UTC_OFFSET: 8 // UTC+8
};

const DATE_FORMATS = {
  ISO: 'YYYY-MM-DD',
  DISPLAY: 'MMM DD, YYYY',
  DISPLAY_WITH_TIME: 'MMM DD, YYYY HH:mm',
  DISPLAY_SHORT: 'MM/DD/YYYY',
  MONTH_YEAR: 'MMMM YYYY',
  TIME_12H: 'h:mm A',
  TIME_24H: 'HH:mm',
  DATETIME_12H: 'MMM DD, YYYY h:mm A',
  DATETIME_24H: 'YYYY-MM-DD HH:mm'
};

const TIME_FORMATS = {
  START_HOUR: 6,
  END_HOUR: 20,
  INTERVAL_MINUTES: 15
};

const COLLECTION_HOURS = {
  START: 6,  // 6:00 AM
  END: 20   // 8:00 PM
};

const REFRESH_INTERVALS = {
  DASHBOARD: 60000,      // 1 minute
  WEATHER: 300000,       // 5 minutes
  NOTIFICATIONS: 120000, // 2 minutes
  ACTIVITY_FEED: 30000   // 30 seconds
};

const PERIOD_TYPES = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year'
};

const REPORT_PERIODS = {
  THIS_MONTH: 'this-month',
  LAST_MONTH: 'last-month',
  THIS_YEAR: 'this-year',
  CUSTOM: 'custom'
};
