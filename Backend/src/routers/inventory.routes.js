const express = require("express");

const router = express.Router();

const auth = require("../middlewares/auth");

const role = require("../middlewares/role");

const { createGeneralApiLimiter } = require("../middlewares/limiter");

const asyncHandler = require("../utils/asyncHandler");

const inventoryController = require("../controllers/inventory.controller");

const { addStockValidation, adjustStockValidation, variantInventoryValidation, getInventoryValidation, getInventoryTransactionsValidation, getVariantTransactionsValidation } = require("../validation/inventory.validation");

router.use(auth);
router.use(createGeneralApiLimiter());

// ==================== Inventory ====================

router.get("/", getInventoryValidation, asyncHandler(inventoryController.getInventory));

// ==================== Inventory Transactions ====================

router.get("/transactions", [role(["superadmin", "manager"])], getInventoryTransactionsValidation, asyncHandler(inventoryController.getInventoryTransactions));

// ==================== Variant Inventory ====================

router.get("/variant/:variantId", variantInventoryValidation, asyncHandler(inventoryController.getVariantInventory));

// ==================== Variant Transactions ====================

router.get("/variant/:variantId/transactions", [role(["superadmin", "manager"])], getVariantTransactionsValidation, asyncHandler(inventoryController.getVariantTransactions));

// ==================== Add Stock ====================

router.post("/variant/:variantId/add", [role(["superadmin", "manager"])], addStockValidation, asyncHandler(inventoryController.addStock));

// ==================== Adjust Stock ====================

router.patch("/variant/:variantId/adjust", [role(["superadmin", "manager"])], adjustStockValidation, asyncHandler(inventoryController.adjustStock));

// ==================== Export ====================

module.exports = router;
