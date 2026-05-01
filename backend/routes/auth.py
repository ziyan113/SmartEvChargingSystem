"""
routes/auth.py
Endpoints:
  POST /auth/login   – Authenticate user/admin, return token + role
  POST /auth/logout  – Invalidate token
  GET  /auth/me      – Return current user from token
"""

from flask import Blueprint, jsonify, request
from db import check_db_available, get_connection
from json import dumps
from werkzeug.security import check_password_hash
import secrets

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

# ── In-memory session store (used for both demo + DB modes) ───────────────────
_sessions: dict = {}


def create_session(user_id, name, email, role):
    token = secrets.token_hex(32)
    _sessions[token] = {"user_id": user_id, "name": name, "email": email, "role": role}
    return token


def get_session(token):
    if not token:
        return None
    return _sessions.get(token)


def get_token_from_request():
    auth = request.headers.get("Authorization", "")
    return auth.replace("Bearer ", "").strip() or None


# ── Decorators ────────────────────────────────────────────────────────────────
from functools import wraps


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        session = get_session(token)
        if not session:
            return jsonify({"success": False, "error": "Unauthorized. Please log in."}), 401
        request.user = session
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        session = get_session(token)
        if not session:
            return jsonify({"success": False, "error": "Unauthorized."}), 401
        if session.get("role") != "admin":
            return jsonify({"success": False, "error": "Admin access required."}), 403
        request.user = session
        return f(*args, **kwargs)
    return decorated


# ── POST /auth/login ──────────────────────────────────────────────────────────
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"success": False, "error": "Email and password are required."}), 400

    # ── MySQL mode ─────────
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT user_id, name, email, phone, role, password FROM User WHERE LOWER(email) = %s",
            (email,)
        )
        user = cursor.fetchone()
        if not user:
            return jsonify({"success": False, "error": "Invalid email or password."}), 401

        # Check password (plain text per DB mismatch downgrade)
        stored_pw = user["password"] or ""
        valid = (stored_pw == password)

        if not valid:
            return jsonify({"success": False, "error": "Invalid email or password."}), 401

        role = user.get("role") or "user"
        token = create_session(user["user_id"], user["name"], user["email"], role)
        return jsonify({
            "success": True,
            "data": {
                "token":   token,
                "user_id": user["user_id"],
                "name":    user["name"],
                "email":   user["email"],
                "role":    role,
            }
        })
    finally:
        cursor.close()
        conn.close()


# ── POST /auth/signup ─────────────────────────────────────────────────────────
@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}
    name     = (data.get("name") or "").strip()
    email    = (data.get("email") or "").strip().lower()
    phone    = (data.get("phone") or "").strip()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"success": False, "error": "Name, email, and password are required."}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Check if email exists
        cursor.execute("SELECT user_id FROM User WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({"success": False, "error": "Email is already registered."}), 409

        cursor.execute(
            "INSERT INTO User (name, email, phone, password, role) VALUES (%s, %s, %s, %s, 'user')",
            (name, email, phone, password)
        )
        user_id = cursor.lastrowid
        conn.commit()

        # Log them in automatically
        token = create_session(user_id, name, email, "user")
        return jsonify({
            "success": True,
            "data": {
                "token":   token,
                "user_id": user_id,
                "name":    name,
                "email":   email,
                "role":    "user",
            }
        }), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


# ── POST /auth/logout ─────────────────────────────────────────────────────────
@auth_bp.route("/logout", methods=["POST"])
def logout():
    token = get_token_from_request()
    if token:
        _sessions.pop(token, None)
    return jsonify({"success": True, "message": "Logged out."})


# ── GET /auth/me ──────────────────────────────────────────────────────────────
@auth_bp.route("/me", methods=["GET"])
def me():
    token = get_token_from_request()
    session = get_session(token)
    if not session:
        return jsonify({"success": False, "error": "Not authenticated."}), 401
    return jsonify({"success": True, "data": session})
