from functools import wraps
from flask import request, jsonify, g, current_app
import jwt
from datetime import datetime, timedelta, timezone
from config import Config
from database import get_db_connection

def get_jwt_secret():
    try:
        if current_app:
            return current_app.config.get("JWT_SECRET", Config.JWT_SECRET)
    except Exception:
        pass
    return Config.JWT_SECRET

def generate_token(user: dict) -> str:
    """Generate signed JWT token containing user identity and role claims."""
    payload = {
        "sub": str(user["id"]),
        "username": user["username"],
        "role": user["role"],
        "full_name": user["full_name"],
        "department_id": user["department_id"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=Config.JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm="HS256")

def token_required(f):
    """Decorator to enforce and decode valid JWT bearer token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization token is missing"}), 401
        
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Invalid Authorization header format. Expected 'Bearer <token>'"}), 401

        token = parts[1]
        try:
            payload = jwt.decode(token, get_jwt_secret(), algorithms=["HS256"])
            g.current_user = {
                "id": int(payload["sub"]),
                "username": payload["username"],
                "role": payload["role"],
                "full_name": payload.get("full_name"),
                "department_id": payload.get("department_id")
            }
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session has expired. Please log in again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token signature"}), 401

        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    """Decorator to enforce Admin-only role on protected endpoints."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, "current_user") or g.current_user.get("role") != "admin":
            return jsonify({
                "error": "Forbidden: Administrative privileges are required for this action.",
                "code": "ADMIN_ROLE_REQUIRED"
            }), 403
        return f(*args, **kwargs)
    return decorated

def staff_required(f):
    """Decorator to enforce Staff or Admin role on protected endpoints."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, "current_user") or g.current_user.get("role") not in ["staff", "admin"]:
            return jsonify({
                "error": "Forbidden: Staff credentials required.",
                "code": "STAFF_ROLE_REQUIRED"
            }), 403
        return f(*args, **kwargs)
    return decorated

def verify_staff_assignment(staff_id: int, subject_id: int, section_id: int) -> bool:
    """Verify if a staff member is assigned to teach a specific subject to a section."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id FROM staff_assignments
        WHERE staff_id = ? AND subject_id = ? AND section_id = ?;
    """, (staff_id, subject_id, section_id))
    row = cursor.fetchone()
    conn.close()
    return row is not None
