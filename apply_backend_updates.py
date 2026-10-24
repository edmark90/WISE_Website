import os

backend_root = r"C:\Users\Admin\OneDrive\Desktop\wise-backend"

# 1. Update apps/models/collection_schedule.py
model_code = """from sqlalchemy import Column, Integer, String, Date, Time, DateTime, Text
from sqlalchemy.sql import func
from apps.database import Base

class CollectionSchedule(Base):
    __tablename__ = "collection_schedule"
    
    id = Column(Integer, primary_key=True, index=True)
    barangay = Column(String(100), nullable=False)
    zone = Column(String(50), nullable=False, default="")
    route_name = Column(String(255), nullable=True)
    starting_point = Column(String(255), nullable=True)
    truck_number = Column(String(100), nullable=True, default="")
    collection_date = Column(Date, nullable=False)
    collection_time = Column(Time, nullable=False)
    assigned_personnel = Column(String(255), nullable=False, default="")
    status = Column(String(20), default="Upcoming")
    remarks = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
"""

with open(os.path.join(backend_root, "apps", "models", "collection_schedule.py"), "w", encoding="utf-8") as f:
    f.write(model_code)
print("1. Updated apps/models/collection_schedule.py")

# 2. Update apps/schemas/collection_schedule.py
schema_code = """from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date, time, datetime

class CollectionScheduleCreate(BaseModel):
    barangay: str
    zone: str = ""
    route_name: Optional[str] = None
    starting_point: Optional[str] = None
    truck_number: Optional[str] = ""
    collection_date: date
    collection_time: time
    assigned_personnel: str = ""
    status: str = "Upcoming"
    remarks: Optional[str] = None

class BatchScheduleCreate(BaseModel):
    schedules: list[CollectionScheduleCreate]

class CollectionScheduleUpdate(BaseModel):
    barangay: Optional[str] = None
    zone: Optional[str] = None
    route_name: Optional[str] = None
    starting_point: Optional[str] = None
    truck_number: Optional[str] = None
    collection_date: Optional[date] = None
    collection_time: Optional[time] = None
    assigned_personnel: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None
    reason: Optional[str] = None
    reason_other: Optional[str] = None
    additional_message: Optional[str] = None

class ScheduleStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None
    reason_other: Optional[str] = None
    additional_message: Optional[str] = None


class CollectionScheduleListItem(BaseModel):
    \"\"\"Lightweight schedule schema for list views.\"\"\"
    model_config = ConfigDict(from_attributes=True)

    id: int
    barangay: str
    zone: str
    route_name: Optional[str] = None
    starting_point: Optional[str] = None
    truck_number: Optional[str] = ""
    collection_date: date
    collection_time: time
    assigned_personnel: str
    status: str


class CollectionScheduleResponse(BaseModel):
    \"\"\"Full schedule schema for detail views.\"\"\"
    model_config = ConfigDict(from_attributes=True)

    id: int
    barangay: str
    zone: str
    route_name: Optional[str] = None
    starting_point: Optional[str] = None
    truck_number: Optional[str] = ""
    collection_date: date
    collection_time: time
    assigned_personnel: str
    status: str
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class CollectionScheduleListResponse(BaseModel):
    schedules: list[CollectionScheduleListItem]
    total: int
    page: int
    page_size: int

class RouteStopInfo(BaseModel):
    id: Optional[int] = None
    barangay: str
    zone: str = ""
    collection_time: Optional[time] = None
    status: str = "Upcoming"

class RoutePreviewAssignment(BaseModel):
    id: int
    truck_number: Optional[str] = ""
    assigned_personnel: str
    route_name: Optional[str] = None
    starting_point: Optional[str] = None
    barangay: str
    zone: str
    collection_date: date
    collection_time: time
    status: str
    remarks: Optional[str] = None
    stops: list[RouteStopInfo] = []

class RoutePreviewResponse(BaseModel):
    date: date
    total_assignments: int
    assignments: list[RoutePreviewAssignment]
"""

with open(os.path.join(backend_root, "apps", "schemas", "collection_schedule.py"), "w", encoding="utf-8") as f:
    f.write(schema_code)
print("2. Updated apps/schemas/collection_schedule.py")

# 3. Update apps/services/collection_schedule.py
service_code = '''from sqlalchemy.orm import Session, load_only
from sqlalchemy import or_
from typing import Optional, List
from datetime import date, datetime, time, timedelta
from apps.models.collection_schedule import CollectionSchedule
from apps.models.notification import Notification
from apps.services.notification import (
    STATUS_TO_TYPE,
    handle_status_change,
    generate_route_notification,
    generate_reschedule_notification,
)
from apps.utils.ph_time import ph_now, ph_today

# Automatic statuses are derived from the server clock. Manual statuses
# (Delayed/Cancelled) are set via the status-change modal and preserved.
MANUAL_STATUSES = ("Cancelled", "Delayed")
AUTO_STATUSES = ("Upcoming", "Arriving", "Arrived", "Completed")
# A route flips to "Arriving" this many minutes before its scheduled time.
ARRIVING_LEAD_MINUTES = 30
# A route flips from "Arrived" to "Completed" this many minutes after its
# scheduled time, so today's route can reach "Completed" on collection day.
COMPLETED_AFTER_MINUTES = 60


def derive_schedule_status(schedule, now: Optional[datetime] = None) -> str:
    """Compute the server-time-derived status for a single route stop.

    Manual statuses (Cancelled/Delayed) are preserved untouched. Otherwise:
      - past date              -> Completed
      - future date            -> Upcoming
      - today, > lead          -> Upcoming
      - today, in lead         -> Arriving
      - today, at/until +60min -> Arrived
      - today, after +60min    -> Completed
    """
    if schedule.status in MANUAL_STATUSES:
        return schedule.status
    d = schedule.collection_date
    t = schedule.collection_time
    if not d or not t:
        return schedule.status or "Upcoming"
    now = now or ph_now()
    if d < now.date():
        return "Completed"
    if d > now.date():
        return "Upcoming"
    sched_dt = datetime.combine(d, t)
    if now < sched_dt - timedelta(minutes=ARRIVING_LEAD_MINUTES):
        return "Upcoming"
    if now < sched_dt:
        return "Arriving"
    if now < sched_dt + timedelta(minutes=COMPLETED_AFTER_MINUTES):
        return "Arrived"
    return "Completed"


def apply_derived_statuses(schedules, now: Optional[datetime] = None):
    """Overwrite each schedule's status with its server-time-derived value.

    In-memory only (read paths) — the changes are never committed, so the
    stored column keeps manual values while responses always reflect the
    server clock.
    """
    if not schedules:
        return schedules
    now = now or ph_now()
    for s in schedules:
        s.status = derive_schedule_status(s, now)
    return schedules


def sync_auto_status_notifications(db: Session) -> int:
    """Materialize Arriving / Arrived / Completed notifications for today."""
    emitted = 0
    today = ph_today()
    start = datetime.combine(today, time.min)
    end = datetime.combine(today, time.max)
    schedules = db.query(CollectionSchedule).filter(
        CollectionSchedule.collection_date == today
    ).all()
    for s in schedules:
        if s.status in MANUAL_STATUSES:
            continue
        derived = derive_schedule_status(s)
        if derived not in ("Arriving", "Arrived", "Completed"):
            continue
        notification_type = STATUS_TO_TYPE.get(derived)
        if not notification_type:
            continue
        existing = db.query(Notification.id).filter(
            Notification.schedule_id == s.id,
            Notification.notification_type == notification_type,
            Notification.status == "Sent",
            Notification.created_at >= start,
            Notification.created_at <= end,
        ).first()
        if existing:
            continue
        if generate_route_notification(db, s, notification_type) is not None:
            emitted += 1
    return emitted


def _normalize_status(schedule_data: dict) -> dict:
    """Ensure a create/update payload never stores an automatic status."""
    status = schedule_data.get("status")
    if status in AUTO_STATUSES:
        schedule_data = dict(schedule_data)
        schedule_data["status"] = "Upcoming"
    return schedule_data


def validate_schedule_conflict(
    db: Session,
    collection_date: date,
    collection_time: time,
    truck_number: Optional[str] = None,
    assigned_personnel: Optional[str] = None,
    exclude_id: Optional[int] = None
):
    """Validate that the assigned truck and personnel do not have a simultaneous
    overlapping assignment on the same date and time.
    """
    truck = (truck_number or "").strip()
    personnel = (assigned_personnel or "").strip()
    time_str = collection_time.strftime("%I:%M %p") if collection_time else "this time"

    if truck:
        query = db.query(CollectionSchedule).filter(
            CollectionSchedule.collection_date == collection_date,
            CollectionSchedule.collection_time == collection_time,
            CollectionSchedule.truck_number == truck,
            CollectionSchedule.status != "Cancelled"
        )
        if exclude_id is not None:
            query = query.filter(CollectionSchedule.id != exclude_id)
        existing = query.first()
        if existing:
            existing_route = existing.route_name or existing.starting_point or f"{existing.barangay} Route"
            raise ValueError(f"Truck '{truck}' is already assigned to {existing_route} on {collection_date} at {time_str}.")

    if personnel:
        query = db.query(CollectionSchedule).filter(
            CollectionSchedule.collection_date == collection_date,
            CollectionSchedule.collection_time == collection_time,
            CollectionSchedule.assigned_personnel == personnel,
            CollectionSchedule.status != "Cancelled"
        )
        if exclude_id is not None:
            query = query.filter(CollectionSchedule.id != exclude_id)
        existing = query.first()
        if existing:
            existing_route = existing.route_name or existing.starting_point or f"{existing.barangay} Route"
            raise ValueError(f"Personnel '{personnel}' is already assigned to {existing_route} on {collection_date} at {time_str}.")


def get_collection_schedules(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    search: Optional[str] = None,
    status: Optional[str] = None,
    barangay: Optional[str] = None,
    truck_number: Optional[str] = None,
    personnel: Optional[str] = None,
):
    """Get collection schedules with filtering, search, and pagination."""
    query = db.query(CollectionSchedule)
    
    if search:
        query = query.filter(
            or_(
                CollectionSchedule.barangay.ilike(f"%{search}%"),
                CollectionSchedule.zone.ilike(f"%{search}%"),
                CollectionSchedule.assigned_personnel.ilike(f"%{search}%"),
                CollectionSchedule.route_name.ilike(f"%{search}%"),
                CollectionSchedule.truck_number.ilike(f"%{search}%"),
            )
        )
    
    if status:
        query = query.filter(CollectionSchedule.status == status)
    
    if barangay:
        query = query.filter(CollectionSchedule.barangay == barangay)

    if truck_number:
        query = query.filter(CollectionSchedule.truck_number == truck_number)

    if personnel:
        query = query.filter(CollectionSchedule.assigned_personnel.ilike(f"%{personnel}%"))
    
    total = query.count()
    schedules = query.order_by(
        CollectionSchedule.collection_date.asc(),
        CollectionSchedule.collection_time.asc()
    ).offset(skip).limit(limit).all()
    
    return {"schedules": apply_derived_statuses(schedules), "total": total}


def get_schedules_by_date(
    db: Session,
    target_date: date,
    status: Optional[str] = None,
    truck_number: Optional[str] = None,
    personnel: Optional[str] = None,
    barangay: Optional[str] = None,
):
    """Get all collection assignments for a specific date (calendar/day view)."""
    query = db.query(CollectionSchedule).filter(
        CollectionSchedule.collection_date == target_date
    )
    if status:
        query = query.filter(CollectionSchedule.status == status)
    if truck_number:
        query = query.filter(CollectionSchedule.truck_number == truck_number)
    if personnel:
        query = query.filter(CollectionSchedule.assigned_personnel.ilike(f"%{personnel}%"))
    if barangay:
        query = query.filter(CollectionSchedule.barangay == barangay)
    return apply_derived_statuses(query.order_by(CollectionSchedule.collection_time.asc()).all())


def get_schedules_by_date_range(
    db: Session,
    start_date: date,
    end_date: date,
    truck_number: Optional[str] = None,
    personnel: Optional[str] = None,
    barangay: Optional[str] = None,
):
    """Get schedules within a date range (calendar / mobile view)."""
    query = db.query(CollectionSchedule).filter(
        CollectionSchedule.collection_date >= start_date,
        CollectionSchedule.collection_date <= end_date
    )
    if truck_number:
        query = query.filter(CollectionSchedule.truck_number == truck_number)
    if personnel:
        query = query.filter(CollectionSchedule.assigned_personnel.ilike(f"%{personnel}%"))
    if barangay:
        query = query.filter(CollectionSchedule.barangay == barangay)
    return apply_derived_statuses(query.order_by(CollectionSchedule.collection_date.asc(), CollectionSchedule.collection_time.asc()).all())


def get_collection_schedule_by_id(db: Session, schedule_id: int):
    """Get a collection schedule by ID."""
    return db.query(CollectionSchedule).filter(CollectionSchedule.id == schedule_id).first()


def _populate_schedule_defaults(schedule_data: dict) -> dict:
    """Auto-populate route_name, starting_point, truck_number, and remarks when not provided."""
    barangay = schedule_data.get("barangay") or "Collection"
    zone = schedule_data.get("zone") or ""

    if not schedule_data.get("starting_point"):
        schedule_data["starting_point"] = zone if zone else f"{barangay} Center"

    if not schedule_data.get("route_name"):
        sp = schedule_data["starting_point"]
        if sp and sp.lower() != barangay.lower() and sp.lower() != f"{barangay.lower()} center":
            schedule_data["route_name"] = f"{barangay} - {sp} Route"
        else:
            schedule_data["route_name"] = f"{barangay} Route"

    if not schedule_data.get("remarks"):
        schedule_data["remarks"] = "Regular Scheduled Collection"

    if "truck_number" not in schedule_data or schedule_data["truck_number"] is None:
        schedule_data["truck_number"] = ""

    return schedule_data


def create_collection_schedule(db: Session, schedule_data: dict, notify: bool = True):
    """Create a new collection assignment for a date.
    Never overwrites or replaces existing assignments on the same date.
    """
    schedule_data = _populate_schedule_defaults(schedule_data)
    schedule_data = _normalize_status(schedule_data)

    validate_schedule_conflict(
        db,
        schedule_data.get("collection_date"),
        schedule_data.get("collection_time"),
        schedule_data.get("truck_number"),
        schedule_data.get("assigned_personnel")
    )

    db_schedule = CollectionSchedule(**schedule_data)
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)

    if notify and db_schedule.status == "Upcoming":
        generate_route_notification(
            db, db_schedule, "Upcoming Collection",
        )
    return db_schedule


def create_collection_schedules_batch(
    db: Session,
    schedules: List[dict],
    created_by: Optional[int] = None,
    created_by_name: Optional[str] = None,
):
    """Create multiple collection schedules for a day in one call."""
    created = []
    for schedule_data in schedules:
        schedule_data = _populate_schedule_defaults(schedule_data)
        schedule_data = _normalize_status(schedule_data)
        validate_schedule_conflict(
            db,
            schedule_data.get("collection_date"),
            schedule_data.get("collection_time"),
            schedule_data.get("truck_number"),
            schedule_data.get("assigned_personnel")
        )
        db_schedule = CollectionSchedule(**schedule_data)
        db.add(db_schedule)
        db.commit()
        db.refresh(db_schedule)
        created.append(db_schedule)

    if created:
        first = created[0]
        if first.status == "Upcoming":
            generate_route_notification(
                db, first, "Upcoming Collection",
                created_by=created_by,
                created_by_name=created_by_name,
                all_schedules=created,
            )
    return created


def update_collection_schedule(db: Session, schedule_id: int, schedule_data: dict,
                               created_by: Optional[int] = None,
                               created_by_name: Optional[str] = None):
    """Update a collection assignment. Validates conflicts excluding self."""
    db_schedule = get_collection_schedule_by_id(db, schedule_id)
    if not db_schedule:
        return None

    target_date = schedule_data.get("collection_date") or db_schedule.collection_date
    target_time = schedule_data.get("collection_time") or db_schedule.collection_time
    target_truck = schedule_data.get("truck_number") if "truck_number" in schedule_data else db_schedule.truck_number
    target_personnel = schedule_data.get("assigned_personnel") if "assigned_personnel" in schedule_data else db_schedule.assigned_personnel

    validate_schedule_conflict(
        db,
        target_date,
        target_time,
        target_truck,
        target_personnel,
        exclude_id=schedule_id
    )

    old_status = db_schedule.status
    old_date = db_schedule.collection_date
    new_status = schedule_data.get("status")
    reason = schedule_data.pop("reason", None)
    reason_other = schedule_data.pop("reason_other", None)
    additional_message = schedule_data.pop("additional_message", None)

    if new_status in AUTO_STATUSES:
        schedule_data.pop("status", None)
        new_status = None

    for key, value in schedule_data.items():
        if value is not None:
            setattr(db_schedule, key, value)

    db.commit()
    db.refresh(db_schedule)

    if old_status in ("Cancelled", "Delayed") and db_schedule.collection_date != old_date:
        if db_schedule.status != "Upcoming":
            db_schedule.status = "Upcoming"
            db.commit()
            db.refresh(db_schedule)
        generate_reschedule_notification(
            db, db_schedule, old_date, old_status,
            created_by=created_by, created_by_name=created_by_name,
        )
    elif new_status and new_status != old_status:
        handle_status_change(
            db, db_schedule, new_status, reason, reason_other,
            additional_message, created_by, created_by_name,
        )
    return db_schedule


def set_schedule_status(db: Session, schedule_id: int, new_status: str,
                        reason: Optional[str] = None,
                        reason_other: Optional[str] = None,
                        additional_message: Optional[str] = None,
                        created_by: Optional[int] = None,
                        created_by_name: Optional[str] = None):
    """Set a route's status manually (Delayed/Cancelled flow) + notify."""
    if new_status not in MANUAL_STATUSES:
        raise ValueError("Only Delayed or Cancelled can be set manually.")
    db_schedule = get_collection_schedule_by_id(db, schedule_id)
    if not db_schedule:
        return None

    old_status = db_schedule.status
    db_schedule.status = new_status
    reason_text = (reason_other if reason == "Others" and reason_other else reason) or ""
    if reason_text or additional_message:
        parts = []
        if reason_text:
            parts.append(f"Status: {new_status} ({reason_text})")
        if additional_message:
            parts.append(additional_message)
        db_schedule.remarks = " | ".join(parts)
    elif new_status in ("Delayed", "Cancelled"):
        db_schedule.remarks = f"Collection {new_status}"
    db.commit()
    db.refresh(db_schedule)

    if new_status != old_status:
        handle_status_change(
            db, db_schedule, new_status, reason, reason_other,
            additional_message, created_by, created_by_name,
        )
    return db_schedule


def delete_collection_schedule(db: Session, schedule_id: int):
    """Delete a single collection schedule assignment."""
    db_schedule = get_collection_schedule_by_id(db, schedule_id)
    if not db_schedule:
        return None
    
    db.delete(db_schedule)
    db.commit()
    return db_schedule


def get_route_preview_data(db: Session, target_date: date) -> dict:
    """Get all routes and assignments for a date formatted for the Route Preview map."""
    schedules = get_schedules_by_date(db, target_date)
    assignments = []
    for s in schedules:
        route_name = s.route_name or s.starting_point or (f"{s.barangay} Route" if s.barangay else "Collection Route")
        stops = []
        if s.zone:
            for z_part in s.zone.split(","):
                part = z_part.strip()
                if part:
                    stops.append({
                        "id": s.id,
                        "barangay": s.barangay,
                        "zone": part,
                        "collection_time": s.collection_time,
                        "status": s.status,
                    })
        if not stops:
            stops.append({
                "id": s.id,
                "barangay": s.barangay,
                "zone": s.zone or "",
                "collection_time": s.collection_time,
                "status": s.status,
            })
            
        assignments.append({
            "id": s.id,
            "truck_number": s.truck_number or "",
            "assigned_personnel": s.assigned_personnel or "",
            "route_name": route_name,
            "starting_point": s.starting_point or "",
            "barangay": s.barangay,
            "zone": s.zone or "",
            "collection_date": s.collection_date,
            "collection_time": s.collection_time,
            "status": s.status,
            "remarks": s.remarks,
            "stops": stops,
        })
    return {
        "date": target_date,
        "total_assignments": len(assignments),
        "assignments": assignments
    }
'''

with open(os.path.join(backend_root, "apps", "services", "collection_schedule.py"), "w", encoding="utf-8") as f:
    f.write(service_code)
print("3. Updated apps/services/collection_schedule.py")

# 4. Update apps/routers/collection_schedules.py
router_code = '''from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
from apps.database import get_db
from apps.schemas.collection_schedule import (
    CollectionScheduleCreate,
    CollectionScheduleUpdate,
    CollectionScheduleResponse,
    CollectionScheduleListResponse,
    ScheduleStatusUpdate,
    BatchScheduleCreate,
    RoutePreviewResponse,
)
from apps.services.collection_schedule import (
    get_collection_schedules,
    get_schedules_by_date,
    get_schedules_by_date_range,
    get_collection_schedule_by_id,
    create_collection_schedule,
    create_collection_schedules_batch,
    update_collection_schedule,
    delete_collection_schedule,
    set_schedule_status,
    apply_derived_statuses,
    get_route_preview_data,
)
from apps.utils.jwt import get_current_admin, get_current_user
from apps.models.user import User

router = APIRouter()

@router.get("/", response_model=CollectionScheduleListResponse)
def list_collection_schedules(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    barangay: Optional[str] = None,
    truck_number: Optional[str] = None,
    personnel: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get all collection schedules with search, filtering, and pagination."""
    skip = (page - 1) * page_size
    result = get_collection_schedules(
        db,
        skip=skip,
        limit=page_size,
        search=search,
        status=status,
        barangay=barangay,
        truck_number=truck_number,
        personnel=personnel,
    )
    
    return {
        "schedules": result["schedules"],
        "total": result["total"],
        "page": page,
        "page_size": page_size
    }

@router.get("/route-preview/", response_model=RoutePreviewResponse)
def get_route_preview_for_date(
    target_date: date = Query(..., description="Target collection date for route preview"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get structured route preview data for all collection assignments on a specific date."""
    return get_route_preview_data(db, target_date)

@router.get("/by-date/", response_model=list[CollectionScheduleResponse])
def list_schedules_by_date(
    target_date: date = Query(...),
    status: Optional[str] = Query(None, description="Filter by route status (e.g. Delayed, Cancelled)"),
    truck_number: Optional[str] = Query(None, description="Filter by truck number"),
    personnel: Optional[str] = Query(None, description="Filter by personnel"),
    barangay: Optional[str] = Query(None, description="Filter by barangay"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all schedules for a specific date, optionally filtered by status, truck, personnel, or barangay."""
    return get_schedules_by_date(
        db,
        target_date,
        status=status,
        truck_number=truck_number,
        personnel=personnel,
        barangay=barangay,
    )

@router.get("/by-date-range/", response_model=list[CollectionScheduleResponse])
def list_schedules_by_date_range(
    start_date: date = Query(...),
    end_date: date = Query(...),
    truck_number: Optional[str] = Query(None, description="Filter by truck number"),
    personnel: Optional[str] = Query(None, description="Filter by personnel"),
    barangay: Optional[str] = Query(None, description="Filter by barangay"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get schedules within a date range (for calendar display - admin only)."""
    return get_schedules_by_date_range(
        db,
        start_date,
        end_date,
        truck_number=truck_number,
        personnel=personnel,
        barangay=barangay,
    )

@router.get("/mobile/upcoming/", response_model=list[CollectionScheduleResponse])
def list_mobile_upcoming_schedules(
    start_date: date = Query(...),
    end_date: date = Query(...),
    truck_number: Optional[str] = Query(None, description="Filter by truck number"),
    personnel: Optional[str] = Query(None, description="Filter by personnel"),
    barangay: Optional[str] = Query(None, description="Filter by barangay"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get upcoming schedules for mobile users (any authenticated user)."""
    return get_schedules_by_date_range(
        db,
        start_date,
        end_date,
        truck_number=truck_number,
        personnel=personnel,
        barangay=barangay,
    )

@router.get("/by-personnel/{personnel_name}", response_model=list[CollectionScheduleResponse])
def list_schedules_by_personnel(
    personnel_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all collection assignments for a specific personnel."""
    return get_schedules_by_date_range(
        db,
        date(2000, 1, 1),
        date(2100, 12, 31),
        personnel=personnel_name
    )

@router.get("/by-truck/{truck_number}", response_model=list[CollectionScheduleResponse])
def list_schedules_by_truck(
    truck_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all collection assignments for a specific truck."""
    return get_schedules_by_date_range(
        db,
        date(2000, 1, 1),
        date(2100, 12, 31),
        truck_number=truck_number
    )

@router.get("/{schedule_id}", response_model=CollectionScheduleResponse)
def get_collection_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get a specific collection schedule by ID."""
    schedule = get_collection_schedule_by_id(db, schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection schedule not found"
        )
    apply_derived_statuses([schedule])
    return schedule

@router.post("/{schedule_id}/status", response_model=CollectionScheduleResponse)
def change_schedule_status(
    schedule_id: int,
    status_data: ScheduleStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Set a route's status (Delayed/Cancelled flow) and auto-generate notification."""
    try:
        schedule = set_schedule_status(
            db,
            schedule_id,
            status_data.status,
            reason=status_data.reason,
            reason_other=status_data.reason_other,
            additional_message=status_data.additional_message,
            created_by=current_user.id,
            created_by_name=current_user.fullname,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection schedule not found"
        )
    return schedule

@router.post("/batch", response_model=list[CollectionScheduleResponse], status_code=status.HTTP_201_CREATED)
def create_batch_collection_schedules(
    payload: BatchScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Create multiple collection routes for the same day in one call."""
    try:
        return create_collection_schedules_batch(
            db,
            [s.model_dump() for s in payload.schedules],
            created_by=current_user.id,
            created_by_name=current_user.fullname,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/", response_model=CollectionScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_new_collection_schedule(
    schedule_data: CollectionScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Create a new collection assignment."""
    try:
        schedule = create_collection_schedule(db, schedule_data.model_dump())
        return schedule
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{schedule_id}", response_model=CollectionScheduleResponse)
def update_existing_collection_schedule(
    schedule_id: int,
    schedule_data: CollectionScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Update an existing collection schedule."""
    try:
        schedule = update_collection_schedule(
            db,
            schedule_id,
            schedule_data.model_dump(exclude_unset=True),
            created_by=current_user.id,
            created_by_name=current_user.fullname,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection schedule not found"
        )
    return schedule

@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_collection_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Delete a collection schedule."""
    schedule = delete_collection_schedule(db, schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection schedule not found"
        )
    return None
'''

with open(os.path.join(backend_root, "apps", "routers", "collection_schedules.py"), "w", encoding="utf-8") as f:
    f.write(router_code)
print("4. Updated apps/routers/collection_schedules.py")

# 5. Update apps/main.py (schema migration for truck_number)
main_path = os.path.join(backend_root, "apps", "main.py")
with open(main_path, "r", encoding="utf-8") as f:
    main_content = f.read()

migration_target = 'if "starting_point" not in s_cols:'
migration_addition = '''if "truck_number" not in s_cols:
                conn.execute(text("ALTER TABLE collection_schedule ADD COLUMN truck_number VARCHAR(100) NULL"))
            '''

if "truck_number" not in main_content:
    main_content = main_content.replace(
        migration_target,
        migration_addition + migration_target
    )
    with open(main_path, "w", encoding="utf-8") as f:
        f.write(main_content)
    print("5. Updated apps/main.py with truck_number migration")
else:
    print("5. apps/main.py already has truck_number migration")

print("Backend update script completed successfully!")
