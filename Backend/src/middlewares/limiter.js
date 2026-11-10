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

// ==================== General API Limiter ====================
// Product, variant, inventory, order and dashboard routes previously
// had no rate limiting at all - an authenticated session could issue
// unlimited catalog writes or stock adjustments (audit finding M-14).
// A generous per-IP cap well above normal interactive staff usage
// (300 requests / 15 min = ~1 every 3 seconds sustained) adds a
// backstop against a runaway script or compromised session without
// affecting legitimate use of an internal tool.

const generalApiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: "Too many requests. Please slow down and try again shortly.",
});

// ==================== Login Limiter ====================

const signinLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: "Too many login attempts. Please try again after 15 minutes.",
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
  generalApiLimiter,
  passwordChangeRequestLimiter,
  passwordChangeVerifyLimiter,
  emailChangeRequestLimiter,
  emailChangeVerifyLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  refreshTokenLimiter,
};
