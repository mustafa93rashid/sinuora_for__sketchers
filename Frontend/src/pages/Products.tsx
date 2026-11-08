import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Plus,
  Package,
  Search,
  Trash2,
} from "lucide-react";
import { api, query } from "../lib/api";
import { useAuth } from "../lib/auth";
import { admin, available, money } from "../lib/utils";
import type { Product, Variant } from "../lib/types";
import {
  Button,
  PageTitle,
  Loading,
  ErrorBox,
  Pager,
  Badge,
  Modal,
  FieldsForm,
  Empty,
  type FieldSpec,
} from "../components/ui";
import { DataTable } from "../components/DataTable";
const sizes = Array.from({ length: 13 }, (_, i) => 36 + i * 0.5);
function ProductEditor({
  product,
  done,
}: {
  product?: Product;
  done: () => void;
}) {
  const fields: FieldSpec[] = [
    {
      name: "name",
      label: "Product name",
      required: true,
      value: product?.name,
    },
    {
      name: "modelCode",
      label: "Model code",
      required: true,
      value: product?.modelCode,
    },
    { name: "brand", label: "Brand", value: product?.brand || "Skechers" },
    {
      name: "category",
      label: "Category",
      value: product?.category || "Shoes",
    },
    {
      name: "defaultSalePrice",
      label: "Sale price",
      type: "number",
      min: 0,
      step: 1,
      required: true,
      value: product?.defaultSalePrice ?? 0,
    },
    {
      name: "costPrice",
      label: "Cost price",
      type: "number",
      min: 0,
      step: 1,
      required: true,
      value: product?.costPrice ?? 0,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      value: product?.description,
    },
    {
      name: "images",
      label: "Add images",
      type: "file",
      multiple: true,
      hint: "JPEG, PNG or WebP. Existing images are preserved.",
    },
  ];
  return (
    <FieldsForm
      fields={fields}
      submit={product ? "Save product" : "Create product"}
      onSubmit={async (data) => {
        for (const value of data.getAll("images"))
          if (value instanceof File && !value.size) data.delete("images");
        await api(product ? `/products/${product._id}` : "/products", {
          method: product ? "PATCH" : "POST",
          body: data,
        });
        done();
      }}
    />
  );
}
export function Products() {
  const { user } = useAuth(),
    cache = useQueryClient();
  const [params, setParams] = useSearchParams(),
    [open, setOpen] = useState(false);
  const page = Number(params.get("page")) || 1,
    search = params.get("search") || "",
    active = params.get("isActive") || "true";
  const result = useQuery({
    queryKey: ["products", page, search, active],
    queryFn: () =>
      api<{ products: Product[] }>(
        `/products${query({ page, search, isActive: active, limit: 12 })}`,
      ),
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
        title="The collection"
        description="Your products, down to the last detail."
        action={
          admin(user?.role) && (
            <Button onClick={() => setOpen(true)}>
              <Plus size={17} />
              Add product
            </Button>
          )
        }
      />
      <div
        className={
          "catalog-toolbar flex justify-between gap-[20px] mb-[25px] max-[768px]:flex-col max-[768px]:gap-[12px] max-[768px]:mb-[20px]"
        }
      >
        <label
          className={
            "search-field relative max-w-[400px] w-full [&_svg]:absolute [&_svg]:left-[13px] [&_svg]:top-[13px] [&_svg]:text-[#95aaa7] [&_input]:pl-[41px] [&_input]:text-[12px] max-[768px]:max-w-none"
          }
        >
          <Search size={18} />
          <input
            aria-label="Search products"
            placeholder="Search products or model code…"
            value={search}
            onChange={(e) => set("search", e.target.value)}
          />
        </label>
        <select
          aria-label="Product status"
          value={active}
          onChange={(e) => set("isActive", e.target.value)}
        >
          <option value="true">Active collection</option>
          <option value="false">Archived products</option>
        </select>
      </div>
      {result.isPending ? (
        <Loading />
      ) : result.error ? (
        <ErrorBox error={result.error} retry={() => void result.refetch()} />
      ) : (
        <>
          {!result.data.data.products.length ? (
            <Empty title="No products found" />
          ) : (
            <div
              className={
                "product-grid grid grid-cols-[repeat(3,_minmax(0,_1fr))] gap-[24px] mb-[22px] min-[768px]:max-[1200px]:[grid-template-columns:1fr_1fr] min-[768px]:max-[1200px]:gap-[18px] max-[768px]:[grid-template-columns:1fr_1fr] max-[768px]:gap-[12px]"
              }
            >
              {result.data.data.products.map((p, i) => (
                <Link
                  className={
                    "product-card bg-white [border:1px_solid_var(--border)] rounded-[11px] overflow-hidden [transition:box-shadow_.2s,_transform_.2s] [&:hover]:[box-shadow:0_12px_28px_#345a4c0d] [&:hover]:[transform:translateY(-3px)]"
                  }
                  to={`/products/${p._id}`}
                  key={p._id}
                >
                  <div
                    className={
                      i % 3 === 1
                        ? "product-art bg-[#eff3ee] min-h-[210px] relative flex items-center justify-center text-[#99afa2] flex-col [&>img]:w-full [&>img]:h-[230px] [&>img]:object-contain [&>img]:[padding:15px] max-[768px]:min-h-[160px] max-[768px]:[&>img]:h-[160px] max-[768px]:[&>img]:[padding:5px] product-art-1 bg-[#edf1f3] text-[#9dadb7]"
                        : i % 3 === 2
                          ? "product-art bg-[#eff3ee] min-h-[210px] relative flex items-center justify-center text-[#99afa2] flex-col [&>img]:w-full [&>img]:h-[230px] [&>img]:object-contain [&>img]:[padding:15px] max-[768px]:min-h-[160px] max-[768px]:[&>img]:h-[160px] max-[768px]:[&>img]:[padding:5px] product-art-2 bg-[#f3f1e9] text-[#b1ad95]"
                          : "product-art bg-[#eff3ee] min-h-[210px] relative flex items-center justify-center text-[#99afa2] flex-col [&>img]:w-full [&>img]:h-[230px] [&>img]:object-contain [&>img]:[padding:15px] max-[768px]:min-h-[160px] max-[768px]:[&>img]:h-[160px] max-[768px]:[&>img]:[padding:5px]"
                    }
                  >
                    {p.images[0] ? (
                      <img src={p.images[0].url} alt={p.name} />
                    ) : (
                      <div
                        className={
                          "product-placeholder flex items-center justify-center flex-col gap-[16px] [&>span]:text-[12px] [&>span]:tracking-[4px] [&>span]:font-[300] max-[768px]:[&_svg]:h-[40px] max-[768px]:gap-[8px] max-[768px]:[&>span]:text-[9px] max-[768px]:[&>span]:tracking-[2px]"
                        }
                      >
                        <Package size={55} strokeWidth={1} />
                        <span>{p.modelCode}</span>
                      </div>
                    )}
                    <span
                      className={
                        "category-chip absolute left-[17px] top-[17px] bg-[#ffffffbb] [border:1px_solid_#ffffffee] [padding:5px_9px] rounded-[4px] text-[#6d8178] text-[9px] max-[768px]:left-[9px] max-[768px]:top-[9px] max-[768px]:[padding:4px_6px] max-[768px]:text-[8px]"
                      }
                    >
                      {p.category}
                    </span>
                    <span
                      className={
                        "product-arrow absolute right-[14px] bottom-[14px] flex items-center justify-center w-[30px] h-[30px] rounded-full bg-white text-[#698b7e] max-[768px]:w-[25px] max-[768px]:h-[25px] max-[768px]:right-[9px] max-[768px]:bottom-[9px] max-[768px]:[&_svg]:w-[16px]"
                      }
                    >
                      <ArrowUpRight size={20} />
                    </span>
                  </div>
                  <div
                    className={
                      "product-card-body [padding:21px] [&>small]:text-[9px] [&>small]:text-[#8ca09a] [&>small]:tracking-[.5px] [&>h3]:text-[17px] [&>h3]:[margin:7px_0_20px] [&>h3]:tracking-[-.4px] [&>div]:flex [&>div]:justify-between [&>div]:gap-[7px] [&>div]:text-[10px] [&>div]:[border-top:1px_solid_#eff3f1] [&>div]:pt-[14px] [&_strong]:text-[12px] max-[768px]:[padding:13px] max-[768px]:[&>h3]:text-[14px] max-[768px]:[&>h3]:leading-[1.4] max-[768px]:[&>h3]:mb-[13px] max-[768px]:[&>small]:text-[8px] max-[768px]:[&>div]:flex-col max-[768px]:[&>div]:gap-[6px] max-[768px]:[&>div]:text-[9px]"
                    }
                  >
                    <small>
                      {p.brand} / {p.modelCode}
                    </small>
                    <h3>{p.name}</h3>
                    <div>
                      <span
                        className={"muted text-muted-foreground font-normal"}
                      >
                        Default sale price
                      </span>
                      <strong>{money(p.defaultSalePrice)}</strong>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Pager
            pagination={result.data.pagination}
            page={page}
            onChange={(p) => set("page", String(p))}
          />
        </>
      )}
      <Modal title="Add a product" open={open} onOpenChange={setOpen}>
        <ProductEditor
          done={() => {
            void cache.invalidateQueries();
            setOpen(false);
          }}
        />
      </Modal>
    </>
  );
}
export function ProductDetail() {
  const { id } = useParams(),
    { user } = useAuth(),
    cache = useQueryClient();
  const [modal, setModal] = useState(""),
    [variant, setVariant] = useState<Variant | null>(null),
    [imageId, setImageId] = useState("");
  const result = useQuery({
    queryKey: ["product", id],
    queryFn: () =>
      api<{ product: Product; variants: Variant[] }>(`/products/${id}`),
  });
  if (result.isPending) return <Loading />;
  if (result.error) return <ErrorBox error={result.error} />;
  const { product: p, variants } = result.data.data;
  const done = () => {
    void cache.invalidateQueries();
    setModal("");
    setVariant(null);
  };
  return (
    <>
      <Link
        className={
          "back-link inline-flex items-center gap-[8px] text-[#78928f] text-[11px] mb-[22px]"
        }
        to="/products"
      >
        <ArrowLeft size={15} />
        Back to collection
      </Link>
      <PageTitle
        title={p.name}
        eyebrow={`${p.brand} / ${p.modelCode}`}
        description={p.category}
        action={
          admin(user?.role) && (
            <div
              className={
                "inline-actions flex gap-[5px] items-center flex-wrap [&_.btn]:text-[10px] [&_.btn]:min-h-[35px] max-[768px]:gap-[8px] max-[768px]:[&_.btn]:min-h-[42px]"
              }
            >
              <Button variant="secondary" onClick={() => setModal("archive")}>
                {p.isActive ? "Archive" : "Restore"}
              </Button>
              <Button onClick={() => setModal("edit")}>Edit product</Button>
            </div>
          )
        }
      />
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
            <div
              className={
                "product-gallery flex gap-[12px] overflow-auto mb-[25px] [&>div]:relative [&>div]:flex-1 [&>div]:min-w-[180px] [&_img]:w-full [&_img]:h-[230px] [&_img]:object-contain [&_img]:bg-[#f6f9f7] [&_img]:rounded-[8px] [&_.btn]:absolute [&_.btn]:top-[5px] [&_.btn]:right-[5px] [&_.btn]:bg-white [&_.product-art]:min-h-[240px] [&_.product-art]:rounded-[8px] [&_.product-art]:gap-[20px] [&_span]:text-[11px] max-[768px]:[&_img]:h-[180px] max-[768px]:[&>div]:min-w-[150px]"
              }
            >
              {p.images.length ? (
                p.images.map((img, i) => (
                  <div key={img._id || img.url}>
                    <img src={img.url} alt={`${p.name} view ${i + 1}`} />
                    {admin(user?.role) && img._id && (
                      <Button
                        variant="ghost"
                        aria-label={`Delete image ${i + 1}`}
                        onClick={() => {
                          setImageId(img._id!);
                          setModal("image");
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <div
                  className={
                    "product-art bg-[#eff3ee] min-h-[210px] relative flex items-center justify-center text-[#99afa2] flex-col [&>img]:w-full [&>img]:h-[230px] [&>img]:object-contain [&>img]:[padding:15px] max-[768px]:min-h-[160px] max-[768px]:[&>img]:h-[160px] max-[768px]:[&>img]:[padding:5px]"
                  }
                >
                  <Package size={80} strokeWidth={1} />
                  <span>No product images yet</span>
                </div>
              )}
            </div>
            <h2>Product details</h2>
            <p className={"muted text-muted-foreground font-normal"} dir="auto">
              {p.description || "No description added."}
            </p>
          </section>
          <section
            className={
              "panel bg-white [border:1px_solid_var(--border)] rounded-[11px] overflow-hidden min-w-0 mb-[22px] max-[768px]:mb-[18px]"
            }
          >
            <div
              className={
                "panel-heading flex items-center justify-between gap-[12px] [padding:24px_23px_19px] [&_h2]:text-[16px] [&_h2]:mb-[5px] [&_p]:text-[10px] [&_p]:mb-0 [&_.text-link]:text-[10px] [&_.text-link]:whitespace-nowrap max-[768px]:[padding:20px_17px_17px] max-[768px]:[&_h2]:text-[16px] max-[768px]:[&_p]:text-[10px] max-[768px]:[&_.text-link]:text-[10px]"
              }
            >
              <div>
                <h2>Colors & sizes</h2>
                <p className={"muted text-muted-foreground font-normal"}>
                  Stock at the variant level.
                </p>
              </div>
              {admin(user?.role) && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setVariant(null);
                    setModal("variant");
                  }}
                >
                  <Plus size={16} />
                  Add variant
                </Button>
              )}
            </div>
            <DataTable
              rows={variants}
              columns={[
                {
                  header: "Color / SKU",
                  cell: ({ row }) => (
                    <div>
                      <strong>{row.original.color}</strong>
                      <small>{row.original.sku || "No SKU"}</small>
                    </div>
                  ),
                },
                { header: "Size", accessorKey: "size" },
                {
                  header: "Available",
                  cell: ({ row }) => available(row.original),
                },
                {
                  header: "Status",
                  cell: ({ row }) => (
                    <Badge>
                      {row.original.isActive ? "Active" : "Archived"}
                    </Badge>
                  ),
                },
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
                            {!row.original.identityLocked && (
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  setVariant(row.original);
                                  setModal("variant");
                                }}
                              >
                                Edit
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setVariant(row.original);
                                setModal("variant-archive");
                              }}
                            >
                              {row.original.isActive ? "Archive" : "Restore"}
                            </Button>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
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
              PRICING
            </p>
            <h2>{money(p.defaultSalePrice)}</h2>
            <p className={"muted text-muted-foreground font-normal"}>
              Default sale price
            </p>
            {admin(user?.role) && (
              <p>
                Cost price <strong>{money(p.costPrice)}</strong>
              </p>
            )}
            <hr />
            <Badge>{p.isActive ? "Active" : "Archived"}</Badge>
            <p className={"muted text-muted-foreground font-normal"}>
              Used variants keep their original color, size and SKU to preserve
              order history.
            </p>
            <Button asChild variant="secondary">
              <Link to={`/inventory?product=${p._id}`}>
                View inventory <ArrowUpRight size={16} />
              </Link>
            </Button>
          </section>
        </aside>
      </div>
      <Modal
        title={
          modal === "edit"
            ? "Edit product"
            : modal === "variant"
              ? variant
                ? "Edit variant"
                : "Add variant"
              : "Confirm change"
        }
        open={!!modal}
        onOpenChange={(v) => !v && setModal("")}
      >
        {modal === "edit" ? (
          <ProductEditor product={p} done={done} />
        ) : modal === "variant" ? (
          <FieldsForm
            fields={[
              {
                name: "color",
                label: "Color",
                required: true,
                value: variant?.color,
              },
              {
                name: "size",
                label: "Size (EU)",
                required: true,
                value: variant?.size || 39,
                options: sizes.map((s) => ({
                  value: String(s),
                  label: String(s),
                })),
              },
              { name: "sku", label: "SKU", value: variant?.sku },
            ]}
            onSubmit={async (data) => {
              const body = {
                color: String(data.get("color")),
                size: Number(data.get("size")),
                ...(data.get("sku") ? { sku: String(data.get("sku")) } : {}),
                ...(!variant ? { product: id } : {}),
              };
              await api(
                variant
                  ? `/product-variants/${variant._id}`
                  : "/product-variants",
                { method: variant ? "PATCH" : "POST", body },
              );
              done();
            }}
          />
        ) : (
          <FieldsForm
            fields={[]}
            submit="Confirm"
            onSubmit={async () => {
              const path =
                modal === "image"
                  ? `/products/${id}/images/${imageId}`
                  : modal === "variant-archive"
                    ? `/product-variants/${variant!._id}/${variant!.isActive ? "archive" : "restore"}`
                    : `/products/${id}/${p.isActive ? "archive" : "restore"}`;
              await api(path, {
                method: modal === "image" ? "DELETE" : "PATCH",
              });
              done();
            }}
          >
            <p>
              {modal === "image"
                ? "Delete this product image?"
                : modal === "variant-archive"
                  ? `${variant?.isActive ? "Archive" : "Restore"} this variant?`
                  : `${p.isActive ? "Archive" : "Restore"} this product?`}
            </p>
          </FieldsForm>
        )}
      </Modal>
    </>
  );
}
