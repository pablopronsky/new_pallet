"use client";

import { useMemo, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SimpleTable, type SimpleColumn } from "@/components/ui/Table";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts";
import { useDistribution } from "@/hooks/useDistribution";
import {
  useAudits,
  type CreateAuditItemInput,
  type UseAuditsResult,
} from "@/hooks/useAudits";
import { BRANCHES, BRANCH_LABELS } from "@/lib/constants";
import { getErrorMessage, logError } from "@/lib/errors";
import { formatDateAR } from "@/lib/formatters";
import type {
  Audit,
  AuditItem,
  Branch,
  Product,
  ProductDistribution,
} from "@/types/domain";

type CellKey = `${string}:${Branch}`;
const cellKey = (productId: string, branch: Branch): CellKey =>
  `${productId}:${branch}`;

interface CellDraft {
  counted: string;
  notas: string;
}

function emptyDraft(): CellDraft {
  return { counted: "", notas: "" };
}

// ---------------------------------------------------------------------------
// Feedback banner
// ---------------------------------------------------------------------------

function FeedbackBanner({
  message,
  tone,
}: {
  message: string;
  tone: "success" | "error";
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        tone === "success"
          ? "border-primary/35 bg-primary/12 text-primary-light"
          : "border-red-500/30 bg-red-500/10 text-red-400"
      }`}
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit form
// ---------------------------------------------------------------------------

interface AuditFormProps {
  products: Product[];
  productsLoading: boolean;
  byProductId: Record<string, ProductDistribution>;
  distLoading: boolean;
  defaultBranch: Branch;
  auditState: Pick<
    UseAuditsResult,
    "createAudit" | "submitting" | "error"
  >;
}

function AuditForm({
  products,
  productsLoading,
  byProductId,
  distLoading,
  defaultBranch,
  auditState,
}: AuditFormProps) {
  const { createAudit, submitting, error } = auditState;
  const [selectedBranch, setSelectedBranch] = useState<Branch>(defaultBranch);
  const [drafts, setDrafts] = useState<Record<CellKey, CellDraft>>({});
  const [generalNotas, setGeneralNotas] = useState("");
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loading = productsLoading || distLoading;

  function getDraft(productId: string, branch: Branch): CellDraft {
    return drafts[cellKey(productId, branch)] ?? emptyDraft();
  }

  function updateDraft(
    productId: string,
    branch: Branch,
    patch: Partial<CellDraft>,
  ) {
    const key = cellKey(productId, branch);
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? emptyDraft()), ...patch },
    }));
  }

  function systemBoxes(productId: string, branch: Branch): number {
    return byProductId[productId]?.cajasPorSucursal[branch] ?? 0;
  }

  function computeDifference(
    productId: string,
    branch: Branch,
  ): number | null {
    const raw = getDraft(productId, branch).counted.trim();
    if (!raw) return null;
    const n = parseInt(raw, 10);
    if (isNaN(n)) return null;
    return n - systemBoxes(productId, branch);
  }

  async function handleSubmit() {
    setFormError(null);
    const items: CreateAuditItemInput[] = [];
    const missing: string[] = [];

    for (const product of products) {
      const d = getDraft(product.id, selectedBranch);
      const raw = d.counted.trim();
      const cajasSistema = systemBoxes(product.id, selectedBranch);
      const notas = d.notas.trim();
      if (!raw) {
        if (cajasSistema > 0) {
          missing.push(`${product.nombre} / ${BRANCH_LABELS[selectedBranch]}`);
          continue;
        }
        continue;
      }
      const n = parseInt(raw, 10);
      if (
        !Number.isFinite(n) ||
        !Number.isInteger(n) ||
        n < 0 ||
        String(n) !== raw
      ) {
        setFormError(
          `Valor inválido para ${product.nombre} / ${BRANCH_LABELS[selectedBranch]}: debe ser un entero >= 0`,
        );
        return;
      }
      items.push({
        productId: product.id,
        sucursal: selectedBranch,
        cajasSistema,
        cajasContadas: n,
        ...(notas ? { notas } : {}),
      });
    }

    if (missing.length > 0) {
      setFormError(
        `Faltan cajas contadas para: ${missing.join(", ")}`,
      );
      return;
    }

    if (items.length === 0) {
      setFormError("No hay productos activos para auditar.");
      return;
    }

    try {
      await createAudit({
        sucursal: selectedBranch,
        items,
        ...(generalNotas.trim() ? { notas: generalNotas.trim() } : {}),
      });
      setDrafts({});
      setGeneralNotas("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    } catch (err) {
      logError("guardar auditoría", err);
      setFormError(getErrorMessage(err, "No se pudo guardar la auditoría."));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva auditoría</CardTitle>
        {loading && (
          <span className="text-xs text-text-muted">Cargando…</span>
        )}
      </CardHeader>

      <p className="mb-4 text-xs text-text-muted">
        Ingrese las cajas contadas físicamente para una sucursal. El sistema las
        compara con el stock actual, pero no modifica stock ni registra ventas.
      </p>

      <div className="mb-4 max-w-xs">
        <Select
          label="Sucursal auditada"
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value as Branch)}
          disabled={submitting}
          options={BRANCHES.map((branch) => ({
            value: branch,
            label: BRANCH_LABELS[branch],
          }))}
        />
      </div>

      <div className="mb-3 flex flex-col gap-2">
        {success && (
          <FeedbackBanner
            message="Auditoría registrada correctamente."
            tone="success"
          />
        )}
        {formError && <FeedbackBanner message={formError} tone="error" />}
        {error && (
          <FeedbackBanner
            message={getErrorMessage(error, "No se pudo guardar la auditoría.")}
            tone="error"
          />
        )}
      </div>

      {!loading && (
        <div className="w-full max-w-full overflow-x-auto rounded-xl border border-border shadow-[inset_-16px_0_16px_-18px_rgba(255,255,255,0.35)]">
          <table className="min-w-max w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Sucursal</th>
                <th className="px-4 py-3 font-medium text-right">Sistema</th>
                <th className="px-4 py-3 font-medium text-right">Contadas</th>
                <th className="px-4 py-3 font-medium text-right">Diferencia</th>
                <th className="px-4 py-3 font-medium">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-text-muted"
                  >
                    Sin productos activos
                  </td>
                </tr>
              )}
              {products.map((product) => {
                  const draft = getDraft(product.id, selectedBranch);
                  const sys = systemBoxes(product.id, selectedBranch);
                  const diff = computeDifference(product.id, selectedBranch);
                  return (
                    <tr
                      key={cellKey(product.id, selectedBranch)}
                      className="hover:bg-surface-2/60 transition-colors"
                    >
                      <td className="px-4 py-2 font-medium text-text-primary">
                        {product.nombre}
                      </td>
                      <td className="px-4 py-2 text-text-secondary">
                        {BRANCH_LABELS[selectedBranch]}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {sys}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={draft.counted}
                          disabled={submitting}
                          placeholder={sys === 0 ? "0" : undefined}
                          onChange={(e) =>
                            updateDraft(product.id, selectedBranch, {
                              counted: e.target.value,
                            })
                          }
                          className="min-h-11 w-28 rounded-xl border border-border bg-surface-2 px-3 text-right text-base tabular-nums text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 sm:text-sm"
                        />
                        {sys === 0 && (
                          <span className="mt-1 block text-right text-[11px] text-text-muted">
                            Sin stock según sistema
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {diff === null ? (
                          <span className="text-text-muted">—</span>
                        ) : diff === 0 ? (
                          <Badge tone="success">0</Badge>
                        ) : (
                          <Badge tone={diff > 0 ? "warning" : "error"}>
                            {diff > 0 ? `+${diff}` : String(diff)}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={draft.notas}
                          disabled={submitting}
                          placeholder="Opcional"
                          onChange={(e) =>
                            updateDraft(product.id, selectedBranch, {
                              notas: e.target.value,
                            })
                          }
                          className="min-h-11 w-full min-w-[10rem] rounded-xl border border-border bg-surface-2 px-3 text-base text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 sm:text-sm"
                        />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-secondary">
            Notas generales
          </span>
          <textarea
            value={generalNotas}
            onChange={(e) => setGeneralNotas(e.target.value)}
            disabled={submitting}
            rows={2}
            className="min-h-24 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 sm:text-sm"
            placeholder="Comentarios sobre la auditoría (opcional)"
          />
        </label>

        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={submitting || loading}
            className="w-full sm:w-auto"
          >
            {submitting ? "Guardando…" : "Registrar auditoría"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Recent audits
// ---------------------------------------------------------------------------

interface AuditSummaryRow {
  audit: Audit;
  differenceCount: number;
}

interface RecentAuditsProps {
  auditState: Pick<UseAuditsResult, "audits" | "loading" | "error">;
  productById: Record<string, Product>;
}

function auditStatus(audit: Audit): {
  label: "Sin diferencias" | "Con diferencias" | "Resuelta";
  tone: "success" | "warning" | "neutral";
} {
  if (audit.resuelta) return { label: "Resuelta", tone: "neutral" };
  return audit.items.some((item) => item.diferencia !== 0)
    ? { label: "Con diferencias", tone: "warning" }
    : { label: "Sin diferencias", tone: "success" };
}

function formatDifference(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function auditBranchLabel(audit: Audit): string {
  return audit.sucursal ? BRANCH_LABELS[audit.sucursal] : "Todas";
}

function RecentAudits({ auditState, productById }: RecentAuditsProps) {
  const { audits, loading, error } = auditState;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const rows: AuditSummaryRow[] = useMemo(
    () =>
      audits.map((audit) => ({
        audit,
        differenceCount: audit.items.filter((item) => item.diferencia !== 0)
          .length,
      })),
    [audits],
  );

  function toggleExpanded(auditId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(auditId)) {
        next.delete(auditId);
      } else {
        next.add(auditId);
      }
      return next;
    });
  }

  const columns: SimpleColumn<AuditSummaryRow>[] = [
    {
      key: "fecha",
      header: "Fecha",
      render: (r) => (
        <span className="text-text-secondary">
          {formatDateAR(r.audit.fecha.toDate())}
        </span>
      ),
    },
    {
      key: "sucursal",
      header: "Sucursal auditada",
      render: (r) => auditBranchLabel(r.audit),
    },
    {
      key: "createdBy",
      header: "Creado por",
      render: (r) => (
        <span className="font-mono text-xs text-text-secondary">
          {r.audit.createdBy}
        </span>
      ),
    },
    {
      key: "items",
      header: "Items",
      className: "text-right",
      render: (r) => (
        <span className="tabular-nums">{r.audit.items.length}</span>
      ),
    },
    {
      key: "differences",
      header: "Diferencias",
      className: "text-right",
      render: (r) => (
        <span className="tabular-nums">{r.differenceCount}</span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (r) => {
        const status = auditStatus(r.audit);
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
    {
      key: "notas",
      header: "Notas",
      render: (r) =>
        r.audit.notas ? (
          <span className="text-text-secondary">{r.audit.notas}</span>
        ) : (
          <span className="text-text-muted">-</span>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) => {
        const expanded = expandedIds.has(r.audit.id);
        return (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => toggleExpanded(r.audit.id)}
          >
            {expanded ? "Ocultar" : "Ver detalle"}
          </Button>
        );
      },
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auditorías recientes</CardTitle>
        {loading && (
          <span className="text-xs text-text-muted">Cargando...</span>
        )}
      </CardHeader>

      {error && (
        <div className="mb-3">
          <FeedbackBanner
            message={getErrorMessage(error, "No se pudieron cargar las auditorías.")}
            tone="error"
          />
        </div>
      )}

      <SimpleTable<AuditSummaryRow>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.audit.id}
        empty="Sin auditorías registradas"
      />

      {rows
        .filter((row) => expandedIds.has(row.audit.id))
        .map((row) => (
          <div
            key={row.audit.id}
            className="mt-4 rounded-xl border border-border bg-surface-2/40 p-4"
          >
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Detalle de auditoría
                </p>
                <p className="text-xs text-text-muted">
                  {formatDateAR(row.audit.fecha.toDate())} ·{" "}
                  {auditBranchLabel(row.audit)}
                </p>
              </div>
              {row.differenceCount === 0 && (
                <Badge tone="success">Auditoría sin diferencias.</Badge>
              )}
            </div>

            {row.differenceCount === 0 && (
              <p className="mb-3 text-sm text-text-secondary">
                Auditoría sin diferencias.
              </p>
            )}

            <SimpleTable<AuditItem>
              columns={[
                {
                  key: "producto",
                  header: "Producto",
                  render: (item) => (
                    <span className="font-medium text-text-primary">
                      {productById[item.productId]?.nombre ?? item.productId}
                    </span>
                  ),
                },
                {
                  key: "sucursal",
                  header: "Sucursal",
                  render: (item) => BRANCH_LABELS[item.sucursal],
                },
                {
                  key: "sistema",
                  header: "Sistema",
                  className: "text-right",
                  render: (item) => (
                    <span className="tabular-nums">{item.cajasSistema}</span>
                  ),
                },
                {
                  key: "contadas",
                  header: "Contadas",
                  className: "text-right",
                  render: (item) => (
                    <span className="tabular-nums">{item.cajasContadas}</span>
                  ),
                },
                {
                  key: "diferencia",
                  header: "Diferencia",
                  className: "text-right",
                  render: (item) =>
                    item.diferencia === 0 ? (
                      <Badge tone="success">0</Badge>
                    ) : (
                      <Badge tone={item.diferencia > 0 ? "warning" : "error"}>
                        {formatDifference(item.diferencia)}
                      </Badge>
                    ),
                },
                {
                  key: "notas",
                  header: "Notas",
                  render: (item) =>
                    item.notas ? (
                      <span className="text-text-secondary">{item.notas}</span>
                    ) : (
                      <span className="text-text-muted">-</span>
                    ),
                },
              ]}
              rows={row.audit.items}
              rowKey={(item) => `${item.productId}:${item.sucursal}`}
              empty="Auditoría sin diferencias."
            />
          </div>
        ))}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Admin alerts
// ---------------------------------------------------------------------------

interface AlertRow {
  audit: Audit;
  item: AuditItem;
  key: string;
}

interface AdminAlertsProps {
  auditState: Pick<
    UseAuditsResult,
    "audits" | "loading" | "markAuditResolved" | "resolvingIds" | "error"
  >;
  productById: Record<string, Product>;
}

function AdminAlerts({ auditState, productById }: AdminAlertsProps) {
  const { audits, loading, markAuditResolved, resolvingIds, error } = auditState;
  const rows: AlertRow[] = useMemo(() => {
    const out: AlertRow[] = [];
    for (const audit of audits) {
      if (audit.resuelta) continue;
      for (let i = 0; i < audit.items.length; i++) {
        const item = audit.items[i];
        if (item.diferencia !== 0) {
          out.push({ audit, item, key: `${audit.id}:${i}` });
        }
      }
    }
    return out;
  }, [audits]);

  const columns: SimpleColumn<AlertRow>[] = [
    {
      key: "fecha",
      header: "Fecha",
      render: (r) => (
        <span className="text-text-secondary">
          {formatDateAR(r.audit.fecha.toDate())}
        </span>
      ),
    },
    {
      key: "producto",
      header: "Producto",
      render: (r) => (
        <span className="font-medium text-text-primary">
          {productById[r.item.productId]?.nombre ?? r.item.productId}
        </span>
      ),
    },
    {
      key: "sucursal",
      header: "Sucursal",
      render: (r) => BRANCH_LABELS[r.item.sucursal],
    },
    {
      key: "sistema",
      header: "Sistema",
      className: "text-right",
      render: (r) => (
        <span className="tabular-nums">{r.item.cajasSistema}</span>
      ),
    },
    {
      key: "contadas",
      header: "Contadas",
      className: "text-right",
      render: (r) => (
        <span className="tabular-nums">{r.item.cajasContadas}</span>
      ),
    },
    {
      key: "diferencia",
      header: "Diferencia",
      className: "text-right",
      render: (r) => (
        <Badge tone={r.item.diferencia > 0 ? "warning" : "error"}>
          {r.item.diferencia > 0
            ? `+${r.item.diferencia}`
            : String(r.item.diferencia)}
        </Badge>
      ),
    },
    {
      key: "notas",
      header: "Notas",
      render: (r) =>
        r.item.notas ? (
          <span className="text-text-secondary">{r.item.notas}</span>
        ) : r.audit.notas ? (
          <span className="text-text-muted italic">{r.audit.notas}</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) => {
        const resolving = resolvingIds.has(r.audit.id);
        return (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              markAuditResolved(r.audit.id).catch((err) => {
                logError("marcar auditoría resuelta", err);
              });
            }}
            disabled={resolving}
          >
            {resolving ? "…" : "Marcar auditoría como resuelta"}
          </Button>
        );
      },
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Alertas sin resolver
          <Badge
            tone={rows.length > 0 ? "error" : "neutral"}
            className="ml-2"
          >
            {rows.length}
          </Badge>
        </CardTitle>
        {loading && (
          <span className="text-xs text-text-muted">Cargando…</span>
        )}
      </CardHeader>

      {error && (
        <div className="mb-3">
          <FeedbackBanner
            message={getErrorMessage(error, "No se pudieron cargar las auditorías.")}
            tone="error"
          />
        </div>
      )}

      <SimpleTable<AlertRow>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.key}
        empty="Sin diferencias sin resolver"
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function AuditoriasContent() {
  const { role, profile } = useAuth();
  const auditState = useAudits();
  const { products, loading: productsLoading } = useProducts({
    activeOnly: role !== "admin",
  });
  const { byProductId, loading: distLoading } = useDistribution();

  const activeProducts = useMemo(
    () => (role === "admin" ? products.filter((p) => p.activo) : products),
    [products, role],
  );

  const productById = useMemo<Record<string, Product>>(() => {
    const map: Record<string, Product> = {};
    for (const p of products) map[p.id] = p;
    return map;
  }, [products]);

  return (
    <div className="flex flex-col gap-8">
      <AuditForm
        products={activeProducts}
        productsLoading={productsLoading}
        byProductId={byProductId}
        distLoading={distLoading}
        defaultBranch={profile?.sucursalAsignada ?? "gonnet"}
        auditState={auditState}
      />
      <RecentAudits auditState={auditState} productById={productById} />
      <RoleGuard allowedRoles={["admin"]} fallback={null}>
        <AdminAlerts auditState={auditState} productById={productById} />
      </RoleGuard>
    </div>
  );
}

export default function AuditoriasPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Auditorías</h1>
        <p className="text-sm text-text-secondary">
          Conteo físico vs. stock del sistema
        </p>
      </div>

      <div className="mt-6">
        <RoleGuard allowedRoles={["admin", "controlador"]}>
          <AuditoriasContent />
        </RoleGuard>
      </div>
    </>
  );
}
