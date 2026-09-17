const notify = require('./notify');
const settings = require('../notifications/settings/cache');

const keyOf = (r) => `${r.userType}|${r.userId}|${r.title}|${r.message}`;

/**
 * Send many notifications in one call.
 *
 * Rows missing any required field are dropped rather than sent — a recipient with
 * no parent on file, or an enrolment row with a null studentId, must not produce a
 * notification. Rows are also de-duped: CourseDetails can legitimately hold two rows
 * for the same (studentId, courseId) under different teachers, and several callers
 * map over it directly, which would otherwise deliver the same message twice.
 *
 * Rows whose event an admin has switched off, or narrowed away from this
 * audience, are filtered here rather than inside notify(). Same outcome either
 * way, but a disabled event costs no promises at all.
 *
 * Implemented as a fan-out over notify() rather than Notification.bulkCreate() on
 * purpose: notify() isolates per-row failures, so one bad recipient costs one
 * notification instead of the whole batch. Swapping to a batched insert later is a
 * change to this file alone — the call-site API is identical.
 *
 * Never throws.
 *
 * @param {Array<{ userId: number|string, userType: string, title: string, message: string, priority?: 'critical'|'warning'|'info', eventKey?: string }>} rows
 * @returns {Promise<Array>} the created records (undefined entries where a send failed)
 */
const notifyBulk = async (rows) => {
  try {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const seen = new Set();
    const clean = [];
    for (const r of rows) {
      if (!r || !r.userId || !r.userType || !r.title || !r.message) continue;

      const eventKey = notify.resolveEventKey(r.eventKey, r.title);
      if (!settings.isEnabled(eventKey, r.userType)) continue;

      const k = keyOf(r);
      if (seen.has(k)) continue;
      seen.add(k);
      clean.push(r);
    }

    return await Promise.all(clean.map((r) => notify(r)));
  } catch (err) {
    console.error('notifyBulk error:', err);
    return [];
  }
};

module.exports = notifyBulk;
