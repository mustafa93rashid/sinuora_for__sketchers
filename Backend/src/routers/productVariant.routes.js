const express = require("express");

const router = express.Router();

const auth = require("../middlewares/auth");

const role = require("../middlewares/role");

const { createGeneralApiLimiter } = require("../middlewares/limiter");

const asyncHandler = require("../utils/asyncHandler");

const productVariantController = require("../controllers/productVariant.controller");

const { createProductVariantValidation, updateProductVariantValidation, productVariantIdValidation, productIdValidation, getProductVariantsValidation } = require("../validation/productVariant.validation");

router.use(auth);
router.use(createGeneralApiLimiter());

// ==================== Product Variants ====================

router.get("/", getProductVariantsValidation, asyncHandler(productVariantController.getProductVariants));

router.post("/", [role(["superadmin", "manager"])], createProductVariantValidation, asyncHandler(productVariantController.createProductVariant));

// ==================== Product Variants By Product ====================

router.get("/product/:productId", productIdValidation, asyncHandler(productVariantController.getVariantsByProduct));

// ==================== Product Variant By Id ====================

router.get("/:id", productVariantIdValidation, asyncHandler(productVariantController.getProductVariantById));

router.patch("/:id", [role(["superadmin", "manager"])], updateProductVariantValidation, asyncHandler(productVariantController.updateProductVariant));

// ==================== Archive Product Variant ====================

router.patch("/:id/archive", [role(["superadmin", "manager"])], productVariantIdValidation, asyncHandler(productVariantController.archiveProductVariant));

// ==================== Restore Product Variant ====================

router.patch("/:id/restore", [role(["superadmin", "manager"])], productVariantIdValidation, asyncHandler(productVariantController.restoreProductVariant));

// ==================== Export ====================

module.exports = router;
