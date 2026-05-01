"""
routes/stations.py
Endpoints:
  GET  /stations               – All stations with available point count
  GET  /nearby-stations        – Sorted by Haversine distance (?lat=&lng=)
  GET  /slots/<station_id>     – Slot availability per point for a date

Admin:
  POST /admin/stations         – Add a new station
  POST /admin/points           – Add a charging point to a station
  GET  /admin/bookings         – All bookings (admin only)
"""

import math
from flask import Blueprint, jsonify, request
from db import get_connection
from routes.auth import require_auth, require_admin
from datetime import datetime, date

stations_bp = Blueprint("stations", __name__)


def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl  = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


# ─── GET /stations ─────────────────────────────────────────────────────────────
@stations_bp.route("/stations", methods=["GET"])
def get_stations():

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT s.station_id, s.station_name, s.location,
                   s.latitude, s.longitude, s.total_points,
                   COUNT(CASE WHEN cp.status = 'Available' THEN 1 END) AS available_points
            FROM Station s
            LEFT JOIN ChargingPoint cp ON s.station_id = cp.station_id
            GROUP BY s.station_id ORDER BY s.station_name
        """)
        stations = cursor.fetchall()
        for s in stations:
            s["latitude"]  = float(s["latitude"])
            s["longitude"] = float(s["longitude"])
        return jsonify({"success": True, "data": stations})
    finally:
        cursor.close(); conn.close()


# ─── GET /nearby-stations ──────────────────────────────────────────────────────
@stations_bp.route("/nearby-stations", methods=["GET"])
def get_nearby_stations():
    try:
        user_lat = float(request.args.get("lat", 0))
        user_lng = float(request.args.get("lng", 0))
    except ValueError:
        return jsonify({"success": False, "error": "Invalid lat/lng parameters"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT s.station_id, s.station_name, s.location,
                   s.latitude, s.longitude, s.total_points,
                   COUNT(CASE WHEN cp.status = 'Available' THEN 1 END) AS available_points
            FROM Station s
            LEFT JOIN ChargingPoint cp ON s.station_id = cp.station_id
            GROUP BY s.station_id
        """)
        stations = cursor.fetchall()
        for s in stations:
            s["latitude"]    = float(s["latitude"])
            s["longitude"]   = float(s["longitude"])
            s["distance_km"] = haversine(user_lat, user_lng, s["latitude"], s["longitude"])
            
        # Filter stations within 50 km radius
        stations = [s for s in stations if s["distance_km"] <= 50.0]
        stations.sort(key=lambda s: s["distance_km"])
        return jsonify({"success": True, "data": stations})
    finally:
        cursor.close(); conn.close()


# ─── GET /slots/<station_id> ──────────────────────────────────────────────────
@stations_bp.route("/slots/<int:station_id>", methods=["GET"])
def get_slots(station_id):
    booking_date = request.args.get("date")
    if not booking_date:
        return jsonify({"success": False, "error": "date query param required (YYYY-MM-DD)"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT point_id, status FROM ChargingPoint WHERE station_id = %s", (station_id,))
        points = cursor.fetchall()
        cursor.execute("SELECT * FROM TimeSlot ORDER BY start_time")
        timeslots = cursor.fetchall()
        cursor.execute("""
            SELECT b.point_id, b.slot_id FROM Booking b
            JOIN ChargingPoint cp ON b.point_id = cp.point_id
            WHERE cp.station_id = %s AND b.booking_date = %s AND b.status = 'Confirmed'
        """, (station_id, booking_date))
        booked = {(r["point_id"], r["slot_id"]) for r in cursor.fetchall()}

        today = date.today()
        now   = datetime.now()
        result = []
        for pt in points:
            slots_info = []
            for sl in timeslots:
                is_booked = (pt["point_id"], sl["slot_id"]) in booked
                # Determine if slot is in the past
                slot_dt = datetime.strptime(f"{booking_date} {str(sl['start_time'])}", "%Y-%m-%d %H:%M:%S")
                booking_date_obj = date.fromisoformat(booking_date)
                in_past = (booking_date_obj < today) or \
                          (booking_date_obj == today and now >= slot_dt)
                slots_info.append({
                    "slot_id":    sl["slot_id"],
                    "start_time": str(sl["start_time"]),
                    "end_time":   str(sl["end_time"]),
                    "available":  not is_booked and pt["status"] == "Available" and not in_past,
                    "past":       in_past,
                })
            result.append({"point_id": pt["point_id"], "status": pt["status"], "slots": slots_info})
        return jsonify({"success": True, "data": result})
    finally:
        cursor.close(); conn.close()


# ─── POST /admin/stations ──────────────────────────────────────────────────────
@stations_bp.route("/admin/stations", methods=["POST"])
@require_admin
def admin_add_station():
    data = request.get_json() or {}
    required = ["station_name", "location", "latitude", "longitude"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"success": False, "error": f"Missing: {', '.join(missing)}"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            INSERT INTO Station (station_name, location, latitude, longitude, total_points)
            VALUES (%s, %s, %s, %s, 0)
        """, (data["station_name"], data["location"], data["latitude"], data["longitude"]))
        sid = cursor.lastrowid
        return jsonify({"success": True, "data": {"station_id": sid, **data}}), 201
    finally:
        cursor.close(); conn.close()


# ─── POST /admin/points ────────────────────────────────────────────────────────
@stations_bp.route("/admin/points", methods=["POST"])
@require_admin
def admin_add_point():
    data = request.get_json() or {}
    station_id = data.get("station_id")
    if not station_id:
        return jsonify({"success": False, "error": "station_id required"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT station_id FROM Station WHERE station_id = %s", (station_id,))
        if not cursor.fetchone():
            return jsonify({"success": False, "error": "Station not found."}), 404
        cursor.execute("INSERT INTO ChargingPoint (station_id, status) VALUES (%s, 'Available')", (station_id,))
        pid = cursor.lastrowid
        cursor.execute("UPDATE Station SET total_points = total_points + 1 WHERE station_id = %s", (station_id,))
        return jsonify({"success": True, "data": {"point_id": pid, "station_id": station_id, "status": "Available"}}), 201
    finally:
        cursor.close(); conn.close()


# ─── GET /admin/bookings ───────────────────────────────────────────────────────
@stations_bp.route("/admin/bookings", methods=["GET"])
@require_admin
def admin_all_bookings():

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT b.booking_id, b.booking_date, b.status,
                   u.name AS user_name, u.email,
                   s.station_name, s.location, cp.point_id,
                   ts.start_time, ts.end_time
            FROM Booking b
            JOIN User u          ON b.user_id  = u.user_id
            JOIN ChargingPoint cp ON b.point_id = cp.point_id
            JOIN Station s        ON cp.station_id = s.station_id
            JOIN TimeSlot ts      ON b.slot_id  = ts.slot_id
            ORDER BY b.booking_date DESC, ts.start_time DESC
        """)
        bookings = cursor.fetchall()
        for bk in bookings:
            bk["start_time"]   = str(bk["start_time"])
            bk["end_time"]     = str(bk["end_time"])
            bk["booking_date"] = bk["booking_date"].isoformat() if hasattr(bk["booking_date"], "isoformat") else bk["booking_date"]
        return jsonify({"success": True, "data": bookings})
    finally:
        cursor.close(); conn.close()
