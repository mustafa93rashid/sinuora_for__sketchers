export type Role = "superadmin" | "manager" | "saler" | "follow-up";
export interface User {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  avatar?: { url?: string };
  isActive: boolean;
  isAccountActivated: boolean;
}
export const statuses = [
  "New",
  "Preparing",
  "Prepared",
  "Out For Delivery",
  "Delivered",
  "Returned",
  "Partially Returned",
  "Cancelled",
] as const;
export type Status = (typeof statuses)[number];
export interface Product {
  _id: string;
  name: string;
  modelCode: string;
  description: string;
  brand: string;
  category: string;
  costPrice?: number;
  defaultSalePrice: number;
  images: { _id?: string; url: string }[];
  isActive: boolean;
}
export interface Variant {
  _id: string;
  product: Product | string;
  color: string;
  size: number;
  sku?: string;
  stockQuantity: number;
  reservedQuantity: number;
  quarantinedQuantity: number;
  availableQuantity?: number;
  identityLocked?: boolean;
  isActive: boolean;
}
export interface Customer {
  name: string;
  phone: string;
  instagramUsername?: string;
  governorate?: string;
  city?: string;
  address: string;
}
export interface OrderItem {
  _id: string;
  variant: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  dispatchedQuantity: number;
  deliveredQuantity: number;
  returnedQuantity: number;
  productSnapshot: {
    name: string;
    modelCode: string;
    color: string;
    size: number;
  };
}
export interface Order {
  _id: string;
  orderNumber: string;
  customer: Customer;
  items: OrderItem[];
  status: Status;
  totalAmount: number;
  deliveryFee: number;
  discount: number;
  notes: string;
  createdAt: string;
  createdBy: string;
  followUpCompleted?: boolean;
  deliveredAmount?: number;
  returnedAmount?: number;
}
export interface History {
  _id: string;
  fromStatus: Status;
  toStatus: Status;
  changedBy?: { fullName: string };
  createdAt: string;
  reason?: string;
  note?: string;
}
export interface Movement {
  _id: string;
  type: string;
  quantity: number;
  reason?: string;
  createdAt: string;
  variant?: Variant;
  performedBy?: { fullName: string };
  order?: { _id: string; orderNumber: string } | string;
}
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
export interface DashboardStatistics {
  totalOrders: number;
  newOrders: number;
  preparingOrders: number;
  preparedOrders: number;
  outForDeliveryOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  partiallyReturnedOrders: number;
  cancelledOrders: number;
  returnRate: number;
  // Stripped by the backend for the follow-up role (audit finding H-1) -
  // only superadmin/manager/saler receive these.
  deliveredItemValue?: number;
  totalOrderValue?: number;
  returnedValue?: number;
}
export interface DashboardOverview {
  statistics: DashboardStatistics;
  today: { orders: number; deliveredItemValue?: number; returnedValue?: number };
  inventory: { lowStockVariants: number; outOfStockVariants: number } | null;
  period: { from: string | null; to: string | null; basis: string; timezone: string };
}
export interface DailySales {
  date: string;
  orders: number;
  soldQuantity: number;
  returnedQuantity: number;
  revenue?: number;
  returnedValue?: number;
}
export interface TopSalesRow {
  _id: { product: string; name: string; modelCode: string } | string | number;
  soldQuantity: number;
  returnedQuantity: number;
  revenue?: number;
}
export interface SalesCharts {
  period: { from: string; to: string; days: number; basis: string; timezone: string };
  summary: { orders: number; soldQuantity: number; returnedQuantity: number; revenue?: number; returnedValue?: number };
  dailySales: DailySales[];
  topModels: TopSalesRow[];
  topColors: TopSalesRow[];
  topSizes: TopSalesRow[];
}
export interface Response<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: Pagination;
}
