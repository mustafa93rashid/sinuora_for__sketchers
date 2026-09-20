const { body } = require("express-validator");

const validate = require("../middlewares/validate");

// ==================== Password Validation Rules ====================

const passwordValidationRules = (fieldName = "newPassword") => {
  return body(fieldName)
    .notEmpty()
    .withMessage("New password is required")
    .bail()
    .isString()
    .withMessage("New password must be a string")
    .bail()
    .isLength({ min: 8, max: 128 })
    .withMessage("New password must be between 8 and 128 characters")
    .bail()
    .matches(/[a-z]/)
    .withMessage("New password must contain at least one lowercase letter")
    .bail()
    .matches(/[A-Z]/)
    .withMessage("New password must contain at least one uppercase letter")
    .bail()
    .matches(/\d/)
    .withMessage("New password must contain at least one number")
    .bail()
    .matches(/[@$!%*?&#^()_\-+=]/)
    .withMessage("New password must contain at least one special character");
};

// ==================== Confirm Password Validation ====================

const confirmPasswordValidation = body("confirmPassword")
  .notEmpty()
  .withMessage("Password confirmation is required")
  .bail()
  .isString()
  .withMessage("Password confirmation must be a string")
  .bail()
  .custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error("Password confirmation does not match");
    }

    return true;
  });

// ==================== Login Validation ====================

const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .bail()
    .isEmail()
    .withMessage("Please enter a valid email address")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .bail()
    .isString()
    .withMessage("Password must be a string"),

  validate,
];

// ==================== Request Password Change Validation ====================

const requestPasswordChangeValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required")
    .bail()
    .isString()
    .withMessage("Current password must be a string"),

  validate,
];

// ==================== Verify Password Change Validation ====================

const verifyPasswordChangeValidation = [
  body("verificationCode")
    .trim()
    .notEmpty()
    .withMessage("Verification code is required")
    .bail()
    .matches(/^\d{6}$/)
    .withMessage("Verification code must contain exactly 6 digits"),

  passwordValidationRules(),

  confirmPasswordValidation,

  validate,
];

// ==================== Forgot Password Validation ====================

const forgotPasswordValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .bail()
    .isEmail()
    .withMessage("Please enter a valid email address")
    .normalizeEmail(),

  validate,
];

// ==================== Reset Password Validation ====================

const resetPasswordValidation = [
  passwordValidationRules(),

  confirmPasswordValidation,

  validate,
];

module.exports = {
  loginValidation,
  requestPasswordChangeValidation,
  verifyPasswordChangeValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
};