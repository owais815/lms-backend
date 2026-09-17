'use strict';

/**
 * Public surface of the email subsystem.
 *
 * Controllers and crons should only ever need this file:
 *
 *   const { sendEmailEvent } = require('../emails');
 *   sendEmailEvent('payment.proof_verified', { fee, student });   // no await
 *
 * `critical: true` events (credentials, password resets) should be awaited --
 * it is two indexed inserts, and you want the intent durably recorded before
 * telling someone to check their inbox.
 */

const { sendEmailEvent } = require('./dispatch');
const registry = require('./registry');
const settings = require('./settings/cache');
const { buckets } = require('./queue/dedup');

module.exports = {
    sendEmailEvent,
    registry,
    settings,
    // Re-exported so call sites spell reminder and digest buckets consistently.
    buckets,
};
