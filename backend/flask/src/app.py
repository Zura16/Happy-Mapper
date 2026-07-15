"""
Flask API for deal Image Upload and Processing
Accepts image uploads from frontend, processes with Gemini Vision, uploads to Firebase
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from endpoints.routes import api_bp
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

app.config["UPLOAD_FOLDER"] = "/tmp"  # has to be "/tmp"
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max file size

# Register routes from endpoints/routes.py
app.register_blueprint(api_bp)

# Allowed file extensions
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}


def allowed_file(filename):
    """Check if file extension is allowed"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify(
        {
            "status": "healthy",
            "service": "deal-parser-api",
            "timestamp": datetime.utcnow().isoformat(),
        }
    ), 200


if __name__ == "__main__":
    print("=" * 70)
    print("deal Parser API Server")
    print("=" * 70)
    print("Endpoints:")
    print("  GET  /health              - Health check")
    print("  POST /upload-deal         - Upload and process deal image")
    print("=" * 70)
    # print("Starting server on http://0.0.0.0:5000")
    print("=" * 70)
    app.run()
