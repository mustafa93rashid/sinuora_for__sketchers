const express = require("express");

const productController = require("../controllers/product.controller");

const {
  createProductValidation,
  updateProductValidation,
  productIdValidation,
  getProductsValidation,
} = require("../validations/product.validation");

const auth = require("../middlewares/auth.middleware");

const authorize = require("../middlewares/authorize.middleware");

// ==================== Router ====================

const router = express.Router();

// ==================== Products ====================

router.get("/", auth, getProductsValidation, productController.getProducts);

router.post("/", auth, authorize("SUPER_ADMIN", "MANAGER"), createProductValidation, productController.createProduct);

// ==================== Product By Id ====================

router.get("/:id", auth, productIdValidation, productController.getProductById);

router.patch("/:id", auth, authorize("SUPER_ADMIN", "MANAGER"), updateProductValidation, productController.updateProduct);

// ==================== Archive Product ====================

router.patch("/:id/archive", auth, authorize("SUPER_ADMIN", "MANAGER"), productIdValidation, productController.archiveProduct);

// ==================== Restore Product ====================

router.patch("/:id/restore", auth, authorize("SUPER_ADMIN", "MANAGER"), productIdValidation, productController.restoreProduct);

// ==================== Export Router ====================

module.exports = router;