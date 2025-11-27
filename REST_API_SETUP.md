# Massive.com REST API Setup

## ⚠️ IMPORTANT: REST API Endpoints Need Configuration

The REST API service (`src/services/massive-rest-api.ts`) currently uses **placeholder endpoints** that don't exist. You need to update them with the actual Massive.com REST API endpoints.

## Steps to Configure:

1. **Check Massive.com Documentation**
   - Visit Massive.com API documentation
   - Find the REST API base URL (e.g., `https://api.massive.com` or `https://api.massive.com/v1`)
   - Find the endpoints for:
     - Getting stock quotes
     - Getting historical bars/aggregates

2. **Update `massive-rest-api.ts`**
   
   Update these values:
   ```typescript
   private baseUrl: string = 'https://api.massive.com'; // Replace with actual base URL
   ```

   Update these methods:
   - `getQuote()` - Update the endpoint path (currently `/v1/stocks/{symbol}/quote`)
   - `getHistoricalBars()` - Update the endpoint path (currently `/v1/stocks/{symbol}/bars`)

3. **Update Authentication**
   - Check if Massive.com uses Bearer token, API key in header, or query parameter
   - Update the headers in both methods accordingly

4. **Update Response Parsing**
   - The response parsing assumes certain field names
   - Adjust the field mappings based on actual API response format

## Current Status:

- ✅ WebSocket integration (with fallback to delayed endpoint)
- ✅ IndexedDB caching system
- ✅ React hooks for data fetching
- ⚠️ REST API endpoints need to be configured (placeholder URLs)
- ⚠️ Response parsing may need adjustment based on actual API format

## Testing:

Once you update the endpoints:
1. Check browser console for API calls
2. Look for `[MassiveRestApi]` log messages
3. Verify data is being fetched and cached
4. Check Network tab in DevTools to see actual API requests

## Fallback Behavior:

- If REST API fails, the system will:
  1. Try to use cached data (if available)
  2. Fall back to mock data (if no cache)
  3. Show error messages in console

