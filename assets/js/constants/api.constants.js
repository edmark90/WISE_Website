/**
 * WISE System - API Constants
 * Centralized API endpoints and related constants.
 */

const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
    REFRESH: '/api/auth/refresh'
  },

  // Users
  USERS: {
    LIST: '/api/users/',
    DETAIL: (id) => `/api/users/${id}`,
    CREATE: '/api/users/',
    UPDATE: (id) => `/api/users/${id}`,
    DELETE: (id) => `/api/users/${id}`
  },

  // Waste Records
  WASTE_RECORDS: {
    LIST: '/api/waste-records/',
    DETAIL: (id) => `/api/waste-records/${id}`,
    CREATE: '/api/waste-records/',
    UPDATE: (id) => `/api/waste-records/${id}`,
    DELETE: (id) => `/api/waste-records/${id}`,
    STATS: '/api/waste-records/stats'
  },

  // Collection Schedules
  COLLECTION_SCHEDULES: {
    LIST: '/api/collection-schedules/',
    DETAIL: (id) => `/api/collection-schedules/${id}`,
    CREATE: '/api/collection-schedules/',
    UPDATE: (id) => `/api/collection-schedules/${id}`,
    DELETE: (id) => `/api/collection-schedules/${id}`,
    BATCH: '/api/collection-schedules/batch',
    BY_DATE_RANGE: '/api/collection-schedules/by-date-range/',
    UPDATE_STATUS: (id) => `/api/collection-schedules/${id}/status`
  },

  // Notifications
  NOTIFICATIONS: {
    LIST: '/api/notifications/',
    DETAIL: (id) => `/api/notifications/${id}`,
    CREATE: '/api/notifications/',
    UPDATE: (id) => `/api/notifications/${id}`,
    DELETE: (id) => `/api/notifications/${id}`,
    SUMMARY: '/api/notifications/summary'
  },

  // Reports
  REPORTS: {
    SUMMARY: '/api/reports/summary',
    EXPORT: '/api/reports/export'
  },

  // Dashboard
  DASHBOARD: {
    ACTIVITY: '/api/dashboard/activity',
    MONTHLY_DATA: '/api/dashboard/monthly',
    COLLECTION_RAIL: '/api/dashboard/collection-rail'
  }
};

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
};

const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE'
};

const REQUEST_TIMEOUT = 30000; // 30 seconds
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second
