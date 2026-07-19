/**
 * Cloud Functions Entry Point
 * 
 * Export all Cloud Functions here
 */

const { extractDealFromImage } = require('./extractDealFromImage');
const { getVenueWithDeals } = require('./getVenueWithDeals');
const { getAllVenuesWithDeals } = require('./getAllVenuesWithDeals');

module.exports = {
  extractDealFromImage,
  getVenueWithDeals,
  getAllVenuesWithDeals,
};







