// Modelo de dominio del sistema de gestión de pedidos mayoristas B2B
// (ISAKI.PERU / MAYTA SPORT). Estos tipos son la "forma" de los documentos
// almacenados en Firestore. No son tablas relacionales: las relaciones N:M
// (p. ej. las líneas de un pedido) se modelan embebidas en el documento.

/** Roles del sistema. Ver épica "Usuarios y Seguridad" (HU-01..HU-03). */
export type Rol = "admin" | "vendedor" | "produccion" | "cliente";

export const ROLES: Rol[] = ["admin", "vendedor", "produccion", "cliente"];

export const ROL_LABEL: Record<Rol, string> = {
	admin: "Administrador",
	vendedor: "Vendedor",
	produccion: "Producción",
	cliente: "Cliente mayorista",
};

// ----------------------------- Clientes -----------------------------

export type TipoCliente = "natural" | "juridico";
export type TipoEntrega = "local" | "agencia";

/**
 * Cliente mayorista (entidad CLIENTE + DIRECCION_ENVIO del informe, simplificadas
 * para el prototipo: la dirección principal se embebe en el propio cliente).
 * Un cliente es un registro comercial gestionado por el vendedor; no requiere
 * una cuenta de acceso propia.
 */
export interface Cliente {
	id: string;
	vendedorUid: string;
	razonSocial: string; // nombre completo o razón social (RF-02)
	tipoCliente: TipoCliente;
	dniRuc: string; // DNI o RUC (RF-03)
	telefono?: string;
	email?: string;
	// Dirección principal de envío (RF-03, RF-04)
	tipoEntrega: TipoEntrega;
	departamento?: string;
	direccion?: string;
	nombreReceptor?: string;
	dniReceptor?: string;
	notas?: string;
	createdBy?: string; // uid del vendedor que lo registró
	createdAt?: unknown;
	updatedAt?: unknown;
}

/** Datos que el formulario envía para crear/editar un cliente (sin metadatos). */
export type ClienteInput = Omit<
	Cliente,
	"id" | "createdBy" | "createdAt" | "updatedAt"
>;

// ----------------------------- Pedidos ------------------------------

/**
 * Estados del flujo de un pedido (entidad ESTADO_PEDIDO). El `orden` define la
 * secuencia y se usa para la cola de producción (HU-16).
 */
export type EstadoPedido =
	| "borrador"
	| "solicitado"
	| "cotizado"
	| "pendiente_anticipo"
	| "pendiente_produccion"
	| "en_produccion"
	| "control_calidad"
	| "listo_entrega"
	| "entregado"
	| "cancelado";

export interface EstadoMeta {
	label: string;
	orden: number;
	/** Clases Tailwind para el badge de estado. */
	badge: string;
}

export const ESTADOS: Record<EstadoPedido, EstadoMeta> = {
	borrador: { label: "Borrador", orden: 0, badge: "bg-slate-100 text-slate-600" },
	solicitado: { label: "Solicitado", orden: 1, badge: "bg-stone-50 text-stone-600" },
	cotizado: { label: "Esperando Aprobación", orden: 2, badge: "bg-cyan-50 text-cyan-700" },
	pendiente_anticipo: { label: "Pendiente de anticipo", orden: 3, badge: "bg-amber-50 text-amber-700" },
	pendiente_produccion: { label: "Cola de producción", orden: 4, badge: "bg-yellow-50 text-yellow-700" },
	en_produccion: { label: "En producción", orden: 5, badge: "bg-blue-50 text-blue-700" },
	control_calidad: { label: "Control de calidad", orden: 6, badge: "bg-indigo-50 text-indigo-700" },
	listo_entrega: { label: "Listo para entrega", orden: 7, badge: "bg-violet-50 text-violet-700" },
	entregado: { label: "Entregado", orden: 8, badge: "bg-green-50 text-green-700" },
	cancelado: { label: "Cancelado", orden: 9, badge: "bg-red-50 text-red-700" },
};

/**
 * Una entrada del historial de seguimiento del pedido (entidad SEGUIMIENTO_PEDIDO).
 * Cada transición de estado deja un registro con su fecha, para trazabilidad (RF-21).
 */
export interface HistorialEntry {
	estado: EstadoPedido;
	fecha: string; // ISO timestamp del momento del cambio
	nota?: string;
}

/** Una línea del pedido (entidad DETALLE_PEDIDO): producto + talla + color + cantidad. */
export interface ItemPedido {
	producto: string;
	talla: string;
	color: string;
	cantidad: number;
	precioUnitario: number;
	subtotal: number; // cantidad * precioUnitario (se recalcula al guardar)
}

/** Cabecera del pedido (entidad PEDIDO) con sus líneas embebidas. */
export interface Pedido {
	id: string;
	clienteId: string;
	clienteNombre: string; // denormalizado para listados rápidos
	vendedorUid: string;
	items: ItemPedido[];
	montoTotal: number;
	anticipo: number;
	anticipoConfirmado: boolean; // habilita el paso a producción (RF-10, RF-11)
	saldo: number; // montoTotal - anticipo
	fechaEntregaPactada?: string; // ISO yyyy-mm-dd (RF-12)
	estado: EstadoPedido;
	historial?: HistorialEntry[]; // trazabilidad de cambios de estado (RF-21)
	notas?: string;
	createdAt?: unknown;
	updatedAt?: unknown;
}

export type PedidoInput = {
	clienteId: string;
	clienteNombre: string;
	items: ItemPedido[];
	anticipo: number;
	fechaEntregaPactada?: string;
	notas?: string;
};

// ----------------------------- Cotizaciones ------------------------------

export type EstadoCotizacion =
	| "borrador"
	| "enviada"
	| "aprobada"
	| "rechazada"
	| "convertida";

export const ESTADOS_COTIZACION: Record<EstadoCotizacion, EstadoMeta> = {
	borrador: { label: "Borrador", orden: 0, badge: "bg-slate-100 text-slate-600" },
	enviada: { label: "Enviada", orden: 1, badge: "bg-blue-50 text-blue-700" },
	aprobada: { label: "Aprobada", orden: 2, badge: "bg-green-50 text-green-700" },
	rechazada: { label: "Rechazada", orden: 3, badge: "bg-red-50 text-red-700" },
	convertida: { label: "Convertida", orden: 4, badge: "bg-purple-50 text-purple-700" },
};

export interface Cotizacion {
	id: string;
	clienteId: string;
	clienteNombre: string;
	vendedorUid: string;
	items: ItemPedido[]; // Reutilizamos el mismo tipo de las líneas de pedido
	montoTotal: number;

	fechaEmision: string; // ISO yyyy-mm-dd
	fechaValidez: string; // ISO yyyy-mm-dd (Límite para que el cliente acepte)

	estado: EstadoCotizacion;
	notasCondiciones?: string; // Términos: "50% de adelanto, entrega local..."

	pedidoGeneradoId?: string; // Si el estado es "convertida", guarda el ID del pedido hijo.

	createdAt?: unknown;
	updatedAt?: unknown;
}

export type CotizacionInput = {
	clienteId: string;
	clienteNombre: string;
	items: ItemPedido[];
	fechaValidez: string;
	notasCondiciones?: string;
};
