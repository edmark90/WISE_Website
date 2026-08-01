/**
 * WISE System - Shared Utilities
 * Pure helper functions (date/time/string formatting) used by multiple pages.
 */

/** Pad a number to 2 digits (5 -> "05"). */
function pad(n) { return n < 10 ? '0' + n : '' + n; }

/** "HH:MM" -> minutes since midnight; -1 if empty. */
function timeToMinutes(t) {
  if (!t) return -1;
  var p = t.split(':');
  return parseInt(p[0]) * 60 + parseInt(p[1]);
}

/** Date -> "YYYY-MM-DD" (used for API payloads and date inputs). */
function formatDate(d) {
  const dt = new Date(d);
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
}

/** "HH:MM" -> "h:mm AM/PM" (used for display). */
function formatTime12(t) {
  if (!t) return '';
  const parts = t.split(':');
  const h = parseInt(parts[0]);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return h12 + ':' + m + ' ' + ampm;
}

/** Escape HTML special characters to prevent XSS in innerHTML templates. */
function escapeHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/** True when the given "YYYY-MM-DD" date is before today. */
function isDatePast(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(dateStr.substring(0, 10) + 'T00:00:00');
  return checkDate < today;
}

/** Date -> "Mon DD, YYYY" (used in tables/lists). */
function formatDisplayDate(d) {
  if (!d) return '-';
  try {
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) { return d; }
}

/** First letters of the first two words, uppercased (for avatars). */
function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').filter(function (w) { return w.length > 0; }).map(function (w) { return w[0].toUpperCase(); }).slice(0, 2).join('');
}

/** Role -> css class used for avatar/badge coloring. */
function getRoleClass(role) {
  return ({ admin: 'admin', citizen: 'citizen' })[role] || 'default';
}
