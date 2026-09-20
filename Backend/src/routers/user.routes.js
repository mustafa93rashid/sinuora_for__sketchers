const express = require("express");

const router = express.Router();

const userController = require("../controllers/user.controller");

const auth = require("../middlewares/auth");
const role = require("../middlewares/role");
const { uploadUserAvatar } = require("../middlewares/upload.middleware");
const {
  emailChangeRequestLimiter,
  emailChangeVerifyLimiter,
} = require("../middlewares/limiter");

const asyncHandler = require("../utils/asyncHandler");

const {
  updateProfileValidation, requestEmailChangeValidation, verifyEmailChangeValidation, createUserValidation, activateAccountValidation, userIdValidation, updateUserStatusValidation, updateUserRoleValidation} = require("../validation/user.validate");

// ==================== Current User Routes ====================

router.get("/profile", [auth], asyncHandler(userController.getProfile));

router.patch("/profile", [auth, uploadUserAvatar(), ...updateProfileValidation], asyncHandler(userController.updateProfile));

router.delete("/profile/image", [auth], asyncHandler(userController.deleteProfileImage));

// ==================== Email Change Routes ====================

router.post("/profile/email-change/request", [auth, emailChangeRequestLimiter, ...requestEmailChangeValidation], asyncHandler(userController.requestEmailChange));

router.post("/profile/email-change/verify", [auth, emailChangeVerifyLimiter, ...verifyEmailChangeValidation], asyncHandler(userController.verifyEmailChange));

// ==================== Account Activation Route ====================

router.post("/activate-account", [...activateAccountValidation], asyncHandler(userController.activateAccount));

// ==================== User Management Routes ====================

router.get("/", [auth, role(["superadmin", "manager"])], asyncHandler(userController.getAllUsers));

router.post("/", [auth, role(["superadmin"]), ...createUserValidation], asyncHandler(userController.createUser));

router.get("/activate-account/token", asyncHandler(userController.activateAccount));

router.get("/:id", [auth, role(["superadmin"]), ...userIdValidation], asyncHandler(userController.getUserById));

router.patch("/:id/status", [auth, role(["superadmin"]), ...userIdValidation, ...updateUserStatusValidation], asyncHandler(userController.updateUserStatus));

router.patch("/:id/role", [auth, role(["superadmin"]), ...userIdValidation, ...updateUserRoleValidation], asyncHandler(userController.updateUserRole));

router.delete("/:id", [auth, role(["superadmin"]), ...userIdValidation], asyncHandler(userController.deleteUser));

module.exports = router;