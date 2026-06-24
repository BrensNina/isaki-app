"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, History, Package, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listarClientes } from "@/lib/clientes";
import {
	calcularTotales,
	cambiarEstado,
	confirmarAnticipo,
	crearPedido,
	eliminarPedido,
	listarPedidos,
} from "@/lib/pedidos";
import { COLORES, TALLAS } from "@/lib/catalog";
import { ESTADOS } from "@/lib/types";
import type { Cliente, EstadoPedido, HistorialEntry, ItemPedido, Pedido } from "@/lib/types";
import { Badge, Button, EmptyState, Field, Input, Modal, Select, Spinner, Textarea, money } from "./ui";

export default function PedidosView() {
	const { user } = useAuth();
	const [pedidos, setPedidos] = useState<Pedido[]>([]);
	const [clientes, setClientes] = useState<Cliente[]>([]);
	const [loading, setLoading] = useState(true);
	const [creando, setCreando] = useState(false);
	const [verPedido, setVerPedido] = useState<Pedido | null>(null);
	const [filtroEstado, setFiltroEstado] = useState<EstadoPedido | "">("");

	async function recargar() {
		setLoading(true);
		const [p, c] = await Promise.all([listarPedidos(), listarClientes()]);
		setPedidos(p);
		setClientes(c);
		setLoading(false);
	}

	useEffect(() => {
		recargar();
	}, []);

	const visibles = filtroEstado ? pedidos.filter((p) => p.estado === filtroEstado) : pedidos;

	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
					<p className="text-sm text-muted">Registro y seguimiento de pedidos mayoristas.</p>
				</div>
				<Button onClick={() => setCreando(true)} disabled={clientes.length === 0}>
					<Plus className="h-4 w-4" /> Nuevo pedido
				</Button>
			</header>

			{clientes.length === 0 && !loading && (
				<p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
					Registra al menos un cliente antes de crear pedidos.
				</p>
			)}

			<div className="flex flex-wrap gap-2">
				<EstadoChip activo={filtroEstado === ""} onClick={() => setFiltroEstado("")}>
					Todos ({pedidos.length})
				</EstadoChip>
				{(Object.keys(ESTADOS) as EstadoPedido[]).map((e) => {
					const n = pedidos.filter((p) => p.estado === e).length;
					if (n === 0) return null;
					return (
						<EstadoChip key={e} activo={filtroEstado === e} onClick={() => setFiltroEstado(e)}>
							{ESTADOS[e].label} ({n})
						</EstadoChip>
					);
				})}
			</div>

			{loading ? (
				<Spinner />
			) : visibles.length === 0 ? (
				<EmptyState icon={<Package className="h-5 w-5" />} title="No hay pedidos" hint="Crea el primer pedido mayorista." />
			) : (
				<div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
					<table className="w-full text-sm">
						<thead className="border-b border-border bg-background text-left text-xs font-medium uppercase tracking-wide text-muted">
							<tr>
								<th className="px-4 py-3">Cliente</th>
								<th className="px-4 py-3">Ítems</th>
								<th className="px-4 py-3">Total</th>
								<th className="px-4 py-3">Estado</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody>
							{visibles.map((p) => (
								<tr
									key={p.id}
									className="cursor-pointer border-b border-border last:border-0 hover:bg-background"
									onClick={() => setVerPedido(p)}
								>
									<td className="px-4 py-3 font-medium">{p.clienteNombre}</td>
									<td className="px-4 py-3 text-muted">
										{p.items.reduce((a, it) => a + it.cantidad, 0)} und · {p.items.length} línea(s)
									</td>
									<td className="px-4 py-3 tabular-nums">{money(p.montoTotal)}</td>
									<td className="px-4 py-3">
										<Badge className={ESTADOS[p.estado].badge}>{ESTADOS[p.estado].label}</Badge>
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
				<PedidoForm
					clientes={clientes}
					vendedorUid={user!.uid}
					onClose={() => setCreando(false)}
					onSaved={async () => {
						setCreando(false);
						await recargar();
					}}
				/>
			)}

			{verPedido && (
				<PedidoDetalle
					pedido={verPedido}
					onClose={() => setVerPedido(null)}
					onChanged={async () => {
						setVerPedido(null);
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

// ----------------------- Formulario de nuevo pedido -----------------------

const ITEM_VACIO: ItemPedido = {
	producto: "",
	talla: "M",
	color: COLORES[0].nombre,
	cantidad: 1,
	precioUnitario: 0,
	subtotal: 0,
};

function PedidoForm({
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
	const [anticipo, setAnticipo] = useState("");
	const [fechaEntrega, setFechaEntrega] = useState("");
	const [notas, setNotas] = useState("");
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
		const ant = Number(anticipo || 0);
		if (ant < 0) e.anticipo = "El anticipo no puede ser negativo.";
		if (ant > montoTotal) e.anticipo = "El anticipo no puede superar el total.";
		if (fechaEntrega && fechaEntrega < hoy) e.fecha = "La fecha no puede ser anterior a hoy.";
		setErrors(e);
		return Object.keys(e).length === 0;
	}

	async function handleSubmit(ev: React.FormEvent) {
		ev.preventDefault();
		if (!validar()) return;
		setBusy(true);
		try {
			const cliente = clientes.find((c) => c.id === clienteId)!;
			await crearPedido(
				{
					clienteId,
					clienteNombre: cliente.razonSocial,
					items,
					anticipo: Number(anticipo || 0),
					fechaEntregaPactada: fechaEntrega || undefined,
					notas,
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
		<Modal title="Nuevo pedido" onClose={onClose} wide>
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
						<span className="text-sm font-medium">Productos del pedido</span>
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
					<Field label="Anticipo recibido" error={errors.anticipo} hint="Se confirma luego para pasar a producción.">
						<Input type="number" min={0} step="0.01" value={anticipo} onChange={(e) => setAnticipo(e.target.value)} />
					</Field>
					<Field label="Fecha de entrega pactada" error={errors.fecha}>
						<Input type="date" min={hoy} value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
					</Field>
				</div>

				<Field label="Notas / especificaciones adicionales">
					<Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
				</Field>

				<div className="flex items-center justify-between rounded-xl bg-primary-soft px-4 py-3">
					<span className="text-sm text-muted">Total del pedido</span>
					<span className="text-lg font-semibold text-primary">{money(montoTotal)}</span>
				</div>

				{errors._ && <p className="text-sm text-red-600">{errors._}</p>}

				<div className="flex justify-end gap-2 border-t border-border pt-4">
					<Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
					<Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Registrar pedido"}</Button>
				</div>
			</form>
		</Modal>
	);
}

// --------------------------- Detalle del pedido ---------------------------

function PedidoDetalle({ pedido, onClose, onChanged }: { pedido: Pedido; onClose: () => void; onChanged: () => void }) {
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

	const SIGUIENTE: Partial<Record<EstadoPedido, EstadoPedido>> = {
		en_produccion: "control_calidad",
		control_calidad: "listo_entrega",
		listo_entrega: "entregado",
	};
	const siguiente = SIGUIENTE[pedido.estado];

	return (
		<Modal title="Detalle del pedido" onClose={onClose} wide>
			<div className="flex flex-col gap-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="text-lg font-semibold">{pedido.clienteNombre}</p>
						{pedido.fechaEntregaPactada && (
							<p className="text-sm text-muted">Entrega pactada: {pedido.fechaEntregaPactada}</p>
						)}
					</div>
					<Badge className={ESTADOS[pedido.estado].badge}>{ESTADOS[pedido.estado].label}</Badge>
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
							{pedido.items.map((it, i) => (
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

				<div className="grid grid-cols-3 gap-3 text-sm">
					<Resumen etiqueta="Total" valor={money(pedido.montoTotal)} />
					<Resumen
							etiqueta="Anticipo"
							valor={money(pedido.anticipo)}
							sub={pedido.anticipo === 0 ? "Sin anticipo" : pedido.anticipoConfirmado ? "Confirmado" : "Por confirmar"}
						/>
					<Resumen etiqueta="Saldo" valor={money(pedido.saldo)} />
				</div>

				{pedido.notas && (
					<div className="rounded-xl border border-border bg-background p-3 text-sm">
						<span className="text-muted">Notas: </span>
						{pedido.notas}
					</div>
				)}

				{pedido.historial && pedido.historial.length > 0 && <Timeline historial={pedido.historial} />}

					<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
					<Button
						variant="danger"
						className="h-9 px-3"
						disabled={busy}
						onClick={() => {
							if (confirm("¿Eliminar este pedido?")) accion(() => eliminarPedido(pedido.id));
						}}
					>
						<Trash2 className="h-4 w-4" /> Eliminar
					</Button>

					<div className="flex flex-wrap gap-2">
						{pedido.estado === "pendiente_anticipo" && (
							<Button disabled={busy} onClick={() => accion(() => confirmarAnticipo(pedido.id))}>
								Confirmar anticipo → producción
							</Button>
						)}
						{siguiente && (
							<Button disabled={busy} onClick={() => accion(() => cambiarEstado(pedido.id, siguiente))}>
								Avanzar a: {ESTADOS[siguiente].label}
							</Button>
						)}
						{pedido.estado !== "entregado" && pedido.estado !== "cancelado" && (
							<Button variant="secondary" disabled={busy} onClick={() => accion(() => cambiarEstado(pedido.id, "cancelado", "Pedido cancelado."))}>
								Cancelar pedido
							</Button>
						)}
					</div>
				</div>
			</div>
		</Modal>
	);
}

// Línea de tiempo del seguimiento: una entrada por cada cambio de estado,
// de la más reciente a la más antigua (RF-21).
function Timeline({ historial }: { historial: HistorialEntry[] }) {
	const entradas = [...historial].reverse();
	return (
		<div>
			<p className="mb-3 flex items-center gap-2 text-sm font-medium">
				<History className="h-4 w-4 text-muted" /> Seguimiento del pedido
			</p>
			<ol className="flex flex-col">
				{entradas.map((h, i) => (
					<li key={i} className="flex gap-3">
						<div className="flex flex-col items-center">
							<span className={"mt-1 h-2.5 w-2.5 shrink-0 rounded-full " + (i === 0 ? "bg-primary" : "bg-border")} />
							{i < entradas.length - 1 && <span className="w-px flex-1 bg-border" />}
						</div>
						<div className="pb-4">
							<div className="flex flex-wrap items-center gap-2">
								<Badge className={ESTADOS[h.estado].badge}>{ESTADOS[h.estado].label}</Badge>
								<span className="text-xs text-muted">{formatFecha(h.fecha)}</span>
							</div>
							{h.nota && <p className="mt-1 text-xs text-muted">{h.nota}</p>}
						</div>
					</li>
				))}
			</ol>
		</div>
	);
}

function formatFecha(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString("es-PE", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function Resumen({ etiqueta, valor, sub }: { etiqueta: string; valor: string; sub?: string }) {
	return (
		<div className="rounded-xl border border-border bg-background p-3">
			<p className="text-xs text-muted">{etiqueta}</p>
			<p className="font-semibold tabular-nums">{valor}</p>
			{sub && <p className="text-xs text-muted">{sub}</p>}
		</div>
	);
}
