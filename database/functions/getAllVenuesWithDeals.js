/**
 * Cloud Function: getAllVenuesWithDeals
 * 
 * Returns ALL venues with their deals in frontend's expected format.
 * This is the main API endpoint for frontend to get all venue data.
 * 
 * Input:
 * {}  // No input required
 * 
 * Output:
 * {
 *   success: boolean,
 *   venues: FrontendVenueWithDeals[],  // Array of venues in frontend format
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
 * (Reused from getVenueWithDeals.js)
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

// updated funciton to pull from 'final_schema' 
exports.getAllVenuesWithDeals = functions.https.onCall(async (_data, _ctx) => {
  try {
    const snap = await db.collection('final_schema').get();
    functions.logger.info('[getAllVenuesWithDeals] Using final_schema', { count: snap.size });


    if (snap.empty) {
      return { success: true, venues: [] };
    }

    const venues = snap.docs.map(doc => {
      const v = doc.data() || {};

      const deals = Array.isArray(v.deals)
        ? v.deals.map(d => ({
            name: d?.name ?? '',
            price: d?.price ?? '',
            description: d?.description ?? null,
            start_time: d?.start_time ?? '',
            end_time: d?.end_time ?? '',
            days: Array.isArray(d?.days) ? d.days : [],
            special_conditions: Array.isArray(d?.special_conditions)
              ? d.special_conditions.join('; ')
              : (d?.special_conditions ?? null),
          }))
        : [];

      return {
        venue_id: v.venue_id ?? doc.id,
        venue_name: v.venue_name ?? '',
        latitude: v.latitude ?? null,
        longitude: v.longitude ?? null,
        address: v.address ?? '',
        deals,
      };
    });

    return { success: true, venues };
  } catch (error) {
    console.error('Error in getAllVenuesWithDeals:', error);
    return { success: false, venues: [], error: error.message };
  }
});
