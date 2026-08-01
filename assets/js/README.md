# WISE System — JavaScript Structure

Organized by responsibility. All scripts are **classic scripts** (no modules)
so inline `onclick` handlers keep working and pages work from `file://` too.

## Folder layout

```
assets/js/
├── core/        # Shared, page-agnostic modules (load first)
│   ├── config.js   # API_BASE and app-wide constants
│   ├── dom.js      # $id / $all DOM shortcuts
│   ├── utils.js    # pad, formatDate, formatTime12, escapeHtml, etc.
│   ├── toast.js    # showToast() shared across pages
│   ├── auth.js     # getHeaders, checkAuth, logout, initBasePage
│   └── api.js      # apiRequest() — fetch wrapper + 401 handling
├── data/         # Static reference data
│   ├── barangays.js  # BARANGAYS, BARANGAY_STREETS, BARANGAY_COLORS
│   └── statuses.js   # STATUSES, STATUS_COLORS, getAutoStatus
├── components/   # Reusable UI pieces, one concern per file
│   ├── schedule-api.js   # collection-schedule CRUD calls
│   ├── calendar.js       # month grid + day/event click handling
│   ├── route-diagram.js  # SVG route visualization
│   ├── sidebar.js        # day route list + schedule detail view
│   ├── day-actions.js    # delete all / move all / bulk status
│   ├── status-actions.js # quick status buttons
│   ├── schedule-modal.js # multi-route entry form modal
│   ├── delete-modal.js   # delete confirmation modal
│   ├── user-table.js     # users table + pagination + stats
│   └── user-modal.js     # add/edit/delete user modals
└── pages/        # One entry point per HTML page
    ├── collection-schedule.js
    ├── users.js
    ├── login.js
    └── dashboard.js
```

## Rules for adding new features

1. **Shared logic → `core/`.** If two or more pages need it, it belongs here
   (e.g. toast, auth, API client). Never copy-paste.
2. **Static data → `data/`.** Reference data (barangays, statuses, etc.).
3. **UI pieces → `components/`.** One concern per file. Components talk to
   the page through the global `state` object and shared helpers.
4. **Page bootstrap → `pages/`.** Each HTML page loads its own entry point
   (plus the core/data/component scripts it needs).
5. **Load order matters.** `core/` → `data/` → `components/` → `pages/`.
   Add the new `<script>` tags in that order at the bottom of the HTML page.
6. **Inline `onclick` handlers** call global functions — keep component
   functions global (top-level `function` declarations).

## Checking the app works

```bash
# Syntax-check every script
for f in $(find assets/js -name '*.js'); do node --check "$f" || echo "FAIL $f"; done
```
