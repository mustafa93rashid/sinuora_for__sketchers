
const dashboardHelper = require("../helpers/dashboard.helper");

// ==================== Dashboard Controller ====================

class DashboardController {
  // ==================== Get Dashboard Overview ====================

  getOverview = async (req, res) => {
    const data = await dashboardHelper.getOverview(
      req.user,
      req.query
    );

    return res.status(200).json({
      success: true,
      message: "Dashboard statistics retrieved successfully",
      data,
    });
  };


  // ==================== Get Sales Charts ====================

  getSalesCharts = async (req, res) => {
    const data = await dashboardHelper.getSalesCharts(
      req.user,
      req.query
    );

    return res.status(200).json({
      success: true,
      message: "Sales charts retrieved successfully",
      data,
    });
  };

}

// ==================== Export Controller ====================

module.exports = new DashboardController();
