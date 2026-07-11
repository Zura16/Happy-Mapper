/**
 * API Configuration Constants
 * Centralized configuration for backend API endpoints
 */

// Backend API base URL - update for production
export const API_BASE_URL = __DEV__
  ? 'http://localhost:5000'
  : 'https://happy-mapper-api.vercel.app';

// API Endpoints
export const ENDPOINTS = {
  HEALTH: '/health',
  UPLOAD_DEAL: '/upload-deal',
  GET_DATA: '/api/data',
} as const;

// Request timeouts (ms)
export const REQUEST_TIMEOUT = 30000;
export const UPLOAD_TIMEOUT = 60000;
