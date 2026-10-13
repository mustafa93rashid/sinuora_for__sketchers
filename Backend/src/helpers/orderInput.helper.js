// ==================== Order Input Validation ====================

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const object = (value, keys) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Expected an object");
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`Unknown field: ${key}`);
};
const text = (value, max, required = false) => {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) fail("Invalid text field");
  return value.trim();
};
const integer = (value, min = 0) => {
  if (!Number.isSafeInteger(value) || value < min) fail("Expected a safe integer");
  return value;
};
const id = (value) => {
  if (typeof value !== "string" || !/^[a-f0-9]{24}$/i.test(value)) fail("Invalid resource ID");
  return value.toLowerCase();
};
const key = (value) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(value)) fail("Idempotency-Key must contain 8-128 letters, numbers, underscores or hyphens");
  return value;
};
const items = (values, returning = false) => {
  if (!Array.isArray(values) || !values.length || values.length > 100) fail("Expected 1-100 items");
  const field = returning ? "orderItem" : "variant";
  const seen = new Set();
  return values.map((value) => {
    object(value, returning ? [field, "quantity"] : [field, "quantity", "unitPrice"]);
    const itemId = id(value[field]);
    if (seen.has(itemId)) fail("Duplicate item");
    seen.add(itemId);
    return { [field]: itemId, quantity: integer(value.quantity, 1), ...(!returning && { unitPrice: integer(value.unitPrice) }) };
  }).sort((a, b) => a[field].localeCompare(b[field]));
};
const order = (value, partial = false) => {
  object(value, ["customer", "items", "deliveryFee", "discount", "notes"]);
  if (partial && !Object.keys(value).some((field) => value[field] !== undefined)) fail("At least one field is required");
  const result = {};
  if (!partial || value.customer !== undefined) {
    object(value.customer, ["name", "phone", "instagramUsername", "governorate", "city", "address"]);
    result.customer = {};
    for (const [field, max] of Object.entries({ name: 100, phone: 30, instagramUsername: 100, governorate: 100, city: 100, address: 500 })) {
      result.customer[field] = text(value.customer[field], max, ["name", "address"].includes(field));
    }
    if (!result.customer.phone && !result.customer.instagramUsername) fail("Phone or Instagram username is required");
  }
  if (!partial || value.items !== undefined) result.items = items(value.items);
  for (const field of ["deliveryFee", "discount"]) if (!partial || value[field] !== undefined) result[field] = integer(value[field] ?? 0);
  if (!partial || value.notes !== undefined) result.notes = text(value.notes, 1000);
  return result;
};
const action = (value = {}, cancel = false) => {
  object(value, ["reason", "note"]);
  return { reason: text(value.reason, 500, cancel), note: text(value.note, 1000) };
};
const returns = (value) => {
  object(value, ["items", "reason", "note"]);
  if (!["NO_ANSWER", "REFUSED", "WRONG_ADDRESS", "CHANGED_MIND", "SIZE_ISSUE", "DAMAGED", "OTHER"].includes(value.reason)) fail("Invalid return reason");
  return { items: items(value.items, true), reason: value.reason, note: text(value.note, 1000) };
};

module.exports = { fail, object, text, integer, id, key, order, action, returns };
