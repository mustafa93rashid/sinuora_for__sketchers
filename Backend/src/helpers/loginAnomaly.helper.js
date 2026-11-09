// ==================== Login Anomaly Monitor ====================
// Tracks failed login attempts per normalized email to slow down (not
// block) a targeted or distributed brute-force attempt, and logs a
// masked warning once a threshold is crossed.
//
// History: a first version added a hard rate limit keyed purely on the
// submitted email (audit finding M-1); security review flagged that as
// a worse vulnerability than the one it closed - anyone who merely
// knows a coworker's email could lock them out of login with zero
// credentials. A second version removed all friction and only logged a
// warning; review flagged that as a control regression plus an
// unbounded store and an over-exposed log line, which a third version
// fixed with a capped progressive delay, a bounded/evicting store, and
// email masking. A fourth review round found two remaining gaps, both
// fixed here:
//   - evictIfFull could push out an already-anomalous (over-threshold)
//     entry to make room for a flood of fresh junk keys, letting an
//     attacker reset their own throttle state by flooding unrelated
//     emails. Eviction now only ever removes a sub-threshold entry,
//     and only falls back to an over-threshold one if literally every
//     entry in the store is over threshold.
//   - getDelayMs was a pure snapshot of the count-based delay, so N
//     concurrent requests for the same email all read the same value
//     and none of them actually queued behind each other. reserveDelay
//     is now the entry point login() calls: it tracks a per-key
//     "nextAllowedAt" timestamp and advances it *synchronously* on
//     every call (JS's run-to-completion semantics make this safe
//     without a real lock), so concurrent requests for one email are
//     serialized into a queue instead of all firing together - while
//     still capped overall so the wait can never run away unbounded.

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

const recordFailedLogin = (email, now = Date.now()) => {
  const key = normalizeEmail(email);

  if (!key) return 0;

  const existing = failureCounts.get(key);

  if (!existing || isExpired(existing, now)) {
    evictIfFull(now);
    failureCounts.set(key, { count: 1, windowStart: now, warned: false, nextAllowedAt: now });
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

const delayForCount = (count) => {
  const over = count - THRESHOLD + 1;

  if (over <= 0) return 0;

  return Math.min(BASE_DELAY_MS * over, MAX_DELAY_MS);
};

// Read-only snapshot of the current delay magnitude for an account,
// with no side effects - does not reserve a queue slot. Prefer
// reserveDelay() in request-handling code; this exists for
// introspection/tests.
const getDelayMs = (email, now = Date.now()) => {
  const key = normalizeEmail(email);

  if (!key) return 0;

  const existing = failureCounts.get(key);

  if (!existing || isExpired(existing, now)) return 0;

  return delayForCount(existing.count);
};

// Concurrency-safe entry point: reserves this call's slot in the
// per-key queue and returns how long THIS call must wait, advancing
// the key's nextAllowedAt synchronously so a burst of concurrent
// requests for the same email queue up one after another rather than
// each reading the same stale delay. The wait is still capped overall
// at MAX_DELAY_MS so a large burst clusters at the cap instead of
// growing an unbounded queue.
const reserveDelay = (email, now = Date.now()) => {
  const key = normalizeEmail(email);

  if (!key) return 0;

  const entry = failureCounts.get(key);

  if (!entry || isExpired(entry, now)) return 0;

  const step = delayForCount(entry.count);

  if (step <= 0) return 0;

  const ceiling = now + MAX_DELAY_MS;
  const earliest = Math.max(now + step, (entry.nextAllowedAt ?? now) + step);
  const releaseAt = Math.min(earliest, ceiling);

  entry.nextAllowedAt = releaseAt;

  return releaseAt - now;
};

const size = () => failureCounts.size;

module.exports = {
  normalizeEmail,
  recordFailedLogin,
  clearFailedLogins,
  getDelayMs,
  reserveDelay,
  maskEmail,
  size,
};
