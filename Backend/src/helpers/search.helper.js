// ==================== Escape Regex ====================

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ==================== Build Search Filter ====================

const buildSearchFilter = (search, fields = []) => {
  if (!search) return {};
  const searchRegex = escapeRegex(search);
  return {
    $or: fields.map((field) => ({
      [field]: { $regex: searchRegex, $options: "i" },
    })),
  };
};

// ==================== Export ====================

module.exports = {
  escapeRegex,
  buildSearchFilter,
};