"""
app.py – Flask application entry point
"""

import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from routes.auth     import auth_bp
from routes.stations import stations_bp
from routes.bookings import bookings_bp

load_dotenv()


def create_app():
    app = Flask(__name__)
    app.secret_key = os.getenv("SECRET_KEY", "dev-secret-key")

    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

    app.register_blueprint(auth_bp)
    app.register_blueprint(stations_bp)
    app.register_blueprint(bookings_bp)

    @app.route("/health", methods=["GET"])
    def health():
        return {
            "status": "ok",
            "service": "smart-ev-charging-api",
            "db_mode": "live",
        }

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", 5000))
    print(f"Smart EV Charging API -> http://localhost:{port}")
    print(f"Credentials: admin@ev.com / admin123 | alex@example.com / user123")
    app.run(debug=True, host="0.0.0.0", port=port)
