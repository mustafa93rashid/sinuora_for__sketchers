const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");

const auth = require("../middlewares/auth");
const asyncHandler = require("../utils/asyncHandler");

const {loginValidation, requestPasswordChangeValidation, verifyPasswordChangeValidation, forgotPasswordValidation, resetPasswordValidation} = require("../validation/auth.validate");
const {signinLimiter, passwordChangeRequestLimiter, passwordChangeVerifyLimiter,forgotPasswordLimiter, resetPasswordLimiter,refreshTokenLimiter} = require("../middlewares/limiter");

// ==================== Login ====================

router.post("/login", [signinLimiter, ...loginValidation], asyncHandler(authController.login));

// ==================== Logout ====================

router.post("/logout", [auth], asyncHandler(authController.logout));

// ==================== Get Current User ====================

router.get("/me", [auth], asyncHandler(authController.getCurrentUser));

// ==================== Request Password Change ====================

router.post("/change-password/request", [auth, passwordChangeRequestLimiter, ...requestPasswordChangeValidation], asyncHandler(authController.requestPasswordChange));

// ==================== Verify Password Change ====================

router.post("/change-password/verify", [auth, passwordChangeVerifyLimiter, ...verifyPasswordChangeValidation], asyncHandler(authController.verifyPasswordChange));

// ==================== Forgot Password ====================

router.post("/forgot-password", [forgotPasswordLimiter, ...forgotPasswordValidation], asyncHandler(authController.forgotPassword));

// ==================== Reset Password ====================

router.post("/reset-password/:token", [resetPasswordLimiter, ...resetPasswordValidation], asyncHandler(authController.resetPassword));

// ==================== Refresh Access Token ====================

router.post("/refresh-token", [refreshTokenLimiter], asyncHandler(authController.refreshToken));

module.exports = router;