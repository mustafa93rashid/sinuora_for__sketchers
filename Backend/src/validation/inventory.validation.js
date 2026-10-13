const {
  body,
  param,
  query,
  validationResult,
} = require("express-validator");

// ==================== Inventory Transaction Types ====================

const INVENTORY_TRANSACTION_TYPES = [
  "IN",
  "RESERVE",
  "RELEASE_RESERVE",
  "SALE",
  "RETURN",
  "ADJUSTMENT",
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
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
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
    .exists()
    .withMessage("Quantity is required")
    .bail()
    .isInt({
      min: 1,
    })
    .withMessage(
      "Quantity must be a positive integer",
    )
    .toInt(),

  body("reason")
    .exists({
      checkFalsy: true,
    })
    .withMessage("Reason is required")
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

// ==================== Adjust Stock Validation ====================

const adjustStockValidation = [
  param("variantId")
    .isMongoId()
    .withMessage(
      "Invalid product variant id",
    ),

  body("newQuantity")
    .exists()
    .withMessage(
      "New quantity is required",
    )
    .bail()
    .isInt({
      min: 0,
    })
    .withMessage(
      "New quantity must be 0 or greater",
    )
    .toInt(),

  body("reason")
    .exists({
      checkFalsy: true,
    })
    .withMessage("Reason is required")
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

// ==================== Variant Inventory Validation ====================

const variantInventoryValidation = [
  param("variantId")
    .isMongoId()
    .withMessage(
      "Invalid product variant id",
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
    .trim(),

  query("size")
    .optional()
    .isFloat()
    .withMessage(
      "Size must be a number",
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
      "Low stock must be 0 or greater",
    )
    .toInt(),

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
  addStockValidation,
  adjustStockValidation,
  variantInventoryValidation,
  getInventoryValidation,
  getInventoryTransactionsValidation,
  getVariantTransactionsValidation,
};