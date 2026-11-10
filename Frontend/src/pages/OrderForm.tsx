import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, ShoppingBag } from "lucide-react";
import { api, query, requestKey } from "../lib/api";
import { useAuth } from "../lib/auth";
import { actionsFor, available, money } from "../lib/utils";
import type { Order, Product, Variant } from "../lib/types";
import { Button, PageTitle, ErrorBox, Loading } from "../components/ui";
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const orderSchema = z
  .object({
    customer: z
      .object({
        name: z.string().trim().min(1, "Customer name is required").max(100),
        phone: z.string().max(30),
        instagramUsername: z.string().max(100),
        governorate: z.string().max(100),
        city: z.string().max(100),
        address: z
          .string()
          .trim()
          .min(1, "Delivery address is required")
          .max(500),
      })
      .refine((c) => c.phone.trim() || c.instagramUsername.trim(), {
        message: "Enter a phone number or Instagram username",
        path: ["phone"],
      }),
    items: z
      .array(
        z.object({
          variant: z.string().min(1),
          quantity: integer.min(1),
          unitPrice: integer,
        }),
      )
      .min(1, "Add at least one item")
      .max(100),
    deliveryFee: integer,
    discount: integer,
    notes: z.string().max(1000),
  })
  .refine(
    (v) =>
      v.discount <=
      v.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) + v.deliveryFee,
    { message: "Discount exceeds the order total", path: ["discount"] },
  );
type Values = z.infer<typeof orderSchema>;
export default function OrderForm() {
  const { id } = useParams(),
    navigate = useNavigate(),
    cache = useQueryClient(),
    { user } = useAuth();
  const [search, setSearch] = useState(""),
    [productId, setProductId] = useState(""),
    [selected, setSelected] = useState(""),
    [error, setError] = useState<unknown>(null),
    [key] = useState(() => requestKey()),
    [labels, setLabels] = useState<Record<string, string>>({});
  const form = useForm<Values>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer: {
        name: "",
        phone: "",
        instagramUsername: "",
        governorate: "",
        city: "",
        address: "",
      },
      items: [],
      deliveryFee: 0,
      discount: 0,
      notes: "",
    },
  });
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "items",
  });
  const values = form.watch();
  const existing = useQuery({
    queryKey: ["order", id],
    queryFn: () => api<{ order: Order }>(`/orders/${id}`),
    enabled: !!id,
  });
  const products = useQuery({
    queryKey: ["products", "picker", search],
    queryFn: () =>
      api<{ products: Product[] }>(
        `/products${query({ search, isActive: "true", limit: 30 })}`,
      ),
  });
  const variants = useQuery({
    queryKey: ["variants", productId],
    queryFn: () =>
      api<{ variants: Variant[] }>(`/product-variants/product/${productId}`),
    enabled: !!productId,
  });
  useEffect(() => {
    if (existing.data) {
      const o = existing.data.data.order;
      form.reset({
        customer: {
          ...o.customer,
          instagramUsername: o.customer.instagramUsername || "",
          governorate: o.customer.governorate || "",
          city: o.customer.city || "",
        },
        items: o.items.map((i) => ({
          variant: i.variant,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        deliveryFee: o.deliveryFee,
        discount: o.discount,
        notes: o.notes || "",
      });
      setLabels(
        Object.fromEntries(
          o.items.map((i) => [
            i.variant,
            `${i.productSnapshot.name} · ${i.productSnapshot.color} · EU ${i.productSnapshot.size}`,
          ]),
        ),
      );
    }
  }, [existing.data]);
  if (id && existing.isPending) return <Loading />;
  if (existing.error) return <ErrorBox error={existing.error} />;
  if (
    user?.role === "follow-up" ||
    (existing.data &&
      !actionsFor(existing.data.data.order, user!.role, user!._id).edit)
  )
    return (
      <ErrorBox error="You cannot edit this order in its current state." />
    );
  const subtotal = values.items.reduce(
    (s, i) => s + (i.quantity || 0) * (i.unitPrice || 0),
    0,
  );
  const errors = form.formState.errors;
  function add() {
    const v = variants.data?.data.variants.find((v) => v._id === selected),
      p = products.data?.data.products.find((p) => p._id === productId);
    if (!v || !p) return;
    const index = values.items.findIndex((i) => i.variant === v._id);
    if (index >= 0)
      update(index, {
        ...values.items[index],
        quantity: values.items[index].quantity + 1,
      });
    else append({ variant: v._id, quantity: 1, unitPrice: p.defaultSalePrice });
    setLabels((prev) => ({
      ...prev,
      [v._id]: `${p.name} · ${v.color} · EU ${v.size}`,
    }));
  }
  return (
    <>
      <Link
        className={
          "back-link inline-flex items-center gap-[8px] text-[#78928f] text-[11px] mb-[22px]"
        }
        to={id ? `/orders/${id}` : "/orders"}
      >
        <ArrowLeft size={15} />
        Back to {id ? "order" : "orders"}
      </Link>
      <PageTitle
        title={id ? "Edit order" : "Create an order"}
        description="A few details. One great customer experience."
      />
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setError(null);
          try {
            const r = await api<{ order: Order }>(
              id ? `/orders/${id}` : "/orders",
              {
                method: id ? "PATCH" : "POST",
                body: values,
                key: id ? undefined : key(values),
              },
            );
            await Promise.all([
              cache.invalidateQueries({ queryKey: ["orders"] }),
              cache.invalidateQueries({ queryKey: ["order", id] }),
              cache.invalidateQueries({ queryKey: ["inventory"] }),
              cache.invalidateQueries({ queryKey: ["overview"] }),
            ]);
            navigate(`/orders/${r.data.order._id}`);
          } catch (e) {
            setError(e);
          }
        })}
      >
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
              <h2>
                <span
                  className={
                    "step w-[25px] h-[25px] inline-flex items-center justify-center rounded-[7px] bg-[#eef6f3] text-[#63998d] text-[10px] mr-[5px]"
                  }
                >
                  01
                </span>{" "}
                Customer details
              </h2>
              <div
                className={
                  "form-grid grid [grid-template-columns:1fr_1fr] gap-[20px] max-[768px]:grid-cols-[1fr] max-[768px]:gap-[17px]"
                }
              >
                {(
                  [
                    ["name", "Full name"],
                    ["phone", "Phone number"],
                    ["instagramUsername", "Instagram username"],
                    ["governorate", "Governorate"],
                    ["city", "City"],
                    ["address", "Delivery address"],
                  ] as const
                ).map(([name, label]) => (
                  <label
                    className={`field flex flex-col gap-[7px] min-w-0 [&>span]:text-[11px] [&>span]:font-[550] [&>span]:text-[#607c7e] [&_select]:w-full [&_small]:text-[10px] ${name === "address" ? "span-two col-span-2 max-[768px]:col-auto" : ""}`}
                    key={name}
                  >
                    <span>
                      {label}
                      {["name", "address"].includes(name) ? " *" : ""}
                    </span>
                    <input
                      dir="auto"
                      {...form.register(`customer.${name}`)}
                      placeholder={name === "phone" ? "+964…" : label}
                    />
                    {errors.customer?.[name] && (
                      <small
                        className={"field-error text-[#b24a46] text-[11px]"}
                      >
                        {errors.customer[name]?.message}
                      </small>
                    )}
                  </label>
                ))}
              </div>
            </section>
            <section
              className={
                "panel bg-white [border:1px_solid_var(--border)] rounded-[11px] overflow-hidden min-w-0 mb-[22px] max-[768px]:mb-[18px] padded [padding:25px] [&_h2]:flex [&_h2]:items-center [&_h2]:gap-[8px] [&_h2]:mb-[21px] [&_p]:text-[12px] [&_small]:block max-[768px]:[padding:20px]"
              }
            >
              <h2>
                <span
                  className={
                    "step w-[25px] h-[25px] inline-flex items-center justify-center rounded-[7px] bg-[#eef6f3] text-[#63998d] text-[10px] mr-[5px]"
                  }
                >
                  02
                </span>{" "}
                Order items
              </h2>
              <div
                className={
                  "product-picker grid [grid-template-columns:1fr_1fr] gap-[14px] bg-[#f8faf9] [border:1px_solid_#e9eeeb] rounded-[9px] [padding:17px] [&>.btn]:self-end max-[768px]:grid-cols-[1fr] max-[768px]:[padding:15px]"
                }
              >
                <label
                  className={
                    "field flex flex-col gap-[7px] min-w-0 [&>span]:text-[11px] [&>span]:font-[550] [&>span]:text-[#607c7e] [&_select]:w-full [&_small]:text-[10px]"
                  }
                >
                  <span>Find a product</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or model code"
                  />
                </label>
                <label
                  className={
                    "field flex flex-col gap-[7px] min-w-0 [&>span]:text-[11px] [&>span]:font-[550] [&>span]:text-[#607c7e] [&_select]:w-full [&_small]:text-[10px]"
                  }
                >
                  <span>Product</span>
                  <select
                    value={productId}
                    onChange={(e) => {
                      setProductId(e.target.value);
                      setSelected("");
                    }}
                  >
                    <option value="">Select product</option>
                    {products.data?.data.products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} · {p.modelCode}
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  className={
                    "field flex flex-col gap-[7px] min-w-0 [&>span]:text-[11px] [&>span]:font-[550] [&>span]:text-[#607c7e] [&_select]:w-full [&_small]:text-[10px]"
                  }
                >
                  <span>Color & size</span>
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    disabled={!productId || variants.isPending}
                  >
                    <option value="">Select variant</option>
                    {variants.data?.data.variants
                      .filter((v) => v.isActive)
                      .map((v) => (
                        <option
                          key={v._id}
                          value={v._id}
                          disabled={available(v) <= 0}
                        >
                          {v.color} · EU {v.size} · {available(v)} available
                        </option>
                      ))}
                  </select>
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={add}
                  disabled={!selected || fields.length >= 100}
                >
                  <Plus size={16} />
                  Add item
                </Button>
              </div>
              {(products.error || variants.error) && (
                <ErrorBox error={products.error || variants.error} />
              )}
              <div className={"cart-items mt-[20px]"}>
                {!fields.length && (
                  <p className={"muted text-muted-foreground font-normal"}>
                    Choose a product and its variant to start your order.
                  </p>
                )}
                {fields.map((field, index) => (
                  <div
                    className={
                      "cart-item [padding:18px_0] [border-bottom:1px_solid_var(--border)] [&>strong]:text-[12px] max-[768px]:[&>strong]:text-[11px]"
                    }
                    key={field.id}
                  >
                    <strong>{labels[field.variant] || field.variant}</strong>
                    <div
                      className={
                        "cart-controls grid [grid-template-columns:100px_1fr_40px] items-end gap-[12px] mt-[12px] [&_input]:w-full max-[768px]:[grid-template-columns:85px_1fr_40px] max-[768px]:gap-[10px]"
                      }
                    >
                      <label
                        className={
                          "field flex flex-col gap-[7px] min-w-0 [&>span]:text-[11px] [&>span]:font-[550] [&>span]:text-[#607c7e] [&_select]:w-full [&_small]:text-[10px]"
                        }
                      >
                        <span>Quantity</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          {...form.register(`items.${index}.quantity`, {
                            valueAsNumber: true,
                          })}
                        />
                      </label>
                      <label
                        className={
                          "field flex flex-col gap-[7px] min-w-0 [&>span]:text-[11px] [&>span]:font-[550] [&>span]:text-[#607c7e] [&_select]:w-full [&_small]:text-[10px]"
                        }
                      >
                        <span>Unit price</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          {...form.register(`items.${index}.unitPrice`, {
                            valueAsNumber: true,
                          })}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={`Remove ${labels[field.variant]}`}
                        onClick={() => remove(index)}
                      >
                        <Trash2 size={17} />
                      </Button>
                    </div>
                    {errors.items?.[index] && (
                      <small
                        className={"field-error text-[#b24a46] text-[11px]"}
                      >
                        Quantity must be a positive integer; price must be a
                        non-negative integer.
                      </small>
                    )}
                  </div>
                ))}
              </div>
              {errors.items && (
                <p className={"field-error text-[#b24a46] text-[11px]"}>
                  {errors.items.message || errors.items.root?.message}
                </p>
              )}
            </section>
            <section
              className={
                "panel bg-white [border:1px_solid_var(--border)] rounded-[11px] overflow-hidden min-w-0 mb-[22px] max-[768px]:mb-[18px] padded [padding:25px] [&_h2]:flex [&_h2]:items-center [&_h2]:gap-[8px] [&_h2]:mb-[21px] [&_p]:text-[12px] [&_small]:block max-[768px]:[padding:20px]"
              }
            >
              <h2>
                <span
                  className={
                    "step w-[25px] h-[25px] inline-flex items-center justify-center rounded-[7px] bg-[#eef6f3] text-[#63998d] text-[10px] mr-[5px]"
                  }
                >
                  03
                </span>{" "}
                Additional details
              </h2>
              <label
                className={
                  "field flex flex-col gap-[7px] min-w-0 [&>span]:text-[11px] [&>span]:font-[550] [&>span]:text-[#607c7e] [&_select]:w-full [&_small]:text-[10px]"
                }
              >
                <span>Order notes</span>
                <textarea
                  dir="auto"
                  {...form.register("notes")}
                  maxLength={1000}
                  placeholder="Anything the team should know?"
                />
              </label>
            </section>
          </div>
          <aside>
            <section
              className={
                "panel bg-white [border:1px_solid_var(--border)] rounded-[11px] overflow-hidden min-w-0 mb-[22px] max-[768px]:mb-[18px] padded [padding:25px] [&_h2]:flex [&_h2]:items-center [&_h2]:gap-[8px] [&_h2]:mb-[21px] [&_p]:text-[12px] [&_small]:block max-[768px]:[padding:20px] sticky-summary sticky top-[24px] [&_.totals_.field]:mb-[15px] min-[768px]:max-[1200px]:[position:static] max-[768px]:[position:static]"
              }
            >
              <div
                className={
                  "summary-title flex gap-[12px] items-center text-primary [&_h2]:mb-0"
                }
              >
                <ShoppingBag size={21} />
                <h2>Order summary</h2>
              </div>
              <div
                className={
                  "totals mt-[20px] [&_p]:flex [&_p]:items-center [&_p]:justify-between [&_p]:gap-[15px] [&_p]:text-[12px] [&_p]:text-[#6f8586] [&_.total-line]:pt-[17px] [&_.total-line]:mt-[18px] [&_.total-line]:[border-top:1px_solid_var(--border)] [&_.total-line]:text-[15px] [&_.total-line]:text-[#234d4d]"
                }
              >
                <p>
                  <span>
                    {values.items.reduce((s, i) => s + (i.quantity || 0), 0)}{" "}
                    items
                  </span>
                  <strong>{money(subtotal)}</strong>
                </p>
                {(["deliveryFee", "discount"] as const).map((name) => (
                  <label
                    className={
                      "field flex flex-col gap-[7px] min-w-0 [&>span]:text-[11px] [&>span]:font-[550] [&>span]:text-[#607c7e] [&_select]:w-full [&_small]:text-[10px]"
                    }
                    key={name}
                  >
                    <span>
                      {name === "deliveryFee" ? "Delivery fee" : "Discount"}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      {...form.register(name, { valueAsNumber: true })}
                    />
                    {errors[name] && (
                      <small
                        className={"field-error text-[#b24a46] text-[11px]"}
                      >
                        {errors[name]?.message}
                      </small>
                    )}
                  </label>
                ))}
                <p
                  className={
                    "total-line [&_strong]:text-[21px] [&_strong]:tracking-[-.7px]"
                  }
                >
                  <span>Total</span>
                  <strong>
                    {money(
                      subtotal +
                        (values.deliveryFee || 0) -
                        (values.discount || 0),
                    )}
                  </strong>
                </p>
              </div>
              <p className={"muted text-muted-foreground font-normal"}>
                Stock availability is checked when you save the order.
              </p>
              {error != null && <ErrorBox error={error} />}
              <Button
                className={"full-width w-full"}
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting
                  ? "Saving…"
                  : id
                    ? "Save order"
                    : "Create order"}
                <ArrowLeft className={"rotate-180 rotate-180"} size={17} />
              </Button>
            </section>
          </aside>
        </div>
      </form>
    </>
  );
}
