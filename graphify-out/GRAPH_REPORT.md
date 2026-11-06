# Graph Report - WISE  (2026-11-02)

## Corpus Check
- 61 files · ~116,159 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: .css 8, .bat 2, (none) 1)

## Summary
- 487 nodes · 724 edges · 45 communities (24 shown, 21 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.86)
- Token cost: 13,250 input · 3,550 output

## Community Hubs (Navigation)
- Leaflet Route Map & Dispatch
- User Management Modals & CRUD
- Executive Dashboard UI & Telemetry
- Route Map Pipeline Tests
- Collection Schedule & Day Actions
- Muntinlupa GeoJSON Boundary Tests
- Waste Records Page & Details
- Schedule Route Entry Modal
- Notification Center & Broadcast UI
- Reports & Analytics Page Engine
- Executive Portal & Schedule Views
- Route Status Change Dialog
- Formatting & DOM Utilities
- Waste Records Table & Badges
- Session Auth & Navigation Guard
- Tripartite Architecture & Backend
- Admin Login & Hero Graphics
- Archify Architecture Topology
- Schedule Route Sidebar Drawer
- User Management Data Table
- Reports & Waste Analytics
- Calendar Grid Component
- Barangay Reference Data
- Route Status Definitions
- Notification Broadcast Composer
- User Provisioning & Roles
- Global Application Configuration
- Muntinlupa GeoJSON Polygon
- Script Architecture & Load Order
- Barangay Performance Metrics
- Collection Calendar Summary
- Route Efficiency Report
- Comparative Performance Report
- Environmental Impact Report
- Notification Delivery Report
- Peak Collection Analysis

## God Nodes (most connected - your core abstractions)
1. `renderRouteEntries()` - 14 edges
2. `renderRouteMapInternal()` - 13 edges
3. `loadDashboard()` - 13 edges
4. `loadMonthly()` - 12 edges
5. `drawTruckLayers()` - 11 edges
6. `Marker` - 11 edges
7. `updateFleetFromSchedule()` - 10 edges
8. `initDashboard()` - 10 edges
9. `selectNotification()` - 10 edges
10. `wireReportsControls()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Waste Type Trends Report` --semantically_similar_to--> `AI Waste Classification Pipeline`  [INFERRED] [semantically similar]
  REPORTS_UPDATE.md → archify/ARCHITECTURE_DOCUMENTATION.md
- `Weather & Operational Telemetry Widget` --semantically_similar_to--> `Dashboard Weather Header Redesign Spec`  [INFERRED] [semantically similar]
  dashboard.html → scratch/full_user_req_9.txt
- `Transparent Brand Logo Asset` --references--> `Executive Operations Dashboard`  [EXTRACTED]
  assets/images/logo-transparent.png → dashboard.html
- `Clean High-Contrast Vector WISE Logo Badge` --references--> `Executive Operations Dashboard`  [EXTRACTED]
  assets/images/wise-logo-clean.png → dashboard.html
- `Cropped Highway Waste Truck Artwork` --references--> `Brand Hero & Authentication Split Layout`  [EXTRACTED]
  assets/images/login-bg-cropped.png → index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **WISE Tripartite Architecture Stack** — archify_architecture_documentation_wise_web_admin, archify_architecture_documentation_wise_mobile_app, archify_architecture_documentation_wise_backend [EXTRACTED 1.00]
- **WISE Comprehensive Analytics Suite** — reports_update_barangay_performance_report, reports_update_waste_type_trends_report, reports_update_collection_route_efficiency_report, reports_update_environmental_impact_report [EXTRACTED 1.00]
- **WISE Web Admin Page Suite** — dashboard_executive_dashboard, collection_schedule_schedule_workspace, waste_records_records_portal, reports_analytics_portal, users_user_management_portal, notification_center_portal [EXTRACTED 1.00]

## Communities (45 total, 21 thin omitted)

### Community 0 - "Leaflet Route Map & Dispatch"
Cohesion: 0.08
Nodes (58): addDepotMarker(), addLayer(), assignRouteColors(), buildRemainingTrail(), buildStopPopupHtml(), buildStraightLegs(), buildTruckPopupHtml(), buildTruckTooltipHtml() (+50 more)

### Community 1 - "User Management Modals & CRUD"
Cohesion: 0.06
Nodes (40): closeDeleteModal(), closeUserModal(), deleteUser(), openAddModal(), openEditModal(), saveUser(), updateStatusToggleLabel(), accountStatusFields (+32 more)

### Community 2 - "Executive Dashboard UI & Telemetry"
Cohesion: 0.12
Nodes (34): animateNumber(), buildMonotoneCubicSpline(), cacheActivities(), dateOffset(), formatAgo(), formatShortDateTime(), getWeatherSvg(), initDashboard() (+26 more)

### Community 3 - "Route Map Pipeline Tests"
Cohesion: 0.06
Nodes (15): activePolylines(), assert, DEPOT, elements, fs, Layer, LayerGroup, mapLayersOfType() (+7 more)

### Community 4 - "Collection Schedule & Day Actions"
Cohesion: 0.06
Nodes (26): deleteAllDayRoutes(), addRouteBtn, calendarGrid, calendarTitle, dayActions, deleteCancelBtn, deleteConfirmBtn, deleteOverlay (+18 more)

### Community 5 - "Muntinlupa GeoJSON Boundary Tests"
Cohesion: 0.07
Nodes (19): boundary, boundaryCode, fs, lmMatch, routeMapContent, assert, boundaryGeoJson, fs (+11 more)

### Community 6 - "Waste Records Page & Details"
Cohesion: 0.10
Nodes (28): brgyState, closeModal(), countEl, dateBtn, dateLabel, deleteWasteRecord(), detailBody, fetchBarangayLeaderboard() (+20 more)

### Community 7 - "Schedule Route Entry Modal"
Cohesion: 0.21
Nodes (21): addRouteEntry(), addStopToEntry(), buildTimeOptions(), closeModal(), createEmptyRoute(), getAvailableTruck(), getNextAvailableTime(), getSavedTrucksForDate() (+13 more)

### Community 8 - "Notification Center & Broadcast UI"
Cohesion: 0.22
Nodes (17): barangayList(), closeAnnouncementModal(), deleteNotification(), filterQuery(), formatFullDate(), formatSimpleDate(), isValidValue(), loadHistory() (+9 more)

### Community 9 - "Reports & Analytics Page Engine"
Cohesion: 0.29
Nodes (15): buildParams(), downloadReport(), initReports(), loadSummary(), rpPhNow(), setDownloading(), setElementText(), setModeUI() (+7 more)

### Community 10 - "Executive Portal & Schedule Views"
Cohesion: 0.15
Nodes (13): Transparent Brand Logo Asset, Clean High-Contrast Vector WISE Logo Badge, Monthly Dispatch Calendar Component, Interactive Route Map & Dispatch View, Multi-Route Scheduling Modal, Collection Schedule Management Portal, Live Vehicle Dispatch Rail, Executive Operations Dashboard (+5 more)

### Community 11 - "Route Status Change Dialog"
Cohesion: 0.38
Nodes (10): _buildStatusMessage(), closeStatusChangeModal(), confirmStatusChange(), openStatusChangeModal(), _refreshStatusSummary(), renderStatusChangeModal(), _scopedSchedules(), STATUS_CHANGE (+2 more)

### Community 14 - "Waste Records Table & Badges"
Cohesion: 0.33
Nodes (6): renderWasteRows(), WC_BADGE, wcBadgeClass(), wcConfLevel(), wcFormatDate(), wcFormatTime()

### Community 15 - "Session Auth & Navigation Guard"
Cohesion: 0.42
Nodes (8): checkAuth(), ensureSidebarUserCard(), getHeaders(), initBasePage(), initMobileNav(), loadSidebarUserFromApi(), logout(), populateSidebarUserFromStorage()

### Community 16 - "Tripartite Architecture & Backend"
Cohesion: 0.25
Nodes (8): AI Waste Classification Pipeline, Muntinlupa GIS & OSRM Engine, FCM Push Notification Service, TiDB Cloud Distributed Database, WISE FastAPI Backend Architecture, WISE Mobile Client Architecture, WISE Web Admin Architecture, Waste Type Trends Report

### Community 17 - "Admin Login & Hero Graphics"
Cohesion: 0.25
Nodes (8): Cropped Highway Waste Truck Artwork, Faded Soft Background Artwork Variant, Primary Garbage Truck Highway Landscape, Clean Muntinlupa Eco Hero Illustration, Official WISE Emblem with Muntinlupa Seal, Administrator Login Portal, Brand Hero & Authentication Split Layout, JWT Authentication Form

### Community 18 - "Archify Architecture Topology"
Cohesion: 0.29
Nodes (7): WISE Client-Server Architecture Tier, WISE Interactive Architecture Topology, WISE Architecture Visual Render (1440x900 Dark), WISE Architecture Visual Render (1440x900 Light), WISE Architecture Visual Render (2048x1320 Dark), WISE Architecture Visual Render (2048x1320 Light), Architecture Visual Test Harness

### Community 19 - "Schedule Route Sidebar Drawer"
Cohesion: 0.47
Nodes (3): renderSidebar(), showDayRouteMap(), updateSidebarForDate()

### Community 20 - "User Management Data Table"
Cohesion: 0.53
Nodes (3): renderPagination(), renderTable(), updateUserCount()

### Community 21 - "Reports & Waste Analytics"
Cohesion: 0.33
Nodes (6): Executive Reports & Analytics Portal, Temporal & Barangay Filter Toolbar, PDF Export Engine, AI Classification Accuracy & Confidence Metrics, Barangay Waste Distribution Table, Waste Classification Records Portal

### Community 22 - "Calendar Grid Component"
Cohesion: 1.00
Nodes (3): attachCalendarListeners(), drawCalendarGrid(), renderCalendar()

### Community 23 - "Barangay Reference Data"
Cohesion: 0.50
Nodes (3): BARANGAY_COLORS, BARANGAY_STREETS, BARANGAYS

### Community 29 - "Notification Broadcast Composer"
Cohesion: 0.67
Nodes (3): Barangay Alert & Broadcast Composer, Notification & Broadcast Center Portal, Dispatch & Delivery Audit History

### Community 30 - "User Provisioning & Roles"
Cohesion: 0.67
Nodes (3): Role & Account Provisioning Modal, Paginated User Directory Table, User & Collector Management Portal

## Knowledge Gaps
- **42 isolated node(s):** `WISE Client-Server Architecture Tier`, `Barangay Performance Report`, `Waste Type Trends Report`, `Route Efficiency Report`, `Environmental Impact Report` (+37 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 230 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `closeModal()` connect `Waste Records Page & Details` to `Collection Schedule & Day Actions`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `WISE Client-Server Architecture Tier`, `Barangay Performance Report`, `Waste Type Trends Report` to the rest of the system?**
  _42 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Leaflet Route Map & Dispatch` be split into smaller, more focused modules?**
  _Cohesion score 0.08416130917592052 - nodes in this community are weakly interconnected._
- **Why does `addRouteEntry()` connect `Schedule Route Entry Modal` to `Collection Schedule & Day Actions`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Should `User Management Modals & CRUD` be split into smaller, more focused modules?**
  _Cohesion score 0.05647840531561462 - nodes in this community are weakly interconnected._
- **Should `Executive Dashboard UI & Telemetry` be split into smaller, more focused modules?**
  _Cohesion score 0.12051282051282051 - nodes in this community are weakly interconnected._
- **Should `Route Map Pipeline Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.05897435897435897 - nodes in this community are weakly interconnected._