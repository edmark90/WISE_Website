# WISE Platform — Architecture Documentation

**Generated:** 2026-09-16  
**Diagram:** `WISE-Architecture.html` (Interactive Archify diagram)  
**Specification:** `WISE-Architecture.json` (Archify source)

---

## System Overview

The **WISE (Waste Information System & Education)** platform is an integrated waste management system comprising three distinct codebases working as one unified system:

| Component | Technology | Purpose |
|-----------|------------|---------|
| **WISE Web Admin** | Vanilla JavaScript, HTML/CSS | Admin dashboard for analytics, user management, announcements, schedule management |
| **WISE Mobile App** | Flutter (Dart), Android/iOS | Citizen-facing app for waste classification, schedule viewing, notifications |
| **WISE Backend** | FastAPI (Python 3.10), SQLAlchemy | REST API, AI inference, authentication, background workers, FCM push |

All three clients connect to the **same production backend** deployed on Render: `https://wise-backend-9oze.onrender.com`

---

## Client Layer

### WISE Mobile App (Flutter)
- **Location:** `C:\Users\Admin\AndroidStudioProjects\WISE`
- **Entry:** `lib/main.dart` — app initialization, auth gate, routing
- **Main Navigation:** `lib/screens/MainScreen.dart` — 6-tab drawer navigation
  - Dashboard, AI Waste Input, Waste Guide, Collection Schedule, Notifications, Profile
- **AI Classification:** `lib/services/ai_service.dart` — calls `POST /api/v1/predict` (multipart)
- **Push Notifications:** `lib/services/push_notification_service.dart` — Firebase Messaging + flutter_local_notifications
- **Key Screens:**
  - `AiWasteInputScreen.dart` — camera/gallery capture → backend classification → result with confidence, bin guidance
  - `CollectionScheduleScreen.dart` — barangay-filtered schedules with day grouping
  - `NotificationScreen.dart` — in-app notification center with read/unread state

### WISE Web Admin (Vanilla JS)
- **Location:** `C:\Users\Admin\OneDrive\Desktop\WISE`
- **Pages:** `index.html` (login), `dashboard.html`, `users.html`, `reports.html`, `waste records.html`, `collection schedule.html`, `notification.html`, `profile.html`
- **Core JS:**
  - `assets/js/core/api.js` — fetch wrapper with JWT Bearer auth
  - `assets/js/core/auth.js` — session management, login guard
  - `assets/js/services/dashboard.service.js` — stats, monthly trends, activity feed, collection rail
  - `assets/js/pages/dashboard/index.js` — dashboard orchestration with 60s auto-refresh
- **API Constants:** `assets/js/constants/api.constants.js` — auto-detects local vs production backend

---

## Backend API (FastAPI)

### Application Structure
- **Location:** `C:\Users\Admin\OneDrive\Desktop\wise-backend`
- **Entry:** `apps/main.py` — FastAPI app with lifespan, routers, middleware
- **Config:** `apps/config.py` — DB, Firebase, model paths from environment
- **Database:** `apps/database.py` — SQLAlchemy + PyMySQL → TiDB Cloud (MySQL)

### Routers (all under `/api` with JWT Bearer auth)
| Router | Prefix | Purpose |
|--------|--------|---------|
| `auth.py` | `/api/auth` | Login, signup, token refresh, `/me` |
| `users.py` | `/api/users` | Admin user CRUD |
| `profile.py` | `/api/users` | Profile, uploads |
| `dashboard.py` | `/api/dashboard` | Stats, monthly, activity, collection rail |
| `waste_records.py` | `/api/waste-records` | Admin waste classification records |
| `collection_schedules.py` | `/api/collection-schedules` | Schedule CRUD |
| `collection_history.py` | `/api/collection-history` | Completed collections |
| `notifications.py` | `/api/notifications` | Admin + citizen notifications, device tokens, preferences |
| `ai_guides.py` | `/api/ai-guides` | Waste guide CRUD |
| `reports.py` | `/api/reports` | Excel/PDF exports |
| `mobile_updates.py` | `/api` | App version check, update reminders |
| `prediction.py` | `/api/v1` | **AI classification endpoint** |

### Key Services
- **AI Model Service:** `apps/services/model_service.py` — MobileNetV2 TFLite singleton, loaded once at startup, async inference via `asyncio.to_thread`
- **Push Service:** `apps/services/push.py` — Firebase Admin SDK multicast (optional, env-config)
- **Collection Schedule:** `apps/services/collection_schedule.py` — auto-status notifications (Arriving/Arrived/Completed)
- **Mobile Update:** `apps/services/mobile_update.py` — version check + reminder scheduling

### Background Workers (daemon threads)
- **Auto-Status Worker:** Polls every 60s → emits route-status notifications via `sync_auto_status_notifications()`
- **Update Reminder Worker:** Processes `sync_update_reminders()` for app update prompts

---

## AI Waste Classification Flow

```
Mobile App (Camera/Gallery)
        │
        ▼ POST /api/v1/predict (multipart image)
Backend API (FastAPI)
        │
        ▼ Internal async call
AI Model Service (MobileNetV2 TFLite)
        │
        ▼ Returns: category, confidence, probabilities
Backend API
        │
        ▼ Fail-open persist
TiDB Cloud (waste_records table)
        │
        ▼ Response
Mobile App → Display result + bin guidance → Save to Waste Guide
```

**Model Details:**
- **File:** `apps/ai_model/waste_classifier.tflite` (MobileNetV2 backbone, 224×224×3 input)
- **Labels:** `apps/ai_model/labels.txt` or `class_mapping.json` (5 classes: Biodegradable, Electronic, Hazardous, Recyclable, Residual)
- **Endpoint:** `POST /api/v1/predict` — accepts `image` multipart field, returns `PredictionResponse`
- **Storage:** Result + image URL saved to `waste_records` for admin dashboard (fail-open: prediction returned even if persist fails)

---

## Collection Operations

### Data Flow
```
Admin (Web) → CREATE/UPDATE collection_schedule
                    │
                    ▼
Mobile App → GET /api/collection-schedules → Filter by barangay → Day-grouped UI
                    │
                    ▼
Background Worker (60s poll) → sync_auto_status_notifications()
                    │
                    ▼ Creates notifications + FCM push
Mobile App → FCM → Local notification (Arriving/Arrived/Completed)
```

### Schedule Schema (`collection_schedule` table)
- `barangay`, `zone`, `route_name`, `starting_point`
- `collection_date`, `collection_time`, `assigned_personnel`
- `status` (Upcoming/Arriving/Arrived/Completed)

---

## Notification Pipeline

### Notification Types
1. **Manual Announcements** (Admin → Web) → General, Delayed Collection, Cancelled Collection
2. **Auto-Status** (Worker) → Route Arriving/Arrived/Completed
3. **App Updates** (Worker) → Version available + reminders

### Delivery Path
```
Backend creates notification → notifications table
                    │
                    ├─► notification_reads (per-user read state)
                    │
                    └─► Firebase Admin SDK → FCM Multicast → Device tokens
                                      │
                                      ▼
                              Mobile App (Firebase Messaging)
                                      │
                                      ▼
                              flutter_local_notifications → Heads-up display
```

### Citizen Preferences (stored in `users` table)
- `notif_collection_updates`, `notif_route_updates`, `notif_announcements`
- `notif_emergency_alerts`, `notif_reminders`, `notif_completed_collection`
- `preferred_barangays` (JSON array for targeted delivery)

---

## Data Layer (TiDB Cloud MySQL)

### Core Tables
| Table | Purpose |
|-------|---------|
| `users` | Citizens + admins, roles, barangay/zone, notification prefs, device tokens |
| `waste_records` | AI classifications (user_id, image_url, waste_type, disposal_category, confidence) |
| `collection_schedule` | Upcoming collection routes |
| `collection_history` | Completed collections (dashboard source) |
| `notifications` | Broadcast + targeted notifications |
| `notification_reads` | Per-user read receipts |
| `device_tokens` | FCM tokens per user/platform |
| `app_versions` / `app_update_announcements` | Mobile update management |
| `ai_guides` | Waste disposal guides per category |

### File Storage
- **Location:** `/uploads` (served via `StaticFiles` mount at `apps/main.py:292`)
- **Structure:** `/uploads/profile/` + `/uploads/waste/`
- **Config:** `apps/config.py:29-30` — `WASTE_UPLOAD_DIR`

---

## External Services

| Service | Purpose | Integration |
|---------|---------|-------------|
| **TiDB Cloud** | Managed MySQL database | SQLAlchemy + PyMySQL |
| **Firebase Cloud Messaging** | Push notifications | Firebase Admin SDK (backend), Firebase Messaging (mobile) |
| **Firebase Auth** | Not used — custom JWT | N/A |

---

## Authentication Flow

```
Mobile / Web → POST /api/auth/login (email, password)
                    │
                    ▼ bcrypt verify
Backend → JWT access_token + refresh_token
                    │
                    ▼ Authorization: Bearer <token>
All subsequent API calls
```

- **Token:** `python-jose` JWT with `sub`, `email`, `role` claims
- **Password:** `bcrypt` hashing
- **Roles:** `admin` (web access), `citizen` (mobile access)

---

## Key Architecture Decisions (from code)

1. **AI On-Backend, Not On-Device** — Model runs on Render GPU/CPU; mobile only sends image
2. **Fail-Open AI Persistence** — Prediction returned even if DB insert fails
3. **Auto-Status Notifications** — Worker polls schedules, emits FCM without admin action
4. **Per-User Notification Preferences** — Citizens choose barangays + categories
5. **Static File Serving** — Profile/waste images served directly from backend `/uploads`
6. **JWT Bearer Auth (No Cookies)** — CORS `allow_credentials=False` for wildcard origins
7. **Rate Limiting Middleware** — Applied globally before routing
8. **Optional FCM** — Graceful degradation if Firebase credentials missing

---

## Interactive Diagram Usage

Open `WISE-Architecture.html` in a browser for:

- **Theme Switch** — Light/Dark mode (top-right)
- **Search** — Ctrl/Cmd+F to find components
- **Node Inspection** — Click any node for details
- **Flow Tracing** — Hover connections to highlight upstream/downstream
- **Guided Views** — Top bar: "Authentication Flow", "AI Waste Classification", "Collection Operations", "Notification System", "Dashboard & Analytics"
- **Export** — PNG/JPEG/SVG/WebP/WebM via toolbar

---

## Source References

| Diagram Element | Source File |
|-----------------|-------------|
| Mobile App Entry | `AndroidStudioProjects/WISE/lib/main.dart` |
| Mobile Navigation | `AndroidStudioProjects/WISE/lib/screens/MainScreen.dart` |
| AI Classification Client | `AndroidStudioProjects/WISE/lib/services/ai_service.dart` |
| Push Notifications (Mobile) | `AndroidStudioProjects/WISE/lib/services/push_notification_service.dart` |
| Web API Client | `WISE/assets/js/core/api.js` |
| Web Auth | `WISE/assets/js/core/auth.js` |
| Dashboard Service | `WISE/assets/js/services/dashboard.service.js` |
| Backend Entry | `wise-backend/apps/main.py` |
| Backend Config | `wise-backend/apps/config.py` |
| Database Setup | `wise-backend/apps/database.py` |
| AI Model Service | `wise-backend/apps/services/model_service.py` |
| Prediction Endpoint | `wise-backend/apps/routers/prediction.py` |
| Push Service | `wise-backend/apps/services/push.py` |
| Auto-Status Worker | `wise-backend/apps/main.py:258-287` |
| Notification Router | `wise-backend/apps/routers/notifications.py` |
| Collection Schedule Worker | `wise-backend/apps/services/collection_schedule.py` |

---

## Validation Summary

- **Archify Profile:** Standard
- **Composition Status:** PASS (0 errors, 12 warnings)
- **Artifact Checks:** 9/9 passed
- **Diagram Type:** Architecture (signal-flow preset with trace animation)
- **Components:** 8 nodes, 11 connections, 3 boundaries, 6 info cards
- **Views:** 5 guided chapters for presentation

---

*Generated by Archify from actual WISE source code analysis. No components were invented — all elements trace to real source files.*