from flask import Blueprint, request, jsonify, g
from database import get_db_connection, hash_password
from middleware import token_required, admin_required

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

# Enforce Admin security globally across all endpoints in this blueprint
@admin_bp.before_request
@token_required
@admin_required
def enforce_admin_access():
    pass

@admin_bp.route("/dashboard-summary", methods=["GET"])
def get_dashboard_summary():
    """Retrieve top-level college metrics for Admin overview."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM departments;")
    dept_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'staff';")
    staff_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM students;")
    student_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM marks;")
    marks_recorded = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM notification_logs WHERE status = 'SENT';")
    notifications_sent = cursor.fetchone()[0]

    conn.close()

    return jsonify({
        "departments": dept_count,
        "staff": staff_count,
        "students": student_count,
        "marks_recorded": marks_recorded,
        "notifications_sent": notifications_sent
    }), 200

@admin_bp.route("/academic-structure", methods=["GET"])
def get_academic_structure():
    """Retrieve full hierarchy: Academic Years, Departments, Years, and Sections."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM academic_years ORDER BY id DESC;")
    acad_years = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM departments ORDER BY dept_code ASC;")
    depts = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM years ORDER BY year_number ASC;")
    years = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
        SELECT s.id, s.section_name, s.department_id, d.dept_code, s.year_id, y.year_name, s.academic_year_id, ay.year_name as academic_year_name
        FROM sections s
        JOIN departments d ON s.department_id = d.id
        JOIN years y ON s.year_id = y.id
        JOIN academic_years ay ON s.academic_year_id = ay.id
        ORDER BY d.dept_code, y.year_number, s.section_name;
    """)
    sections = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
        SELECT sub.id, sub.subject_code, sub.subject_name, sub.department_id, d.dept_code, sub.year_id, sub.semester
        FROM subjects sub
        JOIN departments d ON sub.department_id = d.id
        ORDER BY sub.subject_code;
    """)
    subjects = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return jsonify({
        "academic_years": acad_years,
        "departments": depts,
        "years": years,
        "sections": sections,
        "subjects": subjects
    }), 200

@admin_bp.route("/departments", methods=["POST"])
def create_department():
    """Register a new college department."""
    data = request.get_json() or {}
    code = data.get("dept_code", "").strip().upper()
    name = data.get("dept_name", "").strip()

    if not code or not name:
        return jsonify({"error": "Department code and name are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO departments (dept_code, dept_name) VALUES (?, ?);", (code, name))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return jsonify({"message": "Department created successfully", "id": new_id, "dept_code": code}), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": f"Failed to create department: {str(e)}"}), 400

@admin_bp.route("/staff", methods=["GET"])
def get_staff_list():
    """List all teaching faculty and their current allocations."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.full_name, u.email, u.department_id, d.dept_name, d.dept_code, u.created_at
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.role = 'staff'
        ORDER BY u.full_name ASC;
    """)
    staff = [dict(r) for r in cursor.fetchall()]

    # Fetch allocations
    cursor.execute("""
        SELECT sa.id, sa.staff_id, sa.subject_id, sub.subject_code, sub.subject_name,
               sa.section_id, sec.section_name, d.dept_code, y.year_name
        FROM staff_assignments sa
        JOIN subjects sub ON sa.subject_id = sub.id
        JOIN sections sec ON sa.section_id = sec.id
        JOIN departments d ON sec.department_id = d.id
        JOIN years y ON sec.year_id = y.id;
    """)
    assignments = [dict(r) for r in cursor.fetchall()]
    conn.close()

    # Group assignments by staff
    assignment_map = {}
    for a in assignments:
        sid = a["staff_id"]
        if sid not in assignment_map:
            assignment_map[sid] = []
        assignment_map[sid].append(a)

    for s in staff:
        s["assignments"] = assignment_map.get(s["id"], [])

    return jsonify({"staff": staff}), 200

@admin_bp.route("/staff", methods=["POST"])
def create_staff():
    """Create a new staff account."""
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip()
    dept_id = data.get("department_id")

    if not username or not password or not full_name or not email or not dept_id:
        return jsonify({"error": "All fields (username, password, full_name, email, department_id) are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        pw_hash = hash_password(password)
        cursor.execute("""
            INSERT INTO users (username, password_hash, full_name, email, role, department_id)
            VALUES (?, ?, ?, ?, 'staff', ?);
        """, (username, pw_hash, full_name, email, dept_id))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return jsonify({"message": "Staff user created successfully", "id": new_id}), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": f"Failed to register staff: {str(e)}"}), 400

@admin_bp.route("/staff-assignments", methods=["POST"])
def assign_staff():
    """Assign staff member to a subject and section."""
    data = request.get_json() or {}
    staff_id = data.get("staff_id")
    subject_id = data.get("subject_id")
    section_id = data.get("section_id")
    acad_year_id = data.get("academic_year_id")

    if not all([staff_id, subject_id, section_id, acad_year_id]):
        return jsonify({"error": "staff_id, subject_id, section_id, and academic_year_id are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO staff_assignments (staff_id, subject_id, section_id, academic_year_id)
            VALUES (?, ?, ?, ?);
        """, (staff_id, subject_id, section_id, acad_year_id))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return jsonify({"message": "Staff assigned successfully", "id": new_id}), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": f"Assignment conflict or error: {str(e)}"}), 400

@admin_bp.route("/students", methods=["GET"])
def get_students():
    """List all students across sections with linked parent contact details."""
    section_id = request.args.get("section_id")
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT s.id, s.register_number, s.roll_number, s.first_name, s.last_name,
               sec.section_name, d.dept_code, y.year_name,
               p.father_name, p.mother_name, p.primary_phone, p.whatsapp_number, p.email as parent_email
        FROM students s
        JOIN sections sec ON s.section_id = sec.id
        JOIN departments d ON sec.department_id = d.id
        JOIN years y ON sec.year_id = y.id
        JOIN parents p ON s.parent_id = p.id
    """
    params = []
    if section_id:
        query += " WHERE s.section_id = ?"
        params.append(section_id)

    query += " ORDER BY s.register_number ASC;"
    cursor.execute(query, params)
    students = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify({"students": students}), 200

@admin_bp.route("/audit-logs", methods=["GET"])
def get_audit_logs():
    """Retrieve immutable audit trail of mark alterations."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT al.id, al.previous_marks, al.new_marks, al.assessment_type, al.change_reason, al.created_at,
               s.register_number, s.first_name || ' ' || s.last_name as student_name,
               sub.subject_code, sub.subject_name,
               u.full_name as changed_by_name, u.role as changed_by_role
        FROM mark_audit_logs al
        JOIN students s ON al.student_id = s.id
        JOIN subjects sub ON al.subject_id = sub.id
        JOIN users u ON al.changed_by = u.id
        ORDER BY al.created_at DESC
        LIMIT 100;
    """)
    logs = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify({"audit_logs": logs}), 200

@admin_bp.route("/notification-logs", methods=["GET"])
def get_notification_logs():
    """Retrieve parent dispatch logs (SMS and WhatsApp)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT nl.id, nl.recipient_phone, nl.channel, nl.notification_type, nl.message_body,
               nl.status, nl.created_at, u.full_name as triggered_by_name,
               s.register_number, s.first_name || ' ' || s.last_name as student_name
        FROM notification_logs nl
        LEFT JOIN students s ON nl.student_id = s.id
        JOIN users u ON nl.triggered_by = u.id
        ORDER BY nl.created_at DESC
        LIMIT 100;
    """)
    logs = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify({"notification_logs": logs}), 200
