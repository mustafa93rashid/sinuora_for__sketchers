// ==================== Login Anomaly Monitor ====================
// Tracks login attempts per normalized email to slow down (not block)
// a targeted or distributed brute-force attempt, and logs a masked
// warning once a threshold is crossed.
//
// History (audit finding M-1, four security review rounds):
//   1. A hard rate limit keyed purely on the submitted email let anyone
//      who merely knows a coworker's email lock them out of login with
//      zero credentials - reverted.
//   2. A detection-only, log-only version removed all friction (control
//      regression) and had an unbounded store plus a fully-exposed
//      email in its log line - fixed with a capped progressive delay, a
//      bounded/evicting store, and masked logging.
//   3. The eviction policy could push out an already-anomalous entry to
//      make room for a flood of fresh junk keys, and the delay snapshot
//      (getDelayMs) had no side effects, so concurrent requests for one
//      email all read the same stale value instead of queueing - fixed
//      with threshold-aware eviction and a synchronous per-key
//      "nextAllowedAt" queue (reserveDelay).
//   4. reserveDelay still read a count that only grew once a request's
//      own password check had resolved and failed, so N truly
//      concurrent requests could all read the same below-threshold
//      count and none would be delayed. claimAttempt below counts the
//      attempt and reserves its delay slot in one synchronous step, so
//      it must be called once at the very start of login - before any
//      await - instead of waiting for the request to fail.

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

const isOverThreshold = (entry) => entry.count >= THRESHOLD;

// Opportunistically drops expired entries while choosing one to evict.
// Prefers the oldest entry that is still under the anomaly threshold,
// so a flood of fresh low-count junk keys displaces other low-count
// junk, never an account that's already flagged as anomalous - unless
// the entire store is somehow over threshold, in which case evicting
// the oldest one is the only option left.
const evictIfFull = (now) => {
  if (failureCounts.size < MAX_ENTRIES) return;

  let bestKey = null;
  let bestStart = Infinity;
  let oldestOverKey = null;
  let oldestOverStart = Infinity;

  for (const [key, entry] of failureCounts) {
    if (isExpired(entry, now)) {
      failureCounts.delete(key);
      continue;
    }

    if (isOverThreshold(entry)) {
      if (entry.windowStart < oldestOverStart) {
        oldestOverStart = entry.windowStart;
        oldestOverKey = key;
      }
      continue;
    }

    if (entry.windowStart < bestStart) {
      bestStart = entry.windowStart;
      bestKey = key;
    }
  }

  if (failureCounts.size < MAX_ENTRIES) return;

  const toEvict = bestKey ?? oldestOverKey;

  if (toEvict) failureCounts.delete(toEvict);
};

// Fetches the live entry for a key, starting a fresh window if there
// is none or the previous one expired. Does not increment the count.
const getLiveEntry = (key, now) => {
  const existing = failureCounts.get(key);

  if (existing && !isExpired(existing, now)) return existing;

  evictIfFull(now);

  const entry = { count: 0, windowStart: now, warned: false, nextAllowedAt: now };

  failureCounts.set(key, entry);

  return entry;
};

const warnIfThresholdCrossed = (entry, key) => {
  if (entry.count >= THRESHOLD && !entry.warned) {
    entry.warned = true;
    console.warn(`[auth] ${entry.count} failed login attempts for one account within 15 minutes: ${maskEmail(key)}`);
  }
};

const recordFailedLogin = (email, now = Date.now()) => {
  const key = normalizeEmail(email);

  if (!key) return 0;

  const entry = getLiveEntry(key, now);

  entry.count += 1;
  warnIfThresholdCrossed(entry, key);

  return entry.count;
};

const clearFailedLogins = (email) => {
  failureCounts.delete(normalizeEmail(email));
};

const delayForCount = (count) => {
  const over = count - THRESHOLD + 1;

  if (over <= 0) return 0;

  return Math.min(BASE_DELAY_MS * over, MAX_DELAY_MS);
};

// Advances entry.nextAllowedAt synchronously and returns this call's
// wait, queueing concurrent callers one behind another instead of
// letting them all read the same delay. Capped overall at
// now + MAX_DELAY_MS so a large burst clusters at the cap instead of
// growing an unbounded queue.
const scheduleRelease = (entry, now) => {
  const step = delayForCount(entry.count);

  if (step <= 0) return 0;

  const ceiling = now + MAX_DELAY_MS;
  const earliest = Math.max(now + step, (entry.nextAllowedAt ?? now) + step);
  const releaseAt = Math.min(earliest, ceiling);

  entry.nextAllowedAt = releaseAt;

  return releaseAt - now;
};

// Read-only snapshot of the current delay magnitude for an account,
// with no side effects - does not touch the count or the queue.
// Exists for introspection/tests; request-handling code should call
// claimAttempt() instead.
const getDelayMs = (email, now = Date.now()) => {
  const key = normalizeEmail(email);

  if (!key) return 0;

  const existing = failureCounts.get(key);

  if (!existing || isExpired(existing, now)) return 0;

  return delayForCount(existing.count);
};

// Reserves a queue slot for the account's *current* count without
// incrementing it. Kept for callers that only want the queueing
// behavior around an already-recorded count; login() should use
// claimAttempt() instead, since that also counts the attempt itself.
const reserveDelay = (email, now = Date.now()) => {
  const key = normalizeEmail(email);

  if (!key) return 0;

  const entry = failureCounts.get(key);

  if (!entry || isExpired(entry, now)) return 0;

  return scheduleRelease(entry, now);
};

// The entry point login() should call, once, at the very start of the
// request - before any await. Counts this attempt immediately (not
// only after it's confirmed to have failed) and reserves this call's
// delay slot in the same synchronous step, so truly concurrent
// requests for one email each see the others' in-flight attempts
// instead of all reading a stale, below-threshold count.
const claimAttempt = (email, now = Date.now()) => {
  const key = normalizeEmail(email);

  if (!key) return 0;

  const entry = getLiveEntry(key, now);

  entry.count += 1;
  warnIfThresholdCrossed(entry, key);

  return scheduleRelease(entry, now);
};

const size = () => failureCounts.size;

module.exports = {
  normalizeEmail,
  recordFailedLogin,
  clearFailedLogins,
  getDelayMs,
  reserveDelay,
  claimAttempt,
  maskEmail,
  size,
};
