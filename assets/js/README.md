# WISE System — JavaScript Structure

Organized by responsibility. All scripts are **classic scripts** (no modules)
so inline `onclick` handlers keep working and pages work from `file://` too.

## Folder layout

```
assets/js/
├── core/        # Shared, page-agnostic modules (load first)
│   ├── config.js   # CONFIG.API_BASE_URL and app-wide constants
│   ├── dom.js      # $id / $all DOM shortcuts
│   ├── utils.js    # pad, formatDate, formatTime12, escapeHtml, etc.
│   ├── toast.js    # showToast() shared across pages
│   ├── auth.js     # getHeaders, checkAuth, logout, initBasePage, mobile nav
│   └── api.js      # apiRequest() — fetch wrapper + 401 handling
├── data/         # Static reference data
│   ├── barangays.js            # BARANGAYS, BARANGAY_STREETS, BARANGAY_COLORS
│   ├── muntinlupa-boundary.js  # MUNTINLUPA_BOUNDARY_GEOJSON polygon coordinates
│   └── statuses.js             # STATUSES, STATUS_COLORS
├── components/   # Reusable UI pieces, one concern per file
│   ├── schedule-api.js         # collection-schedule CRUD calls
│   ├── calendar.js             # month grid + day/event click handling
│   ├── route-map.js            # interactive Leaflet map + OSRM routing
│   ├── sidebar.js              # day route list + schedule detail view
│   ├── day-actions.js          # delete all / move all / bulk status
│   ├── status-actions.js       # quick status buttons
│   ├── status-change-modal.js  # delayed/cancelled status reason modal
│   ├── schedule-modal.js       # multi-route entry form modal
│   ├── delete-modal.js         # delete confirmation modal
│   ├── user-table.js           # users table + pagination + stats
│   ├── user-modal.js           # add/edit/delete user modals
│   ├── waste-record-table.js   # waste classification table + pagination
│   └── mobile-update-modal.js  # mobile app version & update broadcast modal
└── pages/        # One entry point per HTML page
    ├── login.js               # index.html
    ├── dashboard.js           # dashboard.html
    ├── users.js               # users.html
    ├── waste-records.js       # waste records.html
    ├── collection-schedule.js # collection schedule.html
    ├── reports.js             # reports.html
    └── notification.js        # notification.html
```

## Rules for adding new features

1. **Shared logic → `core/`.** If two or more pages need it, it belongs here
   (e.g. toast, auth, API client). Never copy-paste.
2. **Static data → `data/`.** Reference data (barangays, statuses, boundaries).
3. **UI pieces → `components/`.** One concern per file. Components talk to
   the page through the global `state` object and shared helpers.
4. **Page bootstrap → `pages/`.** Each HTML page loads its own entry point
   (plus the core/data/component scripts it needs).
5. **Load order matters.** `core/` → `data/` → `components/` → `pages/`.
   Add the new `<script>` tags in that order at the bottom of the HTML page.
6. **Inline `onclick` handlers** call global functions — keep component
   functions global (top-level `function` declarations).

## Checking the app works

```powershell
# Syntax-check every script
Get-ChildItem -Path assets/js -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```
