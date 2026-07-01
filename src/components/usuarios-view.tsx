"use client";

import { useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listarUsuarios, crearUsuarioPorAdmin, eliminarUsuarioAdmin } from "@/lib/usuarios";
import { ROL_LABEL } from "@/lib/types";
import type { UserProfile, Rol } from "@/lib/types";
import { Badge, Button, EmptyState, Field, Input, Modal, Select, Spinner } from "./ui";

export default function UsuariosView() {
	const { user } = useAuth();
	const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
	const [loading, setLoading] = useState(true);
	const [creando, setCreando] = useState(false);

	async function recargar() {
		setLoading(true);
		try {
			const data = await listarUsuarios();
			setUsuarios(data);
		} catch (err) {
			console.error(err);
		}
		setLoading(false);
	}

	useEffect(() => {
		recargar();
	}, []);

	async function handleEliminar(uid: string, nombre: string) {
		if (!confirm(`¿Estás seguro de eliminar el acceso de ${nombre}?`)) return;
		try {
			await eliminarUsuarioAdmin(uid);
			await recargar();
		} catch (err) {
			alert("Error al eliminar usuario.");
		}
	}

	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Gestión de Personal</h1>
					<p className="text-sm text-muted">Administra las cuentas y roles del sistema.</p>
				</div>
				<Button onClick={() => setCreando(true)}>
					<Plus className="h-4 w-4" /> Nuevo usuario
				</Button>
			</header>

			{loading ? (
				<Spinner />
			) : usuarios.length === 0 ? (
				<EmptyState icon={<Users className="h-5 w-5" />} title="No hay usuarios" hint="" />
			) : (
				<div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
					<table className="w-full text-sm">
						<thead className="border-b border-border bg-background text-left text-xs font-medium uppercase tracking-wide text-muted">
							<tr>
								<th className="px-4 py-3">Nombre</th>
								<th className="px-4 py-3">Correo</th>
								<th className="px-4 py-3">Rol actual</th>
								<th className="px-4 py-3 text-right">Acciones</th>
							</tr>
						</thead>
						<tbody>
							{usuarios.map((u) => (
								<tr key={u.uid} className="border-b border-border last:border-0">
									<td className="px-4 py-3 font-medium">{u.displayName}</td>
									<td className="px-4 py-3 text-muted">{u.email}</td>
									<td className="px-4 py-3">
										<Badge>{ROL_LABEL[u.rol]}</Badge>
									</td>
									<td className="px-4 py-3 text-right">
										{u.rol === "produccion" && (
											<Button variant="secondary" onClick={() => handleEliminar(u.uid, u.displayName || "Usuario")}>
												Eliminar
											</Button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{creando && (
				<UsuarioForm
					onClose={() => setCreando(false)}
					onSaved={async () => {
						setCreando(false);
						await recargar();
					}}
				/>
			)}
		</div>
	);
}

// ----------------------- Formulario de nuevo usuario -----------------------

function UsuarioForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [nombre, setNombre] = useState("");
	
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	async function handleSubmit(ev: React.FormEvent) {
		ev.preventDefault();
		setError("");
		if (!email || !password || !nombre) {
			return setError("Llena todos los campos obligatorios.");
		}
		if (password.length < 6) {
			return setError("La contraseña debe tener al menos 6 caracteres.");
		}

		setBusy(true);
		try {
			await crearUsuarioPorAdmin(email, password, nombre, "produccion");
			onSaved();
		} catch (err: any) {
			// Traducir algunos errores comunes de Firebase
			let msg = err.message;
			if (err.code === "auth/email-already-in-use") msg = "El correo ya está registrado.";
			if (err.code === "auth/invalid-email") msg = "El correo no es válido.";
			setError(msg);
			setBusy(false);
		}
	}

	return (
		<Modal title="Crear nueva cuenta" onClose={onClose}>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<p className="text-sm text-muted mb-2">
					Esta cuenta se creará de forma interna sin cerrar tu sesión.
				</p>

				<Field label="Nombre completo" error={error && error.includes("campos") ? error : undefined}>
					<Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Juan Pérez" />
				</Field>
				<Field label="Correo electrónico">
					<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@empresa.com" />
				</Field>
				<Field label="Contraseña temporal">
					<Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 caracteres" />
				</Field>

				{error && !error.includes("campos") && (
					<p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">{error}</p>
				)}

				<div className="flex justify-end gap-2 border-t border-border pt-4">
					<Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
					<Button type="submit" disabled={busy}>{busy ? "Creando…" : "Crear cuenta"}</Button>
				</div>
			</form>
		</Modal>
	);
}
