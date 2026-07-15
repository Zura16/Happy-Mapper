"""
Firebase Uploader for Menu Extraction
Extracts menu information using Gemini Vision and uploads to Firestore
"""

import os
import json
import base64
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore, storage
from datetime import datetime
from src.vision_parser import VisionMenuParser


class FirebaseUploader:
    """Handles Vision parsing and Firebase Firestore uploads"""

    def __init__(self):
        """
        Initialize Firebase connection and Vision parser.

        Expected environment variable:
          - FIREBASE_SERVICE_ACCOUNT_JSON : raw JSON or base64-encoded JSON string
        """
        # Load .env locally; Vercel uses environment variables directly
        load_dotenv()

        raw = os.getenv("FIREBASE_SERVICE_ACCOUNT")
        if not raw:
            raise ValueError("Missing FIREBASE_SERVICE_ACCOUNT in environment.")

        # Support both raw JSON and base64-encoded JSON
        try:
            sa_dict = json.loads(raw)
        except json.JSONDecodeError:
            try:
                sa_dict = json.loads(base64.b64decode(raw).decode("utf-8"))
            except Exception as e:
                raise ValueError(
                    "FIREBASE_SERVICE_ACCOUNT must be valid JSON or base64 of that JSON."
                ) from e

        cred = credentials.Certificate(sa_dict)

        if not firebase_admin._apps:
            # Initialize with storage bucket, points to bucket gs://
            # TODO: HARDCODED, HIDE IT LATER LMAO
            firebase_admin.initialize_app(
                cred, {"storageBucket": "happy-hour-mvp.firebasestorage.app"}
            )
            print("[OK] Firebase initialized")
        else:
            print("[OK] Using existing Firebase connection")

        self.db = firestore.client()
        print("[OK] Connected to Firestore")

        self.bucket = storage.bucket()
        print("[OK] Connected to Firebase Storage")

        # Initialize Vision parser
        self.parser = VisionMenuParser()

    def upload_image_to_storage(self, image_path, folder="menu_images"):
        """Upload image to Firebase Storage and return public URL."""
        try:
            # Generate unique filename
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = os.path.basename(image_path)
            blob_name = f"{folder}/{timestamp}_{filename}"

            # Upload to Firebase Storage
            blob = self.bucket.blob(blob_name)
            blob.upload_from_filename(image_path)

            # Make the blob publicly accessible
            blob.make_public()

            # Get public URL
            public_url = blob.public_url
            print(f"[OK] Uploaded image to Storage: {blob_name}")
            print(f"[OK] Public URL: {public_url}")

            return public_url
        except Exception as e:
            print(f"[ERROR] Failed to upload image to Storage: {e}")
            return None

    def upload_deal(self, image_path, collection="final_schema"):
        """Extract menu data via Gemini and upload to Firestore."""
        print(f"\n{'=' * 70}")
        print(f"Processing: {image_path}")
        print(f"{'=' * 70}\n")

        # Upload image to Firebase Storage
        image_url = self.upload_image_to_storage(image_path)

        data = self.parser.parse_deal(image_path)
        data["metadata"] = {
            "uploaded_at": datetime.utcnow().isoformat(),
            "image_filename": os.path.basename(image_path),
            "extraction_method": "gemini_vision",
        }

        # Add image URL to data
        if image_url:
            data["image_url"] = image_url

        print(f"\n{'=' * 70}")
        print("Uploading to Firestore...")
        print(f"{'=' * 70}\n")

        doc_ref = self.db.collection(collection).add(data)
        doc_id = doc_ref[1].id

        print(f"[OK] Uploaded to Firestore: {collection}/{doc_id}")
        print(f"{'=' * 70}\n")

        return doc_id

    def update_deal(self, doc_id, updates, collection="final_schema"):
        """Update existing restaurant data in Firestore."""
        if "metadata" not in updates:
            updates["metadata"] = {}
        updates["metadata"]["updated_at"] = datetime.utcnow().isoformat()

        self.db.collection(collection).document(doc_id).update(updates)
        print(f"[OK] Updated {collection}/{doc_id}")

    def get_restaurant(self, doc_id, collection="final_schema"):
        """Get a single restaurant by document ID."""
        doc = self.db.collection(collection).document(doc_id).get()
        if doc.exists:
            return {"id": doc.id, **doc.to_dict()}
        return None

    def get_all_restaurants(self, collection="final_schema", limit=None):
        """Get all restaurants from Firestore."""
        query = self.db.collection(collection)
        if limit:
            query = query.limit(limit)
        docs = query.stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]

    def batch_upload(self, image_paths, collection="final_schema"):
        """Upload multiple menu images to Firestore."""
        results = []
        for i, image_path in enumerate(image_paths, 1):
            print(f"\n[{i}/{len(image_paths)}] Processing {image_path}...")
            try:
                doc_id = self.upload_deal(image_path, collection)
                results.append({"image": image_path, "id": doc_id, "status": "success"})
            except Exception as e:
                print(f"[ERROR] Failed to process {image_path}: {e}")
                results.append(
                    {"image": image_path, "error": str(e), "status": "failed"}
                )
        return results


def main():
    """Example CLI usage"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Extract menu data and upload to Firestore"
    )
    parser.add_argument("image", help="Path to menu image")
    parser.add_argument(
        "--collection",
        default="final_schema",
        help="Firestore collection name (default: final_schema)",
    )

    args = parser.parse_args()

    uploader = FirebaseUploader()
    doc_id = uploader.upload_deal(args.image, collection=args.collection)

    print(f"\n{'=' * 70}")
    print(f"SUCCESS! Document ID: {doc_id}")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
