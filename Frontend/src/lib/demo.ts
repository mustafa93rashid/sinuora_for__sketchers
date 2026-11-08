import type { Product, Variant, Order, User } from "./types";
export const demoUser: User = {
  _id: "demo-user",
  fullName: "Alex Morgan",
  email: "alex@example.com",
  role: "superadmin",
  isActive: true,
  isAccountActivated: true,
};
export const demoProducts: Product[] = [
  ["Go Walk Flex", "124952", "Walking", 79000],
  ["Uno Stand on Air", "73690", "Lifestyle", 95000],
  ["Arch Fit 2.0", "150067", "Walking", 110000],
  ["D’Lites Fresh Start", "11931", "Lifestyle", 89000],
  ["Summits Daily", "12980", "Training", 69000],
  ["Slip-ins Ultra Flex", "149710", "Walking", 99000],
].map((p, i) => ({
  _id: `product-${i}`,
  name: String(p[0]),
  modelCode: String(p[1]),
  category: String(p[2]),
  brand: "Skechers",
  description: "Everyday comfort, thoughtfully designed.",
  defaultSalePrice: Number(p[3]),
  costPrice: 45000,
  images: [],
  isActive: true,
}));
export const demoVariants: Variant[] = demoProducts.flatMap((p, i) =>
  [38, 39, 40].map((size, j) => ({
    _id: `variant-${i}-${j}`,
    product: p,
    color: ["Ivory", "Black", "Sage"][j],
    size,
    sku: `SK-${p.modelCode}-${size}`,
    stockQuantity: i === 2 ? j + 1 : 12 + i * 3 + j,
    reservedQuantity: i === 2 ? 0 : j + 2,
    quarantinedQuantity: 0,
    isActive: true,
  })),
);
export const demoOrders: Order[] = [
  "New",
  "Preparing",
  "Prepared",
  "Out For Delivery",
  "Delivered",
  "Partially Returned",
  "New",
  "Delivered",
].map((status, i) => ({
  _id: `order-${i}`,
  orderNumber: `SN-104${8 - i}`,
  customer: {
    name: [
      "Noor Hassan",
      "Omar Ali",
      "Sara Ahmed",
      "Zaid Kareem",
      "Lina Khalid",
      "Hassan Abbas",
      "Maya Saad",
      "Ali Mustafa",
    ][i],
    phone: "07700000000",
    address: "Sample delivery address",
    governorate: ["Baghdad", "Erbil", "Basra", "Baghdad"][i % 4],
    city: "City center",
  },
  items: [
    {
      _id: `item-${i}`,
      variant: demoVariants[i]._id,
      quantity: 1,
      unitPrice: 79000,
      totalPrice: 79000,
      dispatchedQuantity: i >= 3 ? 1 : 0,
      deliveredQuantity: status === "Delivered" ? 1 : 0,
      returnedQuantity: 0,
      productSnapshot: {
        name: demoProducts[i % 6].name,
        modelCode: demoProducts[i % 6].modelCode,
        color: "Ivory",
        size: 39,
      },
    },
  ],
  status: status as Order["status"],
  totalAmount: 84000,
  deliveryFee: 5000,
  discount: 0,
  notes: "",
  createdAt: new Date(Date.UTC(2026, 9, 26 - i, 10)).toISOString(),
  createdBy: "demo-user",
}));
export async function demoRequest(path: string, method: string) {
  if (method !== "GET")
    throw new Error(
      "Preview is read-only. Sign in to your server to save changes.",
    );
  const url = new URL(path, "https://preview.local");
  const p = url.pathname,
    q = url.searchParams;
  const paginate = (rows: unknown[], key: string) => {
    const page = Number(q.get("page") || 1),
      limit = Number(q.get("limit") || 20);
    return {
      success: true,
      data: { [key]: rows.slice((page - 1) * limit, page * limit) },
      pagination: {
        page,
        total: rows.length,
        totalPages: Math.ceil(rows.length / limit),
      },
    };
  };
  if (p === "/orders")
    return paginate(
      demoOrders.filter(
        (o) => !q.get("status") || o.status === q.get("status"),
      ),
      "orders",
    );
  if (p.startsWith("/orders/")) {
    const order = demoOrders.find((o) => o._id === p.split("/")[2]);
    if (!order) throw new Error("Order not found");
    return {
      success: true,
      data: {
        order,
        history: [
          {
            _id: "history",
            fromStatus: "New",
            toStatus: order.status,
            changedBy: demoUser,
            createdAt: order.createdAt,
          },
        ],
      },
    };
  }
  if (p === "/products")
    return paginate(
      demoProducts.filter((p) =>
        `${p.name} ${p.modelCode}`
          .toLowerCase()
          .includes((q.get("search") || "").toLowerCase()),
      ),
      "products",
    );
  if (p.startsWith("/products/")) {
    const product = demoProducts.find((x) => x._id === p.split("/")[2]);
    return {
      success: true,
      data: {
        product,
        variants: demoVariants.filter(
          (v) => (v.product as Product)._id === product?._id,
        ),
      },
    };
  }
  if (p === "/inventory/transactions") return paginate([], "transactions");
  if (p === "/inventory" || p === "/product-variants")
    return paginate(
      demoVariants.filter(
        (v) =>
          (!q.has("lowStock") ||
            v.stockQuantity - v.reservedQuantity <=
              Number(q.get("lowStock"))) &&
          (!q.get("product") ||
            (v.product as Product)._id === q.get("product")),
      ),
      "variants",
    );
  if (p.startsWith("/product-variants/product/"))
    return {
      success: true,
      data: {
        variants: demoVariants.filter(
          (v) => (v.product as Product)._id === p.split("/").pop(),
        ),
      },
    };
  if (p === "/users")
    return {
      success: true,
      data: [demoUser],
      pagination: { currentPage: 1, totalUsers: 1, totalPages: 1 },
    };
  throw new Error("This view is unavailable in preview.");
}
