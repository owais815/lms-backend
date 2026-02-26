'use strict';

/**
 * callingAppService.js
 * HTTP client for the MiroTalk SFU calling-app REST API.
 * The LMS backend is the sole consumer of the calling-app API —
 * the API secret is never exposed to the frontend.
 */

const CALLING_APP_URL = process.env.CALLING_APP_URL || 'http://localhost:3010';
const CALLING_APP_API_SECRET = process.env.CALLING_APP_API_SECRET || 'lms_calling_secret_2026';

const API_BASE = `${CALLING_APP_URL}/api/v1`;

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
 * @param {string} roomId       - Unique room identifier, e.g. 'lms-42'
 * @param {string} userName     - Display name of the participant
 * @param {boolean} isPresenter - true = teacher/admin (can mute, kick, etc.)
 * @returns {Promise<string>}   - The full join URL to load in the iframe
 */
async function createJoinUrl(roomId, userName, isPresenter) {
  const data = await callingAppRequest('/join', 'POST', {
    room: roomId,
    roomPassword: false,
    name: userName,
    audio: true,
    video: true,
    screen: isPresenter,
    hide: false,
    notify: false,
    token: {
      username: userName,
      password: 'lms-token',
      presenter: isPresenter,
      expire: '2h',
    },
  });

  if (!data || !data.join) {
    throw new Error('Calling-app did not return a join URL');
  }

  return data.join;
}

/**
 * Get a list of currently active meetings from the calling-app.
 * @returns {Promise<Array>}
 */
async function getActiveMeetings() {
  return callingAppRequest('/meetings', 'GET');
}

module.exports = { createJoinUrl, getActiveMeetings };
