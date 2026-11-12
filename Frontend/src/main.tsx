import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./lib/auth";
import { admin } from "./lib/utils";
import { ApiError } from "./lib/api";
import Layout from "./components/Layout";
import { Loading, Button, StateBlock } from "./components/ui";
import Auth from "./pages/Auth";
import "./styles.css";
const Overview = lazy(() => import("./pages/Overview")),
  OrderForm = lazy(() => import("./pages/OrderForm")),
  Users = lazy(() => import("./pages/Users")),
  Profile = lazy(() => import("./pages/Profile"));
const Orders = lazy(() =>
    import("./pages/Orders").then((m) => ({ default: m.Orders })),
  ),
  OrderDetail = lazy(() =>
    import("./pages/Orders").then((m) => ({ default: m.OrderDetail })),
  );
const Products = lazy(() =>
    import("./pages/Products").then((m) => ({ default: m.Products })),
  ),
  ProductDetail = lazy(() =>
    import("./pages/Products").then((m) => ({ default: m.ProductDetail })),
  );
const Inventory = lazy(() =>
    import("./pages/Inventory").then((m) => ({ default: m.Inventory })),
  ),
  Movements = lazy(() =>
    import("./pages/Inventory").then((m) => ({ default: m.Movements })),
  );
const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (count, e) =>
        !(e instanceof ApiError && e.status >= 400 && e.status < 500) &&
        count < 1,
    },
    mutations: { retry: false },
  },
});
function Protected() {
  const { user, loading } = useAuth();
  return loading ? (
    <Loading />
  ) : user ? (
    <Layout />
  ) : (
    <Navigate to="/login" replace />
  );
}
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Previously rendered an inline ErrorBox, leaving the restricted
  // route "entered" (breadcrumb/layout visible) for any authenticated
  // user who navigated here directly, just with its body swapped out -
  // inconsistent with how Protected() handles unauthorized access
  // (redirect). Redirect here too (audit finding L-17).
  return admin(user?.role) ? children : <Navigate to="/" replace />;
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <StateBlock>
        <h1>Something went wrong.</h1>
        <p>Your saved server data has not been changed.</p>
        <Button onClick={() => window.location.reload()}>
          Reload workspace
        </Button>
      </StateBlock>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/login" element={<Auth />} />
                <Route
                  path="/forgot-password"
                  element={<Auth mode="forgot" />}
                />
                <Route
                  path="/reset-password/:token"
                  element={<Auth mode="reset" />}
                />
                <Route
                  path="/activate-account/:token"
                  element={<Auth mode="activate" />}
                />
                <Route
                  path="/activate-account"
                  element={<Auth mode="activate" />}
                />
                <Route element={<Protected />}>
                  <Route index element={<Overview />} />
                  <Route path="orders" element={<Orders />} />
                  <Route path="orders/new" element={<OrderForm />} />
                  <Route path="orders/:id/edit" element={<OrderForm />} />
                  <Route path="orders/:id" element={<OrderDetail />} />
                  <Route path="products" element={<Products />} />
                  <Route path="products/:id" element={<ProductDetail />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route
                    path="movements"
                    element={
                      <AdminOnly>
                        <Movements />
                      </AdminOnly>
                    }
                  />
                  <Route
                    path="users"
                    element={
                      <AdminOnly>
                        <Users />
                      </AdminOnly>
                    }
                  />
                  <Route path="profile" element={<Profile />} />
                  <Route
                    path="*"
                    element={
                      <StateBlock>
                        <h1>Page not found</h1>
                        <a href="/">Return to overview</a>
                      </StateBlock>
                    }
                  />
                </Route>
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
