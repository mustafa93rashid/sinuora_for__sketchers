const {
  body,
  param,
  query,
  validationResult,
} = require("express-validator");

// ==================== Inventory Transaction Types ====================

const INVENTORY_TRANSACTION_TYPES = [
  "IN",
  "SALE",
  "RETURN",
  "ADJUSTMENT",
  "RESERVE",
  "RELEASE_RESERVE",
];

// ==================== Handle Validation Errors ====================

const handleValidationErrors = (
  req,
  res,
  next,
) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,

      message: "Validation failed",

      errors: errors.array().map(
        (error) => ({
          field: error.path,
          message: error.msg,
        }),
      ),
    });
  }

  next();
};

// ==================== Add Stock Validation ====================

const addStockValidation = [
  param("variantId")
    .isMongoId()
    .withMessage(
      "Invalid product variant id",
    ),

  body("quantity")
    .exists({
      checkNull: true,
    })
    .withMessage(
      "Quantity is required",
    )
    .bail()
    .isInt({
      min: 1,
    })
    .withMessage(
      "Quantity must be a positive integer",
    )
    .toInt(),

  body("reason")
    .optional()
    .isString()
    .withMessage(
      "Reason must be a string",
    )
    .bail()
    .trim()
    .isLength({
      max: 500,
    })
    .withMessage(
      "Reason cannot exceed 500 characters",
    ),

  body("note")
    .optional()
    .isString()
    .withMessage(
      "Note must be a string",
    )
    .bail()
    .trim()
    .isLength({
      max: 1000,
    })
    .withMessage(
      "Note cannot exceed 1000 characters",
    ),

  handleValidationErrors,
];

// ==================== Adjust Stock Validation ====================

const adjustStockValidation = [
  param("variantId")
    .isMongoId()
    .withMessage(
      "Invalid product variant id",
    ),

  body("newQuantity")
    .exists({
      checkNull: true,
    })
    .withMessage(
      "New quantity is required",
    )
    .bail()
    .isInt({
      min: 0,
    })
    .withMessage(
      "New quantity must be a non-negative integer",
    )
    .toInt(),

  body("reason")
    .exists({
      checkFalsy: true,
    })
    .withMessage(
      "Reason is required",
    )
    .bail()
    .isString()
    .withMessage(
      "Reason must be a string",
    )
    .bail()
    .trim()
    .isLength({
      min: 2,
      max: 500,
    })
    .withMessage(
      "Reason must be between 2 and 500 characters",
    ),

  body("note")
    .optional()
    .isString()
    .withMessage(
      "Note must be a string",
    )
    .bail()
    .trim()
    .isLength({
      max: 1000,
    })
    .withMessage(
      "Note cannot exceed 1000 characters",
    ),

  handleValidationErrors,
];

// ==================== Get Inventory Validation ====================

const getInventoryValidation = [
  query("page")
    .optional()
    .isInt({
      min: 1,
    })
    .withMessage(
      "Page must be a positive integer",
    )
    .toInt(),

  query("limit")
    .optional()
    .isInt({
      min: 1,
      max: 100,
    })
    .withMessage(
      "Limit must be between 1 and 100",
    )
    .toInt(),

  query("product")
    .optional()
    .isMongoId()
    .withMessage(
      "Invalid product id",
    ),

  query("color")
    .optional()
    .isString()
    .withMessage(
      "Color must be a string",
    )
    .bail()
    .trim()
    .isLength({
      max: 50,
    })
    .withMessage(
      "Color cannot exceed 50 characters",
    ),

  query("size")
    .optional()
    .isFloat()
    .withMessage(
      "Size must be a valid number",
    )
    .toFloat(),

  query("isActive")
    .optional()
    .isBoolean()
    .withMessage(
      "isActive must be true or false",
    )
    .toBoolean(),

  query("lowStock")
    .optional()
    .isInt({
      min: 0,
    })
    .withMessage(
      "Low stock must be a non-negative integer",
    )
    .toInt(),

  handleValidationErrors,
];

// ==================== Variant Inventory Validation ====================

const variantInventoryValidation = [
  param("variantId")
    .isMongoId()
    .withMessage(
      "Invalid product variant id",
    ),

  handleValidationErrors,
];

// ==================== Get Inventory Transactions Validation ====================

const getInventoryTransactionsValidation = [
  query("page")
    .optional()
    .isInt({
      min: 1,
    })
    .withMessage(
      "Page must be a positive integer",
    )
    .toInt(),

  query("limit")
    .optional()
    .isInt({
      min: 1,
      max: 100,
    })
    .withMessage(
      "Limit must be between 1 and 100",
    )
    .toInt(),

  query("variant")
    .optional()
    .isMongoId()
    .withMessage(
      "Invalid product variant id",
    ),

  query("type")
    .optional()
    .isString()
    .withMessage(
      "Transaction type must be a string",
    )
    .bail()
    .trim()
    .toUpperCase()
    .isIn(
      INVENTORY_TRANSACTION_TYPES,
    )
    .withMessage(
      "Invalid inventory transaction type",
    ),

  query("order")
    .optional()
    .isMongoId()
    .withMessage(
      "Invalid order id",
    ),

  query("performedBy")
    .optional()
    .isMongoId()
    .withMessage(
      "Invalid user id",
    ),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage(
      "Invalid start date",
    ),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage(
      "Invalid end date",
    ),

  // ==================== Validate Date Range ====================

  query("endDate").custom(
    (endDate, { req }) => {
      if (
        !endDate ||
        !req.query.startDate
      ) {
        return true;
      }

      const start = new Date(
        req.query.startDate,
      );

      const end = new Date(
        endDate,
      );

      if (end < start) {
        throw new Error(
          "End date cannot be before start date",
        );
      }

      return true;
    },
  ),

  handleValidationErrors,
];

// ==================== Get Variant Transactions Validation ====================

const getVariantTransactionsValidation = [
  param("variantId")
    .isMongoId()
    .withMessage(
      "Invalid product variant id",
    ),

  query("page")
    .optional()
    .isInt({
      min: 1,
    })
    .withMessage(
      "Page must be a positive integer",
    )
    .toInt(),

  query("limit")
    .optional()
    .isInt({
      min: 1,
      max: 100,
    })
    .withMessage(
      "Limit must be between 1 and 100",
    )
    .toInt(),

  handleValidationErrors,
];

// ==================== Export ====================

module.exports = {
  INVENTORY_TRANSACTION_TYPES,

  addStockValidation,

  adjustStockValidation,

  getInventoryValidation,

  variantInventoryValidation,

  getInventoryTransactionsValidation,

  getVariantTransactionsValidation,
};