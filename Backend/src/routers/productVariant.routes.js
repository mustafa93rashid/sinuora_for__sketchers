const express = require("express");

const productVariantController = require("../controllers/productVariant.controller");

const {
  createProductVariantValidation,
  updateProductVariantValidation,
  productVariantIdValidation,
  productIdValidation,
  getProductVariantsValidation,
} = require("../validations/productVariant.validation");

const auth = require("../middlewares/auth.middleware");

const authorize = require("../middlewares/authorize.middleware");

// ==================== Router ====================

const router = express.Router();

// ==================== Product Variants ====================

router.get("/", auth, getProductVariantsValidation, productVariantController.getProductVariants);

router.post("/", auth, authorize("SUPER_ADMIN", "MANAGER"), createProductVariantValidation, productVariantController.createProductVariant);

// ==================== Variants By Product ====================

router.get("/product/:productId", auth, productIdValidation, productVariantController.getVariantsByProduct);

// ==================== Product Variant By Id ====================

router.get("/:id", auth, productVariantIdValidation, productVariantController.getProductVariantById);

router.patch("/:id", auth, authorize("SUPER_ADMIN", "MANAGER"), updateProductVariantValidation, productVariantController.updateProductVariant);

// ==================== Archive Product Variant ====================

router.patch("/:id/archive", auth, authorize("SUPER_ADMIN", "MANAGER"), productVariantIdValidation, productVariantController.archiveProductVariant);

// ==================== Restore Product Variant ====================

router.patch("/:id/restore", auth, authorize("SUPER_ADMIN", "MANAGER"), productVariantIdValidation, productVariantController.restoreProductVariant);

// ==================== Export Router ====================

module.exports = router;