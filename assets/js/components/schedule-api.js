/**
 * WISE System - Collection Schedule API
 * All schedule CRUD calls, built on the shared core/api.js client.
 */

// ---------- API ----------
async function fetchSchedulesByMonth(year, month) {
  const startDate = year + '-' + pad(month + 1) + '-01';
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = year + '-' + pad(month + 1) + '-' + lastDay;
  try {
    const res = await apiRequest('/api/collection-schedules/by-date-range/?start_date=' + startDate + '&end_date=' + endDate);
    if (!res) return [];
    if (!res.ok) return [];
    return await res.json();
  } catch (err) { console.error('Fetch schedules error:', err); return []; }
}

async function createSchedule(data) {
  try {
    const res = await apiRequest('/api/collection-schedules/', { method: 'POST', body: JSON.stringify(data) });
    if (!res) return null;
    if (!res.ok) { const e = await res.json(); showToast(e.detail || 'Failed to create schedule', 'error'); return null; }
    return await res.json();
  } catch (err) { showToast('Connection error.', 'error'); return null; }
}

async function updateSchedule(id, data, silent) {
  try {
    const res = await apiRequest('/api/collection-schedules/' + id, { method: 'PUT', body: JSON.stringify(data) });
    if (!res) return null;
    if (!res.ok) { const e = await res.json(); showToast(e.detail || 'Failed to update schedule', 'error'); return null; }
    if (!silent) showToast('Schedule updated!', 'success');
    return await res.json();
  } catch (err) { showToast('Connection error.', 'error'); return null; }
}

async function deleteSchedule(id) {
  try {
    const res = await apiRequest('/api/collection-schedules/' + id, { method: 'DELETE' });
    if (!res) return false;
    if (!res.ok) { showToast('Failed to delete.', 'error'); return false; }
    showToast('Schedule deleted.', 'success');
    return true;
  } catch (err) { showToast('Connection error.', 'error'); return false; }
}
