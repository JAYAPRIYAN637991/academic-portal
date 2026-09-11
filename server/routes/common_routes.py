from flask import Blueprint, jsonify
from database import get_db_connection

common_bp = Blueprint("common", __name__, url_prefix="/api")

@common_bp.route("/health", methods=["GET"])
def health_check():
    """System health check endpoint."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users;")
        user_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM departments;")
        dept_count = cursor.fetchone()[0]
        conn.close()

        return jsonify({
            "status": "HEALTHY",
            "database": "CONNECTED",
            "users_registered": user_count,
            "departments_count": dept_count,
            "system_version": "1.0.0"
        }), 200
    except Exception as e:
        return jsonify({
            "status": "UNHEALTHY",
            "database": "ERROR",
            "error": str(e)
        }), 500

@common_bp.route("/notices", methods=["GET"])
def get_public_notices():
    """Retrieve official college notices."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT n.id, n.title, n.content, n.category, n.target_audience, n.created_at,
               u.full_name as author_name, d.dept_name
        FROM notices n
        JOIN users u ON n.published_by = u.id
        LEFT JOIN departments d ON n.department_id = d.id
        WHERE n.is_published = 1
        ORDER BY n.created_at DESC
        LIMIT 20;
    """)
    notices = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify({"notices": notices}), 200
