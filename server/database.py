import sqlite3
import os
import bcrypt
from config import Config

from flask import current_app

def get_db_connection(db_path=None):
    """Establish connection to SQLite with row dictionary access and foreign keys enabled."""
    if db_path is None:
        try:
            if current_app:
                db_path = current_app.config.get("DATABASE_PATH")
        except Exception:
            pass
    path = db_path or Config.DATABASE_PATH
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def check_password(password: str, hashed: str) -> bool:
    """Verify password with bcrypt hash."""
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

def init_db(db_path=None):
    """Initialize tables according to relational schema."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()

    # 1. Academic Years
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS academic_years (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year_name TEXT UNIQUE NOT NULL,
        is_current BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Departments
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dept_code TEXT UNIQUE NOT NULL,
        dept_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Years (1 to 4)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS years (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year_number INTEGER UNIQUE NOT NULL,
        year_name TEXT NOT NULL
    );
    """)

    # 4. Sections
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_name TEXT NOT NULL,
        department_id INTEGER NOT NULL,
        year_id INTEGER NOT NULL,
        academic_year_id INTEGER NOT NULL,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
        FOREIGN KEY (year_id) REFERENCES years(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        UNIQUE(section_name, department_id, year_id, academic_year_id)
    );
    """)

    # 5. Users (Admin, Staff)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT CHECK(role IN ('admin', 'staff')) NOT NULL,
        department_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );
    """)

    # 6. Subjects
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_code TEXT UNIQUE NOT NULL,
        subject_name TEXT NOT NULL,
        department_id INTEGER NOT NULL,
        year_id INTEGER NOT NULL,
        semester INTEGER NOT NULL,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
        FOREIGN KEY (year_id) REFERENCES years(id) ON DELETE CASCADE
    );
    """)

    # 7. Staff Assignments
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS staff_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        staff_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        section_id INTEGER NOT NULL,
        academic_year_id INTEGER NOT NULL,
        FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        UNIQUE(subject_id, section_id, academic_year_id)
    );
    """)

    # 8. Parents (No Login, SMS/WhatsApp contact)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS parents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        father_name TEXT,
        mother_name TEXT,
        guardian_name TEXT,
        primary_phone TEXT NOT NULL,
        secondary_phone TEXT,
        whatsapp_number TEXT NOT NULL,
        email TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 9. Students
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        register_number TEXT UNIQUE NOT NULL,
        roll_number TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        section_id INTEGER NOT NULL,
        parent_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE
    );
    """)

    # 10. Marks (IA-1 and IA-2)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS marks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        assessment_type TEXT CHECK(assessment_type IN ('IA1', 'IA2')) NOT NULL,
        max_marks REAL DEFAULT 100.0,
        marks_obtained REAL NOT NULL CHECK(marks_obtained >= 0 AND marks_obtained <= max_marks),
        entered_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        FOREIGN KEY (entered_by) REFERENCES users(id) ON DELETE RESTRICT,
        UNIQUE(student_id, subject_id, assessment_type)
    );
    """)

    # 11. Mark Audit Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mark_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mark_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        assessment_type TEXT NOT NULL,
        previous_marks REAL,
        new_marks REAL NOT NULL,
        changed_by INTEGER NOT NULL,
        change_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mark_id) REFERENCES marks(id) ON DELETE CASCADE,
        FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT
    );
    """)

    # 12. Notices
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT DEFAULT 'General',
        target_audience TEXT DEFAULT 'All',
        department_id INTEGER,
        published_by INTEGER NOT NULL,
        is_published BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE RESTRICT,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );
    """)

    # 13. Notification Logs (SMS & WhatsApp alerts sent to parents)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notification_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient_phone TEXT NOT NULL,
        channel TEXT CHECK(channel IN ('SMS', 'WhatsApp')) NOT NULL,
        notification_type TEXT NOT NULL,
        student_id INTEGER,
        message_body TEXT NOT NULL,
        status TEXT CHECK(status IN ('SENT', 'DELIVERED', 'FAILED')) DEFAULT 'SENT',
        triggered_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
        FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE RESTRICT
    );
    """)

    conn.commit()
    conn.close()

def seed_initial_data(db_path=None):
    """Seed base setup if empty."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()

    # Check if admin already exists
    cursor.execute("SELECT id FROM users WHERE username = 'admin';")
    if cursor.fetchone():
        conn.close()
        return

    # Seed Academic Year
    cursor.execute("INSERT INTO academic_years (year_name, is_current) VALUES ('2025-2026', 1);")
    acad_id = cursor.lastrowid

    # Seed Departments
    cursor.execute("INSERT INTO departments (dept_code, dept_name) VALUES ('CSE', 'Computer Science & Engineering');")
    cse_id = cursor.lastrowid
    cursor.execute("INSERT INTO departments (dept_code, dept_name) VALUES ('ECE', 'Electronics & Communication Engineering');")
    ece_id = cursor.lastrowid
    cursor.execute("INSERT INTO departments (dept_code, dept_name) VALUES ('MECH', 'Mechanical Engineering');")

    # Seed Years
    cursor.execute("INSERT INTO years (year_number, year_name) VALUES (1, 'First Year');")
    cursor.execute("INSERT INTO years (year_number, year_name) VALUES (2, 'Second Year');")
    cursor.execute("INSERT INTO years (year_number, year_name) VALUES (3, 'Third Year');")
    yr3_id = cursor.lastrowid
    cursor.execute("INSERT INTO years (year_number, year_name) VALUES (4, 'Final Year');")

    # Seed Sections
    cursor.execute("INSERT INTO sections (section_name, department_id, year_id, academic_year_id) VALUES ('A', ?, ?, ?);", (cse_id, yr3_id, acad_id))
    sec_cse_3a = cursor.lastrowid
    cursor.execute("INSERT INTO sections (section_name, department_id, year_id, academic_year_id) VALUES ('B', ?, ?, ?);", (cse_id, yr3_id, acad_id))
    sec_cse_3b = cursor.lastrowid
    cursor.execute("INSERT INTO sections (section_name, department_id, year_id, academic_year_id) VALUES ('A', ?, ?, ?);", (ece_id, yr3_id, acad_id))
    sec_ece_3a = cursor.lastrowid

    # Seed Users (Admin & Staff)
    admin_pw = hash_password("admin123")
    cursor.execute("""
    INSERT INTO users (username, password_hash, full_name, email, role, department_id)
    VALUES ('admin', ?, 'Chief Administrator', 'admin@college.edu', 'admin', NULL);
    """, (admin_pw,))

    staff1_pw = hash_password("staff123")
    cursor.execute("""
    INSERT INTO users (username, password_hash, full_name, email, role, department_id)
    VALUES ('staff1', ?, 'Prof. Sarah Jenkins', 'sarah.cse@college.edu', 'staff', ?);
    """, (staff1_pw, cse_id))
    staff1_id = cursor.lastrowid

    staff2_pw = hash_password("staff123")
    cursor.execute("""
    INSERT INTO users (username, password_hash, full_name, email, role, department_id)
    VALUES ('staff2', ?, 'Dr. Michael Chang', 'michael.ece@college.edu', 'staff', ?);
    """, (staff2_pw, ece_id))
    staff2_id = cursor.lastrowid

    # Seed Subjects
    cursor.execute("""
    INSERT INTO subjects (subject_code, subject_name, department_id, year_id, semester)
    VALUES ('CS8501', 'Database Management Systems', ?, ?, 5);
    """, (cse_id, yr3_id))
    sub_dbms = cursor.lastrowid

    cursor.execute("""
    INSERT INTO subjects (subject_code, subject_name, department_id, year_id, semester)
    VALUES ('CS8502', 'Theory of Computation', ?, ?, 5);
    """, (cse_id, yr3_id))
    sub_toc = cursor.lastrowid

    cursor.execute("""
    INSERT INTO subjects (subject_code, subject_name, department_id, year_id, semester)
    VALUES ('EC8501', 'Digital Communication', ?, ?, 5);
    """, (ece_id, yr3_id))
    sub_dc = cursor.lastrowid

    # Seed Staff Assignments (staff1 teaches CS8501 to CSE 3rd Year Sec A)
    cursor.execute("""
    INSERT INTO staff_assignments (staff_id, subject_id, section_id, academic_year_id)
    VALUES (?, ?, ?, ?);
    """, (staff1_id, sub_dbms, sec_cse_3a, acad_id))

    # staff2 teaches EC8501 to ECE 3rd Year Sec A
    cursor.execute("""
    INSERT INTO staff_assignments (staff_id, subject_id, section_id, academic_year_id)
    VALUES (?, ?, ?, ?);
    """, (staff2_id, sub_dc, sec_ece_3a, acad_id))

    # Seed Parents
    cursor.execute("""
    INSERT INTO parents (father_name, mother_name, primary_phone, whatsapp_number, email, address)
    VALUES ('Robert Vance', 'Linda Vance', '+919876543210', '+919876543210', 'vance.family@example.com', '12 Lake View St, City');
    """)
    parent1_id = cursor.lastrowid

    cursor.execute("""
    INSERT INTO parents (father_name, mother_name, primary_phone, whatsapp_number, email, address)
    VALUES ('David Miller', 'Karen Miller', '+919876543211', '+919876543211', 'miller.family@example.com', '45 Green Park Road, City');
    """)
    parent2_id = cursor.lastrowid

    # Seed Students
    cursor.execute("""
    INSERT INTO students (register_number, roll_number, first_name, last_name, section_id, parent_id)
    VALUES ('723723106001', '23CS01', 'Ethan', 'Vance', ?, ?);
    """, (sec_cse_3a, parent1_id))
    student1_id = cursor.lastrowid

    cursor.execute("""
    INSERT INTO students (register_number, roll_number, first_name, last_name, section_id, parent_id)
    VALUES ('723723106002', '23CS02', 'Chloe', 'Miller', ?, ?);
    """, (sec_cse_3a, parent2_id))
    student2_id = cursor.lastrowid

    # Seed Initial Marks for student1 & student2 in DBMS (IA1)
    cursor.execute("""
    INSERT INTO marks (student_id, subject_id, assessment_type, max_marks, marks_obtained, entered_by)
    VALUES (?, ?, 'IA1', 100.0, 88.5, ?);
    """, (student1_id, sub_dbms, staff1_id))

    cursor.execute("""
    INSERT INTO marks (student_id, subject_id, assessment_type, max_marks, marks_obtained, entered_by)
    VALUES (?, ?, 'IA1', 100.0, 74.0, ?);
    """, (student2_id, sub_dbms, staff1_id))

    # Seed College Notice
    cursor.execute("""
    INSERT INTO notices (title, content, category, target_audience, department_id, published_by)
    VALUES ('Internal Assessment 2 Schedule', 'IA-2 examination will commence from October 15th. All students must submit lab records.', 'Exam', 'All', NULL, 1);
    """)

    conn.commit()
    conn.close()
