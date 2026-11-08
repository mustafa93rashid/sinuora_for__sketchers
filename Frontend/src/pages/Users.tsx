import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, query } from "../lib/api";
import { useAuth } from "../lib/auth";
import { roleLabel } from "../lib/utils";
import type { User, Role } from "../lib/types";
import {
  PageTitle,
  Button,
  Loading,
  ErrorBox,
  Pager,
  Modal,
  FieldsForm,
  Badge,
} from "../components/ui";
import { DataTable } from "../components/DataTable";
const roles: Role[] = ["superadmin", "manager", "saler", "follow-up"];
export default function Users() {
  const { user } = useAuth(),
    cache = useQueryClient();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState(""),
    [selected, setSelected] = useState<User | null>(null);
  const result = useQuery({
    queryKey: ["users", page, search],
    queryFn: () => api<User[]>(`/users${query({ page, search, limit: 15 })}`),
  });
  const done = () => {
    void cache.invalidateQueries();
    setModal("");
  };
  return (
    <>
      <PageTitle
        title="Your team"
        description="The people who keep everything moving."
        action={
          user?.role === "superadmin" && (
            <Button onClick={() => setModal("create")}>
              <Plus size={17} />
              Invite member
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
          <input
            aria-label="Search team"
            placeholder="Search name, email or phone…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {result.isPending ? (
          <Loading />
        ) : result.error ? (
          <ErrorBox error={result.error} />
        ) : (
          <>
            <DataTable
              rows={result.data.data}
              columns={[
                {
                  header: "Team member",
                  cell: ({ row }) => (
                    <div>
                      <strong>{row.original.fullName}</strong>
                      <small>{row.original.email}</small>
                    </div>
                  ),
                },
                {
                  header: "Role",
                  cell: ({ row }) => roleLabel(row.original.role),
                },
                {
                  header: "Status",
                  cell: ({ row }) => (
                    <Badge>
                      {!row.original.isAccountActivated
                        ? "Pending activation"
                        : row.original.isActive
                          ? "Active"
                          : "Inactive"}
                    </Badge>
                  ),
                },
                ...(user?.role === "superadmin"
                  ? [
                      {
                        header: "Actions",
                        cell: ({ row }: { row: { original: User } }) => (
                          <div
                            className={
                              "inline-actions flex gap-[5px] items-center flex-wrap [&_.btn]:text-[10px] [&_.btn]:min-h-[35px] max-[768px]:gap-[8px] max-[768px]:[&_.btn]:min-h-[42px]"
                            }
                          >
                            {["role", "status", "delete"].map((action) => (
                              <Button
                                key={action}
                                variant={
                                  action === "delete" ? "danger" : "ghost"
                                }
                                disabled={row.original._id === user._id}
                                onClick={() => {
                                  setSelected(row.original);
                                  setModal(action);
                                }}
                              >
                                {action === "role"
                                  ? "Change role"
                                  : action === "status"
                                    ? row.original.isActive
                                      ? "Deactivate"
                                      : "Activate"
                                    : "Delete"}
                              </Button>
                            ))}
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
              onChange={setPage}
            />
          </>
        )}
      </section>
      <Modal
        open={!!modal}
        onOpenChange={(v) => !v && setModal("")}
        title={
          modal === "create"
            ? "Invite team member"
            : modal === "role"
              ? "Change role"
              : modal === "delete"
                ? "Delete team member"
                : "Change account status"
        }
      >
        <FieldsForm
          key={`${modal}-${selected?._id}`}
          fields={
            modal === "create"
              ? [
                  { name: "fullName", label: "Full name", required: true },
                  {
                    name: "email",
                    label: "Email address",
                    type: "email",
                    required: true,
                  },
                  {
                    name: "role",
                    label: "Role",
                    value: "saler",
                    options: roles.map((r) => ({
                      value: r,
                      label: roleLabel(r),
                    })),
                  },
                ]
              : modal === "role"
                ? [
                    {
                      name: "role",
                      label: "Role",
                      value: selected?.role,
                      options: roles.map((r) => ({
                        value: r,
                        label: roleLabel(r),
                      })),
                    },
                  ]
                : []
          }
          submit={
            modal === "create" ? "Send activation email" : "Confirm change"
          }
          onSubmit={async (data) => {
            const path =
              modal === "create"
                ? "/users"
                : `/users/${selected!._id}${modal === "delete" ? "" : `/${modal}`}`;
            await api(path, {
              method:
                modal === "create"
                  ? "POST"
                  : modal === "delete"
                    ? "DELETE"
                    : "PATCH",
              body:
                modal === "delete"
                  ? undefined
                  : modal === "status"
                    ? { isActive: !selected!.isActive }
                    : Object.fromEntries(data),
            });
            done();
          }}
        >
          {modal === "create" ? (
            <p className={"muted text-muted-foreground font-normal"}>
              They’ll receive an email to set their password and activate their
              account.
            </p>
          ) : (
            <p>
              {selected?.fullName}
              {modal === "delete"
                ? " will be deactivated and retained for audit history."
                : ": this change may end their current session."}
            </p>
          )}
        </FieldsForm>
      </Modal>
    </>
  );
}
