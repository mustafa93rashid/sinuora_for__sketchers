import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Plus,
  ArrowUpRight,
  ArrowLeft,
  Clock,
  MapPin,
  Phone,
  Search,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { api, query, requestKey } from "../lib/api";
import { useAuth } from "../lib/auth";
import { actionsFor, date, money, admin } from "../lib/utils";
import { statuses, type Order, type History, type User } from "../lib/types";
import { DataTable } from "../components/DataTable";
import {
  Button,
  Badge,
  PageTitle,
  Pager,
  Loading,
  ErrorBox,
  Modal,
  FieldsForm,
} from "../components/ui";
export function OrderTable({
  rows,
  compact = false,
}: {
  rows: Order[];
  compact?: boolean;
}) {
  const columns: ColumnDef<Order>[] = [
    {
      header: "Order",
      accessorKey: "orderNumber",
      cell: ({ row }) => (
        <Link
          className={
            "order-number [&:hover]:underline flex gap-[7px] items-center text-[#467b79] text-[10px] font-semibold whitespace-nowrap max-[768px]:text-[11px]"
          }
          to={`/orders/${row.original._id}`}
        >
          {row.original.orderNumber}
          <ArrowUpRight size={13} />
        </Link>
      ),
    },
    {
      header: "Customer",
      cell: ({ row }) => (
        <div>
          <div className={"flex gap-[5px] flex-col "}>
                      <strong dir="auto">{row.original.customer.name}</strong>
                    <strong dir="auto">{row.original.customer.instagramUsername}</strong>
          </div>

          <small>
            {row.original.customer.governorate || row.original.customer.phone}
          </small>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <Badge>{row.original.status}</Badge>,
    },
    {
      header: "Total",
      accessorKey: "totalAmount",
      cell: ({ row }) => (
        <strong className={"numeric tabular-nums whitespace-nowrap"}>
          {money(row.original.totalAmount)}
        </strong>
      ),
    },
    ...(!compact
      ? [
          {
            header: "Created",
            accessorKey: "createdAt",
            cell: ({ row }: { row: { original: Order } }) =>
              date(row.original.createdAt),
          },
        ]
      : []),
  ];
  return <DataTable rows={rows} columns={columns} />;
}
export function Orders() {
  const [search, setSearch] = useSearchParams();
  const page = Number(search.get("page")) || 1,
    status = search.get("status") || "",
    createdBy = search.get("createdBy") || "",
    searchTerm = search.get("search") || "";
  const { user } = useAuth();
  const users = useQuery({
    queryKey: ["users", "filter"],
    queryFn: () => api<User[]>("/users?limit=100"),
    enabled: admin(user?.role),
  });
  const result = useQuery({
    queryKey: ["orders", page, status, createdBy, searchTerm],
    queryFn: () =>
      api<{ orders: Order[] }>(
        `/orders${query({ page, status, createdBy, search: searchTerm, limit: 15 })}`,
      ),
  });
  function set(k: string, v: string) {
    setSearch((prev) => {
      prev.set(k, v);
      if (k !== "page") prev.delete("page");
      return prev;
    });
  }
  return (
    <>
      <PageTitle
        title="Orders"
        description="Every order, from the first step to the doorstep."
        action={
          user?.role !== "follow-up" && (
            <Button asChild>
              <Link to="/orders/new">
                <Plus size={17} />
                Create order
              </Link>
            </Button>
          )
        }
      />
      <section
        className={
          "panel bg-white [border:1px_solid_var(--border)] rounded-[11px] overflow-hidden min-w-0 mb-[22px] max-[768px]:mb-[18px]"
        }
      >
        <div
          className={
            "toolbar [padding:18px_21px] [border-bottom:1px_solid_var(--border)] flex items-center justify-between gap-[15px] flex-wrap [&>input]:max-w-[350px] [&_select]:text-[11px] max-[768px]:[padding:14px] max-[768px]:gap-[15px] max-[768px]:items-stretch"
          }
        >
          <div
            className={
              "tabs flex gap-[5px] flex-wrap [&_button]:border-0 [&_button]:bg-transparent [&_button]:[padding:9px_12px] [&_button]:text-[11px] [&_button]:text-[#849596] [&_button]:rounded-[6px] [&_button]:min-h-[38px] [&_button.active]:text-primary [&_button.active]:bg-[#edf6f4] [&_button.active]:font-semibold max-[768px]:flex-nowrap max-[768px]:overflow-auto max-[768px]:w-full max-[768px]:gap-[2px] max-[768px]:[&_button]:whitespace-nowrap max-[768px]:[&_button]:text-[10px] max-[768px]:[&_button]:[padding:8px_10px] max-[768px]:[&_button]:min-h-[42px]"
            }
          >
            <button
              className={!status ? "active" : ""}
              onClick={() => set("status", "")}
            >
              All orders
            </button>
            {["New", "Preparing", "Out For Delivery", "Delivered"]
              .filter(
                (s) =>
                  user?.role !== "follow-up" ||
                  !["New", "Preparing"].includes(s),
              )
              .map((s) => (
                <button
                  key={s}
                  className={status === s ? "active" : ""}
                  onClick={() => set("status", s)}
                >
                  {s}
                </button>
              ))}
          </div>
          <div
            className={
              "filters flex gap-[8px] [&_select]:text-[11px] max-[768px]:w-full max-[768px]:flex-wrap max-[768px]:[&_select]:flex-1 max-[768px]:[&_select]:min-w-[130px]"
            }
          >
            <label
              className={
                "search-field relative max-w-[220px] w-full [&_svg]:absolute [&_svg]:left-[11px] [&_svg]:top-[11px] [&_svg]:text-[#95aaa7] [&_input]:pl-[33px] [&_input]:text-[11px] max-[768px]:max-w-none"
              }
            >
              <Search size={15} />
              <input
                aria-label="Search orders"
                placeholder="Order #, customer, or phone…"
                value={searchTerm}
                onChange={(e) => set("search", e.target.value)}
              />
            </label>
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="">All statuses</option>
              {statuses
                .filter(
                  (s) =>
                    user?.role !== "follow-up" ||
                    !["New", "Preparing", "Cancelled"].includes(s),
                )
                .map((s) => (
                  <option key={s}>{s}</option>
                ))}
            </select>
            {admin(user?.role) && (
              <select
                aria-label="Filter by team member"
                value={createdBy}
                onChange={(e) => set("createdBy", e.target.value)}
              >
                <option value="">All team members</option>
                {users.data?.data.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        {result.isPending ? (
          <Loading />
        ) : result.error ? (
          <ErrorBox error={result.error} retry={() => void result.refetch()} />
        ) : (
          <>
            <OrderTable rows={result.data.data.orders} />
            <Pager
              page={page}
              pagination={result.data.pagination}
              onChange={(p) => set("page", String(p))}
            />
          </>
        )}
      </section>
    </>
  );
}
export function OrderDetail() {
  const { id } = useParams(),
    { user } = useAuth(),
    cache = useQueryClient();
  const [action, setAction] = useState("");
  const [key] = useState(() => requestKey());
  const result = useQuery({
    queryKey: ["order", id],
    queryFn: () => api<{ order: Order; history: History[] }>(`/orders/${id}`),
  });
  if (result.isPending) return <Loading />;
  if (result.error) return <ErrorBox error={result.error} />;
  const { order, history } = result.data.data,
    allowed = actionsFor(order, user!.role, user!._id);
  const labels: Record<string, string> = {
    prepare: "Start preparing",
    prepared: "Mark as prepared",
    dispatch: "Dispatch order",
    deliver: "Confirm remaining delivery",
    cancel: "Cancel order",
    returns: "Return items",
  };
  return (
    <>
      <Link
        className={
          "back-link inline-flex items-center gap-[8px] text-[#78928f] text-[11px] mb-[22px]"
        }
        to="/orders"
      >
        <ArrowLeft size={15} />
        Back to orders
      </Link>
      <PageTitle
        eyebrow="ORDER DETAILS"
        title={order.orderNumber}
        description={`Created ${date(order.createdAt)}`}
        action={<Badge>{order.status}</Badge>}
      />
      <div
        className={
          "action-bar flex gap-[10px] flex-wrap mb-[24px] max-[768px]:gap-[8px] max-[768px]:[&>.btn]:flex-1 max-[768px]:[&>.btn]:min-h-[44px]"
        }
      >
        {allowed.edit && (
          <Button variant="secondary" asChild>
            <Link to={`/orders/${id}/edit`}>Edit order</Link>
          </Button>
        )}
        {Object.entries(allowed)
          .filter(([k, v]) => k !== "edit" && v)
          .map(([k]) => (
            <Button
              variant={
                k === "cancel"
                  ? "danger"
                  : k === "returns"
                    ? "secondary"
                    : "primary"
              }
              key={k}
              onClick={() => setAction(k)}
            >
              {labels[k]}
            </Button>
          ))}
      </div>
      <div
        className={
          "detail-grid grid [grid-template-columns:minmax(0,_1.8fr)_minmax(280px,_1fr)] gap-[24px] items-start [&>div]:min-w-0 [&>aside]:min-w-0 min-[768px]:max-[1200px]:grid-cols-[1fr] min-[768px]:max-[1200px]:[&>aside]:grid min-[768px]:max-[1200px]:[&>aside]:[grid-template-columns:1fr_1fr] min-[768px]:max-[1200px]:[&>aside]:gap-[20px] min-[768px]:max-[1200px]:[&>aside>.sticky-summary:only-child]:col-span-2 max-[768px]:grid-cols-[1fr] max-[768px]:gap-[0] max-[768px]:[&>aside]:min-w-0"
        }
      >
        <div>
          <section
            className={
              "panel bg-white [border:1px_solid_var(--border)] rounded-[11px] overflow-hidden min-w-0 mb-[22px] max-[768px]:mb-[18px] padded [padding:25px] [&_h2]:flex [&_h2]:items-center [&_h2]:gap-[8px] [&_h2]:mb-[21px] [&_p]:text-[12px] [&_small]:block max-[768px]:[padding:20px]"
            }
          >
            <h2>Order items</h2>
            <div className={"item-list mt-[10px]"}>
              {order.items.map((i) => (
                <div
                  key={i._id}
                  className={
                    "order-item flex items-center gap-[12px] [padding:20px_0] [border-bottom:1px_solid_var(--border)] [&>div]:flex-1 [&>div]:min-w-0 [&_strong]:text-[12px] [&_small]:block [&_small]:text-[10px] [&_small]:mt-[5px] [&_small]:text-muted-foreground max-[768px]:flex-wrap max-[768px]:gap-[11px] max-[768px]:[&>strong]:ml-auto max-[768px]:[&_small]:leading-[1.8]"
                  }
                >
                  <span
                    className={
                      "product-monogram flex items-center justify-center w-[39px] h-[39px] shrink-0 [border:1px_solid_#e4ece7] rounded-[8px] bg-[#f1f5ef] text-[#9aaa98] [font-family:Georgia,_serif] text-[24px] italic"
                    }
                  >
                    {i.productSnapshot.name[0]}
                  </span>
                  <div>
                    <strong>{i.productSnapshot.name}</strong>
                    <small>
                      {i.productSnapshot.color} · EU {i.productSnapshot.size} ·{" "}
                      {i.productSnapshot.modelCode}
                    </small>
                    <small>
                      Ordered {i.quantity} · Dispatched {i.dispatchedQuantity} ·
                      Delivered {i.deliveredQuantity} · Returned{" "}
                      {i.returnedQuantity}
                    </small>
                  </div>
                  <strong>{money(i.totalPrice)}</strong>
                </div>
              ))}
            </div>
            <div
              className={
                "totals mt-[20px] [&_p]:flex [&_p]:items-center [&_p]:justify-between [&_p]:gap-[15px] [&_p]:text-[12px] [&_p]:text-[#6f8586] [&_.total-line]:pt-[17px] [&_.total-line]:mt-[18px] [&_.total-line]:[border-top:1px_solid_var(--border)] [&_.total-line]:text-[15px] [&_.total-line]:text-[#234d4d]"
              }
            >
              <p>
                <span>Items subtotal</span>
                <strong>
                  {money(order.items.reduce((s, i) => s + i.totalPrice, 0))}
                </strong>
              </p>
              <p>
                <span>Delivery fee</span>
                <span>{money(order.deliveryFee)}</span>
              </p>
              <p>
                <span>Discount</span>
                <span>−{money(order.discount)}</span>
              </p>
              <p
                className={
                  "total-line [&_strong]:text-[21px] [&_strong]:tracking-[-.7px]"
                }
              >
                <span>Order total</span>
                <strong>{money(order.totalAmount)}</strong>
              </p>
            </div>
            {order.notes && (
              <div
                className={
                  "note [padding:14px] bg-[#f3f8f7] rounded-[7px] text-[#5a7c78] text-[11px] leading-[1.7] [&_p]:[margin:4px_0]"
                }
              >
                <strong>Order notes</strong>
                <p dir="auto">{order.notes}</p>
              </div>
            )}
          </section>
          <section
            className={
              "panel bg-white [border:1px_solid_var(--border)] rounded-[11px] overflow-hidden min-w-0 mb-[22px] max-[768px]:mb-[18px] padded [padding:25px] [&_h2]:flex [&_h2]:items-center [&_h2]:gap-[8px] [&_h2]:mb-[21px] [&_p]:text-[12px] [&_small]:block max-[768px]:[padding:20px]"
            }
          >
            <h2>
              <Clock size={19} /> Order timeline
            </h2>
            <div
              className={
                "timeline pl-[12px] [&>div]:relative [&>div]:[padding:0_0_25px_25px] [&>div]:[border-left:1px_solid_#dfeae6] [&>div:last-child]:border-0 [&>div:last-child]:pb-[0] [&_i]:absolute [&_i]:left-[-5px] [&_i]:top-[5px] [&_i]:w-[9px] [&_i]:h-[9px] [&_i]:rounded-full [&_i]:bg-[#88b5a8] [&_i]:[box-shadow:0_0_0_4px_white] [&_strong]:text-[12px] [&_p]:text-[10px] [&_p]:text-muted-foreground [&_p]:[margin:5px_0]"
              }
            >
              {history.map((h) => (
                <div key={h._id}>
                  <i />
                  <strong>
                    {h.fromStatus === h.toStatus ? "Order updated" : h.toStatus}
                  </strong>
                  <p>
                    {h.changedBy?.fullName || "Team member"} ·{" "}
                    {date(h.createdAt)}
                  </p>
                  {(h.reason || h.note) && (
                    <p dir="auto">
                      {h.reason} {h.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside>
          <section
            className={
              "panel bg-white [border:1px_solid_var(--border)] rounded-[11px] overflow-hidden min-w-0 mb-[22px] max-[768px]:mb-[18px] padded [padding:25px] [&_h2]:flex [&_h2]:items-center [&_h2]:gap-[8px] [&_h2]:mb-[21px] [&_p]:text-[12px] [&_small]:block max-[768px]:[padding:20px]"
            }
          >
            <p
              className={
                "eyebrow text-[10px] tracking-[1.8px] font-bold text-primary mb-[12px] max-[768px]:text-[9px]"
              }
            >
              CUSTOMER
            </p>
            <h2 dir="auto">{order.customer.name}</h2>
            {order.customer.phone && (
              <p>
                <Phone size={15} />{" "}
                <a href={`tel:${order.customer.phone}`}>
                  {order.customer.phone}
                </a>
              </p>
            )}
            {order.customer.instagramUsername && (
              <p>Instagram: {order.customer.instagramUsername}</p>
            )}
            <hr />
            <p>
              <MapPin size={16} /> Delivery address
            </p>
            <p dir="auto">
              {order.customer.governorate} {order.customer.city}
            </p>
            <p className={"muted text-muted-foreground font-normal"} dir="auto">
              {order.customer.address}
            </p>
          </section>
          <section
            className={
              "panel bg-white [border:1px_solid_var(--border)] rounded-[11px] overflow-hidden min-w-0 mb-[22px] max-[768px]:mb-[18px] padded [padding:25px] [&_h2]:flex [&_h2]:items-center [&_h2]:gap-[8px] [&_h2]:mb-[21px] [&_p]:text-[12px] [&_small]:block max-[768px]:[padding:20px]"
            }
          >
            <h3>Delivery & returns</h3>
            <p>
              Delivered items value{" "}
              <strong>{money(order.deliveredAmount)}</strong>
            </p>
            <p>
              Returned items value{" "}
              <strong>{money(order.returnedAmount)}</strong>
            </p>
            <small className={"muted text-muted-foreground font-normal"}>
              Item values only. These amounts do not represent cash collection
              or refunds.
            </small>
          </section>
        </aside>
      </div>
      <Modal
        title={labels[action] || "Order action"}
        open={!!action}
        onOpenChange={(v) => !v && setAction("")}
        description={
          action === "deliver"
            ? "This confirms delivery of every remaining dispatched item."
            : "The server validates the latest order status before saving."
        }
      >
        <FieldsForm
          key={action}
          submit={labels[action]}
          fields={
            action === "returns"
              ? [
                  {
                    name: "reason",
                    label: "Return reason",
                    required: true,
                    options: [
                      ["NO_ANSWER", "No answer"],
                      ["REFUSED", "Refused"],
                      ["WRONG_ADDRESS", "Wrong address"],
                      ["CHANGED_MIND", "Changed mind"],
                      ["SIZE_ISSUE", "Size issue"],
                      ["DAMAGED", "Damaged — quarantine stock"],
                      ["OTHER", "Other"],
                    ].map(([value, label]) => ({ value, label })),
                  },
                  { name: "note", label: "Note", type: "textarea" },
                ]
              : [
                  {
                    name: "reason",
                    label: "Reason",
                    required: action === "cancel",
                  },
                  { name: "note", label: "Note", type: "textarea" },
                ]
          }
          onSubmit={async (data) => {
            const body: Record<string, unknown> = {
              reason: String(data.get("reason") || ""),
              note: String(data.get("note") || ""),
            };
            if (action === "returns") {
              body.items = order.items
                .map((i) => ({
                  orderItem: i._id,
                  quantity: Number(data.get(i._id) || 0),
                }))
                .filter((i) => i.quantity > 0);
              if (!(body.items as unknown[]).length)
                throw new Error("Choose at least one item to return.");
            }
            await api(`/orders/${id}/${action}`, {
              method: action === "returns" ? "POST" : "PATCH",
              body,
              key: action === "returns" ? key(body) : undefined,
            });
            await cache.invalidateQueries();
            setAction("");
          }}
        >
          {action === "returns" && (
            <>
              <p
                className={
                  "note [padding:14px] bg-[#f3f8f7] rounded-[7px] text-[#5a7c78] text-[11px] leading-[1.7] [&_p]:[margin:4px_0]"
                }
              >
                Damaged items are quarantined and cannot be sold.
              </p>
              {order.items
                .filter((i) => i.dispatchedQuantity > i.returnedQuantity)
                .map((i) => (
                  <label
                    className={
                      "field flex flex-col gap-[7px] min-w-0 [&>span]:text-[11px] [&>span]:font-[550] [&>span]:text-[#607c7e] [&_select]:w-full [&_small]:text-[10px]"
                    }
                    key={i._id}
                  >
                    <span>
                      {i.productSnapshot.name} · {i.productSnapshot.color} · EU{" "}
                      {i.productSnapshot.size}
                    </span>
                    <input
                      aria-label={`Return quantity for ${i.productSnapshot.name}`}
                      type="number"
                      name={i._id}
                      min={0}
                      max={i.dispatchedQuantity - i.returnedQuantity}
                      step={1}
                      defaultValue={0}
                    />
                    <small>
                      Up to {i.dispatchedQuantity - i.returnedQuantity}{" "}
                      available to return
                    </small>
                  </label>
                ))}
            </>
          )}
        </FieldsForm>
      </Modal>
    </>
  );
}
