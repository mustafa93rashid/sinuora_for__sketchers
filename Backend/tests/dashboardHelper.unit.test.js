const { test } = require("node:test");
const assert = require("node:assert/strict");
const dashboardHelper = require("../src/helpers/dashboard.helper");

// ==================== getDateRange ====================

test("getDateRange returns null bounds when no from/to is given", () => {
  const { start, end } = dashboardHelper.getDateRange({});
  assert.equal(start, null);
  assert.equal(end, null);
});

test("getDateRange rejects a malformed date string", () => {
  assert.throws(
    () => dashboardHelper.getDateRange({ from: "not-a-date" }),
    (error) => error.message === "Invalid date" && error.statusCode === 400,
  );
});

test("getDateRange rejects a start date after the end date", () => {
  assert.throws(
    () => dashboardHelper.getDateRange({ from: "2026-06-01", to: "2026-01-01" }),
    (error) =>
      error.message === "Start date cannot exceed end date" &&
      error.statusCode === 400,
  );
});

test("getDateRange accepts a range of exactly 366 days", () => {
  // Audit finding M-7: an explicit from/to had no upper bound at all.
  const { start, end } = dashboardHelper.getDateRange({
    from: "2025-01-01",
    to: "2026-01-01",
  });
  assert.ok(start instanceof Date);
  assert.ok(end instanceof Date);
});

test("getDateRange rejects a range longer than 366 days", () => {
  assert.throws(
    () =>
      dashboardHelper.getDateRange({ from: "2025-01-01", to: "2026-01-02" }),
    (error) =>
      error.message === "Date range must not exceed 366 days" &&
      error.statusCode === 400,
  );
});

test("getDateRange parses the end date as end-of-day so a single-day range is valid", () => {
  const { start, end } = dashboardHelper.getDateRange({
    from: "2026-03-05",
    to: "2026-03-05",
  });
  assert.ok(start < end);
});

// ==================== canViewDashboardFinancials ====================

test("canViewDashboardFinancials allows superadmin, manager, and saler", () => {
  assert.equal(
    dashboardHelper.canViewDashboardFinancials({ role: "superadmin" }),
    true,
  );
  assert.equal(
    dashboardHelper.canViewDashboardFinancials({ role: "manager" }),
    true,
  );
  assert.equal(
    dashboardHelper.canViewDashboardFinancials({ role: "saler" }),
    true,
  );
});

test("canViewDashboardFinancials blocks follow-up and unauthenticated callers", () => {
  // Audit finding H-1: follow-up must only see operational counts.
  assert.equal(
    dashboardHelper.canViewDashboardFinancials({ role: "follow-up" }),
    false,
  );
  assert.equal(dashboardHelper.canViewDashboardFinancials(undefined), false);
});

// ==================== redactOverviewFinancials ====================

const sampleOverview = () => ({
  statistics: {
    totalOrders: 10,
    totalOrderValue: 900000,
    deliveredItemValue: 500000,
    returnedValue: 20000,
    newOrders: 3,
    returnRate: 5,
  },
  today: {
    orders: 2,
    deliveredItemValue: 40000,
    returnedValue: 0,
  },
  inventory: null,
  period: { from: null, to: null, basis: "order_created_at", timezone: "Asia/Baghdad" },
});

test("redactOverviewFinancials passes the overview through unchanged for privileged roles", () => {
  const overview = sampleOverview();
  const result = dashboardHelper.redactOverviewFinancials(
    { role: "manager" },
    overview,
  );
  assert.deepEqual(result, overview);
});

test("redactOverviewFinancials strips money fields but keeps operational counts for follow-up", () => {
  const overview = sampleOverview();
  const result = dashboardHelper.redactOverviewFinancials(
    { role: "follow-up" },
    overview,
  );
  assert.equal("totalOrderValue" in result.statistics, false);
  assert.equal("deliveredItemValue" in result.statistics, false);
  assert.equal("returnedValue" in result.statistics, false);
  assert.equal(result.statistics.totalOrders, 10);
  assert.equal(result.statistics.newOrders, 3);
  assert.equal("deliveredItemValue" in result.today, false);
  assert.equal("returnedValue" in result.today, false);
  assert.equal(result.today.orders, 2);
});

// ==================== redactSalesChartFinancials ====================

const sampleCharts = () => ({
  period: { from: "2026-01-01", to: "2026-01-07", days: 7 },
  summary: { orders: 5, soldQuantity: 8, returnedQuantity: 1, revenue: 400000, returnedValue: 10000 },
  dailySales: [
    { date: "2026-01-01", orders: 1, soldQuantity: 2, returnedQuantity: 0, revenue: 100000, returnedValue: 0 },
  ],
  topModels: [{ _id: "p1", soldQuantity: 4, returnedQuantity: 0, revenue: 200000 }],
  topColors: [{ _id: "Black", soldQuantity: 4, returnedQuantity: 0, revenue: 200000 }],
  topSizes: [{ _id: 40, soldQuantity: 4, returnedQuantity: 0, revenue: 200000 }],
});

test("redactSalesChartFinancials passes the charts through unchanged for privileged roles", () => {
  const charts = sampleCharts();
  const result = dashboardHelper.redactSalesChartFinancials(
    { role: "saler" },
    charts,
  );
  assert.deepEqual(result, charts);
});

test("redactSalesChartFinancials strips revenue/returnedValue everywhere for follow-up", () => {
  const charts = sampleCharts();
  const result = dashboardHelper.redactSalesChartFinancials(
    { role: "follow-up" },
    charts,
  );
  assert.equal("revenue" in result.summary, false);
  assert.equal("returnedValue" in result.summary, false);
  assert.equal(result.summary.soldQuantity, 8);
  for (const row of [
    ...result.dailySales,
    ...result.topModels,
    ...result.topColors,
    ...result.topSizes,
  ]) {
    assert.equal("revenue" in row, false);
    assert.equal("returnedValue" in row, false);
    assert.ok("soldQuantity" in row);
  }
});

// ==================== getChartPeriod ====================

test("getChartPeriod rejects a days value outside 7 or 30", () => {
  assert.throws(
    () => dashboardHelper.getChartPeriod({ days: 14 }),
    (error) => error.message === "days must be 7 or 30" && error.statusCode === 400,
  );
});

test("getChartPeriod requires both from and to when either is given", () => {
  assert.throws(
    () => dashboardHelper.getChartPeriod({ from: "2026-01-01" }),
    (error) =>
      error.message === "Both from and to are required" &&
      error.statusCode === 400,
  );
});

test("getChartPeriod computes an inclusive day count from an explicit range", () => {
  const period = dashboardHelper.getChartPeriod({
    from: "2026-01-01",
    to: "2026-01-07",
  });
  assert.equal(period.days, 7);
  assert.equal(period.from, "2026-01-01");
  assert.equal(period.to, "2026-01-07");
});

test("getChartPeriod treats a single-day range as 1 day", () => {
  const period = dashboardHelper.getChartPeriod({
    from: "2026-01-01",
    to: "2026-01-01",
  });
  assert.equal(period.days, 1);
});

// ==================== getDateLabels ====================

test("getDateLabels builds consecutive calendar-day labels starting from the given date", () => {
  const labels = dashboardHelper.getDateLabels("2026-01-30", 5);
  assert.deepEqual(labels, [
    "2026-01-30",
    "2026-01-31",
    "2026-02-01",
    "2026-02-02",
    "2026-02-03",
  ]);
});

// ==================== getBaghdadDate ====================

test("getBaghdadDate converts a UTC instant to its Asia/Baghdad (UTC+3) calendar date", () => {
  // 22:30 UTC on Jan 1st is 01:30 the next day in Baghdad.
  assert.equal(
    dashboardHelper.getBaghdadDate(new Date("2026-01-01T22:30:00Z")),
    "2026-01-02",
  );
  // 10:00 UTC on Jan 1st is still Jan 1st in Baghdad.
  assert.equal(
    dashboardHelper.getBaghdadDate(new Date("2026-01-01T10:00:00Z")),
    "2026-01-01",
  );
});
