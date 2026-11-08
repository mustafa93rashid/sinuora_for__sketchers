import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, isPreview } from "./api";
import { demoUser } from "./demo";
import type { User } from "./types";
type Auth = {
  user: User | null;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  preview: () => void;
};
const Context = createContext<Auth>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const cache = useQueryClient();
  const clear = () => {
    setUser(null);
    cache.clear();
  };
  const reload = async () => {
    setError("");
    try {
      setUser(isPreview() ? demoUser : (await api<User>("/auth/me")).data);
    } catch (e) {
      setUser(null);
      setError(e instanceof Error ? e.message : "Unable to check session");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
    window.addEventListener("session-expired", clear);
    return () => window.removeEventListener("session-expired", clear);
  }, []);
  const login = async (email: string, password: string) => {
    sessionStorage.removeItem("sinuora-preview");
    const r = await api<User>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    cache.clear();
    setUser(r.data);
  };
  const logout = async () => {
    if (!isPreview()) await api("/auth/logout", { method: "POST" });
    sessionStorage.removeItem("sinuora-preview");
    clear();
  };
  const preview = () => {
    sessionStorage.setItem("sinuora-preview", "true");
    cache.clear();
    setUser(demoUser);
  };
  return (
    <Context.Provider
      value={{ user, loading, error, reload, login, logout, preview }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
