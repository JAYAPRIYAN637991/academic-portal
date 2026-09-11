from flask import Blueprint, request, jsonify, g
from database import get_db_connection
from middleware import token_required, staff_required, verify_staff_assignment

staff_bp = Blueprint("staff", __name__, url_prefix="/api/staff")

@staff_bp.before_request
@token_required
@staff_required
def enforce_staff_access():
    pass

@staff_bp.route("/assigned-classes", methods=["GET"])
def get_assigned_classes():
    """List classes and subjects assigned specifically to this staff member."""
    staff_id = g.current_user["id"]
    is_admin = g.current_user["role"] == "admin"

    conn = get_db_connection()
    cursor = conn.cursor()

    if is_admin:
        # Admins can view all assignments
        cursor.execute("""
            SELECT sa.id, sa.staff_id, u.full_name as staff_name,
                   sa.subject_id, sub.subject_code, sub.subject_name,
                   sa.section_id, sec.section_name,
                   d.dept_code, d.dept_name, y.year_name, y.year_number,
                   ay.year_name as academic_year
            FROM staff_assignments sa
            JOIN users u ON sa.staff_id = u.id
            JOIN subjects sub ON sa.subject_id = sub.id
            JOIN sections sec ON sa.section_id = sec.id
            JOIN departments d ON sec.department_id = d.id
            JOIN years y ON sec.year_id = y.id
            JOIN academic_years ay ON sa.academic_year_id = ay.id
            ORDER BY d.dept_code, y.year_number, sec.section_name;
        """)
    else:
        cursor.execute("""
            SELECT sa.id, sa.staff_id, u.full_name as staff_name,
                   sa.subject_id, sub.subject_code, sub.subject_name,
                   sa.section_id, sec.section_name,
                   d.dept_code, d.dept_name, y.year_name, y.year_number,
                   ay.year_name as academic_year
            FROM staff_assignments sa
            JOIN users u ON sa.staff_id = u.id
            JOIN subjects sub ON sa.subject_id = sub.id
            JOIN sections sec ON sa.section_id = sec.id
            JOIN departments d ON sec.department_id = d.id
            JOIN years y ON sec.year_id = y.id
            JOIN academic_years ay ON sa.academic_year_id = ay.id
            WHERE sa.staff_id = ?
            ORDER BY sub.subject_code;
        """, (staff_id,))

    assignments = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify({"assigned_classes": assignments}), 200

@staff_bp.route("/students", methods=["GET"])
def get_students_for_class():
    """Retrieve students belonging to a section assigned to the staff."""
    section_id = request.args.get("section_id", type=int)
    subject_id = request.args.get("subject_id", type=int)

    if not section_id or not subject_id:
        return jsonify({"error": "section_id and subject_id parameters are required"}), 400

    staff_id = g.current_user["id"]
    is_admin = g.current_user["role"] == "admin"

    # Strict server-side RBAC validation: Staff can only access students if assigned to that section and subject
    if not is_admin and not verify_staff_assignment(staff_id, subject_id, section_id):
        return jsonify({
            "error": "Forbidden: You are not assigned to instruct this subject for this section.",
            "code": "STAFF_CLASS_UNAUTHORIZED"
        }), 403

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.id, s.register_number, s.roll_number, s.first_name, s.last_name,
               m1.marks_obtained as ia1_marks, m1.max_marks as ia1_max,
               m2.marks_obtained as ia2_marks, m2.max_marks as ia2_max
        FROM students s
        LEFT JOIN marks m1 ON s.id = m1.student_id AND m1.subject_id = ? AND m1.assessment_type = 'IA1'
        LEFT JOIN marks m2 ON s.id = m2.student_id AND m2.subject_id = ? AND m2.assessment_type = 'IA2'
        WHERE s.section_id = ?
        ORDER BY s.roll_number ASC;
    """, (subject_id, subject_id, section_id))
    students = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify({"students": students}), 200

@staff_bp.route("/marks", methods=["POST"])
def enter_or_edit_marks():
    """Enter or update IA-1 or IA-2 marks for a student. Logs audit trail if edited."""
    data = request.get_json() or {}
    student_id = data.get("student_id")
    subject_id = data.get("subject_id")
    assessment_type = data.get("assessment_type")
    marks_obtained = data.get("marks_obtained")
    max_marks = data.get("max_marks", 100.0)
    change_reason = data.get("change_reason", "Regular mark entry")

    if student_id is None or subject_id is None or not assessment_type or marks_obtained is None:
        return jsonify({"error": "student_id, subject_id, assessment_type, and marks_obtained are required"}), 400

    if assessment_type not in ["IA1", "IA2"]:
        return jsonify({"error": "assessment_type must be either 'IA1' or 'IA2'"}), 400

    try:
        marks_obtained = float(marks_obtained)
        max_marks = float(max_marks)
    except ValueError:
        return jsonify({"error": "Marks must be numeric"}), 400

    if marks_obtained < 0 or marks_obtained > max_marks:
        return jsonify({"error": f"Marks obtained ({marks_obtained}) must be between 0 and {max_marks}"}), 400

    staff_id = g.current_user["id"]
    is_admin = g.current_user["role"] == "admin"

    conn = get_db_connection()
    cursor = conn.cursor()

    # Find the section_id for this student
    cursor.execute("SELECT section_id FROM students WHERE id = ?;", (student_id,))
    student = cursor.fetchone()
    if not student:
        conn.close()
        return jsonify({"error": "Student not found"}), 404
    section_id = student["section_id"]

    # Security check: verify staff is assigned to this subject & section
    if not is_admin and not verify_staff_assignment(staff_id, subject_id, section_id):
        conn.close()
        return jsonify({
            "error": "Forbidden: You do not have permission to grade this student/subject.",
            "code": "STAFF_GRADING_UNAUTHORIZED"
        }), 403

    # Check if a mark entry already exists
    cursor.execute("""
        SELECT id, marks_obtained FROM marks
        WHERE student_id = ? AND subject_id = ? AND assessment_type = ?;
    """, (student_id, subject_id, assessment_type))
    existing = cursor.fetchone()

    if existing:
        mark_id = existing["id"]
        prev_marks = existing["marks_obtained"]
        cursor.execute("""
            UPDATE marks
            SET marks_obtained = ?, max_marks = ?, entered_by = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?;
        """, (marks_obtained, max_marks, staff_id, mark_id))

        # Record immutable audit log
        cursor.execute("""
            INSERT INTO mark_audit_logs (mark_id, student_id, subject_id, assessment_type, previous_marks, new_marks, changed_by, change_reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """, (mark_id, student_id, subject_id, assessment_type, prev_marks, marks_obtained, staff_id, change_reason))
        message = "Mark updated and change logged in audit trail"
    else:
        cursor.execute("""
            INSERT INTO marks (student_id, subject_id, assessment_type, max_marks, marks_obtained, entered_by)
            VALUES (?, ?, ?, ?, ?, ?);
        """, (student_id, subject_id, assessment_type, max_marks, marks_obtained, staff_id))
        mark_id = cursor.lastrowid
        message = "Mark recorded successfully"

    conn.commit()
    conn.close()

    return jsonify({"message": message, "mark_id": mark_id}), 200

@staff_bp.route("/subject-performance", methods=["GET"])
def get_subject_performance():
    """Retrieve performance statistics strictly for a staff's assigned subject & section."""
    section_id = request.args.get("section_id", type=int)
    subject_id = request.args.get("subject_id", type=int)

    if not section_id or not subject_id:
        return jsonify({"error": "section_id and subject_id parameters are required"}), 400

    staff_id = g.current_user["id"]
    is_admin = g.current_user["role"] == "admin"

    if not is_admin and not verify_staff_assignment(staff_id, subject_id, section_id):
        return jsonify({"error": "Forbidden: You are not assigned to this class."}), 403

    conn = get_db_connection()
    cursor = conn.cursor()

    # IA-1 Aggregates
    cursor.execute("""
        SELECT COUNT(*) as total_graded,
               AVG(m.marks_obtained) as average_marks,
               MAX(m.marks_obtained) as highest_marks,
               MIN(m.marks_obtained) as lowest_marks,
               SUM(CASE WHEN m.marks_obtained >= 50.0 THEN 1 ELSE 0 END) as pass_count
        FROM marks m
        JOIN students s ON m.student_id = s.id
        WHERE s.section_id = ? AND m.subject_id = ? AND m.assessment_type = 'IA1';
    """, (section_id, subject_id))
    ia1_stats = dict(cursor.fetchone())

    # IA-2 Aggregates
    cursor.execute("""
        SELECT COUNT(*) as total_graded,
               AVG(m.marks_obtained) as average_marks,
               MAX(m.marks_obtained) as highest_marks,
               MIN(m.marks_obtained) as lowest_marks,
               SUM(CASE WHEN m.marks_obtained >= 50.0 THEN 1 ELSE 0 END) as pass_count
        FROM marks m
        JOIN students s ON m.student_id = s.id
        WHERE s.section_id = ? AND m.subject_id = ? AND m.assessment_type = 'IA2';
    """, (section_id, subject_id))
    ia2_stats = dict(cursor.fetchone())

    conn.close()

    return jsonify({
        "section_id": section_id,
        "subject_id": subject_id,
        "ia1": ia1_stats,
        "ia2": ia2_stats
    }), 200
