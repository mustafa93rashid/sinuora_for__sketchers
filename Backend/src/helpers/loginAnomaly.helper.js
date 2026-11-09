// ==================== Login Anomaly Monitor ====================
// Tracks failed login attempts per normalized email to slow down (not
// block) a targeted or distributed brute-force attempt, and logs a
// masked warning once a threshold is crossed.
//
// History: a first version of this fix (audit finding M-1) added a
// hard rate limit keyed purely on the submitted email. Security review
// flagged that as a worse vulnerability than the one it closed - anyone
// who merely knows a coworker's email could lock them out of login
// with zero credentials. A second version removed all friction and
// only logged a warning; a follow-up review flagged that as a control
// regression (no actual throttling left) plus two hygiene issues: the
// failure-count store had no upper bound, and the log line printed a
// full email address. This version adds all three back safely:
//   - getDelayMs returns a small, capped delay (never a hard block) so
//     repeated failures against one account are throttled without ever
//     preventing the real owner's correct-password request from
//     eventually succeeding.
//   - the store evicts its oldest entry once it reaches MAX_ENTRIES, so
//     probing many distinct fake emails cannot grow memory unbounded.
//   - the log line masks the local part of the email.

const WINDOW_MS = 15 * 60 * 1000;
const THRESHOLD = 10;
const MAX_ENTRIES = 5000;
const BASE_DELAY_MS = 300;
const MAX_DELAY_MS = 3000;

const failureCounts = new Map();

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const maskEmail = (email) => {
  const [local, domain] = String(email || "").split("@");

  if (!domain) return "***";

  return `${local[0] || "*"}***@${domain}`;
};

const isExpired = (entry, now) => now - entry.windowStart > WINDOW_MS;

// Opportunistically drops expired entries while looking for the oldest
// live one to evict, so the store self-cleans under normal traffic
// instead of only ever growing until it hits the cap.
const evictIfFull = (now) => {
  if (failureCounts.size < MAX_ENTRIES) return;

  let oldestKey = null;
  let oldestStart = Infinity;

  for (const [key, entry] of failureCounts) {
    if (isExpired(entry, now)) {
      failureCounts.delete(key);
      continue;
    }

    if (entry.windowStart < oldestStart) {
      oldestStart = entry.windowStart;
      oldestKey = key;
    }
  }

  if (failureCounts.size >= MAX_ENTRIES && oldestKey) {
    failureCounts.delete(oldestKey);
  }
};

const recordFailedLogin = (email, now = Date.now()) => {
  const key = normalizeEmail(email);

  if (!key) return 0;

  const existing = failureCounts.get(key);

  if (!existing || isExpired(existing, now)) {
    evictIfFull(now);
    failureCounts.set(key, { count: 1, windowStart: now, warned: false });
    return 1;
  }

  existing.count += 1;

  if (existing.count >= THRESHOLD && !existing.warned) {
    existing.warned = true;
    console.warn(`[auth] ${existing.count} failed login attempts for one account within 15 minutes: ${maskEmail(key)}`);
  }

  return existing.count;
};

const clearFailedLogins = (email) => {
  failureCounts.delete(normalizeEmail(email));
};

// A small, capped delay once an account crosses the failure threshold -
// never a block. Lets a slow, deliberate attacker's throughput drop
// sharply while guaranteeing the real owner's correct-password request
// still succeeds, just a little slower.
const getDelayMs = (email, now = Date.now()) => {
  const key = normalizeEmail(email);

  if (!key) return 0;

  const existing = failureCounts.get(key);

  if (!existing || isExpired(existing, now)) return 0;

  const over = existing.count - THRESHOLD + 1;

  if (over <= 0) return 0;

  return Math.min(BASE_DELAY_MS * over, MAX_DELAY_MS);
};

const size = () => failureCounts.size;

module.exports = {
  normalizeEmail,
  recordFailedLogin,
  clearFailedLogins,
  getDelayMs,
  maskEmail,
  size,
};
