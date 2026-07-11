"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, History, Package, Paperclip, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listarClientes } from "@/lib/clientes";
import { eliminarAdjunto, subirAdjunto } from "@/lib/adjuntos";
import {
	calcularTotales,
	cambiarEstado,
	crearPedido,
	actualizarPedido,
	eliminarPedido,
	listarPedidos,
	reportarProgreso,
	aprobarPedidoAProduccion,
} from "@/lib/pedidos";
import { COLORES, TALLAS } from "@/lib/catalog";
import { ESTADOS, getEstadoMeta } from "@/lib/types";
import type { Adjunto, Cliente, EstadoPedido, HistorialEntry, ItemPedido, Pedido } from "@/lib/types";
import { Badge, Button, EmptyState, Field, Input, Modal, Select, Spinner, Textarea, money } from "./ui";

export default function PedidosView() {
	const { user, profile } = useAuth();
	const [pedidos, setPedidos] = useState<Pedido[]>([]);
	const [clientes, setClientes] = useState<Cliente[]>([]);
	const [loading, setLoading] = useState(true);
	const [creando, setCreando] = useState(false);
	const [editando, setEditando] = useState<Pedido | null>(null);
	const [verPedido, setVerPedido] = useState<Pedido | null>(null);
	const [filtroEstado, setFiltroEstado] = useState<EstadoPedido | "">("");
	const rol = profile?.rol ?? "vendedor";

	async function recargar() {
		setLoading(true);
		const [p, c] = await Promise.all([
			listarPedidos(user!.uid, profile!.rol).catch(() => [] as Pedido[]), 
			listarClientes(user!.uid, profile!.rol).catch(() => [] as Cliente[])
		]);
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
							{getEstadoMeta(e).label} ({n})
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
										<Badge className={getEstadoMeta(p.estado).badge}>{getEstadoMeta(p.estado).label}</Badge>
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
				<PedidoForm
					clientes={clientes}
					vendedorUid={user!.uid}
					inicial={editando || undefined}
					onClose={() => { setCreando(false); setEditando(null); }}
					onSaved={async () => {
						setCreando(false);
						setEditando(null);
						await recargar();
					}}
				/>
			)}

			{verPedido && (
				<PedidoDetalle
					pedido={verPedido}
					rol={rol}
					onClose={() => setVerPedido(null)}
					onEdit={() => {
						setEditando(verPedido);
						setVerPedido(null);
					}}
					onChanged={async () => {
						setVerPedido(null);
						await recargar();
					}}
					onRefresh={recargar}
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
	inicial,
	onClose,
	onSaved,
}: {
	clientes: Cliente[];
	vendedorUid: string;
	inicial?: Pedido;
	onClose: () => void;
	onSaved: () => void;
}) {
	const [clienteId, setClienteId] = useState(inicial?.clienteId || "");
	const [items, setItems] = useState<ItemPedido[]>(inicial ? inicial.items : [{ ...ITEM_VACIO }]);
	const [anticipo, setAnticipo] = useState(inicial ? String(inicial.anticipo) : "");
	const [fechaEntrega, setFechaEntrega] = useState(inicial?.fechaEntregaPactada || "");
	const [notas, setNotas] = useState(inicial?.notas || "");
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
			const data = {
				clienteId,
				clienteNombre: clientes.find((c) => c.id === clienteId)?.razonSocial || "Cliente Desconocido",
				items,
				anticipo: Number(anticipo || 0),
				fechaEntregaPactada: fechaEntrega || undefined,
				notas: notas.trim(),
			};
			if (inicial) {
				await actualizarPedido(inicial.id, data);
			} else {
				await crearPedido(data, vendedorUid);
			}
			onSaved();
		} catch (err) {
			setErrors({ _: err instanceof Error ? err.message : "No se pudo guardar." });
			setBusy(false);
		}
	}

	return (
		<Modal title={inicial ? "Editar pedido" : "Nuevo pedido"} onClose={onClose} wide>
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
					<span className="text-lg font-semibold text-foreground">{money(montoTotal)}</span>
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

function PedidoDetalle({ pedido, rol, onClose, onChanged, onEdit, onRefresh }: { pedido: Pedido; rol: string; onClose: () => void; onChanged: () => void; onEdit?: () => void; onRefresh?: () => void; }) {
	const [busy, setBusy] = useState(false);
	const [adjuntos, setAdjuntos] = useState<Adjunto[]>(pedido.adjuntos ?? []);
	const [subiendo, setSubiendo] = useState(false);
	const puedeAdjuntar = rol === "admin" || rol === "vendedor";

	async function accion(fn: () => Promise<void>) {
		setBusy(true);
		try {
			await fn();
			onChanged();
		} catch (e) {
			alert("No se pudo completar la acción: " + (e instanceof Error ? e.message : String(e)));
			setBusy(false);
		}
	}

	async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = ""; // permite re-subir el mismo archivo
		if (!file) return;
		if (file.size > 15 * 1024 * 1024) {
			alert("El archivo supera el límite de 15 MB.");
			return;
		}
		setSubiendo(true);
		try {
			const a = await subirAdjunto(pedido.id, file);
			setAdjuntos((prev) => [...prev, a]);
			onRefresh?.(); // refresca la lista del padre para que al reabrir el adjunto aparezca
		} catch {
			alert("No se pudo subir el archivo. Inténtalo de nuevo.");
		} finally {
			setSubiendo(false);
		}
	}

	async function handleQuitarAdjunto(a: Adjunto) {
		if (!confirm(`¿Quitar "${a.nombre}"?`)) return;
		await eliminarAdjunto(pedido.id, a);
		setAdjuntos((prev) => prev.filter((x) => x.path !== a.path));
		onRefresh?.();
	}

	const SIGUIENTE: Partial<Record<EstadoPedido, EstadoPedido>> = {
		pendiente_produccion: "en_produccion",
		en_produccion: "control_calidad",
		control_calidad: "listo_entrega",
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
					<div className="flex items-center gap-2">
						{onEdit && (rol === "admin" || (rol === "vendedor" && (pedido.estado === "registrado" || pedido.estado === "cotizado"))) && (
							<Button variant="secondary" className="h-8 px-3 text-xs" onClick={onEdit}>
								Editar
							</Button>
						)}
						<Badge className={getEstadoMeta(pedido.estado).badge}>{getEstadoMeta(pedido.estado).label}</Badge>
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

				{/* Archivos adjuntos (Cloudflare R2) */}
				<div>
					<div className="mb-2 flex items-center justify-between gap-2">
						<p className="flex items-center gap-2 text-sm font-medium">
							<Paperclip className="h-4 w-4 text-muted" /> Archivos adjuntos
						</p>
						{puedeAdjuntar && (
							<label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium transition hover:bg-background">
								{subiendo ? "Subiendo…" : "Adjuntar"}
								<input type="file" className="hidden" onChange={handleUpload} disabled={subiendo} />
							</label>
						)}
					</div>
					{adjuntos.length === 0 ? (
						<p className="text-sm text-muted">Sin archivos adjuntos.</p>
					) : (
						<ul className="flex flex-col gap-2">
							{adjuntos.map((a) => (
								<li key={a.path} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm">
									<a href={a.url} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-primary hover:underline">
										{a.nombre}
									</a>
									{puedeAdjuntar && (
										<button
											onClick={() => handleQuitarAdjunto(a)}
											className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
											aria-label="Quitar adjunto"
										>
											<X className="h-4 w-4" />
										</button>
									)}
								</li>
							))}
						</ul>
					)}
				</div>

				{pedido.historial && pedido.historial.length > 0 && <Timeline historial={pedido.historial} />}

					<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
					{(rol === "admin" || (rol === "vendedor" && pedido.estado === "registrado")) && (
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
					)}

					<div className="flex flex-wrap gap-2">
						{(rol === "admin" || rol === "vendedor") && pedido.estado === "registrado" && (
							<>
								<Button disabled={busy} variant="secondary" onClick={() => accion(() => cambiarEstado(pedido.id, "esperando_cotizacion", "Se solicitó cotización a administración."))}>
									Solicitar Cotización a Admin
								</Button>
								<Button disabled={busy} onClick={() => accion(() => aprobarPedidoAProduccion(pedido.id))}>
									Aprobar Directo a Producción
								</Button>
							</>
						)}
						{(rol === "admin" || rol === "vendedor") && pedido.estado === "cotizado" && (
							<Button disabled={busy} onClick={() => accion(() => aprobarPedidoAProduccion(pedido.id))}>
								Aprobar y Confirmar Anticipo
							</Button>
						)}

						{rol === "admin" && pedido.estado === "esperando_cotizacion" && (
							<Button disabled={busy} onClick={() => accion(() => cambiarEstado(pedido.id, "cotizado", "Cotización enviada al vendedor."))}>
								Enviar Cotización
							</Button>
						)}
						{rol === "admin" && pedido.estado === "listo_entrega" && (
							<Button disabled={busy} onClick={() => accion(() => cambiarEstado(pedido.id, "entregado", "Pedido entregado con éxito."))}>
								Marcar como Entregado
							</Button>
						)}

						{(rol === "produccion" || rol === "admin") && (
							<>
								{siguiente && (
									<Button disabled={busy} onClick={() => accion(() => cambiarEstado(pedido.id, siguiente))}>
										{pedido.estado === "pendiente_produccion" ? "Iniciar Producción" : 
										 pedido.estado === "en_produccion" ? "Finalizar (a Control Calidad)" :
										 `Aprobar Calidad (Listo para entrega)`}
									</Button>
								)}
								{pedido.estado === "en_produccion" && (
									<Button 
										variant="secondary"
										disabled={busy} 
										onClick={() => {
											const nota = prompt("Describe el avance (ej. 'Corte de tela finalizado', 'Pasando a bordado'):");
											if (nota) accion(() => reportarProgreso(pedido.id, nota));
										}}
									>
										Reportar Avance
									</Button>
								)}
							</>
						)}

						{rol === "admin" && pedido.estado !== "entregado" && pedido.estado !== "cancelado" && (
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
								<Badge className={getEstadoMeta(h.estado).badge}>{getEstadoMeta(h.estado).label}</Badge>
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
