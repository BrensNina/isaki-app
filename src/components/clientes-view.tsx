"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Send, Trash2, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { actualizarCliente, crearCliente, eliminarCliente, listarClientes } from "@/lib/clientes";
import { listarUsuarios } from "@/lib/usuarios";
import { DEPARTAMENTOS, TIPO_CLIENTE_LABEL, TIPO_ENTREGA_LABEL } from "@/lib/catalog";
import type { Cliente, ClienteInput, TipoCliente, TipoEntrega } from "@/lib/types";
import { Badge, Button, EmptyState, Field, Input, Modal, Select, Spinner, Textarea } from "./ui";

const VACIO: ClienteInput = {
	razonSocial: "",
	tipoCliente: "natural",
	dniRuc: "",
	telefono: "",
	email: "",
	tipoEntrega: "local",
	departamento: "",
	direccion: "",
	nombreReceptor: "",
	dniReceptor: "",
	notas: "",
};

export default function ClientesView() {
	const { user, profile } = useAuth();
	const [clientes, setClientes] = useState<Cliente[]>([]);
	const [loading, setLoading] = useState(true);
	const [editando, setEditando] = useState<Cliente | null>(null);
	const [creando, setCreando] = useState(false);
	const [filtro, setFiltro] = useState("");
	const [vendedores, setVendedores] = useState<Record<string, string>>({});

	async function recargar() {
		setLoading(true);
		const [cli, usu] = await Promise.all([
			listarClientes(user!.uid, profile!.rol).catch(() => [] as Cliente[]),
			profile!.rol === "admin" ? listarUsuarios().catch(() => []) : Promise.resolve([]),
		]);
		
		const mapUsu: Record<string, string> = {};
		for (const u of usu) mapUsu[u.uid] = u.displayName || u.email || "Vendedor Desconocido";
		setVendedores(mapUsu);

		setClientes(cli);
		setLoading(false);
	}

	useEffect(() => {
		recargar();
	}, []);

	async function handleEliminar(c: Cliente) {
		if (!confirm(`¿Eliminar al cliente "${c.razonSocial}"? Esta acción no se puede deshacer.`)) return;
		await eliminarCliente(c.id);
		await recargar();
	}

	// Copia el enlace de vinculación de Telegram para ENVIÁRSELO al cliente (no
	// abrirlo aquí: quien da Start queda vinculado, y debe ser el cliente).
	async function vincularTelegram(c: Cliente) {
		// Usuario del bot (público y fijo). Se puede sobrescribir con la env var.
		const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT || "isaki_pe_bot";
		const enlace = `https://t.me/${bot}?start=${c.id}`;
		try {
			await navigator.clipboard.writeText(enlace);
			alert(`Enlace copiado. Envíaselo a ${c.razonSocial} para que reciba avisos de sus pedidos por Telegram:\n\n${enlace}`);
		} catch {
			prompt("Copia este enlace y envíaselo al cliente:", enlace);
		}
	}

	const visibles = clientes.filter((c) => {
		const q = filtro.trim().toLowerCase();
		if (!q) return true;
		return (
			c.razonSocial.toLowerCase().includes(q) ||
			c.dniRuc.toLowerCase().includes(q) ||
			(c.telefono ?? "").toLowerCase().includes(q)
		);
	});

	const agrupados = useMemo(() => {
		if (profile?.rol !== "admin") return { "Mis Clientes": visibles };
		const grupos: Record<string, Cliente[]> = {};
		visibles.forEach((c) => {
			const nombre = vendedores[c.vendedorUid] || "Vendedor Desconocido";
			if (!grupos[nombre]) grupos[nombre] = [];
			grupos[nombre].push(c);
		});
		return grupos;
	}, [visibles, profile, vendedores]);

	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
					<p className="text-sm text-muted">Registro centralizado de clientes mayoristas.</p>
				</div>
				<Button onClick={() => setCreando(true)}>
					<Plus className="h-4 w-4" /> Nuevo cliente
				</Button>
			</header>

			<div className="relative max-w-sm">
				<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
				<Input
					placeholder="Buscar por nombre, DNI/RUC o teléfono…"
					value={filtro}
					onChange={(e) => setFiltro(e.target.value)}
					className="pl-9"
				/>
			</div>

			{loading ? (
				<Spinner />
			) : visibles.length === 0 ? (
				<EmptyState
					icon={<Users className="h-5 w-5" />}
					title={filtro ? "Sin coincidencias" : "Aún no hay clientes"}
					hint={filtro ? "Prueba con otro término de búsqueda." : "Registra tu primer cliente mayorista."}
				/>
			) : (
				<div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
					<table className="w-full text-sm">
						<thead className="border-b border-border bg-background text-left text-xs font-medium uppercase tracking-wide text-muted">
							<tr>
								<th className="px-4 py-3">Cliente</th>
								<th className="px-4 py-3">DNI / RUC</th>
								<th className="px-4 py-3">Contacto</th>
								<th className="px-4 py-3">Entrega</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody>
							{Object.entries(agrupados).map(([grupo, clis]) => (
								<Fragment key={grupo}>
									{profile?.rol === "admin" && (
										<tr className="bg-slate-50 border-b border-border">
											<td colSpan={5} className="px-4 py-2 text-xs font-semibold uppercase text-slate-500">
												Cartera de: {grupo}
											</td>
										</tr>
									)}
									{clis.map((c) => (
										<tr key={c.id} className="border-b border-border last:border-0 hover:bg-background">
											<td className="px-4 py-3">
												<div className="font-medium">{c.razonSocial}</div>
												<div className="text-xs text-muted">{TIPO_CLIENTE_LABEL[c.tipoCliente]}</div>
											</td>
											<td className="px-4 py-3 tabular-nums">{c.dniRuc}</td>
											<td className="px-4 py-3">
												<div>{c.telefono || "—"}</div>
												{c.email && <div className="text-xs text-muted">{c.email}</div>}
											</td>
											<td className="px-4 py-3">
												<Badge className={c.tipoEntrega === "agencia" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}>
													{c.tipoEntrega === "agencia" ? `Agencia · ${c.departamento || "—"}` : "Local"}
												</Badge>
											</td>
											<td className="px-4 py-3">
												<div className="flex justify-end gap-1">
													<button
														onClick={() => vincularTelegram(c)}
														className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-primary"
														title="Copiar enlace de Telegram para el cliente"
													>
														<Send className="h-4 w-4" />
													</button>
													<button
														onClick={() => setEditando(c)}
														className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-primary"
														title="Editar"
													>
														<Pencil className="h-4 w-4" />
													</button>
													<button
														onClick={() => handleEliminar(c)}
														className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
														title="Eliminar"
													>
														<Trash2 className="h-4 w-4" />
													</button>
												</div>
											</td>
										</tr>
									))}
								</Fragment>
							))}
						</tbody>
					</table>
				</div>
			)}

			{(creando || editando) && (
				<ClienteForm
					inicial={editando}
					onClose={() => {
						setCreando(false);
						setEditando(null);
					}}
					onSaved={async () => {
						setCreando(false);
						setEditando(null);
						await recargar();
					}}
					vendedorUid={user!.uid}
				/>
			)}
		</div>
	);
}

function ClienteForm({
	inicial,
	onClose,
	onSaved,
	vendedorUid,
}: {
	inicial: Cliente | null;
	onClose: () => void;
	onSaved: () => void;
	vendedorUid: string;
}) {
	const [form, setForm] = useState<ClienteInput>(() =>
		inicial
			? {
					razonSocial: inicial.razonSocial,
					tipoCliente: inicial.tipoCliente,
					dniRuc: inicial.dniRuc,
					telefono: inicial.telefono ?? "",
					email: inicial.email ?? "",
					tipoEntrega: inicial.tipoEntrega,
					departamento: inicial.departamento ?? "",
					direccion: inicial.direccion ?? "",
					nombreReceptor: inicial.nombreReceptor ?? "",
					dniReceptor: inicial.dniReceptor ?? "",
					notas: inicial.notas ?? "",
				}
			: VACIO,
	);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState(false);

	function set<K extends keyof ClienteInput>(key: K, value: ClienteInput[K]) {
		setForm((f) => ({ ...f, [key]: value }));
	}

	function validar(): boolean {
		const e: Record<string, string> = {};
		if (!form.razonSocial.trim()) e.razonSocial = "El nombre o razón social es obligatorio.";
		const doc = form.dniRuc.trim();
		if (!doc) e.dniRuc = "El DNI o RUC es obligatorio.";
		else if (!/^\d{8}$|^\d{11}$/.test(doc)) e.dniRuc = "Debe tener 8 dígitos (DNI) u 11 (RUC).";
		if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Correo no válido.";
		if (form.tipoEntrega === "agencia" && !form.departamento) e.departamento = "Indica el departamento de destino.";
		setErrors(e);
		return Object.keys(e).length === 0;
	}

	async function handleSubmit(ev: React.FormEvent) {
		ev.preventDefault();
		if (!validar()) return;
		setBusy(true);
		try {
			if (inicial) {
				await actualizarCliente(inicial.id, form);
			} else {
				await crearCliente(form, vendedorUid);
			}
			onSaved();
		} catch (err) {
			setErrors({ _: err instanceof Error ? err.message : "No se pudo guardar." });
			setBusy(false);
		}
	}

	return (
		<Modal title={inicial ? "Editar cliente" : "Nuevo cliente"} onClose={onClose} wide>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="sm:col-span-2">
						<Field label="Nombre completo o razón social" error={errors.razonSocial}>
							<Input value={form.razonSocial} onChange={(e) => set("razonSocial", e.target.value)} />
						</Field>
					</div>

					<Field label="Tipo de cliente">
						<Select value={form.tipoCliente} onChange={(e) => set("tipoCliente", e.target.value as TipoCliente)}>
							{Object.entries(TIPO_CLIENTE_LABEL).map(([v, l]) => (
								<option key={v} value={v}>{l}</option>
							))}
						</Select>
					</Field>

					<Field label="DNI / RUC" error={errors.dniRuc} hint="8 dígitos (DNI) u 11 (RUC).">
						<Input value={form.dniRuc} onChange={(e) => set("dniRuc", e.target.value)} inputMode="numeric" />
					</Field>

					<Field label="Teléfono">
						<Input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} inputMode="tel" />
					</Field>

					<Field label="Correo" error={errors.email}>
						<Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
					</Field>
				</div>

				<div className="rounded-xl border border-border bg-background p-4">
					<p className="mb-3 text-sm font-medium">Datos de entrega</p>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Tipo de entrega">
							<Select value={form.tipoEntrega} onChange={(e) => set("tipoEntrega", e.target.value as TipoEntrega)}>
								{Object.entries(TIPO_ENTREGA_LABEL).map(([v, l]) => (
									<option key={v} value={v}>{l}</option>
								))}
							</Select>
						</Field>

						{form.tipoEntrega === "agencia" && (
							<>
								<Field label="Departamento de destino" error={errors.departamento}>
									<Select value={form.departamento} onChange={(e) => set("departamento", e.target.value)}>
										<option value="">Selecciona…</option>
										{DEPARTAMENTOS.map((d) => (
											<option key={d} value={d}>{d}</option>
										))}
									</Select>
								</Field>
								<Field label="Nombre del receptor">
									<Input value={form.nombreReceptor} onChange={(e) => set("nombreReceptor", e.target.value)} />
								</Field>
								<Field label="DNI del receptor">
									<Input value={form.dniReceptor} onChange={(e) => set("dniReceptor", e.target.value)} inputMode="numeric" />
								</Field>
							</>
						)}

						<div className="sm:col-span-2">
							<Field label="Dirección / referencia">
								<Input value={form.direccion} onChange={(e) => set("direccion", e.target.value)} />
							</Field>
						</div>
					</div>
				</div>

				<Field label="Notas">
					<Textarea rows={2} value={form.notas} onChange={(e) => set("notas", e.target.value)} />
				</Field>

				{errors._ && <p className="text-sm text-red-600">{errors._}</p>}

				<div className="flex justify-end gap-2 border-t border-border pt-4">
					<Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
					<Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
				</div>
			</form>
		</Modal>
	);
}
