'use strict';

/**
 * callingAppService.js
 * HTTP client for the MiroTalk SFU calling-app REST API.
 * The LMS backend is the sole consumer of the calling-app API —
 * the API secret is never exposed to the frontend.
 */

// Public URL returned to browsers (iframe join links) — must be HTTPS in production
const CALLING_APP_URL = process.env.CALLING_APP_URL || 'http://localhost:3010';
// Internal URL for backend→calling-app API calls — can stay on localhost to avoid SSL round-trip
const CALLING_APP_API_URL = process.env.CALLING_APP_API_URL || CALLING_APP_URL;
const CALLING_APP_API_SECRET = process.env.CALLING_APP_API_SECRET || 'lms_calling_secret_2026';

const API_BASE = `${CALLING_APP_API_URL}/api/v1`;

/**
 * Make an authenticated request to the calling-app API.
 */
async function callingAppRequest(path, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      authorization: CALLING_APP_API_SECRET,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, options);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Calling-app API error [${response.status}]: ${text}`);
  }

  return response.json();
}

/**
 * Create a join URL for a calling-app room.
 *
 * No token is needed: calling-app config has host.protected=false which sets
 * hostCfg.authenticated=true server-wide, so the /join route always serves
 * the room page without requiring a token.
 *
 * Without a token in the URL, Room.js never sends peer_token over WebSocket,
 * and since user_auth=false the WebSocket auth block is skipped entirely —
 * preventing the JWT catch-block that would redirect to the landing page.
 *
 * Name encoding note: pass userName directly to URLSearchParams — it handles
 * percent-encoding automatically. Pre-encoding with encodeURIComponent causes
 * double-encoding (%20 → %2520) making the name appear as "Ali%20Sher" in room.
 *
 * @param {string} roomId       - Unique room identifier, e.g. 'lms-42'
 * @param {string} userName     - Display name of the participant
 * @param {boolean} isPresenter - true = teacher/admin
 * @returns {Promise<string>}   - The full join URL to load in the iframe
 */
async function createJoinUrl(roomId, userName, isPresenter) {
  const params = new URLSearchParams({
    room: roomId,
    roomPassword: 'false',
    name: userName,
    audio: 'true',
    video: 'true',
    screen: String(isPresenter),
    hide: 'false',
    notify: 'false',
    isPresenter: String(isPresenter),
  });

  return `${CALLING_APP_URL}/join?${params.toString()}`;
}

/**
 * Get a list of currently active meetings from the calling-app.
 * @returns {Promise<Array>}
 */
async function getActiveMeetings() {
  return callingAppRequest('/meetings', 'GET');
}

module.exports = { createJoinUrl, getActiveMeetings };
