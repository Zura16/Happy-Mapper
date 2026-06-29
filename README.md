# 🍹 Happy Mapper

**Discover real-time happy hour deals near you!**  
Happy Mapper helps users find nearby bars and restaurants offering happy hour specials — all in real time. Built with **React Native**, it combines fast performance, AI-powered deal extraction, and live location data to create a dependable companion for spontaneous plans.

## Installation
**Android APK (our apk isn't harmful so don't worry)**

https://drive.google.com/file/d/1imknucRkfZK2ZCdUj2uKe0fzJKY_fTGJ/view?usp=sharing

**ios version coming soon...**

---

## ✨ Features

- **🤖 AI Menu Parsing** – Snap a photo of a menu or poster; **Nexa AI's Local LLM** extracts venues, items, prices, and time windows.  
- **🔥 Firebase Integration** – Deals are uploaded instantly to **Firestore**, keeping listings fresh and synchronized.  
- **📍 Location-Aware Discovery** – Explore deals around you with **map and list views**.  
- **⚡ Flask Backend** – Secure APIs handle uploads, parsing, and deal discovery.  
- **📊 Real-Time Analytics** – Firebase powers geo-queries and usage analytics to ensure reliability and speed.  

---

## 🧠 Technologies

| Component | Technology |
|------------|-------------|
| Mobile App | React Native |
| VLM AI Engine | Nexa AI|
| Backend | Flask |
| Database | Firebase / Firestore |
| Hosting | Vercel |

---

## Where and Why NexaSDK Is Used

NexaSDK is used for on-device AI inference when parsing uploaded deal images.
When a user uploads a photo of a menu or poster, NexaSDK runs a local language and vision model directly on the device. It extracts structured information such as venue name, deal items, prices, and time ranges without sending the raw image to a remote server.

This provides several advantages:

- Eliminates per-request cloud API costs
- Reduces latency by removing round-trip server calls
- Improves scalability for high-volume uploads
- Strengthens privacy by keeping images on device

By leveraging local AI through NexaSDK, Happy Mapper turns what would normally be a costly cloud-dependent feature into a scalable, efficient foundation for real-time community deal discovery.

## 🛠️ How to Build and Run (Reproducible Steps)

1. Clone the Repository
```bash
git clone https://github.com/Zura16/Happy-Mapper.git
cd Happy-Mapper
```

2. Install Dependencies
Frontend (React Native / Expo)

```bash
cd my-app
npm install
```

4. Configure Frontend Environment Variables
```bash
ANDROID_GOOGLE_MAPS_KEY=yourApiKey
ANDROID_GOOGLE_PLACES_KEY=yourApiKey
```

3. Run the React Native App (Expo)

From the project root directory:

```bash
npx expo run:android
```
