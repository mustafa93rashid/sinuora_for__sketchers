// Single source of truth for the allowed shoe sizes, shared by the
// ProductVariant schema enum and the matching express-validator rules
// (audit finding L-11) - previously duplicated in both places with no
// shared constant, risking drift if the size range ever changes.
const PRODUCT_SIZES = [
  36,
  36.5,
  37,
  37.5,
  38,
  38.5,
  39,
  39.5,
  40,
  40.5,
  41,
  41.5,
  42,
];

module.exports = { PRODUCT_SIZES };
