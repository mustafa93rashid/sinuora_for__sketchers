const {
  body,
  param,
  query,
  validationResult,
} = require("express-validator");

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

// ==================== Create Product Validation ====================

const createProductValidation = [
  body("name")
    .exists({ checkFalsy: true })
    .withMessage("Product name is required")
    .bail()
    .isString()
    .withMessage(
      "Product name must be a string",
    )
    .bail()
    .trim()
    .isLength({
      min: 2,
      max: 150,
    })
    .withMessage(
      "Product name must be between 2 and 150 characters",
    ),

  body("modelCode")
    .exists({ checkFalsy: true })
    .withMessage("Model code is required")
    .bail()
    .isString()
    .withMessage(
      "Model code must be a string",
    )
    .bail()
    .trim()
    .isLength({
      min: 1,
      max: 100,
    })
    .withMessage(
      "Model code cannot exceed 100 characters",
    ),

  body("description")
    .optional()
    .isString()
    .withMessage(
      "Description must be a string",
    )
    .bail()
    .trim()
    .isLength({
      max: 2000,
    })
    .withMessage(
      "Description cannot exceed 2000 characters",
    ),

  body("brand")
    .optional()
    .isString()
    .withMessage("Brand must be a string")
    .bail()
    .trim()
    .isLength({
      max: 100,
    })
    .withMessage(
      "Brand cannot exceed 100 characters",
    ),

  body("category")
    .optional()
    .isString()
    .withMessage(
      "Category must be a string",
    )
    .bail()
    .trim()
    .isLength({
      max: 100,
    })
    .withMessage(
      "Category cannot exceed 100 characters",
    ),

  body("costPrice")
    .optional()
    .isFloat({
      min: 0,
    })
    .withMessage(
      "Cost price must be 0 or greater",
    )
    .toFloat(),

  body("defaultSalePrice")
    .optional()
    .isFloat({
      min: 0,
    })
    .withMessage(
      "Sale price must be 0 or greater",
    )
    .toFloat(),

  body("images")
    .optional()
    .isArray()
    .withMessage("Images must be an array"),

  body("images.*.url")
    .optional()
    .isURL({
      protocols: ["http", "https"],
      require_protocol: true,
    })
    .withMessage(
      "Image URL must be a valid URL",
    ),

  body("images.*.publicId")
    .optional({
      nullable: true,
    })
    .isString()
    .withMessage(
      "Image publicId must be a string",
    ),

  handleValidationErrors,
];

// ==================== Update Product Validation ====================

const updateProductValidation = [
  param("id")
    .isMongoId()
    .withMessage("Invalid product id"),

  body("name")
    .optional()
    .isString()
    .withMessage(
      "Product name must be a string",
    )
    .bail()
    .trim()
    .isLength({
      min: 2,
      max: 150,
    })
    .withMessage(
      "Product name must be between 2 and 150 characters",
    ),

  body("modelCode")
    .optional()
    .isString()
    .withMessage(
      "Model code must be a string",
    )
    .bail()
    .trim()
    .notEmpty()
    .withMessage(
      "Model code cannot be empty",
    )
    .bail()
    .isLength({
      max: 100,
    })
    .withMessage(
      "Model code cannot exceed 100 characters",
    ),

  body("description")
    .optional()
    .isString()
    .withMessage(
      "Description must be a string",
    )
    .bail()
    .trim()
    .isLength({
      max: 2000,
    })
    .withMessage(
      "Description cannot exceed 2000 characters",
    ),

  body("brand")
    .optional()
    .isString()
    .withMessage("Brand must be a string")
    .bail()
    .trim()
    .isLength({
      max: 100,
    })
    .withMessage(
      "Brand cannot exceed 100 characters",
    ),

  body("category")
    .optional()
    .isString()
    .withMessage(
      "Category must be a string",
    )
    .bail()
    .trim()
    .isLength({
      max: 100,
    })
    .withMessage(
      "Category cannot exceed 100 characters",
    ),

  body("costPrice")
    .optional()
    .isFloat({
      min: 0,
    })
    .withMessage(
      "Cost price must be 0 or greater",
    )
    .toFloat(),

  body("defaultSalePrice")
    .optional()
    .isFloat({
      min: 0,
    })
    .withMessage(
      "Sale price must be 0 or greater",
    )
    .toFloat(),

  body("images")
    .optional()
    .isArray()
    .withMessage("Images must be an array"),

  body("images.*.url")
    .optional()
    .isURL({
      protocols: ["http", "https"],
      require_protocol: true,
    })
    .withMessage(
      "Image URL must be a valid URL",
    ),

  body("images.*.publicId")
    .optional({
      nullable: true,
    })
    .isString()
    .withMessage(
      "Image publicId must be a string",
    ),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage(
      "isActive must be true or false",
    )
    .toBoolean(),

  handleValidationErrors,
];

// ==================== Product Id Validation ====================

const productIdValidation = [
  param("id")
    .isMongoId()
    .withMessage("Invalid product id"),

  handleValidationErrors,
];

// ==================== Get Products Validation ====================

const getProductsValidation = [
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

  query("search")
    .optional()
    .isString()
    .withMessage(
      "Search must be a string",
    )
    .trim(),

  query("brand")
    .optional()
    .isString()
    .withMessage("Brand must be a string")
    .trim(),

  query("category")
    .optional()
    .isString()
    .withMessage(
      "Category must be a string",
    )
    .trim(),

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
  createProductValidation,
  updateProductValidation,
  productIdValidation,
  getProductsValidation,
};