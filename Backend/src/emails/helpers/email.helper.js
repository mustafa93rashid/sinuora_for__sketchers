// ==================== Escape HTML ====================

const escapeHtml = (value = "") => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// ==================== Format Email Value ====================

const formatEmailValue = (
  value,
  fallback = "Not available",
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  return escapeHtml(value);
};

// ==================== Format Identifier ====================

const formatIdentifier = (value) => {
  return value
    ? escapeHtml(value.toString())
    : "Not available";
};

// ==================== Format Full Name ====================

const formatFullName = (
  fullName,
  fallback = "Customer",
) => {
  return escapeHtml(
    fullName?.trim() || fallback,
  );
};

// ==================== Current Year ====================

const getCurrentYear = () => {
  return new Date().getFullYear();
};

// ==================== Exports ====================

module.exports = {
  escapeHtml,
  formatEmailValue,
  formatIdentifier,
  formatFullName,
  getCurrentYear,
};