
const Order = require("../models/order.model");
const ProductVariant = require("../models/productVariant.model");
const orderHelper = require("./order.helper");

// ==================== Dashboard Helper ====================

class DashboardHelper {
  // ==================== Date Range ====================

  getDateRange = ({ from, to } = {}) => {
    const parseDate = (value, endOfDay = false) => {
      if (!value) return null;

      const date = new Date(
        `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+03:00`
      );

      if (Number.isNaN(date.getTime())) {
        throw Object.assign(new Error("Invalid date"), {
          statusCode: 400,
        });
      }

      return date;
    };

    const start = parseDate(from);
    const end = parseDate(to, true);

    if (start && end && start > end) {
      throw Object.assign(
        new Error("Start date cannot exceed end date"),
        { statusCode: 400 }
      );
    }

    return { start, end };
  };

  // ==================== Today Range ====================

  getTodayRange = () => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Baghdad",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date())
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value])
    );

    return this.getDateRange({
      from: `${parts.year}-${parts.month}-${parts.day}`,
      to: `${parts.year}-${parts.month}-${parts.day}`,
    });
  };

  // ==================== Financial Visibility ====================
  // Audit finding H-1: follow-up has no ownership restriction in
  // orderHelper.scope(), so without this check it saw confirmed
  // revenue/returned value across the whole company instead of just
  // the operational counts its role needs.

  canViewDashboardFinancials = (user) =>
    ["superadmin", "manager", "saler"].includes(user?.role);

  redactOverviewFinancials = (user, overview) => {
    if (this.canViewDashboardFinancials(user)) return overview;

    const {
      confirmedRevenue,
      totalOrderValue,
      returnedValue,
      ...operationalStatistics
    } = overview.statistics;

    const { confirmedRevenue: _today, returnedValue: __today, ...operationalToday } =
      overview.today;

    return {
      ...overview,
      statistics: operationalStatistics,
      today: operationalToday,
    };
  };

  redactSalesChartFinancials = (user, charts) => {
    if (this.canViewDashboardFinancials(user)) return charts;

    const stripMoney = ({ revenue, returnedValue, ...rest }) => rest;

    return {
      ...charts,
      summary: stripMoney(charts.summary),
      dailySales: charts.dailySales.map(stripMoney),
      topModels: charts.topModels.map(stripMoney),
      topColors: charts.topColors.map(stripMoney),
      topSizes: charts.topSizes.map(stripMoney),
    };
  };

  // ==================== Build Order Match ====================

  buildOrderMatch = (user, range = {}) => {
    const scope = orderHelper.scope(user);
    const { start, end } = range;

    const match = { ...scope };

    if (start || end) {
      match.createdAt = {};

      if (start) match.createdAt.$gte = start;
      if (end) match.createdAt.$lte = end;
    }

    return match;
  };

  // ==================== Order Statistics ====================

  getOrderStatistics = async (user, range) => {
    const match = this.buildOrderMatch(user, range);

    const [result] = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalOrderValue: { $sum: "$totalAmount" },
          confirmedRevenue: { $sum: "$deliveredAmount" },
          returnedValue: { $sum: "$returnedAmount" },
          newOrders: {
            $sum: { $cond: [{ $eq: ["$status", "New"] }, 1, 0] },
          },
          preparingOrders: {
            $sum: { $cond: [{ $eq: ["$status", "Preparing"] }, 1, 0] },
          },
          preparedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "Prepared"] }, 1, 0] },
          },
          outForDeliveryOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "Out For Delivery"] }, 1, 0],
            },
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ["$status", "Delivered"] }, 1, 0] },
          },
          returnedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "Returned"] }, 1, 0] },
          },
          partiallyReturnedOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "Partially Returned"] }, 1, 0],
            },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] },
          },
        },
      },
    ]);

    const stats = result || {
      totalOrders: 0,
      totalOrderValue: 0,
      confirmedRevenue: 0,
      returnedValue: 0,
      newOrders: 0,
      preparingOrders: 0,
      preparedOrders: 0,
      outForDeliveryOrders: 0,
      deliveredOrders: 0,
      returnedOrders: 0,
      partiallyReturnedOrders: 0,
      cancelledOrders: 0,
    };

    const returnedCount =
      stats.returnedOrders + stats.partiallyReturnedOrders;

    return {
      ...stats,
      returnRate:
        stats.totalOrders > 0
          ? Number(
              ((returnedCount / stats.totalOrders) * 100).toFixed(2)
            )
          : 0,
    };
  };

  // ==================== Low Stock Statistics ====================

  getLowStockStatistics = async (threshold = 5) => {
    const [result] = await ProductVariant.aggregate([
      { $match: { isActive: true } },
      {
        $addFields: {
          availableQuantity: {
            $subtract: ["$stockQuantity", "$reservedQuantity"],
          },
        },
      },
      {
        $match: {
          availableQuantity: { $lte: threshold },
        },
      },
      {
        $group: {
          _id: null,
          lowStockVariants: { $sum: 1 },
          outOfStockVariants: {
            $sum: {
              $cond: [{ $lte: ["$availableQuantity", 0] }, 1, 0],
            },
          },
        },
      },
    ]);

    return result || {
      lowStockVariants: 0,
      outOfStockVariants: 0,
    };
  };

  // ==================== Dashboard Overview ====================

  getOverview = async (user, filters = {}) => {
    const range = this.getDateRange(filters);
    const todayRange = this.getTodayRange();

    const [statistics, today, inventory] = await Promise.all([
      this.getOrderStatistics(user, range),
      this.getOrderStatistics(user, todayRange),
      orderHelper.isAdmin(user)
        ? this.getLowStockStatistics()
        : Promise.resolve(null),
    ]);

    return this.redactOverviewFinancials(user, {
      statistics,
      today: {
        orders: today.totalOrders,
        confirmedRevenue: today.confirmedRevenue,
        returnedValue: today.returnedValue,
      },
      inventory,
      period: {
        from: filters.from || null,
        to: filters.to || null,
        basis: "order_created_at",
        timezone: "Asia/Baghdad",
      },
    });
  };


  // ==================== Baghdad Date Helpers ====================

  getBaghdadDate = (date = new Date()) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Baghdad",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value])
    );

    return `${parts.year}-${parts.month}-${parts.day}`;
  };

  // ==================== Resolve Chart Period ====================

  getChartPeriod = ({ days = 7, from, to } = {}) => {
    if (from || to) {
      if (!from || !to) {
        throw Object.assign(
          new Error("Both from and to are required"),
          { statusCode: 400 }
        );
      }

      const { start, end } = this.getDateRange({ from, to });

      const count =
        Math.round(
          (Date.parse(`${to}T00:00:00Z`) -
            Date.parse(`${from}T00:00:00Z`)) /
            86400000
        ) + 1;

      if (count < 1 || count > 366) {
        throw Object.assign(
          new Error("Chart period must be between 1 and 366 days"),
          { statusCode: 400 }
        );
      }

      return { start, end, from, to, days: count };
    }

    const count = Number(days);

    if (![7, 30].includes(count)) {
      throw Object.assign(
        new Error("days must be 7 or 30"),
        { statusCode: 400 }
      );
    }

    const today = this.getBaghdadDate();
    const startDate = new Date(`${today}T00:00:00Z`);

    startDate.setUTCDate(startDate.getUTCDate() - count + 1);

    const first = startDate.toISOString().slice(0, 10);
    const { start, end } = this.getDateRange({
      from: first,
      to: today,
    });

    return {
      start,
      end,
      from: first,
      to: today,
      days: count,
    };
  };

  // ==================== Build Date Labels ====================

  getDateLabels = (from, days) => {
    const start = new Date(`${from}T00:00:00Z`);

    return Array.from({ length: days }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + index);
      return date.toISOString().slice(0, 10);
    });
  };

  // ==================== Sales Charts ====================

  getSalesCharts = async (user, filters = {}) => {
    const period = this.getChartPeriod(filters);

    const match = this.buildOrderMatch(user, period);

    const [dailyRows, modelRows, colorRows, sizeRows] =
      await Promise.all([
        // ==================== Daily Sales ====================

        Order.aggregate([
          { $match: match },
          {
            $unwind: "$items",
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$createdAt",
                  timezone: "Asia/Baghdad",
                },
              },
              orders: { $addToSet: "$_id" },
              soldQuantity: {
                $sum: "$items.deliveredQuantity",
              },
              returnedQuantity: {
                $sum: "$items.returnedQuantity",
              },
              revenue: {
                $sum: {
                  $multiply: [
                    "$items.deliveredQuantity",
                    "$items.unitPrice",
                  ],
                },
              },
              returnedValue: {
                $sum: {
                  $multiply: [
                    "$items.returnedQuantity",
                    "$items.unitPrice",
                  ],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              date: "$_id",
              orders: { $size: "$orders" },
              soldQuantity: 1,
              returnedQuantity: 1,
              revenue: 1,
              returnedValue: 1,
            },
          },
          { $sort: { date: 1 } },
        ]),

        // ==================== Top Models ====================

        this.getTopSalesAggregation(
          match,
          {
            product: "$items.product",
            name: "$items.productSnapshot.name",
            modelCode: "$items.productSnapshot.modelCode",
          },
          10
        ),

        // ==================== Top Colors ====================

        this.getTopSalesAggregation(
          match,
          "$items.productSnapshot.color",
          10
        ),

        // ==================== Top Sizes ====================

        this.getTopSalesAggregation(
          match,
          "$items.productSnapshot.size",
          10
        ),
      ]);

    // ==================== Fill Missing Days ====================

    const dailyMap = new Map(
      dailyRows.map((row) => [row.date, row])
    );

    const dailySales = this.getDateLabels(
      period.from,
      period.days
    ).map((date) => {
      return (
        dailyMap.get(date) || {
          date,
          orders: 0,
          soldQuantity: 0,
          returnedQuantity: 0,
          revenue: 0,
          returnedValue: 0,
        }
      );
    });

    // ==================== Calculate Summary ====================

    const summary = dailySales.reduce(
      (total, day) => {
        total.orders += day.orders;
        total.soldQuantity += day.soldQuantity;
        total.returnedQuantity += day.returnedQuantity;
        total.revenue += day.revenue;
        total.returnedValue += day.returnedValue;
        return total;
      },
      {
        orders: 0,
        soldQuantity: 0,
        returnedQuantity: 0,
        revenue: 0,
        returnedValue: 0,
      }
    );

    return this.redactSalesChartFinancials(user, {
      period: {
        from: period.from,
        to: period.to,
        days: period.days,
        basis: "order_created_at",
        timezone: "Asia/Baghdad",
      },
      summary,
      dailySales,
      topModels: modelRows,
      topColors: colorRows,
      topSizes: sizeRows,
    });
  };

  // ==================== Top Sales Aggregation ====================

  getTopSalesAggregation = async (match, groupId, limit = 10) => {
    return Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: groupId,
          soldQuantity: {
            $sum: "$items.deliveredQuantity",
          },
          returnedQuantity: {
            $sum: "$items.returnedQuantity",
          },
          revenue: {
            $sum: {
              $multiply: [
                "$items.deliveredQuantity",
                "$items.unitPrice",
              ],
            },
          },
        },
      },
      {
        $match: {
          soldQuantity: { $gt: 0 },
        },
      },
      {
        $sort: {
          soldQuantity: -1,
          revenue: -1,
          _id: 1,
        },
      },
      { $limit: limit },
    ]);
  };

}

// ==================== Export Helper ====================

module.exports = new DashboardHelper();
