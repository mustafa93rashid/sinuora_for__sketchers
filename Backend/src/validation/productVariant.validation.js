const {
  body,
  param,
  query,
  validationResult,
} = require("express-validator");

// ==================== Sizes ====================

const PRODUCT_SIZES = [
  36,
  36.5,
  37,
  37.5,
  38,
  38.5,
  39,
  39.5,
  40,
  40.5,
  41,
  41.5,
  42,
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

// ==================== Create Product Variant Validation ====================

const createProductVariantValidation = [
  body("product")
    .exists({ checkFalsy: true })
    .withMessage("Product is required")
    .bail()
    .isMongoId()
    .withMessage("Invalid product id"),

  body("color")
    .exists({ checkFalsy: true })
    .withMessage("Color is required")
    .bail()
    .isString()
    .withMessage("Color must be a string")
    .bail()
    .trim()
    .isLength({
      min: 1,
      max: 50,
    })
    .withMessage(
      "Color cannot exceed 50 characters",
    ),

  body("size")
    .exists()
    .withMessage("Size is required")
    .bail()
    .isFloat()
    .withMessage("Size must be a number")
    .bail()
    .toFloat()
    .custom((value) => {
      if (!PRODUCT_SIZES.includes(value)) {
        throw new Error(
          "Invalid product size",
        );
      }

      return true;
    }),

  body("sku")
    .optional()
    .isString()
    .withMessage("SKU must be a string")
    .bail()
    .trim()
    .isLength({
      min: 1,
      max: 100,
    })
    .withMessage(
      "SKU must be between 1 and 100 characters",
    )
    .toUpperCase(),

  handleValidationErrors,
];

// ==================== Update Product Variant Validation ====================

const updateProductVariantValidation = [
  param("id")
    .isMongoId()
    .withMessage("Invalid product variant id"),

  body("color")
    .optional()
    .isString()
    .withMessage("Color must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Color cannot be empty")
    .bail()
    .isLength({
      max: 50,
    })
    .withMessage(
      "Color cannot exceed 50 characters",
    ),

  body("size")
    .optional()
    .isFloat()
    .withMessage("Size must be a number")
    .bail()
    .toFloat()
    .custom((value) => {
      if (!PRODUCT_SIZES.includes(value)) {
        throw new Error(
          "Invalid product size",
        );
      }

      return true;
    }),

  body("sku")
    .optional()
    .isString()
    .withMessage("SKU must be a string")
    .bail()
    .trim()
    .isLength({
      min: 1,
      max: 100,
    })
    .withMessage(
      "SKU must be between 1 and 100 characters",
    )
    .toUpperCase(),

  handleValidationErrors,
];

// ==================== Product Variant Id Validation ====================

const productVariantIdValidation = [
  param("id")
    .isMongoId()
    .withMessage("Invalid product variant id"),

  handleValidationErrors,
];

// ==================== Product Id Validation ====================

const productIdValidation = [
  param("productId")
    .isMongoId()
    .withMessage("Invalid product id"),

  handleValidationErrors,
];

// ==================== Get Product Variants Validation ====================

const getProductVariantsValidation = [
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
    .withMessage("Invalid product id"),

  query("color")
    .optional()
    .isString()
    .withMessage("Color must be a string")
    .trim(),

  query("size")
    .optional()
    .isFloat()
    .withMessage("Size must be a number")
    .bail()
    .toFloat()
    .custom((value) => {
      if (!PRODUCT_SIZES.includes(value)) {
        throw new Error(
          "Invalid product size",
        );
      }

      return true;
    }),

  query("isActive")
    .optional()
    .isBoolean()
    .withMessage(
      "isActive must be true or false",
    )
    .toBoolean(),

  handleValidationErrors,
];

// ==================== Export ====================

module.exports = {
  createProductVariantValidation,
  updateProductVariantValidation,
  productVariantIdValidation,
  productIdValidation,
  getProductVariantsValidation,
};