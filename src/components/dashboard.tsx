"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import {
	Activity,
	Bell,
	CheckCircle2,
	Factory,
	FileText,
	LayoutDashboard,
	LogOut,
	Lock,
	Package,
	Settings,
	Shield,
	User,
	Users,
	Wallet,
	type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getDb } from "@/lib/firebase";
import Image from "next/image";
import { listarClientes } from "@/lib/clientes";
import { listarPedidos } from "@/lib/pedidos";
import { ROL_LABEL } from "@/lib/types";
import type { Rol } from "@/lib/types";
import ClientesView from "./clientes-view";
import PedidosView from "./pedidos-view";
import UsuariosView from "./usuarios-view";
import { Button, Card, Field, Input, Spinner, Textarea, money } from "./ui";

type Vista = "inicio" | "clientes" | "pedidos" | "usuarios" | "perfil";

interface NavItem {
	id: Vista;
	label: string;
	icon: LucideIcon;
	roles: Rol[];
}

const NAV: NavItem[] = [
	{ id: "inicio", label: "Panel principal", icon: LayoutDashboard, roles: ["admin"] },
	{ id: "clientes", label: "Clientes", icon: Users, roles: ["admin", "vendedor"] },
	{ id: "pedidos", label: "Pedidos", icon: Package, roles: ["admin", "vendedor", "produccion"] },
	{ id: "usuarios", label: "Personal", icon: Shield, roles: ["admin"] },
	{ id: "perfil", label: "Mi cuenta", icon: Settings, roles: ["admin", "vendedor", "produccion", "cliente"] },
];

export default function Dashboard() {
	const { profile, logout } = useAuth();
	const rol = profile?.rol ?? "vendedor";
	const items = useMemo(() => NAV.filter((n) => n.roles.includes(rol)), [rol]);
	const [vista, setVista] = useState<Vista>(rol === "admin" ? "inicio" : "pedidos");
	const [menuOpen, setMenuOpen] = useState(false);

	useEffect(() => {
		if (!items.some((i) => i.id === vista)) setVista(rol === "admin" ? "inicio" : "pedidos");
	}, [items, vista, rol]);

	const inicial = (profile?.displayName || profile?.email || "U").charAt(0).toUpperCase();

	return (
		<div className="flex min-h-screen flex-col bg-[#f8fafc] md:flex-row">
			{/* Sidebar (Desktop) / Topbar (Mobile) */}
			<aside className="flex flex-col bg-gradient-to-b from-[#fbb9ce] to-[#99ffff] shadow-[10px_0_30px_rgba(0,0,0,0.05)] md:w-[280px] md:shrink-0 md:rounded-r-[3rem] z-10">
				{/* Encabezado Logo */}
				<div className="flex h-20 items-center justify-between px-6 md:h-32 md:justify-center md:pt-8">
					<div className="relative h-14 w-36 md:h-[6rem] md:w-52">
						<Image 
							src="/logo.png" 
							alt="Isaki Logo" 
							fill 
							className="object-contain" 
						/>
					</div>
					<div className="md:hidden">
						{/* Perfil móvil (simplificado) */}
						<button onClick={() => setMenuOpen(!menuOpen)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/50 font-bold text-[#0f172a] shadow-sm">
							{inicial}
						</button>
					</div>
				</div>

				{/* Navegación */}
				<nav className="flex gap-2 overflow-x-auto px-4 py-3 md:mt-8 md:flex-col md:overflow-visible md:px-6">
					{items.map((n) => {
						const Icon = n.icon;
						const active = vista === n.id;
						return (
							<button
								key={n.id}
								onClick={() => setVista(n.id)}
								className={
									"flex items-center gap-3 whitespace-nowrap rounded-2xl px-5 py-3.5 text-[14px] font-bold transition-all md:text-[15px] " +
									(active
										? "bg-white/50 text-[#0f172a] shadow-sm"
										: "text-[#0f172a]/70 hover:bg-white/30 hover:text-[#0f172a]")
								}
							>
								<Icon className="h-[20px] w-[20px] shrink-0 md:h-[22px] md:w-[22px]" strokeWidth={2.5} />
								<span className="hidden sm:inline md:inline">{n.label}</span>
							</button>
						);
					})}
				</nav>
			</aside>

			{/* Contenido Principal */}
			<main className="flex flex-1 flex-col overflow-hidden">
				{/* Top Header (Solo Desktop) */}
				<header className="hidden h-28 items-center justify-between px-10 md:flex">
					{/* Barra de Navegación (Breadcrumbs) */}
					<div className="flex h-[3.25rem] w-auto min-w-[20rem] items-center rounded-full bg-[#e2e8f0]/80 px-6 shadow-inner">
						<span className="text-[14px] font-bold text-[#64748b]">Navegación</span>
						<span className="mx-3 text-[14px] font-bold text-[#94a3b8]">/</span>
						<span className="text-[14px] font-bold text-[#0f172a] capitalize">{vista}</span>
					</div>

					{/* Perfil Usuario (Derecha) */}
					<div className="relative">
						<button 
							onClick={() => setMenuOpen(!menuOpen)}
							className="flex items-center gap-4 rounded-full bg-[#e2e8f0]/60 p-1 pl-6 shadow-sm transition hover:bg-[#cbd5e1]/50"
						>
							<div className="flex flex-col items-end py-1 mr-1">
								<span className="text-sm font-semibold text-[#0f172a] leading-snug">
									{profile?.displayName || "Usuario"}
								</span>
								<span className="text-xs font-medium text-[#64748b] leading-none capitalize">
									{ROL_LABEL[rol]?.toLowerCase() || "Rol"}
								</span>
							</div>
							<div className="grid h-[3rem] w-[3rem] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#fbb9ce] to-[#99ffff] text-[15px] font-black text-[#0f172a] shadow-sm">
								{inicial}
							</div>
						</button>

						{/* Dropdown Menu */}
						{menuOpen && (
							<>
								<div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}></div>
								<div className="absolute right-0 top-full z-20 mt-3 w-52 rounded-[1.5rem] bg-white p-3 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.15)] border border-gray-100 text-center">
									<button
										onClick={() => { setVista("perfil"); setMenuOpen(false); }}
										className="block w-full py-3 text-[15px] font-bold text-[#0f172a] hover:bg-[#f8fafc] hover:text-[#0f172a] rounded-xl transition-colors"
									>
										Configuración
									</button>
									<button
										onClick={() => { logout(); setMenuOpen(false); }}
										className="block w-full py-3 text-[15px] font-bold text-[#0f172a] hover:bg-[#f8fafc] hover:text-[#fbb9ce] rounded-xl transition-colors"
									>
										Cerrar sesión
									</button>
								</div>
							</>
						)}
					</div>
				</header>

				{/* Menú desplegable móvil */}
				<div className="md:hidden">
					{menuOpen && (
						<div className="border-b border-gray-100 bg-white p-4 shadow-sm">
							<button onClick={() => { setVista("perfil"); setMenuOpen(false); }} className="block w-full py-3 text-center text-sm font-bold text-[#0f172a]">Configuración</button>
							<button onClick={() => { logout(); setMenuOpen(false); }} className="block w-full py-3 text-center text-sm font-bold text-[#0f172a]">Cerrar sesión</button>
						</div>
					)}
				</div>

				{/* Área de vistas */}
				<div className="flex-1 overflow-y-auto p-5 sm:p-10">
					<div className="mx-auto max-w-5xl">
						{vista === "inicio" && <Inicio rol={rol} />}
						{vista === "clientes" && <ClientesView />}
						{vista === "pedidos" && <PedidosView />}
						{vista === "usuarios" && <UsuariosView />}
						{vista === "perfil" && <Perfil />}
					</div>
				</div>
			</main>
		</div>
	);
}

// ------------------------------ Panel principal (KPIs) ------------------------------

function Inicio({ rol }: { rol: Rol }) {
	const { user, profile } = useAuth();
	const [loading, setLoading] = useState(true);
	const [kpis, setKpis] = useState({ total: 0, produccion: 0, entregados: 0, porCobrar: 0, clientes: 0 });

	useEffect(() => {
		(async () => {
			if (!user || !profile) return; // Esperar a que user y profile estén disponibles
			const [pedidos, clientes] = await Promise.all([
				listarPedidos(user.uid, profile.rol).catch(() => []),
				listarClientes(user.uid, profile.rol).catch(() => []),
			]);
			setKpis({
				total: pedidos.length,
				produccion: pedidos.filter((p) => ["en_produccion", "control_calidad"].includes(p.estado)).length,
				entregados: pedidos.filter((p) => p.estado === "entregado").length,
				porCobrar: pedidos.filter((p) => p.estado !== "cancelado").reduce((acc, p) => acc + (p.saldo || 0), 0),
				clientes: clientes.length,
			});
			setLoading(false);
		})();
	}, []);

	if (loading) return <Spinner />;

	return (
		<div className="flex flex-col gap-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">
					Hola, {profile?.displayName?.split(" ")[0] || "bienvenido"}
				</h1>
				<p className="text-sm text-muted">Resumen general · {ROL_LABEL[rol]}</p>
			</header>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Kpi etiqueta="Total de pedidos" valor={String(kpis.total)} icon={Package} />
				<Kpi etiqueta="En producción" valor={String(kpis.produccion)} icon={Factory} />
				<Kpi etiqueta="Entregados" valor={String(kpis.entregados)} icon={CheckCircle2} />
				<Kpi etiqueta="Saldo por cobrar" valor={money(kpis.porCobrar)} icon={Wallet} />
			</div>

			<Card>
				<p className="text-sm font-medium">Estado del prototipo</p>
				<p className="mt-1 text-sm text-muted">
					Módulos activos: <span className="font-medium text-foreground">Clientes</span> ({kpis.clientes}{" "}
					registrados), <span className="font-medium text-foreground">Pedidos</span> y{" "}
					<span className="font-medium text-foreground">Seguimiento de estados</span> (trazabilidad por pedido).
					Próximos: Producción, Entregas y Notificaciones.
				</p>
			</Card>
		</div>
	);
}

function Kpi({ etiqueta, valor, icon: Icon }: { etiqueta: string; valor: string; icon: LucideIcon }) {
	return (
		<Card className="flex items-center justify-between p-5">
			<div className="min-w-0">
				<p className="truncate text-sm text-muted">{etiqueta}</p>
				<p className="mt-1 text-2xl font-semibold tracking-tight">{valor}</p>
			</div>
			<div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
				<Icon className="h-5 w-5" strokeWidth={2} />
			</div>
		</Card>
	);
}

// ------------------------------ Mi cuenta (perfil) ------------------------------

function Perfil() {
	const { user, profile, refreshProfile } = useAuth();
	const [displayName, setDisplayName] = useState("");
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		if (profile) {
			setDisplayName(profile.displayName ?? "");
		}
	}, [profile]);

	async function handleSave(e: React.FormEvent) {
		e.preventDefault();
		if (!user) return;
		setSaving(true);
		setSaved(false);
		await updateDoc(doc(getDb(), "users", user.uid), { displayName, updatedAt: serverTimestamp() });
		await refreshProfile();
		setSaving(false);
		setSaved(true);
	}

	return (
		<div className="mx-auto flex max-w-5xl flex-col gap-8">
			<header>
				<h1 className="text-3xl font-bold tracking-tight text-[#0f172a]">Configuración de Cuenta</h1>
				<p className="mt-1 text-sm text-[#64748b]">Administra tu información personal y preferencias del entorno de trabajo.</p>
			</header>

			<div className="grid gap-6 md:grid-cols-2 lg:gap-8">
				{/* 1. Información Profesional */}
				<div className="flex flex-col gap-4">
					<Card>
						<div className="flex items-center gap-3 border-b border-border/50 p-5">
							<div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e2e8f0]/60 text-[#0f172a]">
								<User className="h-5 w-5" />
							</div>
							<div>
								<h2 className="text-lg font-bold text-[#0f172a]">Información Profesional</h2>
								<p className="text-xs font-medium text-[#64748b]">Tus datos de acceso y visualización.</p>
							</div>
						</div>
						<div className="p-5">
							<form onSubmit={handleSave} className="flex flex-col gap-5">
								<Field label="Nombre Completo">
									<Input 
										value={displayName} 
										onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }} 
										className="h-11 rounded-xl bg-[#f8fafc] border-gray-200"
									/>
								</Field>
								<div className="grid gap-5 sm:grid-cols-2">
									<Field label="Correo Electrónico">
										<Input value={user?.email || ""} readOnly className="h-11 rounded-xl bg-gray-100 text-gray-500 border-0 pointer-events-none" />
									</Field>
									<Field label="Nivel de Acceso">
										<div className="flex h-11 items-center px-2">
											<span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 ring-1 ring-inset ring-blue-700/10">
												{ROL_LABEL[profile?.rol ?? "vendedor"]}
											</span>
										</div>
									</Field>
								</div>
								<div className="mt-2 flex items-center gap-4 border-t border-border/50 pt-4">
									<Button type="submit" disabled={saving} className="h-10 rounded-xl bg-[#0f172a] text-white hover:bg-[#334155]">
										{saving ? "Guardando…" : "Guardar cambios"}
									</Button>
									{saved && <span className="text-sm font-semibold text-green-600">¡Actualizado!</span>}
								</div>
							</form>
						</div>
					</Card>
				</div>

				{/* 2. Preferencias del Entorno */}
				<div className="flex flex-col gap-4">
					<Card>
						<div className="flex items-center gap-3 border-b border-border/50 p-5">
							<div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e2e8f0]/60 text-[#0f172a]">
								<Settings className="h-5 w-5" />
							</div>
							<div>
								<h2 className="text-lg font-bold text-[#0f172a]">Preferencias del Entorno</h2>
								<p className="text-xs font-medium text-[#64748b]">Personaliza tu experiencia de uso.</p>
							</div>
						</div>
						<div className="flex flex-col gap-4 p-5">
							<div className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-[#f8fafc] p-4 transition hover:bg-gray-50">
								<div className="flex gap-4">
									<Bell className="mt-0.5 h-5 w-5 text-gray-400" />
									<div className="flex flex-col gap-0.5">
										<span className="text-sm font-bold text-[#0f172a]">Notificaciones de Pedidos</span>
										<span className="text-xs font-medium text-[#64748b]">Recibir alertas sobre cambios de estado.</span>
									</div>
								</div>
								<div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-[#99ffff] border-2 border-transparent transition-colors">
									<span className="inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
								</div>
							</div>

							<div className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-[#f8fafc] p-4 transition hover:bg-gray-50">
								<div className="flex gap-4">
									<LayoutDashboard className="mt-0.5 h-5 w-5 text-gray-400" />
									<div className="flex flex-col gap-0.5">
										<span className="text-sm font-bold text-[#0f172a]">Tablas Compactas</span>
										<span className="text-xs font-medium text-[#64748b]">Mostrar más información en listas reduciendo espacios.</span>
									</div>
								</div>
								<div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-gray-200 border-2 border-transparent transition-colors">
									<span className="inline-block h-5 w-5 translate-x-0 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
								</div>
							</div>
						</div>
					</Card>
				</div>

				{/* 3. Seguridad */}
				<div className="flex flex-col gap-4">
					<Card>
						<div className="flex items-center gap-3 border-b border-border/50 p-5">
							<div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600">
								<Lock className="h-5 w-5" />
							</div>
							<div>
								<h2 className="text-lg font-bold text-[#0f172a]">Seguridad de la Cuenta</h2>
								<p className="text-xs font-medium text-[#64748b]">Protege tu acceso al sistema corporativo.</p>
							</div>
						</div>
						<div className="flex flex-col items-start gap-4 p-5">
							<p className="text-sm text-[#475569]">
								Es recomendable rotar tu contraseña periódicamente para mantener la seguridad de los datos de la empresa.
							</p>
							<Button variant="secondary" className="h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#0f172a] font-bold border-0">
								Actualizar Contraseña
							</Button>
						</div>
					</Card>
				</div>

				{/* 4. Métricas Personales */}
				<div className="flex flex-col gap-4">
					<Card>
						<div className="flex items-center gap-3 border-b border-border/50 p-5">
							<div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#99ffff]/30 text-[#0f172a]">
								<Activity className="h-5 w-5" />
							</div>
							<div>
								<h2 className="text-lg font-bold text-[#0f172a]">Resumen de Actividad</h2>
								<p className="text-xs font-medium text-[#64748b]">Métricas rápidas de tu participación.</p>
							</div>
						</div>
						<div className="p-5">
							<div className="grid grid-cols-2 gap-4">
								<div className="flex flex-col gap-1 rounded-xl bg-gray-50 p-4 border border-gray-100">
									<span className="text-2xl font-black text-[#0f172a]">—</span>
									<span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Pedidos Creados</span>
								</div>
								<div className="flex flex-col gap-1 rounded-xl bg-gray-50 p-4 border border-gray-100">
									<span className="text-2xl font-black text-[#0f172a]">—</span>
									<span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Último Acceso</span>
								</div>
							</div>
						</div>
					</Card>
				</div>
			</div>
		</div>
	);
}
