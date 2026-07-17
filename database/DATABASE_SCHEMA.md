# Database Schema Documentation

## Firestore Collections

### `final_schema`
Stores venue data with associated deals.

| Field | Type | Description |
|-------|------|-------------|
| `venue_id` | string | Unique venue identifier |
| `venue_name` | string | Display name of the venue |
| `latitude` | number | GPS latitude coordinate |
| `longitude` | number | GPS longitude coordinate |
| `address` | map | Street, city, state, zip |
| `image_url` | string | URL to uploaded deal image |
| `deals` | array | List of deal objects |

### `user_data`
Stores user profile and preferences.

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Firebase Auth UID |
| `email` | string | User email address |
| `displayName` | string | User display name |
| `savedDeals` | array | List of favorited venue IDs |
| `addedDeals` | array | List of deals uploaded by user |
| `createdAt` | timestamp | Account creation time |
| `lastLoginAt` | timestamp | Last login timestamp |

## Storage Rules

Deal images are stored under `deal_images/{userId}/{timestamp}_{filename}`.
