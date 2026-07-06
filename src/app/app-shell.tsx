"use client";

import { useState } from "react";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import Dashboard from "@/components/dashboard";
import { Button, Field, Input } from "@/components/ui";
import Image from "next/image";

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
	const { user, profile, loading } = useAuth();

	if (loading || (user && !profile)) {
		return (
			<main className="grid min-h-screen place-items-center text-sm text-[#64748b]">Cargando perfil…</main>
		);
	}

	if (!user) return <AuthScreen />;

	return <Dashboard />;
}

function AuthScreen() {
	return (
		<main className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-[#99ffff] via-[#f8fafc] to-[#fbb9ce] p-6">
			<div className="flex w-full max-w-6xl flex-col items-center justify-between gap-12 lg:flex-row lg:gap-16">
				{/* Panel Izquierdo (Texto y Logo) */}
				<section className="hidden w-full flex-col lg:flex lg:w-1/2">
					<div className="mx-auto w-full max-w-[500px]">
						<div className="relative mb-12 h-32 w-64">
							<Image 
								src="/logo.png" 
								alt="Isaki Logo" 
								fill 
								className="object-contain object-left" 
							/>
						</div>
						<h2 className="text-[3.75rem] font-bold leading-[1.1] tracking-tight text-[#1e293b]">
							Tus pedidos<br />siempre bajo control
						</h2>
						<p className="mt-6 text-[1.25rem] font-medium leading-relaxed text-[#475569]">
							Consulta avances, revisa su historial y recibe información actualizada en tiempo real.
						</p>
					</div>
				</section>

				{/* Panel Derecho (Burbuja Login) */}
				<section className="flex w-full justify-center lg:w-1/2">
					<div className="w-full max-w-[460px] rounded-[2.5rem] bg-surface p-10 sm:p-14 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] border border-white/60">
						<AuthForm />
					</div>
				</section>
			</div>
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
		<div className="w-full">
			<div className="mb-10 flex justify-center lg:hidden">
				<div className="relative h-24 w-56">
					<Image 
						src="/logo.png" 
						alt="Isaki Logo" 
						fill 
						className="object-contain" 
					/>
				</div>
			</div>

			<h1 className="text-[2rem] font-bold tracking-tight text-[#1e293b]">
				{mode === "signin" ? "Iniciar sesión" : "Crear cuenta"}
			</h1>
			<p className="mt-2 text-[15px] font-medium text-[#64748b]">
				{mode === "signin" ? "Accede a tu panel de gestión." : "Registra una cuenta para empezar."}
			</p>

			<form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
				{mode === "signup" && (
					<Field label="Nombre">
						<Input 
							value={displayName} 
							onChange={(e) => setDisplayName(e.target.value)} 
							required 
							placeholder="Tu nombre" 
							className="h-[3.25rem] rounded-xl border-0 bg-[#f1f5f9] px-4 text-[15px] font-medium text-[#1e293b] placeholder:text-[#94a3b8]"
						/>
					</Field>
				)}
				<Field label="Correo">
					<Input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="ejemplo@correo.com"
						required
						className="h-[3.25rem] rounded-xl border-0 bg-[#f1f5f9] px-4 text-[15px] font-medium text-[#1e293b] placeholder:text-[#94a3b8]"
					/>
				</Field>
				<Field label="Contraseña">
					<Input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="••••••••"
						required
						className="h-[3.25rem] rounded-xl border-0 bg-[#f1f5f9] px-4 text-[15px] font-medium text-[#1e293b] placeholder:text-[#94a3b8]"
					/>
				</Field>
				
				{error && <p className="text-sm font-medium text-red-600">{error}</p>}

				<Button 
					type="submit" 
					disabled={busy} 
					className="mt-2 h-[3.25rem] w-full rounded-xl border-0 bg-[#99ffff] text-[16px] font-bold text-[#1e293b] shadow-sm hover:bg-[#7ceeee]"
				>
					{busy ? "Procesando…" : mode === "signin" ? "Entrar" : "Registrarme"}
				</Button>
			</form>

			<div className="mt-10 text-center">
				<button
				onClick={() => {
					setMode(mode === "signin" ? "signup" : "signin");
					setError(null);
				}}
				className="text-[14px] font-medium text-[#64748b] hover:text-[#1e293b]"
			>
				{mode === "signin" ? (
					<>¿No tienes cuenta? <span className="font-semibold text-[#1e293b]">Regístrate</span></>
				) : (
					<>¿Ya tienes cuenta? <span className="font-semibold text-[#1e293b]">Inicia sesión</span></>
				)}
			</button>
			</div>
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
