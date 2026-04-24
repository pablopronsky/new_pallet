"use client";

import { useMemo, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SimpleTable, type SimpleColumn } from "@/components/ui/Table";
import { useProducts } from "@/hooks/useProducts";
import { useDistribution } from "@/hooks/useDistribution";
import {
  useAudits,
  type CreateAuditItemInput,
} from "@/hooks/useAudits";
import { BRANCHES, BRANCH_LABELS } from "@/lib/constants";
import { formatDateAR } from "@/lib/formatters";
import type { Audit, AuditItem, Branch, Product } from "@/types/domain";

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
          ? "border-green-500/30 bg-green-500/10 text-green-400"
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

function AuditForm() {
  const { products, loading: productsLoading } = useProducts({
    activeOnly: true,
  });
  const { byProductId, loading: distLoading } = useDistribution();
  const { createAudit, submitting, error } = useAudits();

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
      for (const branch of BRANCHES) {
        const d = getDraft(product.id, branch);
        const raw = d.counted.trim();
        if (!raw) {
          missing.push(`${product.nombre} / ${BRANCH_LABELS[branch]}`);
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
            `Valor inválido para ${product.nombre} / ${BRANCH_LABELS[branch]}: debe ser un entero >= 0`,
          );
          return;
        }
        const notas = d.notas.trim();
        items.push({
          productId: product.id,
          sucursal: branch,
          cajasSistema: systemBoxes(product.id, branch),
          cajasContadas: n,
          ...(notas ? { notas } : {}),
        });
      }
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
        items,
        ...(generalNotas.trim() ? { notas: generalNotas.trim() } : {}),
      });
      setDrafts({});
      setGeneralNotas("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    } catch {
      // error is surfaced via hook's `error` state
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
        Ingrese las cajas contadas físicamente por sucursal. El sistema las
        compara con el stock actual, pero no modifica el stock ni registra
        ventas.
      </p>

      <div className="mb-3 flex flex-col gap-2">
        {success && (
          <FeedbackBanner
            message="Auditoría registrada correctamente."
            tone="success"
          />
        )}
        {formError && <FeedbackBanner message={formError} tone="error" />}
        {error && <FeedbackBanner message={error.message} tone="error" />}
      </div>

      {!loading && (
        <div className="w-full overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
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
              {products.flatMap((product) =>
                BRANCHES.map((branch) => {
                  const draft = getDraft(product.id, branch);
                  const sys = systemBoxes(product.id, branch);
                  const diff = computeDifference(product.id, branch);
                  return (
                    <tr
                      key={cellKey(product.id, branch)}
                      className="hover:bg-surface-2/60 transition-colors"
                    >
                      <td className="px-4 py-2 font-medium text-text-primary">
                        {product.nombre}
                      </td>
                      <td className="px-4 py-2 text-text-secondary">
                        {BRANCH_LABELS[branch]}
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
                          onChange={(e) =>
                            updateDraft(product.id, branch, {
                              counted: e.target.value,
                            })
                          }
                          className="h-9 w-24 rounded-xl border border-border bg-surface-2 px-3 text-right text-sm tabular-nums text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                        />
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
                            updateDraft(product.id, branch, {
                              notas: e.target.value,
                            })
                          }
                          className="h-9 w-full min-w-[10rem] rounded-xl border border-border bg-surface-2 px-3 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                        />
                      </td>
                    </tr>
                  );
                }),
              )}
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
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
            placeholder="Comentarios sobre la auditoría (opcional)"
          />
        </label>

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting || loading}>
            {submitting ? "Guardando…" : "Registrar auditoría"}
          </Button>
        </div>
      </div>
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

function AdminAlerts() {
  const { audits, loading, markAuditResolved, resolvingIds, error } =
    useAudits();
  const { products } = useProducts({ activeOnly: false });

  const productById = useMemo<Record<string, Product>>(() => {
    const map: Record<string, Product> = {};
    for (const p of products) map[p.id] = p;
    return map;
  }, [products]);

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
              markAuditResolved(r.audit.id).catch(() => {
                /* error surfaced via hook */
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
          <FeedbackBanner message={error.message} tone="error" />
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
          <div className="flex flex-col gap-8">
            <AuditForm />
            <RoleGuard allowedRoles={["admin"]} fallback={null}>
              <AdminAlerts />
            </RoleGuard>
          </div>
        </RoleGuard>
      </div>
    </>
  );
}
