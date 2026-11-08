const serializeProduct = (document, user) => {
  const value = document.toObject ? document.toObject() : { ...document };
  delete value.inventoryRevision;
  if (!["superadmin", "manager"].includes(user?.role)) delete value.costPrice;
  return value;
};
module.exports = { serializeProduct };
