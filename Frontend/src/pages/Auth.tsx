
import { useState, type FormEvent } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  PackageCheck,
  Boxes,
  ChartNoAxesCombined,
} from "lucide-react";

import { ServerStatus } from "../components/ServerStatus";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { ErrorBox } from "../components/ui";

// ==================== Types ====================

type AuthMode = "login" | "forgot" | "reset" | "activate";

type AuthPageProps = {
  mode?: AuthMode;
};

type AuthFormValues = {
  email: string;
  password: string;
  newPassword: string;
  confirmPassword: string;
};

// ==================== Page Configuration ====================

const PAGE_CONFIG = {
  login: {
    eyebrow: "SECURE ACCESS",
    title: "Welcome back.",
    description: "Sign in to manage your store and daily operations.",
    submit: "Sign in to workspace",
  },
  forgot: {
    eyebrow: "ACCOUNT RECOVERY",
    title: "Forgot your password?",
    description:
      "Enter your email address and we'll send you instructions to reset your password.",
    submit: "Send reset link",
  },
  reset: {
    eyebrow: "ACCOUNT RECOVERY",
    title: "Create a new password.",
    description:
      "Choose a secure password to regain access to your workspace.",
    submit: "Reset password",
  },
  activate: {
    eyebrow: "GETTING STARTED",
    title: "Welcome to the team.",
    description:
      "Create a secure password to activate your account and access your workspace.",
    submit: "Activate account",
  },
} as const;

// ==================== Password Validation ====================

const isStrongPassword = (password: string) => {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
};

// ==================== Brand Features ====================

const BRAND_FEATURES = [
  {
    icon: PackageCheck,
    label: "Orders",
    description: "Stay organized",
  },
  {
    icon: Boxes,
    label: "Inventory",
    description: "Stay in control",
  },
  {
    icon: ChartNoAxesCombined,
    label: "Insights",
    description: "Stay informed",
  },
];

// ==================== Brand Panel ====================

function BrandPanel() {
  return (
    <aside className="relative hidden min-h-screen flex-col overflow-hidden bg-[#EDF5F1] px-10 py-10 text-[#2D5752] lg:flex xl:px-14 xl:py-12">
      {/* ==================== Decorative Background ==================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-44 -top-44 h-[500px] w-[500px] rounded-full border border-[#D7E8DF]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-28 h-[380px] w-[380px] rounded-full border border-[#D7E8DF]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-250px] left-[-150px] h-[550px] w-[550px] rounded-full bg-[#DCECE4]/70 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[10%] top-[38%] h-[300px] w-[300px] rounded-full bg-white/35 blur-[90px]"
      />

      {/* ==================== Brand Logo ==================== */}

      <div className="relative z-10 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D8E7DF] bg-white/75 p-1 shadow-[0_3px_12px_rgba(45,87,82,0.04)]">
          <img
            src="/sinuora-logo.png"
            alt="Sinuora"
            className="h-full w-full rounded-lg object-contain"
          />
        </div>

        <div>
          <p className="text-[18px] font-bold tracking-[0.16em] text-[#24655F]">
            SINUORA
          </p>

          <p className="mt-1 text-[9px] font-semibold tracking-[0.22em] text-[#829193]">
            OPERATIONS STUDIO
          </p>
        </div>
      </div>

      {/* ==================== Hero Content ==================== */}

      <div className="relative z-10 my-auto max-w-[550px] py-16">
        {/* ==================== Eyebrow ==================== */}

        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#D3E5DB] bg-white/55 px-4 py-2 text-[10px] font-semibold tracking-[0.13em] text-[#24655F]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#538B7E]" />
          YOUR BUSINESS, ORGANIZED
        </div>

        {/* ==================== Heading ==================== */}

        <h1 className="text-[clamp(46px,4.5vw,76px)] font-medium leading-[1.09] tracking-[-0.055em] text-[#2D5752]">
          Everything
          <br />
          in its place.
          <br />

          <span className="font-serif font-normal italic text-[#538B7E]">
            All in one view.
          </span>
        </h1>

        {/* ==================== Description ==================== */}

        <p className="mt-8 max-w-[400px] text-[14px] leading-8 text-[#77958B]">
          A thoughtful workspace for managing your orders,
          inventory, sales and team with clarity and confidence.
        </p>

        {/* ==================== Feature Cards ==================== */}

        <div className="mt-12 grid max-w-[470px] grid-cols-3 gap-3">
          {BRAND_FEATURES.map(
            ({ icon: Icon, label, description }) => (
              <div
                key={label}
                className="group rounded-xl border border-[#D8E7DF] bg-white/55 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#BED7CB] hover:bg-white/85 hover:shadow-[0_8px_24px_rgba(45,87,82,0.06)]"
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCEAE2] bg-[#F2F8F4] text-[#538B7E] transition-colors group-hover:bg-[#E5F1EA] group-hover:text-[#24655F]">
                  <Icon size={19} strokeWidth={1.7} />
                </div>

                <p className="text-[12px] font-semibold text-[#2D5752]">
                  {label}
                </p>

                <p className="mt-1 text-[10px] leading-4 text-[#829B90]">
                  {description}
                </p>
              </div>
            ),
          )}
        </div>
      </div>

      {/* ==================== Brand Footer ==================== */}

      <div className="relative z-10 flex items-center justify-between gap-4 border-t border-[#D7E5DC] pt-6">
        <span className="text-[10px] font-medium tracking-[0.12em] text-[#829B90]">
          © {new Date().getFullYear()} SINUORA
        </span>

        <span className="flex items-center gap-2 text-[10px] text-[#77958B]">
          <ShieldCheck
            size={15}
            className="text-[#538B7E]"
          />
          Internal workspace
        </span>
      </div>
    </aside>
  );
}

// ==================== Auth Input Types ====================

type AuthInputProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
  disabled?: boolean;
  passwordToggle?: boolean;
};

// ==================== Auth Input Component ====================

function AuthInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled = false,
  passwordToggle = false,
}: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const actualType =
    passwordToggle && showPassword ? "text" : type;

  return (
    <div className="space-y-2">
      {/* ==================== Input Label ==================== */}

      <label
        htmlFor={id}
        className="block text-[12px] font-semibold text-[#2D5752]"
      >
        {label}
      </label>

      {/* ==================== Input Wrapper ==================== */}

      <div className="relative">
        <input
          id={id}
          name={id}
          type={actualType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required
          className="h-[50px] w-full rounded-xl border border-[#DDE9E2] bg-white px-4 pr-12 text-[13px] text-[#2D5752] outline-none transition-all duration-200 placeholder:text-[#9CAE9F] hover:border-[#BFD5C9] focus:border-[#538B7E] focus:ring-4 focus:ring-[#538B7E]/10 disabled:cursor-not-allowed disabled:bg-[#F8FAF9] disabled:opacity-60"
        />

        {/* ==================== Password Visibility ==================== */}

        {passwordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={disabled}
            aria-label={
              showPassword ? "Hide password" : "Show password"
            }
            aria-pressed={showPassword}
            className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md text-[#91A79B] transition-colors hover:text-[#24655F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#538B7E] disabled:cursor-not-allowed"
          >
            {showPassword ? (
              <EyeOff size={17} strokeWidth={1.8} />
            ) : (
              <Eye size={17} strokeWidth={1.8} />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ==================== Main Auth Page ====================

export default function AuthPage({
  mode = "login",
}: AuthPageProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const [search] = useSearchParams();

  // ==================== Form State ====================

  const [values, setValues] = useState<AuthFormValues>({
    email: "",
    password: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<unknown>(null);

  const config = PAGE_CONFIG[mode];

  // ==================== Update Form Field ====================

  const updateField = (
    field: keyof AuthFormValues,
    value: string,
  ) => {
    setValues((prev) => ({
      ...prev,
      [field]: value,
    }));

    setError(null);
  };

  // ==================== Authentication Submit ====================

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      // ==================== Login ====================

      if (mode === "login") {
        await auth.login(
          values.email.trim(),
          values.password,
        );

        navigate("/", { replace: true });
        return;
      }

      // ==================== Forgot Password ====================

      if (mode === "forgot") {
        const result = await api("/auth/forgot-password", {
          method: "POST",
          body: {
            email: values.email.trim(),
          },
        });

        setMessage(
          result.message ||
            "If this email is registered, password reset instructions will be sent.",
        );

        return;
      }

      // ==================== Password Validation ====================

      if (!isStrongPassword(values.newPassword)) {
        throw new Error(
          "Password must contain 8–128 characters, uppercase and lowercase letters, a number and a special character.",
        );
      }

      if (
        values.newPassword !== values.confirmPassword
      ) {
        throw new Error("Passwords do not match.");
      }

      // ==================== Get Token ====================

      const token =
        params.token || search.get("token");

      if (!token) {
        throw new Error(
          "This link is incomplete. Open the original link from your email.",
        );
      }

      // ==================== Reset Password ====================

      if (mode === "reset") {
        const result = await api(
          `/auth/reset-password/${encodeURIComponent(token)}`,
          {
            method: "POST",
            body: {
              newPassword: values.newPassword,
              confirmPassword: values.confirmPassword,
            },
          },
        );

        setMessage(
          result.message ||
            "Your password has been reset successfully.",
        );

        return;
      }

      // ==================== Activate Account ====================

      const result = await api(
        "/users/activate-account",
        {
          method: "POST",
          body: {
            token,
            password: values.newPassword,
            confirmPassword: values.confirmPassword,
          },
        },
      );

      setMessage(
        result.message ||
          "Your account has been activated successfully.",
      );
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // ==================== Design Preview ====================

  const handlePreview = () => {
    try {
      setError(null);

      auth.preview();

      navigate("/", { replace: true });
    } catch (err) {
      setError(err);
    }
  };

  // ==================== Auth Redirect ====================

  if (auth.user && mode === "login") {
    return <Navigate to="/" replace />;
  }

  // ==================== Render ====================

  return (
    <main className="grid min-h-[100dvh] grid-cols-1 bg-white lg:grid-cols-[minmax(0,1.03fr)_minmax(0,1fr)]">
      {/* ==================== Brand Section ==================== */}

      <BrandPanel />

      {/* ==================== Form Section ==================== */}

      <section className="flex min-h-[100dvh] flex-col bg-white px-6 py-8 sm:px-10 lg:px-12 xl:px-20">
        {/* ==================== Mobile Brand ==================== */}

        <div className="flex items-center gap-3 lg:hidden">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-[#DCE9E1] bg-[#EDF5F1] p-1">
            <img
              src="/sinuora-logo.png"
              alt="Sinuora"
              className="h-full w-full object-contain"
            />
          </div>

          <div>
            <p className="text-[16px] font-bold tracking-[0.16em] text-[#24655F]">
              SINUORA
            </p>

            <p className="mt-1 text-[8px] font-semibold tracking-[0.2em] text-[#829193]">
              OPERATIONS STUDIO
            </p>
          </div>
        </div>

        {/* ==================== Centered Form ==================== */}

        <div className="flex flex-1 items-center justify-center py-14">
          <div className="w-full max-w-[390px]">
            {/* ==================== Form Header ==================== */}

            <div className="mb-9">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-[#DCE9E1] bg-[#EDF5F1] text-[#24655F]">
                <LockKeyhole
                  size={20}
                  strokeWidth={1.7}
                />
              </div>

              <p className="mb-3 text-[10px] font-bold tracking-[0.18em] text-[#538B7E]">
                {config.eyebrow}
              </p>

              <h1 className="text-[clamp(28px,3vw,36px)] font-semibold leading-tight tracking-[-0.045em] text-[#2D5752]">
                {config.title}
              </h1>

              <p className="mt-3 max-w-[360px] text-[13px] leading-6 text-[#77958B]">
                {config.description}
              </p>
            </div>

            {/* ==================== Success State ==================== */}

            {message ? (
              <div
                role="status"
                className="rounded-xl border border-[#D4E9DC] bg-[#EEF8F2] p-5"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#DDF0E4] text-[#3B8168]">
                  <CheckCircle2
                    size={21}
                    strokeWidth={1.8}
                  />
                </div>

                <p className="text-[13px] leading-6 text-[#3B8168]">
                  {message}
                </p>

                <Link
                  to="/login"
                  className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold text-[#24655F] transition-colors hover:text-[#2D5752] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#538B7E]"
                >
                  Back to sign in
                  <ArrowRight size={15} />
                </Link>
              </div>
            ) : (
              /* ==================== Auth Form ==================== */

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {/* ==================== Email Field ==================== */}

                {(mode === "login" ||
                  mode === "forgot") && (
                  <AuthInput
                    id="email"
                    label="Email address"
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    value={values.email}
                    onChange={(value) =>
                      updateField("email", value)
                    }
                    disabled={loading}
                  />
                )}

                {/* ==================== Login Password ==================== */}

                {mode === "login" && (
                  <div>
                    <AuthInput
                      id="password"
                      label="Password"
                      type="password"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      passwordToggle
                      value={values.password}
                      onChange={(value) =>
                        updateField("password", value)
                      }
                      disabled={loading}
                    />

                    <div className="mt-3 text-right">
                      <Link
                        to="/forgot-password"
                        className="text-[12px] font-medium text-[#24655F] transition-colors hover:text-[#538B7E] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#538B7E]"
                      >
                        Forgot password?
                      </Link>
                    </div>
                  </div>
                )}

                {/* ==================== New Password Fields ==================== */}

                {(mode === "reset" ||
                  mode === "activate") && (
                  <>
                    <AuthInput
                      id="newPassword"
                      label="New password"
                      type="password"
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      passwordToggle
                      value={values.newPassword}
                      onChange={(value) =>
                        updateField("newPassword", value)
                      }
                      disabled={loading}
                    />

                    <AuthInput
                      id="confirmPassword"
                      label="Confirm password"
                      type="password"
                      placeholder="Confirm your new password"
                      autoComplete="new-password"
                      passwordToggle
                      value={values.confirmPassword}
                      onChange={(value) =>
                        updateField(
                          "confirmPassword",
                          value,
                        )
                      }
                      disabled={loading}
                    />

                    {/* ==================== Password Hint ==================== */}

                    <p className="text-[11px] leading-5 text-[#829B90]">
                      Use 8–128 characters with uppercase,
                      lowercase, a number and a special
                      character.
                    </p>
                  </>
                )}

                {/* ==================== Error State ==================== */}

                {error != null && (
                  <div
                    role="alert"
                    aria-live="assertive"
                  >
                    <ErrorBox error={error} />
                  </div>
                )}

                {/* ==================== Submit Button ==================== */}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-[51px] w-full items-center justify-center gap-2 rounded-xl bg-[#24655F] px-5 text-[13px] font-semibold text-white shadow-[0_5px_14px_rgba(36,101,95,0.14)] transition-all duration-200 hover:bg-[#2D5752] hover:shadow-[0_7px_18px_rgba(36,101,95,0.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#538B7E] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                      Processing...
                    </>
                  ) : (
                    <>
                      {config.submit}
                      <ArrowRight
                        size={17}
                        strokeWidth={1.8}
                      />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ==================== Login Preview ==================== */}

            {mode === "login" && !message && (
              <div className="mt-9">
                {/* ==================== Divider ==================== */}

                <div className="relative mb-7 flex items-center justify-center">
                  <div className="absolute inset-x-0 h-px bg-[#E5EEE8]" />

                  <span className="relative bg-white px-4 text-[10px] text-[#91A79B]">
                    Or explore without signing in
                  </span>
                </div>

                {/* ==================== Preview Button ==================== */}

                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={loading}
                  className="flex h-[49px] w-full items-center justify-center gap-2 rounded-xl border border-[#D7E6DC] bg-[#EDF5F1] text-[12px] font-semibold text-[#24655F] transition-all duration-200 hover:border-[#BFD8C9] hover:bg-[#E3F0E8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#538B7E] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Explore design preview
                  <ArrowUpRight
                    size={16}
                    strokeWidth={1.8}
                  />
                </button>

                <p className="mt-3 text-center text-[10px] text-[#93A39D]">
                  Sample data only. No account required.
                </p>
              </div>
            )}

            {/* ==================== Back Navigation ==================== */}

            {mode !== "login" && !message && (
              <Link
                to="/login"
                className="mt-8 inline-flex items-center gap-2 text-[12px] font-medium text-[#24655F] transition-colors hover:text-[#538B7E] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#538B7E]"
              >
                <ArrowRight
                  size={15}
                  className="rotate-180"
                />
                Back to sign in
              </Link>
            )}

            {/* ==================== Server Status ==================== */}

            {mode === "login" && (
              <div className="mt-8">
                <ServerStatus />
              </div>
            )}

            {/* ==================== Preview Error ==================== */}

            {mode === "login" &&
              error != null &&
              message === "" && (
                <div className="mt-3">
                  {/* Errors are displayed inside the form */}
                </div>
              )}
          </div>
        </div>

        {/* ==================== Form Footer ==================== */}

        <footer className="flex flex-wrap items-center justify-center gap-2 text-center text-[10px] text-[#93A39D]">
          <ShieldCheck
            size={14}
            className="text-[#538B7E]"
          />

          <span>
            Authorized personnel only · SINUORA Workspace
          </span>
        </footer>
      </section>
    </main>
  );
}
