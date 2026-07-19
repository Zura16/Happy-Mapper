/**
 * Cloud Function: getVenueWithDeals
 * 
 * Returns venue data in frontend's expected format (venue with nested deals).
 * Frontend calls this instead of querying Firestore directly.
 * 
 * Input:
 * {
 *   venueId: string  // Required: Venue ID to fetch
 * }
 * 
 * Output:
 * {
 *   success: boolean,
 *   venue: FrontendVenueWithDeals | null,  // Frontend format
 *   error?: string
 * }
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Convert Firestore format to Frontend response format
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

exports.getVenueWithDeals = functions.https.onCall(async (data, context) => {
  const { venueId } = data;

  // Validate required fields
  if (!venueId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'venueId is required'
    );
  }

  try {
    // Step 1: Get venue document
    const venueDoc = await db.collection('venues').doc(venueId).get();
    
    if (!venueDoc.exists) {
      return {
        success: false,
        venue: null,
        error: 'Venue not found',
      };
    }

    const venueData = venueDoc.data();
    const venue = { id: venueDoc.id, ...venueData };

    // Step 2: Get all active deals for this venue
    const dealsSnapshot = await db.collection('deals')
      .where('venueId', '==', venueId)
      .where('active', '==', true)
      .get();

    const deals = dealsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Step 3: Convert to frontend format
    const frontendVenue = convertToFrontendFormat(venue, deals);

    return {
      success: true,
      venue: frontendVenue,
    };

  } catch (error) {
    console.error('Error in getVenueWithDeals:', error);
    
    return {
      success: false,
      venue: null,
      error: error.message,
    };
  }
});

