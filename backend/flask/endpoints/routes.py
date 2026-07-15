# endpoints/routes.py
from flask import Blueprint, jsonify, request
import os
from werkzeug.utils import secure_filename
from datetime import datetime
from src.firebase_uploader import FirebaseUploader
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
UPLOAD_FOLDER = "/tmp"


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


api_bp = Blueprint("api", __name__)

uploader = None
try:
    uploader = FirebaseUploader()
except Exception as e:
    print(f"[ERROR] Failed to initialize Firebase uploader: {e}")


@api_bp.get("/api/data")
def get_sample_data():
    return jsonify(
        {
            "data": [
                {"id": 1, "name": "Sample Item 1", "value": 100},
                {"id": 2, "name": "Sample Item 2", "value": 200},
                {"id": 3, "name": "Sample Item 3", "value": 300},
            ],
            "total": 3,
            "timestamp": "2024-01-01T00:00:00Z",
        }
    )


@api_bp.get("/api/items/<int:item_id>")
def get_item(item_id: int):
    return jsonify(
        {
            "item": {
                "id": item_id,
                "name": f"Sample Item {item_id}",
                "value": item_id * 100,
            },
            "timestamp": "2024-01-01T00:00:00Z",
        }
    )


@api_bp.route("/upload-deal", methods=["POST"])
def upload_deal():
    """
    Upload deal image, process with Gemini Vision, and upload to Firebase

    Request:
        - image: Image file (multipart/form-data)
        - collection: Optional Firestore collection name
        - venue_name: Optional venue name (form data)
        - venue_address: Optional venue address JSON string (form data)

    Response:
        {
      "success": true,
            "document_id": "abc123",
            "data": { extracted deal data },
            "message": "deal uploaded successfully"
        }
    """
    print("[DEBUG] Received upload request")
    print("[DEBUG] request.files: {request.files}")
    print("[DEBUG] request.form: {request.form}")

    if not uploader:
        return jsonify(
            {"success": False, "error": "Firebase uploader not initialized"}
        ), 500

    # Check if image is in request
    if "image" not in request.files:
        print(
            f"[ERROR] No image in request.files. Available keys: {list(request.files.keys())}"
        )
        return jsonify({"success": False, "error": "No image provided"}), 400

    file = request.files["image"]

    if file.filename == "":
        print("[ERROR] Empty filename")
        return jsonify({"success": False, "error": "No selected file"}), 400

    if not allowed_file(file.filename):
        print("[ERROR] Invalid file type: {file.filename}")
        return jsonify(
            {
                "success": False,
                "error": f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
            }
        ), 400

    # Get collection parameter
    collection = request.form.get("collection", "final_schema")

    # Get venue information from form data
    venue_name = request.form.get("venue_name")
    venue_address = request.form.get("venue_address")  # Expecting JSON string

    # Save file temporarily
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    filename = secure_filename(file.filename)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(UPLOAD_FOLDER, f"{timestamp}_{filename}")

    try:
        file.save(filepath)
        print(f"[OK] Saved image to: {filepath}")

        # Process and upload to Firebase with Gemini Vision
        doc_id = uploader.upload_deal(filepath, collection=collection)

        # If venue information is provided, update the document
        if venue_name or venue_address:
            import json

            venue_updates = {}

            if venue_name:
                venue_updates["venue_name"] = venue_name

            if venue_address:
                try:
                    address_data = json.loads(venue_address)
                    venue_updates["address"] = address_data
                except json.JSONDecodeError:
                    print("[WARNING] Invalid venue_address JSON, skipping")

            if venue_updates:
                uploader.update_deal(doc_id, venue_updates, collection=collection)
                print(f"[OK] Updated venue information for {doc_id}")

        # Get the uploaded data
        uploaded_data = uploader.get_restaurant(doc_id, collection=collection)

        # Clean up temp file
        os.remove(filepath)
        print(f"[OK] Cleaned up temp file: {filepath}")

        return jsonify(
            {
                "success": True,
                "document_id": doc_id,
                "data": uploaded_data,
                "message": "Deals uploaded and processed successfully",
            }
        ), 200

    except Exception as e:
        # Clean up temp file on error
        if os.path.exists(filepath):
            os.remove(filepath)

        print(f"[ERROR] Upload failed: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 422
