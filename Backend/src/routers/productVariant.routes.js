const express = require("express");

const router = express.Router();

const auth = require("../middlewares/auth");

const role = require("../middlewares/role");

const asyncHandler = require("../utils/asyncHandler");

const productVariantController = require("../controllers/productVariant.controller");

const { createProductVariantValidation, updateProductVariantValidation, productVariantIdValidation, productIdValidation, getProductVariantsValidation } = require("../validation/productVariant.validation");

// ==================== Product Variants ====================

router.get("/", [auth], getProductVariantsValidation, asyncHandler(productVariantController.getProductVariants));

router.post("/", [auth, role(["superadmin", "manager"])], createProductVariantValidation, asyncHandler(productVariantController.createProductVariant));

// ==================== Product Variants By Product ====================

router.get("/product/:productId", [auth], productIdValidation, asyncHandler(productVariantController.getVariantsByProduct));

// ==================== Product Variant By Id ====================

router.get("/:id", [auth], productVariantIdValidation, asyncHandler(productVariantController.getProductVariantById));

router.patch("/:id", [auth, role(["superadmin", "manager"])], updateProductVariantValidation, asyncHandler(productVariantController.updateProductVariant));

// ==================== Archive Product Variant ====================

router.patch("/:id/archive", [auth, role(["superadmin", "manager"])], productVariantIdValidation, asyncHandler(productVariantController.archiveProductVariant));

// ==================== Restore Product Variant ====================

router.patch("/:id/restore", [auth, role(["superadmin", "manager"])], productVariantIdValidation, asyncHandler(productVariantController.restoreProductVariant));

// ==================== Export ====================

module.exports = router;