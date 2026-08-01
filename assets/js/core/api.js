/**
 * WISE System - API Client
 * Single fetch wrapper: attaches auth headers and handles session expiry.
 * Returns the Response, or null after logging out on 401.
 */
async function apiRequest(path, options) {
  const res = await fetch(API_BASE + path, Object.assign({ headers: getHeaders() }, options));
  if (res.status === 401) { logout(); return null; }
  return res;
}
