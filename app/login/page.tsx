"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
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
    <div className="login-architecture flex min-h-screen text-text-primary">
      <div
        className="relative hidden flex-1 overflow-hidden lg:block"
        aria-hidden
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "radial-gradient(circle at 70% 20%, rgba(0,101,46,0.22), transparent 24rem), linear-gradient(135deg, #05080A 0%, #0B1515 58%, #06100D 100%)",
          }}
        />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(244,247,245,0.045)_0,rgba(244,247,245,0.045)_1px,transparent_1px,transparent_92px)]" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/75 via-black/45 to-primary/15" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-light/20 bg-transparent p-0.5 shadow-glow">
              <Image
                src="/branding/nuevo-parket-logo.png"
                alt="Nuevo Parket"
                width={48}
                height={48}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div>
              <span className="block text-lg font-semibold">Nuevo Parket</span>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-text-muted">
                Control interno
              </span>
            </div>
          </div>
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-primary-light">
              Plataforma interna
            </p>
            <h1 className="text-5xl font-semibold leading-tight tracking-tight">
              Control de consignación <span className="text-primary-light">en tiempo real.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-text-secondary">
              Gestión de stock, ventas y auditorías para la red de sucursales.
            </p>
          </div>
          <div className="text-xs text-text-muted">
            Herramienta de uso interno propiedad de Nuevo Parket
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10 sm:px-8 lg:max-w-xl">
        <div className="flex items-center gap-3 lg:hidden">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-light/20 bg-transparent p-0.5 shadow-glow">
            <Image
              src="/branding/nuevo-parket-logo.png"
              alt="Nuevo Parket"
              width={48}
              height={48}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <div>
            <span className="block text-lg font-semibold">Nuevo Parket</span>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-text-muted">
              Control interno
            </span>
          </div>
        </div>

        <Card className="w-full max-w-md border-primary-light/20 bg-surface/85 p-5 shadow-glow sm:p-7">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Ingresá tus credenciales para continuar
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
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
              <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
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
