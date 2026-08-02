/**
 * WISE System - Schedule Status Definitions
 * Allowed statuses and their colors.
 *
 * The four automatic statuses (Upcoming/Arriving/Arrived/Completed) are
 * derived server-side from the collection date/time. Only Delayed and
 * Cancelled are set manually (via the status-change modal).
 */

// Allowed statuses
const STATUSES = ['Upcoming', 'Arriving', 'Arrived', 'Delayed', 'Completed', 'Cancelled'];

// Colors per status
const STATUS_COLORS = {
  'Upcoming':   { bg: '#EFF6FF', color: '#1E40AF' },
  'Arriving':   { bg: '#FEF3C7', color: '#92400E' },
  'Arrived':    { bg: '#F0FDF4', color: '#166534' },
  'Delayed':    { bg: '#FEF2F2', color: '#991B1B' },
  'Completed':  { bg: '#F0FDF4', color: '#15803D' },
  'Cancelled':  { bg: '#F3F4F6', color: '#4B5563' }
};
