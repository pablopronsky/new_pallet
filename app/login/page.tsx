"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { getErrorMessage, logError } from "@/lib/errors";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      logError("login", err);
      setError(getErrorMessage(err, "No se pudo iniciar sesión."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-text-primary">
      <div
        className="relative hidden flex-1 overflow-hidden lg:block"
        aria-hidden
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #0a0a0a 0%, #0f2a18 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-primary/20" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white">
              N
            </div>
            <span className="text-lg font-semibold">np-stock</span>
          </div>
          <div className="max-w-md">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">
              Control de consignación <span className="text-primary-light">en tiempo real.</span>
            </h1>
            <p className="mt-4 text-sm text-text-secondary">
              Gestión de stock, ventas y auditorías para la red de sucursales.
            </p>
          </div>
          <div className="text-xs text-text-muted">
            © {new Date().getFullYear()} np-stock
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Ingresá tus credenciales para continuar
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@empresa.com"
            />

            <Input
              label="Contraseña"
              type="password"
              name="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            {error && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
