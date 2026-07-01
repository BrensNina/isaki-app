"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listarClientes } from "@/lib/clientes";
import {
	cambiarEstadoCotizacion,
	convertirAPedido,
	crearCotizacion,
	eliminarCotizacion,
	listarCotizaciones,
} from "@/lib/cotizaciones";
import { calcularTotales } from "@/lib/pedidos";
import { COLORES, TALLAS } from "@/lib/catalog";
import { ESTADOS_COTIZACION } from "@/lib/types";
import type { Cliente, Cotizacion, EstadoCotizacion, ItemPedido } from "@/lib/types";
import { Badge, Button, EmptyState, Field, Input, Modal, Select, Spinner, Textarea, money } from "./ui";

export default function CotizacionesView() {
	const { user } = useAuth();
	const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
	const [clientes, setClientes] = useState<Cliente[]>([]);
	const [loading, setLoading] = useState(true);
	const [creando, setCreando] = useState(false);
	const [verCotizacion, setVerCotizacion] = useState<Cotizacion | null>(null);
	const [filtroEstado, setFiltroEstado] = useState<EstadoCotizacion | "">("");

	async function recargar() {
		setLoading(true);
		const [cot, cli] = await Promise.all([listarCotizaciones(), listarClientes()]);
		setCotizaciones(cot);
		setClientes(cli);
		setLoading(false);
	}

	useEffect(() => {
		recargar();
	}, []);

	const visibles = filtroEstado ? cotizaciones.filter((c) => c.estado === filtroEstado) : cotizaciones;

	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Cotizaciones</h1>
					<p className="text-sm text-muted">Gestión de cotizaciones B2B.</p>
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

			<div className="flex flex-wrap gap-2">
				<EstadoChip activo={filtroEstado === ""} onClick={() => setFiltroEstado("")}>
					Todas ({cotizaciones.length})
				</EstadoChip>
				{(Object.keys(ESTADOS_COTIZACION) as EstadoCotizacion[]).map((e) => {
					const n = cotizaciones.filter((c) => c.estado === e).length;
					if (n === 0) return null;
					return (
						<EstadoChip key={e} activo={filtroEstado === e} onClick={() => setFiltroEstado(e)}>
							{ESTADOS_COTIZACION[e].label} ({n})
						</EstadoChip>
					);
				})}
			</div>

			{loading ? (
				<Spinner />
			) : visibles.length === 0 ? (
				<EmptyState icon={<FileText className="h-5 w-5" />} title="No hay cotizaciones" hint="Crea la primera cotización mayorista." />
			) : (
				<div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
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
							{visibles.map((c) => (
								<tr
									key={c.id}
									className="cursor-pointer border-b border-border last:border-0 hover:bg-background"
									onClick={() => setVerCotizacion(c)}
								>
									<td className="px-4 py-3 font-medium">{c.clienteNombre}</td>
									<td className="px-4 py-3 text-muted">
										{c.items.reduce((a, it) => a + it.cantidad, 0)} und
									</td>
									<td className="px-4 py-3 tabular-nums">{money(c.montoTotal)}</td>
									<td className="px-4 py-3 text-muted">{c.fechaValidez}</td>
									<td className="px-4 py-3">
										<Badge className={ESTADOS_COTIZACION[c.estado].badge}>{ESTADOS_COTIZACION[c.estado].label}</Badge>
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

			{creando && (
				<CotizacionForm
					clientes={clientes}
					vendedorUid={user!.uid}
					onClose={() => setCreando(false)}
					onSaved={async () => {
						setCreando(false);
						await recargar();
					}}
				/>
			)}

			{verCotizacion && (
				<CotizacionDetalle
					cotizacion={verCotizacion}
					onClose={() => setVerCotizacion(null)}
					onChanged={async () => {
						setVerCotizacion(null);
						await recargar();
					}}
				/>
			)}
		</div>
	);
}

function EstadoChip({ children, activo, onClick }: { children: React.ReactNode; activo: boolean; onClick: () => void }) {
	return (
		<button
			onClick={onClick}
			className={
				"rounded-full px-3 py-1.5 text-sm font-medium transition " +
				(activo ? "bg-primary text-primary-foreground" : "border border-border bg-surface text-muted hover:bg-background hover:text-foreground")
			}
		>
			{children}
		</button>
	);
}

// ----------------------- Formulario de nueva cotización -----------------------

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
	onClose,
	onSaved,
}: {
	clientes: Cliente[];
	vendedorUid: string;
	onClose: () => void;
	onSaved: () => void;
}) {
	const [clienteId, setClienteId] = useState("");
	const [items, setItems] = useState<ItemPedido[]>([{ ...ITEM_VACIO }]);
	const [notasCondiciones, setNotasCondiciones] = useState("Condiciones: 50% anticipo, saldo contra entrega. Precios no incluyen IGV.");
	
	const hoy = new Date();
	const limiteDefault = new Date();
	limiteDefault.setDate(hoy.getDate() + 15);
	const [fechaValidez, setFechaValidez] = useState(limiteDefault.toISOString().slice(0, 10));

	const [errors, setErrors] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState(false);

	const { montoTotal } = useMemo(() => calcularTotales(items), [items]);
	const strHoy = hoy.toISOString().slice(0, 10);

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
		if (fechaValidez < strHoy) e.fechaValidez = "La fecha no puede ser anterior a hoy.";
		setErrors(e);
		return Object.keys(e).length === 0;
	}

	async function handleSubmit(ev: React.FormEvent) {
		ev.preventDefault();
		if (!validar()) return;
		setBusy(true);
		try {
			const cliente = clientes.find((c) => c.id === clienteId)!;
			await crearCotizacion(
				{
					clienteId,
					clienteNombre: cliente.razonSocial,
					items,
					fechaValidez,
					notasCondiciones,
				},
				vendedorUid,
			);
			onSaved();
		} catch (err) {
			setErrors({ _: err instanceof Error ? err.message : "No se pudo guardar." });
			setBusy(false);
		}
	}

	return (
		<Modal title="Nueva cotización" onClose={onClose} wide>
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
					<Field label="Válida hasta" error={errors.fechaValidez}>
						<Input type="date" min={strHoy} value={fechaValidez} onChange={(e) => setFechaValidez(e.target.value)} />
					</Field>
				</div>

				<Field label="Notas y condiciones comerciales">
					<Textarea rows={2} value={notasCondiciones} onChange={(e) => setNotasCondiciones(e.target.value)} />
				</Field>

				<div className="flex items-center justify-between rounded-xl bg-primary-soft px-4 py-3">
					<span className="text-sm text-muted">Total cotizado</span>
					<span className="text-lg font-semibold text-primary">{money(montoTotal)}</span>
				</div>

				{errors._ && <p className="text-sm text-red-600">{errors._}</p>}

				<div className="flex justify-end gap-2 border-t border-border pt-4">
					<Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
					<Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Registrar cotización"}</Button>
				</div>
			</form>
		</Modal>
	);
}

// --------------------------- Detalle de la cotización ---------------------------

function CotizacionDetalle({ cotizacion, onClose, onChanged }: { cotizacion: Cotizacion; onClose: () => void; onChanged: () => void }) {
	const [busy, setBusy] = useState(false);
	const [showConvertir, setShowConvertir] = useState(false);

	async function accion(fn: () => Promise<void>) {
		setBusy(true);
		try {
			await fn();
			onChanged();
		} catch {
			setBusy(false);
		}
	}

	if (showConvertir) {
		return (
			<ConvertirModal 
				cotizacion={cotizacion} 
				onClose={() => setShowConvertir(false)} 
				onConverted={onChanged} 
			/>
		);
	}

	return (
		<Modal title="Detalle de cotización" onClose={onClose} wide>
			<div className="flex flex-col gap-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="text-lg font-semibold">{cotizacion.clienteNombre}</p>
						<p className="text-sm text-muted">Válida hasta: {cotizacion.fechaValidez}</p>
					</div>
					<Badge className={ESTADOS_COTIZACION[cotizacion.estado].badge}>{ESTADOS_COTIZACION[cotizacion.estado].label}</Badge>
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
							{cotizacion.items.map((it, i) => (
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

				<div className="flex justify-between items-center rounded-xl border border-border bg-background p-3">
					<span className="text-sm text-muted font-medium">Monto Total</span>
					<span className="font-semibold tabular-nums text-lg">{money(cotizacion.montoTotal)}</span>
				</div>

				{cotizacion.notasCondiciones && (
					<div className="rounded-xl border border-border bg-background p-3 text-sm">
						<span className="text-muted font-medium">Condiciones: </span><br/>
						{cotizacion.notasCondiciones}
					</div>
				)}

				<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
					<Button
						variant="danger"
						className="h-9 px-3"
						disabled={busy}
						onClick={() => {
							if (confirm("¿Eliminar esta cotización?")) accion(() => eliminarCotizacion(cotizacion.id));
						}}
					>
						<Trash2 className="h-4 w-4" /> Eliminar
					</Button>

					<div className="flex flex-wrap gap-2">
						{cotizacion.estado === "borrador" && (
							<Button disabled={busy} onClick={() => accion(() => cambiarEstadoCotizacion(cotizacion.id, "enviada"))}>
								Marcar como Enviada
							</Button>
						)}
						{cotizacion.estado === "enviada" && (
							<>
								<Button variant="danger" disabled={busy} onClick={() => accion(() => cambiarEstadoCotizacion(cotizacion.id, "rechazada"))}>
									Rechazada
								</Button>
								<Button disabled={busy} onClick={() => accion(() => cambiarEstadoCotizacion(cotizacion.id, "aprobada"))}>
									Cliente Aprobó
								</Button>
							</>
						)}
						{cotizacion.estado === "aprobada" && (
							<Button disabled={busy} onClick={() => setShowConvertir(true)}>
								Convertir a Pedido en firme
							</Button>
						)}
						{cotizacion.estado === "convertida" && (
							<span className="text-sm text-muted px-3 py-2 bg-surface rounded-lg border border-border">
								Ya convertida en pedido.
							</span>
						)}
					</div>
				</div>
			</div>
		</Modal>
	);
}

// --------------------------- Modal de conversión ---------------------------

function ConvertirModal({
	cotizacion,
	onClose,
	onConverted,
}: {
	cotizacion: Cotizacion;
	onClose: () => void;
	onConverted: () => void;
}) {
	const [anticipo, setAnticipo] = useState("");
	const [fechaEntrega, setFechaEntrega] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const hoy = new Date().toISOString().slice(0, 10);

	async function handleSubmit(ev: React.FormEvent) {
		ev.preventDefault();
		setError("");
		const ant = Number(anticipo || 0);
		if (ant < 0) return setError("El anticipo no puede ser negativo.");
		if (ant > cotizacion.montoTotal) return setError("El anticipo no puede superar el total.");
		if (fechaEntrega && fechaEntrega < hoy) return setError("La fecha de entrega no puede ser anterior a hoy.");

		setBusy(true);
		try {
			await convertirAPedido(cotizacion, ant, fechaEntrega || undefined);
			onConverted();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error al convertir.");
			setBusy(false);
		}
	}

	return (
		<Modal title="Convertir a Pedido" onClose={onClose}>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<p className="text-sm text-muted">
					Para generar el pedido en firme, indica los detalles de la ejecución que no formaban parte de la cotización:
				</p>

				<Field label="Anticipo inicial abonado" error={error && error.includes("anticipo") ? error : undefined}>
					<Input type="number" min={0} step="0.01" value={anticipo} onChange={(e) => setAnticipo(e.target.value)} />
				</Field>
				<Field label="Fecha de entrega pactada" error={error && error.includes("fecha") ? error : undefined}>
					<Input type="date" min={hoy} value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
				</Field>

				{error && !error.includes("anticipo") && !error.includes("fecha") && (
					<p className="text-sm text-red-600">{error}</p>
				)}

				<div className="flex justify-end gap-2 border-t border-border pt-4">
					<Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
					<Button type="submit" disabled={busy}>{busy ? "Convirtiendo…" : "Generar Pedido"}</Button>
				</div>
			</form>
		</Modal>
	);
}
