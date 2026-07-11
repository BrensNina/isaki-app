"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listarClientes } from "@/lib/clientes";
import { calcularTotales } from "@/lib/pedidos";
import {
	actualizarCotizacion,
	cambiarEstadoCotizacion,
	convertirAPedido,
	crearCotizacion,
	eliminarCotizacion,
	listarCotizaciones,
} from "@/lib/cotizaciones";
import { COLORES, TALLAS } from "@/lib/catalog";
import { ESTADOS_COTIZACION } from "@/lib/types";
import type { Cliente, Cotizacion, ItemPedido } from "@/lib/types";
import { Badge, Button, EmptyState, Field, Input, Modal, Select, Spinner, Textarea, money } from "./ui";

export default function CotizacionesView() {
	const { user, profile } = useAuth();
	const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
	const [clientes, setClientes] = useState<Cliente[]>([]);
	const [loading, setLoading] = useState(true);
	const [creando, setCreando] = useState(false);
	const [editando, setEditando] = useState<Cotizacion | null>(null);
	const [verCot, setVerCot] = useState<Cotizacion | null>(null);
	const rol = profile?.rol ?? "vendedor";

	async function recargar() {
		setLoading(true);
		const [q, c] = await Promise.all([
			listarCotizaciones(user!.uid, profile!.rol).catch(() => [] as Cotizacion[]),
			listarClientes(user!.uid, profile!.rol).catch(() => [] as Cliente[]),
		]);
		setCotizaciones(q);
		setClientes(c);
		setLoading(false);
	}

	useEffect(() => {
		recargar();
	}, []);

	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Cotizaciones</h1>
					<p className="text-sm text-muted">Propuestas de precio previas al pedido.</p>
				</div>
				<Button onClick={() => setCreando(true)} disabled={clientes.length === 0}>
					<Plus className="h-4 w-4" /> Nueva cotización
				</Button>
			</header>

			{clientes.length === 0 && !loading && (
				<p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
					Registra al menos un cliente antes de crear cotizaciones.
				</p>
			)}

			{loading ? (
				<Spinner />
			) : cotizaciones.length === 0 ? (
				<EmptyState icon={<FileText className="h-5 w-5" />} title="No hay cotizaciones" hint="Crea la primera propuesta." />
			) : (
				<div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
					<table className="w-full text-sm">
						<thead className="border-b border-border bg-background text-left text-xs font-medium uppercase tracking-wide text-muted">
							<tr>
								<th className="px-4 py-3">Cliente</th>
								<th className="px-4 py-3">Ítems</th>
								<th className="px-4 py-3">Total</th>
								<th className="px-4 py-3">Validez</th>
								<th className="px-4 py-3">Estado</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody>
							{cotizaciones.map((q) => (
								<tr
									key={q.id}
									className="cursor-pointer border-b border-border last:border-0 hover:bg-background"
									onClick={() => setVerCot(q)}
								>
									<td className="px-4 py-3 font-medium">{q.clienteNombre}</td>
									<td className="px-4 py-3 text-muted">
										{q.items.reduce((a, it) => a + it.cantidad, 0)} und · {q.items.length} línea(s)
									</td>
									<td className="px-4 py-3 tabular-nums">{money(q.montoTotal)}</td>
									<td className="px-4 py-3 text-muted">{q.fechaValidez || "—"}</td>
									<td className="px-4 py-3">
										<Badge className={ESTADOS_COTIZACION[q.estado].badge}>{ESTADOS_COTIZACION[q.estado].label}</Badge>
									</td>
									<td className="px-4 py-3 text-right">
										<ChevronRight className="ml-auto h-4 w-4 text-muted" />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{(creando || editando) && (
				<CotizacionForm
					clientes={clientes}
					vendedorUid={user!.uid}
					inicial={editando || undefined}
					onClose={() => {
						setCreando(false);
						setEditando(null);
					}}
					onSaved={async () => {
						setCreando(false);
						setEditando(null);
						await recargar();
					}}
				/>
			)}

			{verCot && (
				<CotizacionDetalle
					cot={verCot}
					rol={rol}
					onClose={() => setVerCot(null)}
					onEdit={() => {
						setEditando(verCot);
						setVerCot(null);
					}}
					onChanged={async () => {
						setVerCot(null);
						await recargar();
					}}
				/>
			)}
		</div>
	);
}

// ----------------------- Formulario -----------------------

const ITEM_VACIO: ItemPedido = {
	producto: "",
	talla: "M",
	color: COLORES[0].nombre,
	cantidad: 1,
	precioUnitario: 0,
	subtotal: 0,
};

function CotizacionForm({
	clientes,
	vendedorUid,
	inicial,
	onClose,
	onSaved,
}: {
	clientes: Cliente[];
	vendedorUid: string;
	inicial?: Cotizacion;
	onClose: () => void;
	onSaved: () => void;
}) {
	const [clienteId, setClienteId] = useState(inicial?.clienteId || "");
	const [items, setItems] = useState<ItemPedido[]>(inicial ? inicial.items : [{ ...ITEM_VACIO }]);
	const [fechaValidez, setFechaValidez] = useState(inicial?.fechaValidez || "");
	const [notas, setNotas] = useState(inicial?.notasCondiciones || "");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState(false);

	const { montoTotal } = useMemo(() => calcularTotales(items), [items]);
	const hoy = new Date().toISOString().slice(0, 10);

	function setItem(i: number, patch: Partial<ItemPedido>) {
		setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
	}
	function addItem() {
		setItems((prev) => [...prev, { ...ITEM_VACIO }]);
	}
	function removeItem(i: number) {
		setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
	}

	function validar(): boolean {
		const e: Record<string, string> = {};
		if (!clienteId) e.cliente = "Selecciona un cliente.";
		items.forEach((it, i) => {
			if (!it.producto.trim()) e[`prod_${i}`] = "Indica el producto.";
			if (!Number.isFinite(it.cantidad) || it.cantidad <= 0) e[`cant_${i}`] = "Cantidad inválida.";
			if (!Number.isFinite(it.precioUnitario) || it.precioUnitario < 0) e[`prec_${i}`] = "Precio inválido.";
		});
		if (!fechaValidez) e.validez = "Indica hasta cuándo es válida.";
		else if (fechaValidez < hoy) e.validez = "La validez no puede ser anterior a hoy.";
		setErrors(e);
		return Object.keys(e).length === 0;
	}

	async function handleSubmit(ev: React.FormEvent) {
		ev.preventDefault();
		if (!validar()) return;
		setBusy(true);
		try {
			const data = {
				clienteId,
				clienteNombre: clientes.find((c) => c.id === clienteId)?.razonSocial || "Cliente Desconocido",
				items,
				fechaValidez,
				notasCondiciones: notas.trim(),
			};
			if (inicial) await actualizarCotizacion(inicial.id, data);
			else await crearCotizacion(data, vendedorUid);
			onSaved();
		} catch (err) {
			setErrors({ _: err instanceof Error ? err.message : "No se pudo guardar." });
			setBusy(false);
		}
	}

	return (
		<Modal title={inicial ? "Editar cotización" : "Nueva cotización"} onClose={onClose} wide>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<Field label="Cliente" error={errors.cliente}>
					<Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
						<option value="">Selecciona un cliente…</option>
						{clientes.map((c) => (
							<option key={c.id} value={c.id}>
								{c.razonSocial} · {c.dniRuc}
							</option>
						))}
					</Select>
				</Field>

				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">Productos cotizados</span>
						<Button type="button" variant="secondary" className="h-9 px-3" onClick={addItem}>
							<Plus className="h-4 w-4" /> Agregar línea
						</Button>
					</div>

					{items.map((it, i) => (
						<div
							key={i}
							className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-12 sm:items-end"
						>
							<div className="col-span-2 sm:col-span-4">
								<Field label="Producto" error={errors[`prod_${i}`]}>
									<Input value={it.producto} onChange={(e) => setItem(i, { producto: e.target.value })} placeholder="Ej. Polo deportivo" />
								</Field>
							</div>
							<div className="sm:col-span-2">
								<Field label="Talla">
									<Select value={it.talla} onChange={(e) => setItem(i, { talla: e.target.value })}>
										{TALLAS.map((t) => (
											<option key={t} value={t}>{t}</option>
										))}
									</Select>
								</Field>
							</div>
							<div className="sm:col-span-2">
								<Field label="Color">
									<Select value={it.color} onChange={(e) => setItem(i, { color: e.target.value })}>
										{COLORES.map((c) => (
											<option key={c.nombre} value={c.nombre}>{c.nombre}</option>
										))}
									</Select>
								</Field>
							</div>
							<div className="sm:col-span-1">
								<Field label="Cant." error={errors[`cant_${i}`]}>
									<Input type="number" min={1} value={it.cantidad} onChange={(e) => setItem(i, { cantidad: Number(e.target.value) })} />
								</Field>
							</div>
							<div className="sm:col-span-2">
								<Field label="P. unit." error={errors[`prec_${i}`]}>
									<Input type="number" min={0} step="0.01" value={it.precioUnitario} onChange={(e) => setItem(i, { precioUnitario: Number(e.target.value) })} />
								</Field>
							</div>
							<div className="col-span-2 flex items-center justify-between sm:col-span-1 sm:justify-end">
								<span className="text-xs text-muted sm:hidden">Subtotal: {money(it.cantidad * it.precioUnitario)}</span>
								{items.length > 1 && (
									<button
										type="button"
										onClick={() => removeItem(i)}
										className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
										aria-label="Quitar línea"
									>
										<X className="h-4 w-4" />
									</button>
								)}
							</div>
						</div>
					))}
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<Field label="Válida hasta" error={errors.validez}>
						<Input type="date" min={hoy} value={fechaValidez} onChange={(e) => setFechaValidez(e.target.value)} />
					</Field>
				</div>

				<Field label="Condiciones / notas">
					<Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. 50% de adelanto, entrega en 15 días…" />
				</Field>

				<div className="flex items-center justify-between rounded-xl bg-primary-soft px-4 py-3">
					<span className="text-sm text-muted">Total cotizado</span>
					<span className="text-lg font-semibold text-foreground">{money(montoTotal)}</span>
				</div>

				{errors._ && <p className="text-sm text-red-600">{errors._}</p>}

				<div className="flex justify-end gap-2 border-t border-border pt-4">
					<Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
					<Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar cotización"}</Button>
				</div>
			</form>
		</Modal>
	);
}

// ----------------------- Detalle -----------------------

function CotizacionDetalle({
	cot,
	rol,
	onClose,
	onChanged,
	onEdit,
}: {
	cot: Cotizacion;
	rol: string;
	onClose: () => void;
	onChanged: () => void;
	onEdit?: () => void;
}) {
	const [busy, setBusy] = useState(false);

	async function accion(fn: () => Promise<void>) {
		setBusy(true);
		try {
			await fn();
			onChanged();
		} catch {
			setBusy(false);
		}
	}

	const puedeGestionar = rol === "admin" || rol === "vendedor";

	return (
		<Modal title="Detalle de la cotización" onClose={onClose} wide>
			<div className="flex flex-col gap-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="text-lg font-semibold">{cot.clienteNombre}</p>
						<p className="text-sm text-muted">
							Emitida: {cot.fechaEmision || "—"} · Válida hasta: {cot.fechaValidez || "—"}
						</p>
					</div>
					<div className="flex items-center gap-2">
						{onEdit && puedeGestionar && cot.estado === "borrador" && (
							<Button variant="secondary" className="h-8 px-3 text-xs" onClick={onEdit}>
								Editar
							</Button>
						)}
						<Badge className={ESTADOS_COTIZACION[cot.estado].badge}>{ESTADOS_COTIZACION[cot.estado].label}</Badge>
					</div>
				</div>

				<div className="overflow-hidden rounded-xl border border-border">
					<table className="w-full text-sm">
						<thead className="border-b border-border bg-background text-left text-xs font-medium uppercase tracking-wide text-muted">
							<tr>
								<th className="px-3 py-2">Producto</th>
								<th className="px-3 py-2">Talla</th>
								<th className="px-3 py-2">Color</th>
								<th className="px-3 py-2 text-right">Cant.</th>
								<th className="px-3 py-2 text-right">P. unit.</th>
								<th className="px-3 py-2 text-right">Subtotal</th>
							</tr>
						</thead>
						<tbody>
							{cot.items.map((it, i) => (
								<tr key={i} className="border-b border-border last:border-0">
									<td className="px-3 py-2">{it.producto}</td>
									<td className="px-3 py-2">{it.talla}</td>
									<td className="px-3 py-2">{it.color}</td>
									<td className="px-3 py-2 text-right tabular-nums">{it.cantidad}</td>
									<td className="px-3 py-2 text-right tabular-nums">{money(it.precioUnitario)}</td>
									<td className="px-3 py-2 text-right tabular-nums">{money(it.subtotal)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<div className="flex items-center justify-between rounded-xl bg-primary-soft px-4 py-3">
					<span className="text-sm text-muted">Total cotizado</span>
					<span className="text-lg font-semibold text-foreground">{money(cot.montoTotal)}</span>
				</div>

				{cot.notasCondiciones && (
					<div className="rounded-xl border border-border bg-background p-3 text-sm">
						<span className="text-muted">Condiciones: </span>
						{cot.notasCondiciones}
					</div>
				)}

				{cot.estado === "convertida" && cot.pedidoGeneradoId && (
					<p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
						Convertida en pedido. Búscalo en el módulo Pedidos.
					</p>
				)}

				{puedeGestionar && cot.estado !== "convertida" && (
					<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
						<Button
							variant="danger"
							className="h-9 px-3"
							disabled={busy}
							onClick={() => {
								if (confirm("¿Eliminar esta cotización?")) accion(() => eliminarCotizacion(cot.id));
							}}
						>
							<Trash2 className="h-4 w-4" /> Eliminar
						</Button>

						<div className="flex flex-wrap gap-2">
							{cot.estado === "borrador" && (
								<Button disabled={busy} onClick={() => accion(() => cambiarEstadoCotizacion(cot.id, "enviada"))}>
									Marcar como enviada
								</Button>
							)}
							{(cot.estado === "borrador" || cot.estado === "enviada") && (
								<>
									<Button variant="secondary" disabled={busy} onClick={() => accion(() => cambiarEstadoCotizacion(cot.id, "rechazada"))}>
										Rechazar
									</Button>
									<Button disabled={busy} onClick={() => accion(() => convertirAPedido(cot).then(() => undefined))}>
										Aprobar y generar pedido
									</Button>
								</>
							)}
							{cot.estado === "rechazada" && (
								<Button disabled={busy} onClick={() => accion(() => cambiarEstadoCotizacion(cot.id, "borrador"))}>
									Reabrir
								</Button>
							)}
						</div>
					</div>
				)}
			</div>
		</Modal>
	);
}
