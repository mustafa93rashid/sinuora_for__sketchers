const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const role = require("../middlewares/role");
const { createGeneralApiLimiter } = require("../middlewares/limiter");
const { uploadProductImages } = require("../middlewares/upload.middleware");
const asyncHandler = require("../utils/asyncHandler");

const productController = require("../controllers/product.controller");

const {createProductValidation, updateProductValidation, productIdValidation,productImageValidation, getProductsValidation} = require("../validation/product.validation");

router.use(auth);
router.use(createGeneralApiLimiter());

// ==================== Products ====================

router.get("/", getProductsValidation, asyncHandler(productController.getProducts));

router.post("/", [role(["superadmin", "manager"])], uploadProductImages(), createProductValidation, asyncHandler(productController.createProduct));

// ==================== Product By Id ====================

router.get("/:id", productIdValidation, asyncHandler(productController.getProductById));

router.patch("/:id", [role(["superadmin", "manager"])], uploadProductImages(), updateProductValidation, asyncHandler(productController.updateProduct));

// ==================== Delete Product Image ====================

router.delete("/:id/images/:imageId", [role(["superadmin", "manager"])], productImageValidation, asyncHandler(productController.deleteProductImage));

// ==================== Archive Product ====================

router.patch("/:id/archive", [role(["superadmin", "manager"])], productIdValidation, asyncHandler(productController.archiveProduct));

// ==================== Restore Product ====================

router.patch("/:id/restore", [role(["superadmin", "manager"])], productIdValidation, asyncHandler(productController.restoreProduct));

module.exports = router;
