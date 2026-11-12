const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildPagination, buildPaginationResponse } = require("../src/helpers/pagination.helper");

// ==================== buildPagination ====================

test("buildPagination computes a zero skip on the first page", () => {
  assert.deepEqual(buildPagination(1, 15), { page: 1, limit: 15, skip: 0 });
});

test("buildPagination computes the correct skip for a later page", () => {
  assert.deepEqual(buildPagination(3, 15), { page: 3, limit: 15, skip: 30 });
});

// ==================== buildPaginationResponse ====================

test("buildPaginationResponse reports no pages and no navigation when the collection is empty", () => {
  const response = buildPaginationResponse(1, 15, 0);
  assert.equal(response.totalPages, 0);
  assert.equal(response.hasNextPage, false);
  assert.equal(response.hasPreviousPage, false);
});

test("buildPaginationResponse rounds a partial last page up", () => {
  // 31 rows at 15 per page is 3 pages, not 2 - a floor/integer-division
  // bug here would silently drop the last row from every listing.
  const response = buildPaginationResponse(1, 15, 31);
  assert.equal(response.totalPages, 3);
});

test("buildPaginationResponse exposes hasNextPage/hasPreviousPage consistently with every other list endpoint's shape", () => {
  const middle = buildPaginationResponse(2, 15, 45);
  assert.equal(middle.totalPages, 3);
  assert.equal(middle.hasNextPage, true);
  assert.equal(middle.hasPreviousPage, true);

  const first = buildPaginationResponse(1, 15, 45);
  assert.equal(first.hasPreviousPage, false);
  assert.equal(first.hasNextPage, true);

  const last = buildPaginationResponse(3, 15, 45);
  assert.equal(last.hasNextPage, false);
  assert.equal(last.hasPreviousPage, true);
});
