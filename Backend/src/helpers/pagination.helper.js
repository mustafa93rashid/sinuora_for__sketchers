// ==================== Build Pagination ====================

const buildPagination = (page, limit) => {
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// ==================== Build Pagination Response ====================

const buildPaginationResponse = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};

// ==================== Export ====================

module.exports = {
  buildPagination,
  buildPaginationResponse,
};