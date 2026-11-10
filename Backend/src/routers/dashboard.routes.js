
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const role = require("../middlewares/role");
const { generalApiLimiter } = require("../middlewares/limiter");
const asyncHandler = require("../utils/asyncHandler");

const dashboardController = require("../controllers/dashboard.controller");
const { dashboardOverviewValidation, salesChartsValidation } = require("../validation/dashboard.validation");

router.use(generalApiLimiter);

// ==================== Dashboard Overview ====================

router.get("/overview", [auth, role(["superadmin", "manager", "saler", "follow-up"])], dashboardOverviewValidation, asyncHandler(dashboardController.getOverview));

// ==================== Sales Charts ====================

router.get("/sales-charts", [auth, role(["superadmin", "manager", "saler", "follow-up"])], salesChartsValidation, asyncHandler(dashboardController.getSalesCharts));

// ==================== Export Router ====================

module.exports = router;
