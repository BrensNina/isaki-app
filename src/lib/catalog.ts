// Catálogos del dominio (entidades TALLA y COLOR del informe). Para el prototipo
// se modelan como constantes en código en lugar de colecciones de Firestore:
// son listas estables y pequeñas, y así el formulario de pedidos funciona sin
// necesidad de sembrar datos. Si más adelante se requiere administrarlos desde
// la UI, se migran a colecciones sin tocar los formularios que los consumen.

import type { TipoCliente, TipoEntrega } from "./types";

/** Tallas disponibles (entidad TALLA). */
export const TALLAS = ["XS", "S", "M", "L", "XL", "XXL"] as const;

/** Colores disponibles (entidad COLOR) con su código hex para previsualización. */
export const COLORES: { nombre: string; hex: string }[] = [
	{ nombre: "Blanco", hex: "#ffffff" },
	{ nombre: "Negro", hex: "#111111" },
	{ nombre: "Gris", hex: "#9ca3af" },
	{ nombre: "Rojo", hex: "#dc2626" },
	{ nombre: "Azul", hex: "#2563eb" },
	{ nombre: "Azul marino", hex: "#1e3a8a" },
	{ nombre: "Verde", hex: "#16a34a" },
	{ nombre: "Amarillo", hex: "#facc15" },
	{ nombre: "Naranja", hex: "#ea580c" },
	{ nombre: "Celeste", hex: "#38bdf8" },
];

export const TIPO_CLIENTE_LABEL: Record<TipoCliente, string> = {
	natural: "Persona natural",
	juridico: "Persona jurídica / empresa",
};

export const TIPO_ENTREGA_LABEL: Record<TipoEntrega, string> = {
	local: "Entrega local (Lima)",
	agencia: "Envío a agencia (provincia)",
};

/** Departamentos del Perú, para el destino de envíos a provincia. */
export const DEPARTAMENTOS = [
	"Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca",
	"Callao", "Cusco", "Huancavelica", "Huánuco", "Ica", "Junín",
	"La Libertad", "Lambayeque", "Lima", "Loreto", "Madre de Dios", "Moquegua",
	"Pasco", "Piura", "Puno", "San Martín", "Tacna", "Tumbes", "Ucayali",
] as const;
