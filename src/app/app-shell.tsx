"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import Dashboard from "@/components/dashboard";
import { Button, Field, Input } from "@/components/ui";

// This whole subtree is loaded client-only (see page.tsx). Firebase's SDK runs
// `new Function` at module-eval time, which the Cloudflare Workers runtime
// forbids during SSR — so it must never be imported on the server.
export default function AppShell() {
	return (
		<AuthProvider>
			<Root />
		</AuthProvider>
	);
}

function Root() {
	const { user, loading } = useAuth();

	if (loading) {
		return (
			<main className="grid min-h-screen place-items-center text-sm text-muted">Cargando…</main>
		);
	}

	if (!user) return <AuthScreen />;

	return <Dashboard />;
}

function AuthScreen() {
	return (
		<main className="grid min-h-screen lg:grid-cols-2">
			{/* Panel de marca */}
			<section className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
				<div className="flex items-center gap-2.5">
					<div className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-sm font-bold">IP</div>
					<span className="font-semibold">ISAKI.PERU</span>
				</div>
				<div>
					<h2 className="text-3xl font-semibold leading-tight">Gestión de pedidos mayoristas B2B</h2>
					<p className="mt-3 max-w-md text-primary-foreground/80">
						Centraliza clientes, pedidos, producción y entregas en una sola plataforma. Menos errores
						manuales, más visibilidad en tiempo real.
					</p>
				</div>
				<p className="text-sm text-primary-foreground/60">ISAKI.PERU · MAYTA SPORT</p>
			</section>

			{/* Formulario */}
			<section className="flex items-center justify-center p-6">
				<AuthForm />
			</section>
		</main>
	);
}

function AuthForm() {
	const { signInWithEmail, signUpWithEmail } = useAuth();
	const [mode, setMode] = useState<"signin" | "signup">("signin");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setBusy(true);
		try {
			if (mode === "signup") await signUpWithEmail(email, password, displayName);
			else await signInWithEmail(email, password);
		} catch (err) {
			setError(traducirError(err));
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="w-full max-w-sm">
			<div className="mb-6 flex items-center gap-2.5 lg:hidden">
				<div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">IP</div>
				<span className="font-semibold">ISAKI.PERU</span>
			</div>

			<h1 className="text-2xl font-semibold tracking-tight">
				{mode === "signin" ? "Iniciar sesión" : "Crear cuenta"}
			</h1>
			<p className="mt-1 text-sm text-muted">
				{mode === "signin" ? "Accede a tu panel de gestión." : "Registra una cuenta para empezar."}
			</p>

			<form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
				{mode === "signup" && (
					<Field label="Nombre">
						<Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="Tu nombre" />
					</Field>
				)}
				<Field label="Correo">
					<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@correo.com" />
				</Field>
				<Field label="Contraseña">
					<Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
				</Field>

				{error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

				<Button type="submit" disabled={busy} className="h-11 w-full">
					{busy ? "Procesando…" : mode === "signin" ? "Entrar" : "Registrarme"}
				</Button>
			</form>

			<button
				onClick={() => {
					setMode(mode === "signin" ? "signup" : "signin");
					setError(null);
				}}
				className="mt-5 text-sm text-muted hover:text-foreground"
			>
				{mode === "signin" ? (
					<>¿No tienes cuenta? <span className="font-medium text-primary">Regístrate</span></>
				) : (
					<>¿Ya tienes cuenta? <span className="font-medium text-primary">Inicia sesión</span></>
				)}
			</button>
		</div>
	);
}

/** Traduce los códigos de error más comunes de Firebase Auth al español. */
function traducirError(err: unknown): string {
	const code = (err as { code?: string })?.code ?? "";
	const map: Record<string, string> = {
		"auth/invalid-credential": "Correo o contraseña incorrectos.",
		"auth/invalid-email": "El correo no es válido.",
		"auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
		"auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
		"auth/too-many-requests": "Demasiados intentos. Inténtalo más tarde.",
	};
	return map[code] || (err instanceof Error ? err.message : "Algo salió mal.");
}
