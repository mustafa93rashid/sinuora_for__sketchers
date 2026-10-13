const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const role = require("../middlewares/role");
const { uploadProductImages } = require("../middlewares/upload.middleware");
const asyncHandler = require("../utils/asyncHandler");

const productController = require("../controllers/product.controller");

const {createProductValidation, updateProductValidation, productIdValidation,productImageValidation, getProductsValidation} = require("../validation/product.validation");

// ==================== Products ====================

router.get("/", [auth], getProductsValidation, asyncHandler(productController.getProducts));

router.post("/", [auth, role(["superadmin", "manager"])], uploadProductImages(), createProductValidation, asyncHandler(productController.createProduct));

// ==================== Product By Id ====================

router.get("/:id", [auth], productIdValidation, asyncHandler(productController.getProductById));

router.patch("/:id", [auth, role(["superadmin", "manager"])], uploadProductImages(), updateProductValidation, asyncHandler(productController.updateProduct));

// ==================== Delete Product Image ====================

router.delete("/:id/images/:imageId", [auth, role(["superadmin", "manager"])], productImageValidation, asyncHandler(productController.deleteProductImage));

// ==================== Archive Product ====================

router.patch("/:id/archive", [auth, role(["superadmin", "manager"])], productIdValidation, asyncHandler(productController.archiveProduct));

// ==================== Restore Product ====================

router.patch("/:id/restore", [auth, role(["superadmin", "manager"])], productIdValidation, asyncHandler(productController.restoreProduct));

module.exports = router;