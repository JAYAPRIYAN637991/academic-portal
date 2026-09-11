import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "college-portal-super-secret-production-key-2026-v1")
    JWT_SECRET = os.environ.get("JWT_SECRET", "college-portal-jwt-secret-key-minimum-32-chars-2026")
    JWT_EXPIRATION_HOURS = 24
    DATABASE_PATH = os.environ.get("DATABASE_PATH", os.path.join(BASE_DIR, "academic_portal.db"))
    CLIENT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "client"))
