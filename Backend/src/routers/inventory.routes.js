const express = require("express");

const router = express.Router();

const auth = require("../middlewares/auth");

const role = require("../middlewares/role");

const asyncHandler = require("../utils/asyncHandler");

const inventoryController = require("../controllers/inventory.controller");

const { addStockValidation, adjustStockValidation, variantInventoryValidation, getInventoryValidation, getInventoryTransactionsValidation, getVariantTransactionsValidation } = require("../validation/inventory.validation");

// ==================== Inventory ====================

router.get("/", [auth], getInventoryValidation, asyncHandler(inventoryController.getInventory));

// ==================== Inventory Transactions ====================

router.get("/transactions", [auth], getInventoryTransactionsValidation, asyncHandler(inventoryController.getInventoryTransactions));

// ==================== Variant Inventory ====================

router.get("/variant/:variantId", [auth], variantInventoryValidation, asyncHandler(inventoryController.getVariantInventory));

// ==================== Variant Transactions ====================

router.get("/variant/:variantId/transactions", [auth], getVariantTransactionsValidation, asyncHandler(inventoryController.getVariantTransactions));

// ==================== Add Stock ====================

router.post("/variant/:variantId/add", [auth, role(["superadmin", "manager"])], addStockValidation, asyncHandler(inventoryController.addStock));

// ==================== Adjust Stock ====================

router.patch("/variant/:variantId/adjust", [auth, role(["superadmin", "manager"])], adjustStockValidation, asyncHandler(inventoryController.adjustStock));

// ==================== Export ====================

module.exports = router;