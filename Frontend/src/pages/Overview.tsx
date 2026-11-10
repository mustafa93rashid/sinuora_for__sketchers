import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  ShoppingBag,
  PackageCheck,
  Truck,
  Boxes,
  Plus,
  Wallet,
  Undo2,
  Percent,
} from "lucide-react";
import { api, query } from "../lib/api";
import { useAuth } from "../lib/auth";
import { available, admin, money } from "../lib/utils";
import type {
  Order,
  Variant,
  Product,
  DashboardOverview,
  DashboardStatistics,
  SalesCharts,
} from "../lib/types";
import {
  Button,
  PageTitle,
  Loading,
  ErrorBox,
  Empty,
  BarChart,
  RankedList,
} from "../components/ui";
import { OrderTable } from "./Orders";
const statusField: Record<string, keyof DashboardStatistics> = {
  New: "newOrders",
  Preparing: "preparingOrders",
  Prepared: "preparedOrders",
  "Out For Delivery": "outForDeliveryOrders",
};
export default function Overview() {
  const { user } = useAuth();
  const follow = user?.role === "follow-up";
  const [days, setDays] = useState<7 | 30>(7);
  const cards = [
    {
      label: follow ? "Ready to follow up" : "New orders",
      status: follow ? "Prepared" : "New",
      icon: ShoppingBag,
      note: follow ? "Prepared and ready" : "Waiting to be prepared",
    },
    {
      label: "In preparation",
      status: "Preparing",
      icon: PackageCheck,
      note: "Being packed with care",
    },
    {
      label: "Out for delivery",
      status: "Out For Delivery",
      icon: Truck,
      note: "On the way to customers",
    },
    {
      label: "Low stock variants",
      status: "stock",
      icon: Boxes,
      note: "5 or fewer available",
    },
  ].filter((c) => !follow || c.status !== "Preparing");
  // Reuses /dashboard/overview (built on the backend, previously had no
  // frontend consumer at all) instead of issuing one /orders?status=X&limit=1
  // request per status card, which duplicated the exact same counts the
  // dashboard aggregation already computes in one call.
  const stats = useQuery({
    queryKey: ["overview", user?.role],
    queryFn: () => api<DashboardOverview>("/dashboard/overview"),
  });
  const lowStock = useQuery({
    queryKey: ["inventory", "low", "count"],
    queryFn: () =>
      api<{ variants: Variant[] }>("/inventory?lowStock=5&isActive=true&limit=1"),
  });
  const orders = useQuery({
    queryKey: ["orders", "recent"],
    queryFn: () => api<{ orders: Order[] }>("/orders?limit=5"),
  });
  const low = useQuery({
    queryKey: ["inventory", "low"],
    queryFn: () =>
      api<{ variants: Variant[] }>(
        "/inventory?lowStock=5&isActive=true&limit=4",
      ),
  });
  const charts = useQuery({
    queryKey: ["sales-charts", days],
    queryFn: () => api<SalesCharts>(`/dashboard/sales-charts?days=${days}`),
  });
  const statistics = stats.data?.data.statistics;
  return (
    <>
      <PageTitle
        title={`A clear view of your day.`}
        description={`Welcome back, ${user?.fullName.split(" ")[0]}. Here’s what needs your attention.`}
        action={
          !follow && (
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
          "welcome-strip relative overflow-hidden flex items-center justify-between gap-[24px] [padding:27px_29px] bg-[#edf5f3] [border:1px_solid_#e1eeea] rounded-[12px] mb-[24px] [&_.eyebrow]:text-[8px] [&_.eyebrow]:block [&_.eyebrow]:mb-[9px] [&_h2]:text-[23px] [&_h2]:text-[#285857] [&_h2]:font-[550] [&_h2]:mb-[5px] [&_h2]:tracking-[-.6px] [&_p]:text-[11px] [&_p]:text-[#72918e] [&_p]:m-0 [&>a]:flex [&>a]:gap-[15px] [&>a]:items-center [&>a]:z-[1] [&>a]:text-[11px] [&>a]:text-primary [&>a]:font-semibold [&>a]:mr-[8px] min-[1600px]:[padding:32px] max-[768px]:[padding:23px_20px] max-[768px]:items-start max-[768px]:flex-col max-[768px]:gap-[15px] max-[768px]:mb-[18px] max-[768px]:[&_h2]:text-[21px] max-[768px]:[&_p]:text-[10px] max-[768px]:[&>a]:text-[10px]"
        }
      >
        <div>
          <span
            className={
              "eyebrow text-[10px] tracking-[1.8px] font-bold text-primary mb-[12px] max-[768px]:text-[9px]"
            }
          >
            YOUR STORE, AT A GLANCE
          </span>
          <h2>Keep every step moving.</h2>
          <p>From the first order to the final delivery.</p>
        </div>
        <Link to="/orders">
          Go to orders <ArrowUpRight size={20} />
        </Link>
        <div
          className={
            "strip-decoration absolute right-[110px] top-[-40px] text-[#dcece6] [transform:rotate(-17deg)] [&_svg]:w-[210px] [&_svg]:h-[210px] [&_svg]:[stroke-width:.5] max-[768px]:right-[-25px] max-[768px]:top-[15px] max-[768px]:opacity-[.6] max-[768px]:[&_svg]:w-[170px] max-[768px]:[&_svg]:h-[170px]"
          }
          aria-hidden="true"
        >
          <ShoppingBag />
        </div>
      </section>
      {stats.error || lowStock.error ? (
        <ErrorBox
          error={stats.error || lowStock.error}
          retry={() => {
            void stats.refetch();
            void lowStock.refetch();
          }}
        />
      ) : (
        <div
          className={
            "stat-grid grid grid-cols-[repeat(4,_minmax(0,_1fr))] gap-[17px] mb-[28px] min-[768px]:max-[1200px]:[grid-template-columns:1fr_1fr] max-[768px]:[grid-template-columns:1fr_1fr] max-[768px]:gap-[11px] max-[768px]:mb-[20px]"
          }
        >
          {cards.map((c) => {
            const pending = c.status === "stock" ? lowStock.isPending : stats.isPending;
            const value =
              c.status === "stock"
                ? lowStock.data?.pagination?.total ?? 0
                : (statistics?.[statusField[c.status]] ?? 0);
            return (
              <Link
                className={
                  "stat-card [border:1px_solid_var(--border)] bg-white rounded-[10px] [padding:20px_19px] [transition:transform_.2s,_box-shadow_.2s] [&:hover]:[transform:translateY(-2px)] [&:hover]:[box-shadow:0_7px_20px_#123a3a08] [&>strong]:block [&>strong]:text-[31px] [&>strong]:leading-[1.2] [&>strong]:font-semibold [&>strong]:tracking-[-.8px] [&>strong]:[margin:16px_0_17px] min-[1600px]:[padding:25px] min-[1600px]:[&>strong]:text-[36px] max-[768px]:[padding:15px_13px] max-[768px]:[&>strong]:text-[29px] max-[768px]:[&>strong]:[margin:13px_0]"
                }
                key={c.label}
                to={
                  c.status === "stock"
                    ? "/inventory?lowStock=5"
                    : `/orders${query({ status: c.status })}`
                }
              >
                <div
                  className={
                    "stat-top flex items-center justify-between gap-[8px] text-[#748789] text-[11px] [&_svg]:text-[#6a9895] max-[768px]:text-[10px] max-[768px]:items-start max-[768px]:[&_svg]:w-[16px]"
                  }
                >
                  <span>{c.label}</span>
                  <c.icon size={19} />
                </div>
                <strong>{pending ? "—" : value}</strong>
                <div
                  className={
                    "stat-bottom flex items-center justify-between text-[9px] text-[#96a2a2] gap-[5px] [&_svg]:text-[#6f8e8c] max-[768px]:text-[8px] max-[768px]:leading-[1.5] max-[768px]:[&_svg]:hidden"
                  }
                >
                  <span>{c.note}</span>
                  <ArrowUpRight size={15} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {statistics && (
        <div
          className={
            "stat-grid grid grid-cols-[repeat(4,_minmax(0,_1fr))] gap-[17px] mb-[28px] min-[768px]:max-[1200px]:[grid-template-columns:1fr_1fr] max-[768px]:[grid-template-columns:1fr_1fr] max-[768px]:gap-[11px] max-[768px]:mb-[20px] [&>div]:[border:1px_solid_var(--border)] [&>div]:bg-white [&>div]:rounded-[10px] [&>div]:[padding:20px_19px] [&_strong]:block [&_strong]:text-[25px] [&_strong]:font-semibold [&_strong]:tracking-[-.6px] [&_strong]:[margin:14px_0_3px] [&_.lbl]:flex [&_.lbl]:items-center [&_.lbl]:justify-between [&_.lbl]:gap-[8px] [&_.lbl]:text-[#748789] [&_.lbl]:text-[11px] [&_.lbl_svg]:text-[#6a9895] [&_small]:text-[9px] [&_small]:text-[#96a2a2]"
          }
        >
          <div>
            <div className="lbl">
              <span>Total orders</span>
              <ShoppingBag size={18} />
            </div>
            <strong>{statistics.totalOrders}</strong>
            <small>All time, your scope</small>
          </div>
          {statistics.deliveredItemValue !== undefined && (
            <div>
              <div className="lbl">
                <span>Confirmed sales</span>
                <Wallet size={18} />
              </div>
              <strong>{money(statistics.deliveredItemValue)}</strong>
              <small>Item value delivered, net of returns</small>
            </div>
          )}
          <div>
            <div className="lbl">
              <span>Returns</span>
              <Undo2 size={18} />
            </div>
            <strong>
              {statistics.returnedOrders + statistics.partiallyReturnedOrders}
            </strong>
            <small>
              {statistics.returnedValue !== undefined
                ? `${money(statistics.returnedValue)} item value`
                : "Orders returned, full or partial"}
            </small>
          </div>
          <div>
            <div className="lbl">
              <span>Return rate</span>
              <Percent size={18} />
            </div>
            <strong>{statistics.returnRate}%</strong>
            <small>Of all orders in scope</small>
          </div>
        </div>
      )}
      <div
        className={
          "overview-grid grid [grid-template-columns:minmax(0,_2.12fr)_minmax(260px,_1fr)] gap-[23px] [&_.panel]:mb-0 min-[1600px]:[grid-template-columns:minmax(0,_2.4fr)_340px] min-[768px]:max-[1200px]:grid-cols-[1fr] max-[768px]:grid-cols-[1fr] max-[768px]:gap-[19px]"
        }
      >
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
              <h2>Recent orders</h2>
              <p className={"muted text-muted-foreground font-normal"}>
                The latest activity in your workspace.
              </p>
            </div>
            <Link
              className={
                "text-link text-primary font-semibold inline-flex items-center gap-[7px] [&:hover]:underline"
              }
              to="/orders"
            >
              View all <ArrowRight size={15} />
            </Link>
          </div>
          {orders.isPending ? (
            <Loading />
          ) : orders.error ? (
            <ErrorBox error={orders.error} />
          ) : (
            <OrderTable rows={orders.data.data.orders} compact />
          )}
        </section>
        <section
          className={
            "panel bg-white [border:1px_solid_var(--border)] rounded-[11px] overflow-hidden min-w-0 mb-[22px] max-[768px]:mb-[18px] stock-watch [padding:0_21px_20px] [&_.panel-heading]:[padding:23px_0_0] [&>.muted]:text-[10px] [&>.muted]:[margin:9px_0_17px] [&_.eyebrow]:text-[8px] [&_.eyebrow]:mb-[7px] [&>.btn]:mt-[20px] [&>.btn]:text-[10px] [&>.btn]:min-h-[36px] min-[768px]:max-[1200px]:block"
          }
        >
          <div
            className={
              "panel-heading flex items-center justify-between gap-[12px] [padding:24px_23px_19px] [&_h2]:text-[16px] [&_h2]:mb-[5px] [&_p]:text-[10px] [&_p]:mb-0 [&_.text-link]:text-[10px] [&_.text-link]:whitespace-nowrap max-[768px]:[padding:20px_17px_17px] max-[768px]:[&_h2]:text-[16px] max-[768px]:[&_p]:text-[10px] max-[768px]:[&_.text-link]:text-[10px]"
            }
          >
            <div>
              <p
                className={
                  "eyebrow text-[10px] tracking-[1.8px] font-bold text-primary mb-[12px] max-[768px]:text-[9px]"
                }
              >
                INVENTORY WATCH
              </p>
              <h2>Running low</h2>
            </div>
            <span
              className={
                "icon-tile flex items-center justify-center [border:1px_solid_#e0ebe8] bg-[#f4f9f7] w-[34px] h-[34px] rounded-[9px] text-[#6b9b91]"
              }
            >
              <Boxes size={19} />
            </span>
          </div>
          <p className={"muted text-muted-foreground font-normal"}>
            A little attention goes a long way.
          </p>
          {low.isPending ? (
            <Loading />
          ) : low.error ? (
            <ErrorBox error={low.error} />
          ) : low.data.data.variants.length ? (
            low.data.data.variants.map((v) => (
              <Link
                to={
                  admin(user?.role)
                    ? "/inventory?lowStock=5"
                    : `/products/${(v.product as Product)?._id}`
                }
                className={
                  "stock-watch-row flex items-center gap-[10px] [border-bottom:1px_solid_#f0f3f3] [padding:13px_0] [&>div]:flex-1 [&>div]:min-w-0 [&_strong]:text-[11px] [&_strong]:block [&_small]:block [&_small]:text-[#92a09f] [&_small]:text-[9px] [&_small]:mt-[4px] min-[768px]:max-[1200px]:[padding:15px_0]"
                }
                key={v._id}
              >
                <span
                  className={
                    "product-monogram flex items-center justify-center w-[39px] h-[39px] shrink-0 [border:1px_solid_#e4ece7] rounded-[8px] bg-[#f1f5ef] text-[#9aaa98] [font-family:Georgia,_serif] text-[24px] italic"
                  }
                >
                  {(v.product as Product)?.name?.slice(0, 1) || "S"}
                </span>
                <div>
                  <strong>{(v.product as Product)?.name || "Product"}</strong>
                  <small>
                    {v.color} · EU {v.size}
                  </small>
                </div>
                <span
                  className={
                    "stock-count text-[10px] text-[#af803c] bg-[#fbf4e8] [padding:4px_7px] rounded-[5px] whitespace-nowrap"
                  }
                >
                  {available(v)} left
                </span>
              </Link>
            ))
          ) : (
            <Empty
              title="Stock looks healthy"
              description="No active variants below this threshold."
            />
          )}
          <Button variant="secondary" asChild className={"full-width w-full"}>
            <Link to="/inventory?lowStock=5">
              Review inventory <ArrowRight size={16} />
            </Link>
          </Button>
        </section>
      </div>
      <section
        className={
          "panel bg-white [border:1px_solid_var(--border)] rounded-[11px] overflow-hidden min-w-0 mb-[22px] max-[768px]:mb-[18px]"
        }
      >
        <div
          className={
            "panel-heading flex items-center justify-between gap-[12px] [padding:24px_23px_19px] [&_h2]:text-[16px] [&_h2]:mb-[5px] [&_p]:text-[10px] [&_p]:mb-0 max-[768px]:[padding:20px_17px_17px] max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-[10px]"
          }
        >
          <div>
            <h2>Sales trend</h2>
            <p className={"muted text-muted-foreground font-normal"}>
              Units delivered, by day.
            </p>
          </div>
          <div
            className={
              "tabs flex gap-[5px] [&_button]:border-0 [&_button]:bg-[#f4f7f6] [&_button]:[padding:7px_13px] [&_button]:text-[11px] [&_button]:text-[#849596] [&_button]:rounded-[6px] [&_button.active]:text-primary [&_button.active]:bg-[#edf6f4] [&_button.active]:font-semibold"
            }
          >
            <button
              className={days === 7 ? "active" : ""}
              onClick={() => setDays(7)}
            >
              7 days
            </button>
            <button
              className={days === 30 ? "active" : ""}
              onClick={() => setDays(30)}
            >
              30 days
            </button>
          </div>
        </div>
        <div className={"[padding:4px_23px_24px] max-[768px]:[padding:4px_17px_20px]"}>
          {charts.isPending ? (
            <Loading />
          ) : charts.error ? (
            <ErrorBox error={charts.error} retry={() => void charts.refetch()} />
          ) : (
            <BarChart
              data={charts.data.data.dailySales.map((d) => ({
                label: d.date.slice(5),
                value: d.soldQuantity,
              }))}
              valueLabel="units delivered"
            />
          )}
        </div>
      </section>
      <div
        className={
          "overview-grid grid grid-cols-3 gap-[23px] mb-[22px] max-[1200px]:grid-cols-1 max-[768px]:gap-[14px]"
        }
      >
        {(
          [
            ["Best-selling models", charts.data?.data.topModels, "models"],
            ["Best-selling colors", charts.data?.data.topColors, "colors"],
            ["Best-selling sizes", charts.data?.data.topSizes, "sizes"],
          ] as const
        ).map(([title, rows, key]) => (
          <section
            key={key}
            className={
              "panel bg-white [border:1px_solid_var(--border)] rounded-[11px] overflow-hidden min-w-0 [padding:20px_21px]"
            }
          >
            <h2 className={"text-[13px] mb-[14px]"}>{title}</h2>
            {charts.isPending ? (
              <Loading />
            ) : (
              <RankedList
                rows={(rows ?? []).map((row) => ({
                  label:
                    typeof row._id === "object"
                      ? `${row._id.name} (${row._id.modelCode})`
                      : String(row._id),
                  value: row.soldQuantity,
                }))}
                emptyLabel={key}
              />
            )}
          </section>
        ))}
      </div>
      <div
        className={
          "quick-links grid [grid-template-columns:1fr_1fr] gap-[23px] mt-[25px] [&>a]:flex [&>a]:items-center [&>a]:gap-[17px] [&>a]:[border:1px_solid_var(--border)] [&>a]:rounded-[10px] [&>a]:[padding:19px_22px] [&>a]:bg-[#f9fbfb] [&>a>svg:first-child]:text-[#7f9b97] [&>a>svg:first-child]:w-[22px] [&_div]:flex-1 [&_strong]:text-[11px] [&_strong]:text-[#466a66] [&_p]:text-[10px] [&_p]:text-[#93a3a0] [&_p]:[margin:4px_0_0] [&>a>svg:last-child]:w-[16px] [&>a>svg:last-child]:text-[#79958e] min-[768px]:max-[1200px]:gap-[14px] min-[768px]:max-[1200px]:[&>a]:[padding:15px] min-[768px]:max-[1200px]:[&>a]:gap-[12px] max-[768px]:grid-cols-[1fr] max-[768px]:gap-[12px] max-[768px]:mt-[19px] max-[768px]:[&>a]:[padding:17px]"
        }
      >
        <Link to="/products">
          <PackageCheck />
          <div>
            <strong>A well-kept collection</strong>
            <p>Browse your products, colors and sizes.</p>
          </div>
          <ArrowUpRight />
        </Link>
        <Link to="/orders?status=Out%20For%20Delivery">
          <Truck />
          <div>
            <strong>Every delivery matters</strong>
            <p>Follow orders through their next step.</p>
          </div>
          <ArrowUpRight />
        </Link>
      </div>
    </>
  );
}
