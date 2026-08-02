/**
 * WISE System - Global Configuration
 * Central location for app-wide constants (API base URL, etc.).
 *
 * The API base URL is chosen automatically:
 *  - Local development (opened from file:// or localhost) -> local backend
 *  - Deployed (Vercel, etc.)                              -> production backend
 *
 * No need to edit this file when switching between local and deployed.
 */
const CONFIG = {
    PRODUCTION_API_BASE_URL: "https://wise-backend-9oze.onrender.com",
    LOCAL_API_BASE_URL: "http://localhost:8000"
};

(function () {
    var host = window.location.hostname || '';
    var isLocal = host === '' || host === 'localhost' || host === '127.0.0.1';
    CONFIG.API_BASE_URL = isLocal ? CONFIG.LOCAL_API_BASE_URL : CONFIG.PRODUCTION_API_BASE_URL;
})();
