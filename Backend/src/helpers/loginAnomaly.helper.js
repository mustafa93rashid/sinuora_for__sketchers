// ==================== Login Anomaly Monitor ====================
// Observes failed login attempts per normalized email and logs a
// warning once a threshold is crossed within a window, so an operator
// can investigate a targeted or distributed brute-force attempt.
//
// This is intentionally detection-only - it never blocks or delays a
// request. An earlier version of this fix (audit finding M-1) added a
// hard rate limit keyed purely on the submitted email; security review
// correctly flagged that as a worse vulnerability than the one it
// closed, since anyone who merely knows a coworker's email could lock
// them out of login with zero credentials. This replacement keeps the
// visibility into the attack without ever denying the real owner
// access.

const WINDOW_MS = 15 * 60 * 1000;
const THRESHOLD = 10;

const failureCounts = new Map();

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const recordFailedLogin = (email, now = Date.now()) => {
  const key = normalizeEmail(email);

  if (!key) return 0;

  const existing = failureCounts.get(key);

  if (!existing || now - existing.windowStart > WINDOW_MS) {
    failureCounts.set(key, { count: 1, windowStart: now, warned: false });
    return 1;
  }

  existing.count += 1;

  if (existing.count >= THRESHOLD && !existing.warned) {
    existing.warned = true;
    console.warn(`[auth] ${existing.count} failed login attempts for one account within 15 minutes: ${key}`);
  }

  return existing.count;
};

const clearFailedLogins = (email) => {
  failureCounts.delete(normalizeEmail(email));
};

module.exports = { normalizeEmail, recordFailedLogin, clearFailedLogins };
