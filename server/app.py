import os
import sys

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from config import Config
from database import init_db, seed_initial_data
from routes.auth_routes import auth_bp
from routes.admin_routes import admin_bp
from routes.staff_routes import staff_bp
from routes.common_routes import common_bp

def create_app(test_config=None):
    """Application factory for the Academic Performance Platform."""
    app = Flask(__name__, static_folder=Config.CLIENT_DIR, static_url_path="")
    app.config.from_object(Config)

    if test_config:
        app.config.update(test_config)

    # Enable CORS for cross-origin API integration
    CORS(app)

    # Initialize SQLite Database & Seed Data
    init_db(app.config.get("DATABASE_PATH"))
    seed_initial_data(app.config.get("DATABASE_PATH"))

    # Register Blueprints
    app.register_blueprint(common_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(staff_bp)

    # Serve Frontend Client SPA
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        client_dir = app.config.get("CLIENT_DIR")
        if path != "" and os.path.exists(os.path.join(client_dir, path)):
            return send_from_directory(client_dir, path)
        else:
            return send_from_directory(client_dir, "index.html")

    # Global Error Handlers
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "Internal server error"}), 500

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 5000))
    print(f"[*] Academic Platform running at http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
