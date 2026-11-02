/**
 * WISE System - API Client
 * Single fetch wrapper: attaches auth headers, retries alternate local loopback
 * address (127.0.0.1 <-> localhost) on network error, and handles session expiry.
 * Returns the Response, or null after logging out on 401.
 */
async function apiRequest(path, options) {
  const reqOptions = Object.assign({ headers: getHeaders() }, typeof options === 'object' ? options : {});
  let res;
  try {
    res = await fetch(CONFIG.API_BASE_URL + path, reqOptions);
  } catch (err) {
    // If local fetch fails on localhost vs 127.0.0.1, try the alternate loopback URL
    const altBase = CONFIG.API_BASE_URL === CONFIG.LOCAL_IPV4_API_BASE_URL
      ? CONFIG.LOCAL_API_BASE_URL
      : (CONFIG.API_BASE_URL === CONFIG.LOCAL_API_BASE_URL ? CONFIG.LOCAL_IPV4_API_BASE_URL : null);
    if (altBase) {
      res = await fetch(altBase + path, reqOptions);
      CONFIG.API_BASE_URL = altBase;
    } else {
      throw err;
    }
  }
  if (res.status === 401) { logout(); return null; }
  return res;
}
