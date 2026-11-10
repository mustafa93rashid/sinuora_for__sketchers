
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const role = require("../middlewares/role");
const { createGeneralApiLimiter } = require("../middlewares/limiter");
const asyncHandler = require("../utils/asyncHandler");

const dashboardController = require("../controllers/dashboard.controller");
const { dashboardOverviewValidation, salesChartsValidation } = require("../validation/dashboard.validation");

router.use(auth);
router.use(createGeneralApiLimiter());

// ==================== Dashboard Overview ====================

router.get("/overview", [role(["superadmin", "manager", "saler", "follow-up"])], dashboardOverviewValidation, asyncHandler(dashboardController.getOverview));

// ==================== Sales Charts ====================

router.get("/sales-charts", [role(["superadmin", "manager", "saler", "follow-up"])], salesChartsValidation, asyncHandler(dashboardController.getSalesCharts));

// ==================== Export Router ====================

module.exports = router;
