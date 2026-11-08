import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  Package,
  ArrowLeftRight,
  Users,
  UserRound,
  LogOut,
  Menu,
  ChevronRight,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { admin, roleLabel } from "../lib/utils";
import { isPreview } from "../lib/api";
import { Button, ErrorBox, Modal } from "./ui";
const links = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/orders", label: "Orders", icon: ShoppingBag },
  { to: "/products", label: "Products", icon: Package },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  {
    to: "/movements",
    label: "Stock movements",
    icon: ArrowLeftRight,
    restricted: true,
  },
  { to: "/users", label: "Team members", icon: Users, restricted: true },
];
export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false),
    [error, setError] = useState<unknown>(null);
  const location = useLocation();
  const allowed = links.filter((l) => !l.restricted || admin(user?.role));
  const nav = (
    <>
      <div
        className={
          "brand flex items-center gap-[11px] text-[20px] font-[750] tracking-[2px] [&_img]:h-[45px] [&_img]:w-[45px] [&_img]:object-cover [&_img]:rounded-[11px] [&_small]:block [&_small]:text-[7px] [&_small]:font-semibold [&_small]:tracking-[2.2px] [&_small]:mt-[4px] [&_small]:text-[#829193]"
        }
      >
        <img src="/sinuora-logo.png" alt="Sinuora" />
        <div>
          SINUORA<small>OPERATIONS STUDIO</small>
        </div>
      </div>
      <p
        className={
          "nav-caption text-[9px] tracking-[1.7px] text-[#93a0a1] font-[650] [margin:45px_12px_15px]"
        }
      >
        WORKSPACE
      </p>
      <nav>
        {allowed.map((l) => (
          <NavLink
            end={l.to === "/"}
            key={l.to}
            aria-label={l.label}
            title={l.label}
            to={l.to}
            onClick={() => setOpen(false)}
          >
            <l.icon size={19} />
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>
      <div
        className={
          "sidebar-bottom mt-auto pt-[30px] min-[768px]:max-[1200px]:[&>.btn]:hidden"
        }
      >
        <div
          className={
            "workspace-note bg-[#f7faf9] [border:1px_solid_#e8efec] rounded-[10px] [padding:17px_14px] mb-[25px] [&_svg]:text-primary [&_svg]:mb-[12px] [&_strong]:block [&_strong]:text-[11px] [&_p]:text-[11px] [&_p]:text-[#8b9999] [&_p]:leading-[1.8] [&_p]:mt-[5px] [&_p]:mb-0"
          }
        >
          <ShieldCheck size={20} />
          <strong>Your workspace, in sync.</strong>
          <p>
            Every order. Every detail.
            <br />
            All in one place.
          </p>
        </div>
        <NavLink
          to="/profile"
          aria-label="My profile"
          onClick={() => setOpen(false)}
          className={
            "profile-link [border-top:1px_solid_var(--border)] pt-[20px] flex items-center gap-[10px] mb-[10px] [&>div]:flex-1 [&>div]:min-w-0 [&_strong]:text-[11px] [&_strong]:block [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_small]:text-muted-foreground [&_small]:block [&_small]:mt-[3px]"
          }
        >
          <span
            className={
              "avatar inline-flex items-center justify-center w-[35px] h-[35px] rounded-full bg-[#e8f1ef] text-primary font-[650] shrink-0 [&.large]:h-[58px] [&.large]:w-[58px] [&.large]:text-[22px]"
            }
          >
            {user?.fullName.slice(0, 1)}
          </span>
          <div>
            <strong>{user?.fullName}</strong>
            <small>{roleLabel(user!.role)}</small>
          </div>
          <ChevronRight size={16} />
        </NavLink>
        <Button variant="ghost" onClick={() => void logout().catch(setError)}>
          <LogOut size={16} />
          {isPreview() ? "Exit preview" : "Sign out"}
        </Button>
      </div>
    </>
  );
  return (
    <div className={"app-shell min-h-[100vh]"}>
      <aside
        className={
          "sidebar fixed [inset:0_auto_0_0] w-[var(--sidebar)] bg-white [border-right:1px_solid_var(--border)] [padding:30px_20px_20px] flex flex-col z-[20] [&_nav]:grid [&_nav]:gap-[7px] [&_nav_a]:flex [&_nav_a]:gap-[13px] [&_nav_a]:items-center [&_nav_a]:[padding:13px] [&_nav_a]:rounded-[7px] [&_nav_a]:text-[#748487] [&_nav_a]:text-[12px] [&_nav_a]:font-[550] [&_nav_a]:relative [&_nav_a:hover]:bg-[#f6f9f9] [&_nav_a.active]:bg-[#eaf5f4] [&_nav_a.active]:text-primary [&_nav_a.active::after]:[content:''] [&_nav_a.active::after]:absolute [&_nav_a.active::after]:right-[0] [&_nav_a.active::after]:top-[14px] [&_nav_a.active::after]:bottom-[14px] [&_nav_a.active::after]:w-[3px] [&_nav_a.active::after]:rounded-[3px] [&_nav_a.active::after]:bg-primary min-[768px]:max-[1200px]:[padding:25px_12px] min-[768px]:max-[1200px]:[&_.brand]:justify-center min-[768px]:max-[1200px]:[&_.brand_img]:w-[43px] min-[768px]:max-[1200px]:[&_.brand_img]:h-[43px] min-[768px]:max-[1200px]:[&_.brand>div]:hidden min-[768px]:max-[1200px]:[&_.nav-caption]:hidden min-[768px]:max-[1200px]:[&_nav_a>span]:hidden min-[768px]:max-[1200px]:[&_.workspace-note]:hidden min-[768px]:max-[1200px]:[&_.profile-link>div]:hidden min-[768px]:max-[1200px]:[&_.profile-link>svg]:hidden min-[768px]:max-[1200px]:[&_nav]:mt-[39px] min-[768px]:max-[1200px]:[&_nav]:gap-[13px] min-[768px]:max-[1200px]:[&_nav_a]:justify-center min-[768px]:max-[1200px]:[&_nav_a]:[padding:14px] min-[768px]:max-[1200px]:[&_.profile-link]:justify-center max-[768px]:hidden"
        }
      >
        {nav}
      </aside>
      <Modal open={open} onOpenChange={setOpen} title="Workspace navigation">
        <div
          className={
            "mobile-menu [&_nav]:grid [&_nav]:gap-[7px] [&_nav_a]:flex [&_nav_a]:gap-[13px] [&_nav_a]:items-center [&_nav_a]:[padding:13px] [&_nav_a]:rounded-[7px] [&_nav_a]:text-[#748487] [&_nav_a]:text-[12px] [&_nav_a]:font-[550] [&_nav_a]:relative [&_nav_a:hover]:bg-[#f6f9f9] [&_nav_a.active]:bg-[#eaf5f4] [&_nav_a.active]:text-primary [&_.sidebar-bottom]:mt-[20px] [&_.workspace-note]:hidden [&_.nav-caption]:mt-[20px]"
          }
        >
          {nav}
        </div>
      </Modal>
      <div
        className={
          "main-shell ml-[var(--sidebar)] min-h-[100vh] flex flex-col [&_main]:[padding:34px_40px_38px] [&_main]:max-w-[1740px] [&_main]:w-full [&_main]:[margin:0_auto] [&_main]:flex-1 [&_main]:min-w-0 min-[1600px]:[&_main]:[padding:42px_55px] min-[768px]:max-[1200px]:[&_main]:[padding:28px_25px] max-[768px]:ml-[0] max-[768px]:[&_main]:[padding:24px_17px_30px]"
        }
      >
        <header
          className={
            "topbar h-[78px] bg-[#fff] [border-bottom:1px_solid_var(--border)] flex items-center justify-between [padding:0_40px] gap-[10px] min-[768px]:max-[1200px]:[padding:0_25px] min-[768px]:max-[1200px]:h-[70px] max-[768px]:h-[64px] max-[768px]:[padding:0_15px]"
          }
        >
          <div
            className={
              "breadcrumbs flex items-center gap-[13px] text-[11px] text-[#8a9697] [&_strong]:text-[#4b6264] [&_strong]:font-medium max-[768px]:gap-[8px] max-[768px]:text-[10px]"
            }
          >
            <Button
              className={
                "menu-toggle hidden max-[768px]:inline-flex max-[768px]:[padding:7px]"
              }
              variant="ghost"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </Button>
            <span>Sinuora</span>
            <ChevronRight size={14} />
            <strong>
              {links.find((l) =>
                l.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(l.to),
              )?.label || "My profile"}
            </strong>
          </div>
          <div
            className={
              "topbar-right flex items-center gap-[22px] max-[768px]:gap-[10px]"
            }
          >
            <span
              className={
                "workspace-pill flex items-center gap-[7px] text-[10px] text-[#738284] [&_i]:w-[6px] [&_i]:h-[6px] [&_i]:rounded-full [&_i]:bg-[#67a290] max-[768px]:hidden"
              }
            >
              <i />
              {isPreview() ? "Preview workspace" : "Team workspace"}
            </span>
            <NavLink
              to="/profile"
              className={
                "avatar inline-flex items-center justify-center w-[35px] h-[35px] rounded-full bg-[#e8f1ef] text-primary font-[650] shrink-0 [&.large]:h-[58px] [&.large]:w-[58px] [&.large]:text-[22px]"
              }
              aria-label="My profile"
            >
              <UserRound size={19} />
            </NavLink>
          </div>
        </header>
        {isPreview() && (
          <div
            className={
              "preview-banner text-[10px] flex justify-between gap-[12px] items-center bg-[#eff6f5] text-[#5d8080] [padding:9px_40px] [border-bottom:1px_solid_#dfebea] [&_button]:text-[10px] [&_button]:text-primary [&_button]:flex [&_button]:items-center [&_button]:gap-[4px] [&_button]:[background:none] [&_button]:border-0 [&_button]:[padding:3px] min-[768px]:max-[1200px]:[padding:9px_25px] max-[768px]:[padding:8px_17px] max-[768px]:text-[9px] max-[768px]:[&_button]:text-[9px] max-[768px]:[&_strong]:block"
            }
          >
            <span>
              <strong>Design preview</strong> · Sample data, read-only.
            </span>
            <button onClick={() => void logout().catch(setError)}>
              Connect your workspace <ArrowUpRight size={14} />
            </button>
          </div>
        )}
        <main>
          {error != null && <ErrorBox error={error} />}
          <Outlet />
        </main>
        <footer
          className={
            "footer flex justify-between gap-[20px] [border-top:1px_solid_var(--border)] [margin:0_40px] [padding:20px_0] text-[9px] tracking-[.3px] text-[#8b9a9a] [&>span:first-child]:text-[#5d7475] [&>span:first-child]:font-semibold min-[768px]:max-[1200px]:[margin:0_25px] max-[768px]:[margin:0_17px_74px] max-[768px]:flex-col max-[768px]:gap-[8px] max-[768px]:[padding:20px_0]"
          }
        >
          <span>
            SINUORA{" "}
            <span className={"muted text-muted-foreground font-normal"}>
              / Operations dashboard
            </span>
          </span>
          <span>Made for your everyday workflow.</span>
        </footer>
      </div>
      <nav
        className={
          "bottom-nav hidden max-[768px]:flex max-[768px]:fixed max-[768px]:bottom-[0] max-[768px]:left-[0] max-[768px]:right-[0] max-[768px]:bg-[#fffffff5] max-[768px]:[backdrop-filter:blur(12px)] max-[768px]:[border-top:1px_solid_#e1e9e7] max-[768px]:z-[50] max-[768px]:[padding:7px_6px_calc(7px_+_env(safe-area-inset-bottom))] max-[768px]:justify-around max-[768px]:[&>a]:flex max-[768px]:[&>a]:flex-col max-[768px]:[&>a]:items-center max-[768px]:[&>a]:justify-center max-[768px]:[&>a]:gap-[5px] max-[768px]:[&>a]:text-[#8a9b98] max-[768px]:[&>a]:min-h-[48px] max-[768px]:[&>a]:min-w-[53px] max-[768px]:[&>a]:text-[9px] max-[768px]:[&>a]:border-0 max-[768px]:[&>a]:bg-transparent max-[768px]:[&>a]:rounded-[8px] max-[768px]:[&>button]:flex max-[768px]:[&>button]:flex-col max-[768px]:[&>button]:items-center max-[768px]:[&>button]:justify-center max-[768px]:[&>button]:gap-[5px] max-[768px]:[&>button]:text-[#8a9b98] max-[768px]:[&>button]:min-h-[48px] max-[768px]:[&>button]:min-w-[53px] max-[768px]:[&>button]:text-[9px] max-[768px]:[&>button]:border-0 max-[768px]:[&>button]:bg-transparent max-[768px]:[&>button]:rounded-[8px] max-[768px]:[&>a.active]:text-primary max-[768px]:[&>a.active]:bg-[#edf6f3]"
        }
      >
        {allowed.slice(0, 4).map((l) => (
          <NavLink
            end={l.to === "/"}
            key={l.to}
            aria-label={l.label}
            title={l.label}
            to={l.to}
          >
            <l.icon size={20} />
            <span>{l.label}</span>
          </NavLink>
        ))}
        <button onClick={() => setOpen(true)}>
          <Menu size={20} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
