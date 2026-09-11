import unittest
import os
import sys
import tempfile
import json

# Add server directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from database import get_db_connection

class TestRoleBasedAccessControl(unittest.TestCase):
    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp(suffix=".db")
        self.app = create_app({
            "TESTING": True,
            "DATABASE_PATH": self.db_path,
            "JWT_SECRET": "test-super-secret-jwt-key-minimum-32-chars-12345"
        })
        self.client = self.app.test_client()

    def tearDown(self):
        os.close(self.db_fd)
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def _login(self, username, password):
        res = self.client.post("/api/auth/login", json={
            "username": username,
            "password": password
        })
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        return data["token"], data["user"]

    def test_health_check(self):
        """Test health check returns HEALTHY and connected database."""
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data["status"], "HEALTHY")
        self.assertEqual(data["database"], "CONNECTED")

    def test_auth_login_roles(self):
        """Test admin and staff receive their respective role claims."""
        admin_token, admin_user = self._login("admin", "admin123")
        self.assertEqual(admin_user["role"], "admin")
        self.assertIsNotNone(admin_token)

        staff_token, staff_user = self._login("staff1", "staff123")
        self.assertEqual(staff_user["role"], "staff")
        self.assertIsNotNone(staff_token)

    def test_admin_can_access_admin_routes(self):
        """Admin should successfully access administrative endpoints."""
        token, _ = self._login("admin", "admin123")
        headers = {"Authorization": f"Bearer {token}"}

        res = self.client.get("/api/admin/dashboard-summary", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertIn("departments", data)
        self.assertIn("students", data)

        res2 = self.client.get("/api/admin/academic-structure", headers=headers)
        self.assertEqual(res2.status_code, 200)
        structure = json.loads(res2.data)
        self.assertIn("departments", structure)
        self.assertIn("sections", structure)

    def test_staff_cannot_access_admin_routes(self):
        """Staff MUST receive 403 Forbidden when accessing Admin routes."""
        token, _ = self._login("staff1", "staff123")
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Staff accessing admin summary
        res1 = self.client.get("/api/admin/dashboard-summary", headers=headers)
        self.assertEqual(res1.status_code, 403, "Staff should NOT access admin dashboard")
        data1 = json.loads(res1.data)
        self.assertEqual(data1.get("code"), "ADMIN_ROLE_REQUIRED")

        # 2. Staff accessing academic structure
        res2 = self.client.get("/api/admin/academic-structure", headers=headers)
        self.assertEqual(res2.status_code, 403)

        # 3. Staff trying to create department
        res3 = self.client.post("/api/admin/departments", json={"dept_code": "CIVIL", "dept_name": "Civil Eng"}, headers=headers)
        self.assertEqual(res3.status_code, 403)

        # 4. Staff trying to access audit logs
        res4 = self.client.get("/api/admin/audit-logs", headers=headers)
        self.assertEqual(res4.status_code, 403)

    def test_unauthenticated_request_is_rejected(self):
        """Requests without JWT must be rejected with 401 Unauthorized."""
        res = self.client.get("/api/admin/dashboard-summary")
        self.assertEqual(res.status_code, 401)

        res2 = self.client.get("/api/staff/assigned-classes")
        self.assertEqual(res2.status_code, 401)

    def test_staff_can_view_assigned_classes_only(self):
        """Staff should view only their assigned classes."""
        token, user = self._login("staff1", "staff123")
        headers = {"Authorization": f"Bearer {token}"}

        res = self.client.get("/api/staff/assigned-classes", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        classes = data["assigned_classes"]
        self.assertTrue(len(classes) > 0)
        for c in classes:
            self.assertEqual(c["staff_id"], user["id"])

    def test_staff_mark_entry_authorization(self):
        """Staff can enter marks for assigned section, but blocked from unassigned section."""
        staff1_token, _ = self._login("staff1", "staff123")
        headers1 = {"Authorization": f"Bearer {staff1_token}"}

        # Find assigned class for staff1
        res = self.client.get("/api/staff/assigned-classes", headers=headers1)
        assigned = json.loads(res.data)["assigned_classes"][0]
        subject_id = assigned["subject_id"]
        section_id = assigned["section_id"]

        # Fetch students in that section
        res_students = self.client.get(f"/api/staff/students?section_id={section_id}&subject_id={subject_id}", headers=headers1)
        self.assertEqual(res_students.status_code, 200)
        students = json.loads(res_students.data)["students"]
        student_id = students[0]["id"]

        # 1. Staff enters marks for their assigned student -> SUCESS (200)
        mark_res = self.client.post("/api/staff/marks", json={
            "student_id": student_id,
            "subject_id": subject_id,
            "assessment_type": "IA2",
            "marks_obtained": 92.5,
            "max_marks": 100.0,
            "change_reason": "IA2 Final evaluation"
        }, headers=headers1)
        self.assertEqual(mark_res.status_code, 200)

        # 2. Staff2 logs in and tries to grade staff1's student/subject -> FORBIDDEN (403)
        staff2_token, _ = self._login("staff2", "staff123")
        headers2 = {"Authorization": f"Bearer {staff2_token}"}
        unauth_mark_res = self.client.post("/api/staff/marks", json={
            "student_id": student_id,
            "subject_id": subject_id,
            "assessment_type": "IA2",
            "marks_obtained": 80.0
        }, headers=headers2)
        self.assertEqual(unauth_mark_res.status_code, 403, "Staff must NOT be able to grade unassigned classes")

if __name__ == "__main__":
    unittest.main()
