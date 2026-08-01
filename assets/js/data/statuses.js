/**
 * WISE System - Schedule Status Definitions
 * Allowed statuses, their colors, and automatic status rules.
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

/**
 * Derive the automatic status for a schedule based on its date.
 * Manual statuses (Cancelled/Delayed) and same-day manual transitions are kept.
 */
function getAutoStatus(dateStr, currentStatus) {
  if (currentStatus === 'Cancelled' || currentStatus === 'Delayed') return currentStatus;
  if (currentStatus === 'Completed' || currentStatus === 'Arrived') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const schedDate = new Date(dateStr.substring(0, 10) + 'T00:00:00');
    if (currentStatus === 'Arrived' && schedDate.toDateString() === today.toDateString()) return 'Arrived';
    if (currentStatus === 'Completed' && schedDate < today) return 'Completed';
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const schedDate = new Date(dateStr.substring(0, 10) + 'T00:00:00');
  if (schedDate < today) return 'Completed';
  else if (schedDate.toDateString() === today.toDateString()) return 'Arriving';
  else return 'Upcoming';
}
