# Menu Parser API

Flask API for uploading menu images from frontend (camera), processing with Gemini Vision AI, and uploading to Firebase.

## Quick Start

### 1. Install Dependencies

```bash
cd ai
pip install -r requirements.txt
```

### 2. Set Up Environment Variables

Create `.env` in the root `starbound` folder:
```bash
GEMINI_API_KEY="your_gemini_api_key"
FIREBASE_SERVICE_ACCOUNT="c:/Users/anhng/Desktop/starbound/happy_hour_service_account.json"
```

### 3. Run the API Server

```bash
cd ai
python server.py
```

Server starts at: `http://localhost:5000`

---

## API Endpoints

### Health Check
```http
GET /health
```

Response:
```json
{
    "status": "healthy",
    "service": "menu-parser-api",
    "timestamp": "2025-11-16T12:00:00Z"
}
```

---

### Upload Menu Image
```http
POST /upload-menu
Content-Type: multipart/form-data
```

**Parameters:**
- `image` (file, required) - Menu image file
- `collection` (string, optional) - Firestore collection name (default: `final_schema`)

**Response:**
```json
{
    "success": true,
    "document_id": "abc123xyz",
    "data": {
        "restaurant_name": "Restaurant Name",
        "deals": [...],
        "time_frame": [...],
        "special_conditions": [...],
        "metadata": {...}
    },
    "message": "Menu uploaded and processed successfully"
}
```

---

### Update Menu
```http
PUT /update-menu/<document_id>?collection=final_schema
Content-Type: application/json
```

**Body:**
```json
{
    "restaurant_name": "Updated Name",
    "deals": [...],
    "time_frame": [...]
}
```

---

### Get Menu by ID
```http
GET /get-menu/<document_id>?collection=final_schema
```

---

### Get All Menus
```http
GET /get-all-menus?collection=final_schema&limit=10
```

---

## Frontend Integration (React Native/Expo)

### Install Dependencies
```bash
npm install expo-image-picker
```

### Example Code

```javascript
import * as ImagePicker from 'expo-image-picker';

const uploadMenuFromCamera = async () => {
  // Request camera permission
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    alert('Camera permission is required');
    return;
  }

  // Take photo
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsEditing: true,
  });

  if (!result.canceled) {
    await uploadImage(result.assets[0].uri);
  }
};

const uploadImage = async (imageUri) => {
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'menu.jpg',
  });
  formData.append('collection', 'final_schema');

  try {
    const response = await fetch('http://YOUR_SERVER_IP:5000/upload-menu', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const data = await response.json();

    if (data.success) {
      console.log('Success!', data.document_id);
      alert('Menu uploaded successfully!');
      // Navigate to results screen or show data
    } else {
      console.error('Error:', data.error);
      alert('Upload failed: ' + data.error);
    }
  } catch (error) {
    console.error('Network error:', error);
    alert('Network error: ' + error.message);
  }
};
```

---

## Testing with cURL

### Upload an image
```bash
curl -X POST http://localhost:5000/upload-menu \
  -F "image=@menu.jpg" \
  -F "method=hybrid" \
  -F "collection=final_schema"
```

### Health check
```bash
curl http://localhost:5000/health
```

---

## Deployment

### Local Development
```bash
python api.py
```
Server runs on `http://localhost:5000`

### Production (with Gunicorn)
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 api:app
```

### Docker (Optional)
Create `Dockerfile`:
```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY ocr_requirements.txt .
RUN pip install -r ocr_requirements.txt
RUN pip install firebase-admin gunicorn

COPY . .

EXPOSE 5000

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "api:app"]
```

Build and run:
```bash
docker build -t menu-parser-api .
docker run -p 5000:5000 -v $(pwd)/.env:/app/.env menu-parser-api
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
    "success": false,
    "error": "Error message description"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad request (invalid parameters)
- `404` - Not found
- `500` - Server error

---

## Security Notes

1. **CORS**: Currently allows all origins. Restrict in production:
   ```python
   CORS(app, origins=["https://your-frontend-domain.com"])
   ```

2. **File Size**: Limited to 16MB. Adjust in `app.config['MAX_CONTENT_LENGTH']`

3. **Rate Limiting**: Consider adding rate limiting for production

4. **Authentication**: Add authentication middleware if needed

---

## Troubleshooting

### Issue: "Firebase uploader not initialized"
- Check `.env` file exists with correct credentials
- Verify `FIREBASE_SERVICE_ACCOUNT` path is correct

### Issue: "ModuleNotFoundError"
- Run `pip install -r ocr_requirements.txt`
- Install firebase-admin: `pip install firebase-admin`

### Issue: Camera upload fails from mobile
- Use your computer's IP instead of `localhost`
- Ensure firewall allows port 5000
- Both devices must be on same network

---

## Flow Diagram

```
Frontend (Camera)
    ↓
Take Photo
    ↓
POST /upload-menu
    ↓
Flask API (api.py)
    ↓
firebase_uploader.py
    ↓
happy_hour_gemini.py (OCR + Gemini)
    ↓
Firebase Firestore (final_schema)
    ↓
Return document_id
    ↓
Frontend displays success
```
