"use client";

import { useMemo, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SimpleTable, type SimpleColumn } from "@/components/ui/Table";
import { useAuth } from "@/hooks/useAuth";
import { useManageUsers } from "@/hooks/useManageUsers";
import { BRANCHES, BRANCH_LABELS } from "@/lib/constants";
import type { Branch, Role, UserProfile } from "@/types/domain";

interface EditFormState {
  uid: string;
  email: string;
  nombre: string;
  role: Role;
  sucursalAsignada: Branch | "";
  activo: boolean;
}

const roleOptions: { value: Role; label: string }[] = [
  { value: "admin", label: "admin" },
  { value: "controlador", label: "controlador" },
  { value: "vendedor", label: "vendedor" },
  { value: "allcovering", label: "allcovering" },
];

const branchOptions = [
  { value: "", label: "Sin sucursal" },
  ...BRANCHES.map((branch) => ({
    value: branch,
    label: BRANCH_LABELS[branch],
  })),
];

function formFromUser(user: UserProfile): EditFormState {
  return {
    uid: user.uid,
    email: user.email,
    nombre: user.nombre ?? "",
    role: user.role,
    sucursalAsignada: user.sucursalAsignada ?? "",
    activo: user.activo,
  };
}

function roleBadgeTone(role: Role): "primary" | "warning" | "success" | "neutral" {
  if (role === "admin") return "primary";
  if (role === "controlador") return "warning";
  if (role === "vendedor") return "success";
  return "neutral";
}

function UsuariosContent() {
  const { user: currentUser } = useAuth();
  const { users, loading, error, updateUserProfile, submitting } =
    useManageUsers();
  const [editing, setEditing] = useState<EditFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) =>
        (a.email || a.uid).localeCompare(b.email || b.uid),
      ),
    [users],
  );

  const columns = useMemo<SimpleColumn<UserProfile>[]>(
    () => [
      {
        key: "nombre",
        header: "Nombre",
        render: (profile) => (
          <span className="font-medium text-text-primary">
            {profile.nombre || "-"}
          </span>
        ),
      },
      {
        key: "email",
        header: "Email",
        render: (profile) => (
          <span className="text-text-secondary">{profile.email}</span>
        ),
      },
      {
        key: "role",
        header: "Rol",
        render: (profile) => (
          <Badge tone={roleBadgeTone(profile.role)}>{profile.role}</Badge>
        ),
      },
      {
        key: "sucursal",
        header: "Sucursal asignada",
        render: (profile) =>
          profile.sucursalAsignada ? (
            <Badge tone="neutral">{BRANCH_LABELS[profile.sucursalAsignada]}</Badge>
          ) : (
            <span className="text-text-muted">-</span>
          ),
      },
      {
        key: "activo",
        header: "Activo",
        render: (profile) => (
          <Badge tone={profile.activo ? "success" : "error"}>
            {profile.activo ? "Sí" : "No"}
          </Badge>
        ),
      },
      {
        key: "uid",
        header: "UID",
        render: (profile) => (
          <span className="font-mono text-xs text-text-muted">
            {profile.uid}
          </span>
        ),
      },
      {
        key: "acciones",
        header: "Acciones",
        className: "text-right",
        render: (profile) => (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(formFromUser(profile));
              setFormError(null);
              setSuccess(null);
            }}
          >
            Editar
          </Button>
        ),
      },
    ],
    [],
  );

  function update<K extends keyof EditFormState>(
    key: K,
    value: EditFormState[K],
  ) {
    setEditing((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    setFormError(null);
    setSuccess(null);

    if (editing.role === "vendedor" && !editing.sucursalAsignada) {
      setFormError("La sucursal asignada es obligatoria para vendedor.");
      return;
    }

    if (editing.uid === currentUser?.uid) {
      if (editing.role !== "admin") {
        setFormError("No podés quitarte tu propio rol admin desde esta pantalla.");
        return;
      }
      if (!editing.activo) {
        setFormError("No podés desactivar tu propio usuario admin.");
        return;
      }
    }

    try {
      await updateUserProfile(editing.uid, {
        nombre: editing.nombre,
        role: editing.role,
        activo: editing.activo,
        ...(editing.role === "vendedor" && editing.sucursalAsignada
          ? { sucursalAsignada: editing.sucursalAsignada }
          : {}),
      });
      setSuccess("Perfil actualizado.");
      setEditing(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "No se pudo actualizar el perfil.",
      );
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Perfiles</CardTitle>
          {loading && <span className="text-xs text-text-muted">Cargando...</span>}
        </CardHeader>

        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            Esta pantalla modifica permisos de la app, no usuarios de Firebase
            Authentication.
          </p>
          <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-secondary">
            Para crear usuarios nuevos, usar npm run setup:users o Firebase
            Authentication.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error.message}
          </p>
        )}
        {success && (
          <p className="mb-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
            {success}
          </p>
        )}

        <SimpleTable<UserProfile>
          columns={columns}
          rows={sortedUsers}
          rowKey={(profile) => profile.uid}
          empty={loading ? "Cargando..." : "Sin usuarios registrados"}
        />
      </Card>

      {editing && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Editar perfil</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormError(null);
              }}
            >
              Cancelar
            </Button>
          </CardHeader>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Email"
                name="email"
                value={editing.email}
                readOnly
                hint="El email de Firebase Authentication no se modifica acá."
              />
              <Input
                label="UID"
                name="uid"
                value={editing.uid}
                readOnly
              />
              <Input
                label="Nombre"
                name="nombre"
                value={editing.nombre}
                onChange={(event) => update("nombre", event.target.value)}
                disabled={submitting}
              />
              <Select
                label="Rol"
                name="role"
                value={editing.role}
                onChange={(event) => {
                  const role = event.target.value as Role;
                  setEditing((current) =>
                    current
                      ? {
                          ...current,
                          role,
                          sucursalAsignada:
                            role === "vendedor" ? current.sucursalAsignada : "",
                        }
                      : current,
                  );
                }}
                options={roleOptions}
                disabled={submitting}
              />
              <Select
                label="Sucursal asignada"
                name="sucursalAsignada"
                value={editing.sucursalAsignada}
                onChange={(event) =>
                  update(
                    "sucursalAsignada",
                    event.target.value as Branch | "",
                  )
                }
                options={branchOptions}
                disabled={submitting || editing.role !== "vendedor"}
                required={editing.role === "vendedor"}
                hint={
                  editing.role === "vendedor"
                    ? "Obligatoria para vendedores."
                    : "Se limpia automáticamente si el rol no es vendedor."
                }
              />
              <Select
                label="Activo"
                name="activo"
                value={editing.activo ? "true" : "false"}
                onChange={(event) =>
                  update("activo", event.target.value === "true")
                }
                options={[
                  { value: "true", label: "Activo" },
                  { value: "false", label: "Inactivo" },
                ]}
                disabled={submitting}
              />
            </div>

            {formError && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {formError}
              </p>
            )}

            <div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Guardando..." : "Guardar perfil"}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}

export default function UsuariosPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <p className="text-sm text-text-secondary">
          Administración de perfiles y permisos
        </p>
      </div>

      <div className="mt-6">
        <RoleGuard allowedRoles={["admin"]}>
          <UsuariosContent />
        </RoleGuard>
      </div>
    </>
  );
}
