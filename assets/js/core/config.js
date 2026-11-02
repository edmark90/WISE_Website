/**
 * WISE System - Global Configuration
 * Central location for app-wide constants (API base URL, etc.).
 *
 * The API base URL is chosen automatically:
 *  - Local development (opened from file://, localhost, or 127.0.0.1) -> local backend on port 8000
 *  - Deployed (Vercel, etc.)                                          -> production backend
 *
 * No need to edit this file when switching between local and deployed.
 */
const CONFIG = {
    PRODUCTION_API_BASE_URL: "https://wise-backend-9oze.onrender.com",
    LOCAL_API_BASE_URL: "http://localhost:8000",
    LOCAL_IPV4_API_BASE_URL: "http://127.0.0.1:8000"
};

(function () {
    var host = window.location.hostname || '';
    var isLocal = host === '' || host === 'localhost' || host === '127.0.0.1';
    if (isLocal) {
        // Default to 127.0.0.1:8000 since start.bat binds uvicorn to --host 127.0.0.1 --port 8000
        CONFIG.API_BASE_URL = CONFIG.LOCAL_IPV4_API_BASE_URL;
    } else {
        CONFIG.API_BASE_URL = CONFIG.PRODUCTION_API_BASE_URL;
    }
})();
