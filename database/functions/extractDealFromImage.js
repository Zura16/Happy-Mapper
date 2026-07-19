/**
 * Cloud Function: extractDealFromImage
 * 
 * This function integrates with the AI team's FastAPI service.
 * 
 * Flow:
 * 1. Frontend uploads image to Firebase Storage
 * 2. Frontend calls this Cloud Function with imageUrl
 * 3. This function downloads image from Storage
 * 4. Sends image to AI team's FastAPI endpoint
 * 5. Converts AI response to Firestore format
 * 6. Saves deal to Firestore
 * 7. Returns structured deal data to frontend
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const FormData = require('form-data');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

// AI team's FastAPI endpoint URL
// TODO: Update this with actual endpoint (local or deployed)
const AI_API_URL = process.env.AI_API_URL || 'http://localhost:8000/parse-menu';

/**
 * Convert AI output format to Firestore format
 */
function convertAIToFirestore(aiResult) {
  // Normalize days to lowercase for consistency
  const normalizeDays = (days) => {
    if (!days || days.length === 0) return [];
    return days.map(day => day.toLowerCase());
  };

  // Convert time format (e.g., "4:00 PM" -> "16:00")
  const normalizeTime = (time) => {
    if (!time) return time;
    
    // Check if already in 24h format
    if (time.includes(":") && !time.toUpperCase().includes("AM") && !time.toUpperCase().includes("PM")) {
      return time;
    }
    
    // Convert 12h to 24h format
    const isPM = time.toUpperCase().includes("PM");
    const isAM = time.toUpperCase().includes("AM");
    
    if (isPM || isAM) {
      const timeStr = time.replace(/[APM]/gi, "").trim();
      const [hours, minutes] = timeStr.split(":");
      let hour24 = parseInt(hours);
      
      if (isPM && hour24 !== 12) hour24 += 12;
      if (isAM && hour24 === 12) hour24 = 0;
      
      return `${hour24.toString().padStart(2, "0")}:${minutes || "00"}`;
    }
    
    return time;
  };

  return {
    restaurantName: aiResult.restaurant_name || null,
    deals: aiResult.deals.map(deal => ({
      name: deal.name,
      price: deal.price,
      description: deal.description || null,
    })),
    timeFrames: aiResult.time_frame.map(tf => ({
      startTime: normalizeTime(tf.start_time),
      endTime: normalizeTime(tf.end_time),
      days: normalizeDays(tf.days),
    })),
    specialConditions: aiResult.special_conditions || null,
  };
}

/**
 * Calculate if deal is active right now
 */
function calculateIsActiveNow(timeFrames) {
  const now = new Date();
  const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  return timeFrames.some(tf => {
    const dayMatch = !tf.days || tf.days.length === 0 || tf.days.includes(currentDay);
    const timeMatch = currentTime >= tf.startTime && currentTime <= tf.endTime;
    return dayMatch && timeMatch;
  });
}

/**
 * Convert Firestore format to Frontend response format
 * 
 * This transforms our normalized Firestore structure (venues + deals as separate collections)
 * into the frontend's desired flattened format (venue with nested deals).
 */
function convertToFrontendFormat(venue, deals) {
  // Convert 24h time back to 12h format for frontend
  const formatTimeForFrontend = (time24h) => {
    if (!time24h) return "";
    // If already in 12h format, return as-is
    if (time24h.toUpperCase().includes("AM") || time24h.toUpperCase().includes("PM")) {
      return time24h;
    }
    
    // Convert 24h to 12h format
    const [hours, minutes] = time24h.split(":");
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const period = hour24 >= 12 ? "PM" : "AM";
    return `${hour12}:${minutes || "00"} ${period}`;
  };

  // Convert days back to capitalized format
  const capitalizeDays = (days) => {
    if (!days || days.length === 0) return [];
    return days.map(day => day.charAt(0).toUpperCase() + day.slice(1).toLowerCase());
  };

  // Transform deals: flatten timeFrames into individual deal items
  const frontendDeals = [];
  
  for (const deal of deals) {
    // If deal has multiple timeFrames, create separate deal entries for each
    if (deal.extractedData && deal.extractedData.timeFrames && deal.extractedData.timeFrames.length > 0) {
      for (const timeFrame of deal.extractedData.timeFrames) {
        // For each deal item, create an entry with this timeFrame
        if (deal.extractedData.deals && deal.extractedData.deals.length > 0) {
          for (const dealItem of deal.extractedData.deals) {
            frontendDeals.push({
              name: dealItem.name,
              price: dealItem.price,
              description: dealItem.description || null,
              start_time: formatTimeForFrontend(timeFrame.startTime),
              end_time: formatTimeForFrontend(timeFrame.endTime),
              days: capitalizeDays(timeFrame.days),
              special_conditions: deal.extractedData.specialConditions || null,
            });
          }
        }
      }
    } else {
      // If no timeFrames, create deals without time info
      if (deal.extractedData && deal.extractedData.deals && deal.extractedData.deals.length > 0) {
        for (const dealItem of deal.extractedData.deals) {
          frontendDeals.push({
            name: dealItem.name,
            price: dealItem.price,
            description: dealItem.description || null,
            start_time: "",
            end_time: "",
            days: [],
            special_conditions: deal.extractedData.specialConditions || null,
          });
        }
      }
    }
  }

  return {
    venue_id: venue.id,
    venue_name: venue.name,
    latitude: venue.latitude,
    longitude: venue.longitude,
    address: venue.address,
    deals: frontendDeals,
  };
}

/**
 * Download image from Firebase Storage
 */
async function downloadImageFromStorage(imageUrl) {
  try {
    // Parse Firebase Storage URL
    // Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media
    const url = new URL(imageUrl);
    const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
    if (!pathMatch) {
      throw new Error('Invalid Firebase Storage URL');
    }
    
    const filePath = decodeURIComponent(pathMatch[1]);
    const bucket = storage.bucket();
    const file = bucket.file(filePath);
    
    // Download file to memory
    const [buffer] = await file.download();
    return buffer;
  } catch (error) {
    console.error('Error downloading image from Storage:', error);
    throw new Error(`Failed to download image: ${error.message}`);
  }
}

/**
 * Call AI team's FastAPI endpoint
 */
async function callAIService(imageBuffer, filename) {
  try {
    // Create form data for multipart upload
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: filename || 'menu.jpg',
      contentType: 'image/jpeg',
    });

    // Call AI team's FastAPI endpoint
    const response = await axios.post(AI_API_URL, formData, {
      headers: formData.getHeaders(),
      timeout: 30000, // 30 second timeout
      // Note: If AI API is self-signed or has SSL issues, you may need:
      // httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    return response.data;
  } catch (error) {
    console.error('Error calling AI service:', error);
    if (error.response) {
      throw new Error(`AI service error: ${error.response.status} - ${error.response.data}`);
    }
    throw new Error(`Failed to call AI service: ${error.message}`);
  }
}

/**
 * Create deal document in Firestore
 */
async function createDealDocument(data) {
  const {
    userId,
    venueId,
    imageUrl,
    aiResult,
    userLocation, // { latitude, longitude }
    restaurantName,
  } = data;

  // Convert AI format to Firestore format
  const extractedData = convertAIToFirestore(aiResult);
  
  // Use provided restaurant name or AI result
  const finalRestaurantName = restaurantName || extractedData.restaurantName || 'Unknown';
  
  // Get venue location if venueId provided
  let location = null;
  let latitude = null;
  let longitude = null;
  
  if (venueId) {
    const venueDoc = await db.collection('venues').doc(venueId).get();
    if (venueDoc.exists) {
      const venueData = venueDoc.data();
      location = venueData.location;
      latitude = venueData.latitude;
      longitude = venueData.longitude;
    }
  }
  
  // Use user location if venue location not available
  if (!location && userLocation) {
    location = new admin.firestore.GeoPoint(userLocation.latitude, userLocation.longitude);
    latitude = userLocation.latitude;
    longitude = userLocation.longitude;
  }
  
  // Calculate if deal is active now
  const isActiveNow = calculateIsActiveNow(extractedData.timeFrames);
  
  // Get current day of week
  const now = new Date();
  const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const activeDayOfWeek = extractedData.timeFrames
    .filter(tf => !tf.days || tf.days.length === 0 || tf.days.includes(currentDay))
    .map(tf => currentDay);

  // Create deal document
  const dealData = {
    venueId: venueId || null,
    userId: userId,
    imageUrl: imageUrl,
    extractedData: {
      restaurantName: finalRestaurantName,
      deals: extractedData.deals,
      timeFrames: extractedData.timeFrames,
      specialConditions: extractedData.specialConditions,
    },
    verified: false, // Start as unverified
    active: true, // Start as active
    votes: {
      upvotes: 0,
      downvotes: 0,
      userVotes: {},
    },
    location: location || new admin.firestore.GeoPoint(0, 0),
    latitude: latitude || 0,
    longitude: longitude || 0,
    restaurantName: finalRestaurantName,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: null, // Could be calculated based on timeFrames
    // Index fields
    _isActiveNow: isActiveNow,
    _activeDayOfWeek: [...new Set(activeDayOfWeek)],
    _searchRestaurant: finalRestaurantName.toLowerCase(),
  };

  // Save to Firestore
  const dealRef = await db.collection('deals').add(dealData);
  
  // Update venue's dealIds array
  if (venueId) {
    await db.collection('venues').doc(venueId).update({
      dealIds: admin.firestore.FieldValue.arrayUnion(dealRef.id),
    });
  }
  
  // Update user's uploadedDealIds array
  await db.collection('users').doc(userId).set({
    uploadedDealIds: admin.firestore.FieldValue.arrayUnion(dealRef.id),
  }, { merge: true });

  // Return deal document with ID
  return {
    id: dealRef.id,
    ...dealData,
  };
}

/**
 * Cloud Function: extractDealFromImage
 * 
 * Called by frontend after uploading image to Storage.
 * 
 * Input:
 * {
 *   imageUrl: string,        // Firebase Storage URL
 *   venueId?: string,        // Optional venue ID
 *   restaurantName?: string, // Optional override for restaurant name
 *   location?: {             // Optional user location
 *     latitude: number,
 *     longitude: number
 *   }
 * }
 */
exports.extractDealFromImage = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to upload deals'
    );
  }

  const userId = context.auth.uid;
  const { imageUrl, venueId, restaurantName, location } = data;

  // Validate required fields
  if (!imageUrl) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'imageUrl is required'
    );
  }

  try {
    // Step 1: Download image from Firebase Storage
    console.log(`Downloading image from Storage: ${imageUrl}`);
    const imageBuffer = await downloadImageFromStorage(imageUrl);
    console.log(`Downloaded image, size: ${imageBuffer.length} bytes`);

    // Step 2: Call AI team's FastAPI service
    console.log(`Calling AI service: ${AI_API_URL}`);
    const aiResult = await callAIService(imageBuffer, 'menu.jpg');
    console.log('AI service returned:', JSON.stringify(aiResult, null, 2));

    // Step 3: Create deal document in Firestore
    console.log('Creating deal document in Firestore...');
    const deal = await createDealDocument({
      userId,
      venueId: venueId || null,
      imageUrl,
      aiResult,
      userLocation: location || null,
      restaurantName: restaurantName || null,
    });

    console.log(`Deal created successfully: ${deal.id}`);

    // Step 4: Get venue data if venueId exists
    let frontendResponse = null;
    if (venueId) {
      const venueDoc = await db.collection('venues').doc(venueId).get();
      if (venueDoc.exists) {
        const venueData = venueDoc.data();
        const venue = { id: venueDoc.id, ...venueData };
        
        // Get all deals for this venue
        const dealsSnapshot = await db.collection('deals')
          .where('venueId', '==', venueId)
          .where('active', '==', true)
          .get();
        
        const allDeals = dealsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        // Convert to frontend format
        frontendResponse = convertToFrontendFormat(venue, allDeals);
      }
    }

    // Step 5: Return result to frontend in their expected format
    return {
      success: true,
      venue: frontendResponse, // Frontend format (venue with nested deals)
      deal: deal, // Keep Firestore format for reference
      aiResult: aiResult, // Include for debugging
    };

  } catch (error) {
    console.error('Error in extractDealFromImage:', error);
    
    return {
      success: false,
      error: error.message,
    };
  }
});







