from flask import Blueprint, request, jsonify, g
from database import get_db_connection, check_password
from middleware import generate_token, token_required

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/login", methods=["POST"])
def login():
    """Authenticate Admin or Staff credentials and return JWT token."""
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.password_hash, u.full_name, u.email, u.role, u.department_id, d.dept_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.username = ?;
    """, (username,))
    user = cursor.fetchone()
    conn.close()

    if not user or not check_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid username or password"}), 401

    user_dict = dict(user)
    del user_dict["password_hash"]

    token = generate_token(user_dict)

    return jsonify({
        "message": "Authentication successful",
        "token": token,
        "user": {
            "id": user_dict["id"],
            "username": user_dict["username"],
            "full_name": user_dict["full_name"],
            "email": user_dict["email"],
            "role": user_dict["role"],
            "department_id": user_dict["department_id"],
            "dept_name": user_dict["dept_name"]
        }
    }), 200

@auth_bp.route("/me", methods=["GET"])
@token_required
def get_current_user():
    """Retrieve identity and permissions of the currently authenticated token."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.full_name, u.email, u.role, u.department_id, d.dept_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = ?;
    """, (g.current_user["id"],))
    user = cursor.fetchone()
    conn.close()

    if not user:
        return jsonify({"error": "User account no longer exists"}), 404

    return jsonify({"user": dict(user)}), 200

@auth_bp.route("/logout", methods=["POST"])
@token_required
def logout():
    """Stateless logout acknowledgement."""
    return jsonify({"message": "Successfully logged out"}), 200
