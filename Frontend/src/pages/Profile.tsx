import { useState } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { roleLabel } from "../lib/utils";
import { PageTitle, FieldsForm, Button, ErrorBox } from "../components/ui";
export default function Profile() {
  const { user, reload } = useAuth();
  const [emailStep, setEmailStep] = useState(false),
    [passwordStep, setPasswordStep] = useState(false),
    [error, setError] = useState<unknown>(null);
  return (
    <>
      <PageTitle
        title="My profile"
        description="Your details and account security, in one place."
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
                "profile-summary flex items-center gap-[17px] mb-[22px] [&_h2]:mb-[5px] [&_p]:m-0"
              }
            >
              {user?.avatar?.url ? (
                <img
                  className={
                    "profile-photo w-[60px] h-[60px] rounded-full object-cover"
                  }
                  src={user.avatar.url}
                  alt="Profile"
                />
              ) : (
                <span
                  className={
                    "avatar inline-flex items-center justify-center w-[35px] h-[35px] rounded-full bg-[#e8f1ef] text-primary font-[650] shrink-0 [&.large]:h-[58px] [&.large]:w-[58px] [&.large]:text-[22px] large"
                  }
                >
                  {user?.fullName[0]}
                </span>
              )}
              <div>
                <h2>{user?.fullName}</h2>
                <p className={"muted text-muted-foreground font-normal"}>
                  {roleLabel(user!.role)}
                </p>
              </div>
            </div>
            <FieldsForm
              submit="Update profile"
              fields={[
                {
                  name: "fullName",
                  label: "Full name",
                  required: true,
                  value: user?.fullName,
                },
                { name: "phone", label: "Phone number", value: user?.phone },
                { name: "avatar", label: "Profile image", type: "file" },
              ]}
              onSubmit={async (data) => {
                if (!data.get("phone")) data.delete("phone");
                const file = data.get("avatar");
                if (file instanceof File && !file.size) data.delete("avatar");
                await api("/users/profile", { method: "PATCH", body: data });
                await reload();
              }}
            />
            {user?.avatar?.url && (
              <Button
                variant="ghost"
                onClick={() =>
                  void api("/users/profile/image", { method: "DELETE" })
                    .then(reload)
                    .catch(setError)
                }
              >
                Remove profile image
              </Button>
            )}
            {error != null && <ErrorBox error={error} />}
          </section>
        </div>
        <aside>
          <section
            className={
              "panel bg-white [border:1px_solid_var(--border)] rounded-[11px] overflow-hidden min-w-0 mb-[22px] max-[768px]:mb-[18px] padded [padding:25px] [&_h2]:flex [&_h2]:items-center [&_h2]:gap-[8px] [&_h2]:mb-[21px] [&_p]:text-[12px] [&_small]:block max-[768px]:[padding:20px]"
            }
          >
            <h2>Change email</h2>
            <p className={"muted text-muted-foreground font-normal"}>
              Current: {user?.email}
            </p>
            <FieldsForm
              key={String(emailStep)}
              submit={emailStep ? "Verify new email" : "Send verification code"}
              fields={
                emailStep
                  ? [
                      {
                        name: "verificationCode",
                        label: "6-digit verification code",
                        required: true,
                      },
                    ]
                  : [
                      {
                        name: "newEmail",
                        label: "New email",
                        type: "email",
                        required: true,
                      },
                      {
                        name: "currentPassword",
                        label: "Current password",
                        type: "password",
                        required: true,
                      },
                    ]
              }
              onSubmit={async (data) => {
                await api(
                  `/users/profile/email-change/${emailStep ? "verify" : "request"}`,
                  { method: "POST", body: Object.fromEntries(data) },
                );
                if (emailStep) {
                  await reload();
                } else setEmailStep(true);
              }}
            />
          </section>
          <section
            className={
              "panel bg-white [border:1px_solid_var(--border)] rounded-[11px] overflow-hidden min-w-0 mb-[22px] max-[768px]:mb-[18px] padded [padding:25px] [&_h2]:flex [&_h2]:items-center [&_h2]:gap-[8px] [&_h2]:mb-[21px] [&_p]:text-[12px] [&_small]:block max-[768px]:[padding:20px]"
            }
          >
            <h2>Change password</h2>
            <p className={"muted text-muted-foreground font-normal"}>
              A verification code will be sent to your email. Changing your
              password ends your session.
            </p>
            <FieldsForm
              key={String(passwordStep)}
              submit={
                passwordStep
                  ? "Verify & change password"
                  : "Send verification code"
              }
              fields={
                passwordStep
                  ? [
                      {
                        name: "verificationCode",
                        label: "6-digit verification code",
                        required: true,
                      },
                      {
                        name: "newPassword",
                        label: "New password",
                        type: "password",
                        required: true,
                        hint: "8–128 characters: uppercase, lowercase, number and special character.",
                      },
                      {
                        name: "confirmPassword",
                        label: "Confirm password",
                        type: "password",
                        required: true,
                      },
                    ]
                  : [
                      {
                        name: "currentPassword",
                        label: "Current password",
                        type: "password",
                        required: true,
                      },
                    ]
              }
              onSubmit={async (data) => {
                if (
                  passwordStep &&
                  data.get("newPassword") !== data.get("confirmPassword")
                )
                  throw new Error("Passwords do not match.");
                await api(
                  `/auth/change-password/${passwordStep ? "verify" : "request"}`,
                  { method: "POST", body: Object.fromEntries(data) },
                );
                if (passwordStep) await reload();
                else setPasswordStep(true);
              }}
            />
          </section>
        </aside>
      </div>
    </>
  );
}
