/**
 * WISE System - Waste Classification Constants
 * Centralized waste classification and related constants.
 */

const WASTE_CATEGORIES = [
  'Biodegradable',
  'Recyclable',
  'Electronic',
  'Hazardous',
  'Residual'
];

const WASTE_CATEGORY_COLORS = {
  Biodegradable: '#10b981', // Emerald
  Recyclable: '#3b82f6',    // Electric Blue
  Electronic: '#8b5cf6',    // Violet
  Hazardous: '#ef4444',     // Crimson
  Residual: '#64748b'       // Slate
};

const WASTE_CATEGORY_ICONS = {
  Biodegradable: '🌱',
  Recyclable: '♻️',
  Electronic: '🔌',
  Hazardous: '⚠️',
  Residual: '🗑️'
};

const CONFIDENCE_LEVELS = {
  HIGH: 85,
  MEDIUM: 60,
  LOW: 0
};

const CONFIDENCE_THRESHOLDS = {
  HIGH: 85,
  MEDIUM: 60,
  LOW: 0
};

const CONFIDENCE_COLORS = {
  HIGH: '#10b981',
  MEDIUM: '#3b82f6',
  LOW: '#ef4444'
};

const WASTE_STATUSES = {
  CLASSIFIED: 'classified',
  FLAGGED: 'flagged',
  VERIFIED: 'verified',
  REJECTED: 'rejected'
};
