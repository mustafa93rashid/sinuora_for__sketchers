const { validationResult } = require("express-validator");

// ==================== Validation Middleware ====================

const validate = (req, res, next) => {
  const validationErrors = validationResult(req);

  if (!validationErrors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validationErrors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    });
  }

  return next();
};

module.exports = validate;
