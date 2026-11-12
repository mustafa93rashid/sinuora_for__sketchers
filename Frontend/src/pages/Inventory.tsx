import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api, query, requestKey } from "../lib/api";
import { admin, available, date } from "../lib/utils";
import { useAuth } from "../lib/auth";
import type { Variant, Product, Movement } from "../lib/types";
import {
  PageTitle,
  Loading,
  ErrorBox,
  Pager,
  Button,
  Modal,
  FieldsForm,
  Badge,
  PANEL_CLASS,
} from "../components/ui";
import { DataTable } from "../components/DataTable";
export function Inventory() {
  const { user } = useAuth(),
    cache = useQueryClient();
  const [params, setParams] = useSearchParams(),
    [selection, setSelection] = useState<{
      variant: Variant;
      mode: "add" | "adjust";
    } | null>(null),
    [key] = useState(() => requestKey());
  const page = Number(params.get("page")) || 1;
  const filter = {
    product: params.get("product") || "",
    color: params.get("color") || "",
    size: params.get("size") || "",
    lowStock: params.get("lowStock") ?? "",
    isActive: params.get("isActive") || "true",
  };
  const result = useQuery({
    queryKey: ["inventory", page, filter],
    queryFn: () =>
      api<{ variants: Variant[] }>(
        `/inventory${query({ ...filter, page, limit: 15 })}`,
      ),
  });
  const products = useQuery({
    queryKey: ["products", "inventory-filter"],
    queryFn: () => api<{ products: Product[] }>("/products?limit=100"),
  });
  function set(k: string, v: string) {
    setParams((prev) => {
      prev.set(k, v);
      if (k !== "page") prev.delete("page");
      return prev;
    });
  }
  return (
    <>
      <PageTitle
        title="Inventory"
        description="Know what’s available. Keep your collection moving."
      />
      <section className={PANEL_CLASS}>
        <div
          className={
            "toolbar [padding:18px_21px] [border-bottom:1px_solid_var(--border)] flex items-center justify-between gap-[15px] flex-wrap [&>input]:max-w-[350px] [&_select]:text-[11px] max-[768px]:[padding:14px] max-[768px]:gap-[15px] max-[768px]:items-stretch inventory-filters grid [grid-template-columns:1.5fr_1fr_.8fr_1fr_.8fr] [&_.field>span]:text-[10px] min-[768px]:max-[1200px]:grid-cols-[repeat(3,_1fr)] max-[768px]:grid max-[768px]:[grid-template-columns:1fr_1fr] max-[768px]:[&_.field:first-child]:col-span-2"
          }
        >
          <label
            className={
              "field flex flex-col gap-[7px] min-w-0 [&>span]:text-[11px] [&>span]:font-[550] [&>span]:text-[#607c7e] [&_select]:w-full [&_small]:text-[10px]"
            }
          >
            <span>Product</span>
            <select
              value={filter.product}
              onChange={(e) => set("product", e.target.value)}
            >
              <option value="">All products</option>
              {products.data?.data.products.map((p) => (
                <option value={p._id} key={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label
            className={
              "field flex flex-col gap-[7px] min-w-0 [&>span]:text-[11px] [&>span]:font-[550] [&>span]:text-[#607c7e] [&_select]:w-full [&_small]:text-[10px]"
            }
          >
            <span>Color</span>
            <input
              placeholder="All colors"
              value={filter.color}
              onChange={(e) => set("color", e.target.value)}
            />
          </label>
          <label
            className={
              "field flex flex-col gap-[7px] min-w-0 [&>span]:text-[11px] [&>span]:font-[550] [&>span]:text-[#607c7e] [&_select]:w-full [&_small]:text-[10px]"
            }
          >
            <span>Size</span>
            <select
              value={filter.size}
              onChange={(e) => set("size", e.target.value)}
            >
              <option value="">All sizes</option>
              {Array.from({ length: 13 }, (_, i) => 36 + i * 0.5).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label
            className={
              "field flex flex-col gap-[7px] min-w-0 [&>span]:text-[11px] [&>span]:font-[550] [&>span]:text-[#607c7e] [&_select]:w-full [&_small]:text-[10px]"
            }
          >
            <span>Available at most</span>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Any quantity"
              value={filter.lowStock}
              onChange={(e) => set("lowStock", e.target.value)}
            />
          </label>
          <label
            className={
              "field flex flex-col gap-[7px] min-w-0 [&>span]:text-[11px] [&>span]:font-[550] [&>span]:text-[#607c7e] [&_select]:w-full [&_small]:text-[10px]"
            }
          >
            <span>Status</span>
            <select
              value={filter.isActive}
              onChange={(e) => set("isActive", e.target.value)}
            >
              <option value="true">Active</option>
              <option value="false">Archived</option>
            </select>
          </label>
        </div>
        {result.isPending ? (
          <Loading />
        ) : result.error ? (
          <ErrorBox error={result.error} retry={() => void result.refetch()} />
        ) : (
          <>
            <DataTable
              rows={result.data.data.variants}
              columns={[
                {
                  header: "Product / Variant",
                  cell: ({ row }) => {
                    const v = row.original,
                      p = v.product as Product;
                    return (
                      <div>
                        <Link
                          className={
                            "text-link text-primary font-semibold inline-flex items-center gap-[7px] [&:hover]:underline"
                          }
                          to={`/products/${p?._id}`}
                        >
                          {p?.name || "Unavailable product"}
                        </Link>
                        <small>
                          {v.color} · EU {v.size} · {v.sku || p?.modelCode}
                        </small>
                      </div>
                    );
                  },
                },
                { header: "In stock", accessorKey: "stockQuantity" },
                { header: "Reserved", accessorKey: "reservedQuantity" },
                {
                  header: "Available",
                  cell: ({ row }) => (
                    <span
                      className={
                        available(row.original) <= 5
                          ? "stock-count text-[10px] text-[#af803c] bg-[#fbf4e8] [padding:4px_7px] rounded-[5px] whitespace-nowrap"
                          : "available-count font-[650] text-primary"
                      }
                    >
                      {available(row.original)}
                    </span>
                  ),
                },
                { header: "Quarantined", accessorKey: "quarantinedQuantity" },
                ...(admin(user?.role)
                  ? [
                      {
                        header: "Actions",
                        cell: ({ row }: { row: { original: Variant } }) => (
                          <div
                            className={
                              "inline-actions flex gap-[5px] items-center flex-wrap [&_.btn]:text-[10px] [&_.btn]:min-h-[35px] max-[768px]:gap-[8px] max-[768px]:[&_.btn]:min-h-[42px]"
                            }
                          >
                            <Button
                              variant="ghost"
                              onClick={() =>
                                setSelection({
                                  variant: row.original,
                                  mode: "add",
                                })
                              }
                            >
                              Add
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() =>
                                setSelection({
                                  variant: row.original,
                                  mode: "adjust",
                                })
                              }
                            >
                              Adjust
                            </Button>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            <Pager
              page={page}
              pagination={result.data.pagination}
              onChange={(p) => set("page", String(p))}
            />
          </>
        )}
      </section>
      <p
        className={
          "muted text-muted-foreground font-normal helper-note text-[11px] max-[768px]:text-[10px]"
        }
      >
        Available = in stock − reserved. Quarantined items are tracked
        separately and cannot be sold.
      </p>
      <Modal
        title={selection?.mode === "add" ? "Add stock" : "Adjust stock"}
        open={!!selection}
        onOpenChange={(v) => !v && setSelection(null)}
        description={
          selection
            ? `${(selection.variant.product as Product).name} · ${selection.variant.color} · EU ${selection.variant.size}`
            : ""
        }
      >
        {selection && (
          <FieldsForm
            key={`${selection.variant._id}-${selection.mode}`}
            submit={
              selection.mode === "add" ? "Add stock" : "Confirm adjustment"
            }
            fields={[
              {
                name: "quantity",
                label:
                  selection.mode === "add"
                    ? "Quantity to add"
                    : "New total stock quantity",
                type: "number",
                required: true,
                min:
                  selection.mode === "add"
                    ? 1
                    : selection.variant.reservedQuantity,
                step: 1,
                value:
                  selection.mode === "add"
                    ? 1
                    : selection.variant.stockQuantity,
                hint: `Current stock: ${selection.variant.stockQuantity}. Reserved: ${selection.variant.reservedQuantity}.`,
              },
              { name: "reason", label: "Reason", required: true },
              { name: "note", label: "Note", type: "textarea" },
            ]}
            onSubmit={async (data) => {
              const body = {
                ...(selection.mode === "add"
                  ? { quantity: Number(data.get("quantity")) }
                  : { newQuantity: Number(data.get("quantity")) }),
                reason: String(data.get("reason")),
                note: String(data.get("note")),
              };
              await api(
                `/inventory/variant/${selection.variant._id}/${selection.mode}`,
                {
                  method: selection.mode === "add" ? "POST" : "PATCH",
                  body,
                  key: key({
                    variant: selection.variant._id,
                    mode: selection.mode,
                    ...body,
                  }),
                },
              );
              await Promise.all([
                cache.invalidateQueries({ queryKey: ["inventory"] }),
                cache.invalidateQueries({ queryKey: ["movements"] }),
                cache.invalidateQueries({ queryKey: ["overview"] }),
              ]);
              setSelection(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}
export function Movements() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page")) || 1,
    type = params.get("type") || "";
  const result = useQuery({
    queryKey: ["movements", page, type],
    queryFn: () =>
      api<{ transactions: Movement[] }>(
        `/inventory/transactions${query({ page, type, limit: 20 })}`,
      ),
  });
  return (
    <>
      <PageTitle
        title="Stock movements"
        description="A traceable history of every inventory change."
      />
      <section className={PANEL_CLASS}>
        <div
          className={
            "toolbar [padding:18px_21px] [border-bottom:1px_solid_var(--border)] flex items-center justify-between gap-[15px] flex-wrap [&>input]:max-w-[350px] [&_select]:text-[11px] max-[768px]:[padding:14px] max-[768px]:gap-[15px] max-[768px]:items-stretch"
          }
        >
          <select
            aria-label="Movement type"
            value={type}
            onChange={(e) => setParams({ type: e.target.value })}
          >
            <option value="">All movement types</option>
            {[
              "IN",
              "RESERVE",
              "RELEASE_RESERVE",
              "SALE",
              "RETURN",
              "QUARANTINE_RETURN",
              "ADJUSTMENT",
            ].map((t) => (
              <option key={t} value={t}>
                {t.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        {result.isPending ? (
          <Loading />
        ) : result.error ? (
          <ErrorBox error={result.error} retry={() => void result.refetch()} />
        ) : (
          <>
            <DataTable
              rows={result.data.data.transactions}
              columns={[
                {
                  header: "Movement",
                  cell: ({ row }) => (
                    <Badge>{row.original.type.replaceAll("_", " ")}</Badge>
                  ),
                },
                {
                  header: "Variant",
                  cell: ({ row }) => (
                    <div>
                      {(row.original.variant?.product as Product)?.name ||
                        "Unavailable product"}
                      <small>
                        {row.original.variant?.color} · EU{" "}
                        {row.original.variant?.size}
                      </small>
                    </div>
                  ),
                },
                { header: "Quantity", accessorKey: "quantity" },
                { header: "Reason", accessorKey: "reason" },
                {
                  header: "Team member",
                  cell: ({ row }) => row.original.performedBy?.fullName || "—",
                },
                {
                  header: "Date",
                  cell: ({ row }) => date(row.original.createdAt),
                },
                {
                  header: "Order",
                  cell: ({ row }) =>
                    typeof row.original.order === "object" &&
                    row.original.order ? (
                      <Link
                        className={
                          "text-link text-primary font-semibold inline-flex items-center gap-[7px] [&:hover]:underline"
                        }
                        to={`/orders/${row.original.order._id}`}
                      >
                        {row.original.order.orderNumber}
                      </Link>
                    ) : (
                      "—"
                    ),
                },
              ]}
            />
            <Pager
              page={page}
              pagination={result.data.pagination}
              onChange={(p) => setParams({ page: String(p), type })}
            />
          </>
        )}
      </section>
    </>
  );
}
