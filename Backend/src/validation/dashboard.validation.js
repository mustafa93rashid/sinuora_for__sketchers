
const { query, validationResult } = require("express-validator");

// ==================== Validation Error Handler ====================

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  next();
};

// ==================== Date Validation ====================

const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

// ==================== Dashboard Overview Validation ====================

const dashboardOverviewValidation = [
  query("from")
    .optional()
    .isString()
    .custom(isValidDate)
    .withMessage("from must be a valid YYYY-MM-DD date"),

  query("to")
    .optional()
    .isString()
    .custom(isValidDate)
    .withMessage("to must be a valid YYYY-MM-DD date"),

  validate,
];


// ==================== Sales Charts Validation ====================

const salesChartsValidation = [
  query("days")
    .optional()
    .isIn(["7", "30"])
    .withMessage("days must be 7 or 30"),

  query("from")
    .optional()
    .isString()
    .custom(isValidDate)
    .withMessage("from must be a valid YYYY-MM-DD date"),

  query("to")
    .optional()
    .isString()
    .custom(isValidDate)
    .withMessage("to must be a valid YYYY-MM-DD date"),

  query()
    .custom((value) => {
      const hasFrom = value.from !== undefined;
      const hasTo = value.to !== undefined;

      if (hasFrom !== hasTo) {
        throw new Error("Both from and to are required");
      }

      if (hasFrom && value.days !== undefined) {
        throw new Error(
          "Use either days or from/to, not both"
        );
      }

      return true;
    }),

  validate,
];


// ==================== Export Validation ====================

module.exports = {
  dashboardOverviewValidation,
  salesChartsValidation,
};