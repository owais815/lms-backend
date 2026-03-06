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
// Secret must be set in .env — no hardcoded fallback
const CALLING_APP_API_SECRET = process.env.CALLING_APP_API_SECRET;

if (!CALLING_APP_API_SECRET) {
  console.error('[callingAppService] CALLING_APP_API_SECRET is not set in environment variables. Calling-app API requests will fail.');
}

const API_BASE = `${CALLING_APP_API_URL}/api/v1`;

/**
 * Make an authenticated request to the calling-app API.
 */
async function callingAppRequest(path, method = 'GET', body = null) {
  if (!CALLING_APP_API_SECRET) {
    throw new Error('Calling-app API secret not configured. Set CALLING_APP_API_SECRET in environment.');
  }

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
 * @param {string} roomId       - Unique room identifier, e.g. 'lms-42'
 * @param {string} userName     - Display name of the participant
 * @param {boolean} isPresenter - true = teacher/admin
 * @returns {Promise<string>}   - The full join URL to load in the iframe
 */
async function createJoinUrl(roomId, userName, isPresenter, audio = false, video = false) {
  // Append a short random suffix so each join attempt has a unique peer_name.
  // MiroTalk blocks entry if another peer with the exact same name is already in the room
  // (e.g. on iframe refresh or duplicate names). The suffix keeps display names readable
  // while guaranteeing uniqueness.
  // Use timestamp (last 4 base-36 chars) + 3 random chars for a 7-char suffix.
  // The timestamp component makes each call unique within its millisecond, and the
  // random component handles concurrent calls in the same millisecond. This is far
  // more robust than the old 3-char-only suffix (46K possibilities) and prevents
  // the "Username already in use" collision that occurs when MiroTalk's server-side
  // peer cleanup hasn't finished before a reconnect or rejoin attempt arrives.
  const suffix = Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 5);
  const uniqueName = `${userName}-${suffix}`;

  const params = new URLSearchParams({
    room: roomId,
    roomPassword: 'false',
    name: uniqueName,
    audio: String(audio),
    video: String(video),
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
