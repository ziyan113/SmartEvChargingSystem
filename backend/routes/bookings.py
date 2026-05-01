"""
routes/bookings.py
Endpoints:
  POST   /book-slot
  GET    /my-bookings
  DELETE /cancel-booking/<booking_id>

All require a valid Bearer token.
Past date / past time slot bookings are rejected.
Late cancellation (< 30 min before slot) → 'Late Cancellation'.
"""

from flask import Blueprint, jsonify, request
from datetime import datetime, date, timedelta
from db import get_connection
import mysql.connector
from routes.auth import require_auth

bookings_bp = Blueprint("bookings", __name__)


# ─── POST /book-slot ───────────────────────────────────────────────────────────
@bookings_bp.route("/book-slot", methods=["POST"])
@require_auth
def book_slot():
    data = request.get_json() or {}
    required = ["point_id", "slot_id", "booking_date"]
    missing  = [f for f in required if data.get(f) is None]
    if missing:
        return jsonify({"success": False, "error": f"Missing fields: {', '.join(missing)}"}), 400

    # Use the authenticated user's id
    user_id      = request.user["user_id"]
    point_id     = int(data["point_id"])
    slot_id      = int(data["slot_id"])
    booking_date = data["booking_date"]   # "YYYY-MM-DD"

    # ── Past date / past slot validation ─────────────────────────────────────
    try:
        booking_date_obj = date.fromisoformat(booking_date)
    except ValueError:
        return jsonify({"success": False, "error": "Invalid date format. Use YYYY-MM-DD."}), 400

    today = date.today()
    if booking_date_obj < today:
        return jsonify({"success": False, "error": "Cannot book past dates."}), 400

    # ── MySQL mode ──────────────
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Validate slot is not in the past (for today's date)
        if booking_date_obj == today:
            cursor.execute("SELECT start_time FROM TimeSlot WHERE slot_id = %s", (slot_id,))
            slot = cursor.fetchone()
            if slot:
                # start_time is a timedelta from MySQL TIME
                td = slot["start_time"]
                slot_start_time = (datetime.min + td).time()
                if datetime.now().time() >= slot_start_time:
                    return jsonify({"success": False, "error": "Cannot book a past time slot."}), 400

        cursor.execute("SELECT status FROM ChargingPoint WHERE point_id = %s", (point_id,))
        point = cursor.fetchone()
        if not point:
            return jsonify({"success": False, "error": "Charging point not found"}), 404
        if point["status"] != "Available":
            return jsonify({"success": False, "error": f"Charging point is {point['status']}"}), 409

        cursor.execute("""
            INSERT INTO Booking (user_id, point_id, slot_id, booking_date, status)
            VALUES (%s, %s, %s, %s, 'Confirmed')
        """, (user_id, point_id, slot_id, booking_date))
        booking_id = cursor.lastrowid
        return jsonify({"success": True, "message": "Slot booked successfully!", "booking_id": booking_id}), 201

    except mysql.connector.IntegrityError as e:
        if e.errno == 1062:
            return jsonify({"success": False, "error": "This slot is already booked for the selected date and point."}), 409
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cursor.close(); conn.close()


# ─── GET /my-bookings ─────────────────────────────────────────────────────────
@bookings_bp.route("/my-bookings", methods=["GET"])
@require_auth
def my_bookings():
    user_id = request.user["user_id"]

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT b.booking_id, b.booking_date, b.status,
                   s.station_name, s.location, cp.point_id,
                   ts.start_time, ts.end_time
            FROM Booking b
            JOIN ChargingPoint cp ON b.point_id  = cp.point_id
            JOIN Station        s  ON cp.station_id = s.station_id
            JOIN TimeSlot       ts ON b.slot_id   = ts.slot_id
            WHERE b.user_id = %s
            ORDER BY b.booking_date DESC, ts.start_time DESC
        """, (user_id,))
        bookings = cursor.fetchall()
        for b in bookings:
            b["start_time"]   = str(b["start_time"])
            b["end_time"]     = str(b["end_time"])
            b["booking_date"] = b["booking_date"].isoformat() if hasattr(b["booking_date"], "isoformat") else b["booking_date"]
        return jsonify({"success": True, "data": bookings})
    finally:
        cursor.close(); conn.close()


# ─── DELETE /cancel-booking/<booking_id> ──────────────────────────────────────
@bookings_bp.route("/cancel-booking/<int:booking_id>", methods=["DELETE"])
@require_auth
def cancel_booking(booking_id):

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT b.booking_id, b.status, b.booking_date, ts.start_time
            FROM Booking b JOIN TimeSlot ts ON b.slot_id = ts.slot_id
            WHERE b.booking_id = %s
        """, (booking_id,))
        booking = cursor.fetchone()

        if not booking:
            return jsonify({"success": False, "error": "Booking not found"}), 404
        if booking["status"] in ("Cancelled", "Late Cancellation"):
            return jsonify({"success": False, "error": "Booking is already cancelled"}), 400
        if booking["status"] == "Completed":
            return jsonify({"success": False, "error": "Cannot cancel a completed booking"}), 400

        booking_date_obj = booking["booking_date"]
        if isinstance(booking_date_obj, str):
            booking_date_obj = datetime.strptime(booking_date_obj, "%Y-%m-%d").date()

        start_td   = booking["start_time"]
        slot_start = datetime.combine(booking_date_obj, (datetime.min + start_td).time())
        now        = datetime.now()

        new_status = "Late Cancellation" \
            if (slot_start > now and (slot_start - now) < timedelta(minutes=30)) \
            else "Cancelled"

        cursor.execute("UPDATE Booking SET status = %s WHERE booking_id = %s", (new_status, booking_id))
        return jsonify({"success": True, "message": f"Booking {new_status.lower()} successfully.", "status": new_status})
    finally:
        cursor.close(); conn.close()
