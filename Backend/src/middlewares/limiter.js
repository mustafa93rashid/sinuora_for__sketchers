const rateLimit = require("express-rate-limit");

// ==================== Rate Limiter Factory ====================

const createLimiter = ({
  windowMs,
  limit,
  message,
  skipSuccessfulRequests = false,
}) => {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: {
      success: false,
      message,
    },
  });
};

// ==================== Login Limiter ====================

const signinLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: "Too many login attempts. Please try again after 15 minutes.",
});

// ==================== Account-Aware Login Limiter ====================
// signinLimiter alone is keyed by IP, so a distributed attacker (botnet,
// proxy rotation) gets a fresh budget per IP against the same victim
// account. This second limiter is keyed by the submitted email instead,
// independent of IP (audit finding M-1).

const accountKeyGenerator = (req) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  return email || req.ip;
};

const accountSigninLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: accountKeyGenerator,
  message: {
    success: false,
    message: "Too many login attempts for this account. Please try again after 15 minutes.",
  },
});

// ==================== Password Change Request Limiter ====================

const passwordChangeRequestLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message:
    "Too many password change requests. Please try again after 15 minutes.",
});

// ==================== Password Change Verification Limiter ====================

const passwordChangeVerifyLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many verification attempts. Please try again after 15 minutes.",
});

// ==================== Email Change Request Limiter ====================

const emailChangeRequestLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: "Too many email change requests. Please try again after 15 minutes.",
});

// ==================== Email Change Verification Limiter ====================

const emailChangeVerifyLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many verification attempts. Please try again after 15 minutes.",
});

// ==================== Forgot Password Limiter ====================

const forgotPasswordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message:
    "Too many password reset requests. Please try again after 15 minutes.",
});

// ==================== Reset Password Limiter ====================

const resetPasswordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message:
    "Too many password reset attempts. Please try again after 15 minutes.",
});

// ==================== Refresh Token Limiter ====================

const refreshTokenLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: "Too many refresh token requests. Please try again later.",
});

const activationLimiter = createLimiter({ windowMs: 15 * 60 * 1000, limit: 10, message: "Too many activation attempts" });

module.exports = {
  activationLimiter,
  signinLimiter,
  accountSigninLimiter,
  accountKeyGenerator,
  passwordChangeRequestLimiter,
  passwordChangeVerifyLimiter,
  emailChangeRequestLimiter,
  emailChangeVerifyLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  refreshTokenLimiter,
};
