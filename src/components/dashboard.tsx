"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import {
	CheckCircle2,
	Factory,
	LayoutDashboard,
	LogOut,
	Package,
	Settings,
	Users,
	Wallet,
	type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getDb } from "@/lib/firebase";
import { listarClientes } from "@/lib/clientes";
import { listarPedidos } from "@/lib/pedidos";
import { ROL_LABEL } from "@/lib/types";
import type { Rol } from "@/lib/types";
import ClientesView from "./clientes-view";
import PedidosView from "./pedidos-view";
import { Button, Card, Field, Input, Spinner, Textarea, money } from "./ui";

type Vista = "inicio" | "clientes" | "pedidos" | "perfil";

interface NavItem {
	id: Vista;
	label: string;
	icon: LucideIcon;
	roles: Rol[];
}

const NAV: NavItem[] = [
	{ id: "inicio", label: "Panel principal", icon: LayoutDashboard, roles: ["admin", "vendedor", "produccion", "cliente"] },
	{ id: "clientes", label: "Clientes", icon: Users, roles: ["admin", "vendedor"] },
	{ id: "pedidos", label: "Pedidos", icon: Package, roles: ["admin", "vendedor", "produccion"] },
	{ id: "perfil", label: "Mi cuenta", icon: Settings, roles: ["admin", "vendedor", "produccion", "cliente"] },
];

export default function Dashboard() {
	const { profile, logout } = useAuth();
	const rol = profile?.rol ?? "vendedor";
	const items = useMemo(() => NAV.filter((n) => n.roles.includes(rol)), [rol]);
	const [vista, setVista] = useState<Vista>("inicio");

	useEffect(() => {
		if (!items.some((i) => i.id === vista)) setVista("inicio");
	}, [items, vista]);

	const inicial = (profile?.displayName || profile?.email || "U").charAt(0).toUpperCase();

	return (
		<div className="min-h-screen md:grid md:grid-cols-[256px_1fr]">
			{/* Sidebar */}
			<aside className="flex flex-col border-b border-border bg-surface md:min-h-screen md:border-b-0 md:border-r">
				<div className="flex items-center gap-2.5 px-5 py-5">
					<div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
						IP
					</div>
					<div className="leading-tight">
						<p className="text-sm font-semibold">ISAKI.PERU</p>
						<p className="text-xs text-muted">Pedidos B2B</p>
					</div>
				</div>

				<nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
					{items.map((n) => {
						const Icon = n.icon;
						const active = vista === n.id;
						return (
							<button
								key={n.id}
								onClick={() => setVista(n.id)}
								className={
									"flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition " +
									(active
										? "bg-primary-soft text-primary"
										: "text-muted hover:bg-background hover:text-foreground")
								}
							>
								<Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
								{n.label}
							</button>
						);
					})}
				</nav>

				<div className="mt-auto hidden items-center gap-3 border-t border-border px-4 py-3 md:flex">
					<div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
						{inicial}
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium">{profile?.displayName || profile?.email}</p>
						<p className="text-xs text-muted">{ROL_LABEL[rol]}</p>
					</div>
					<button
						onClick={logout}
						className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-background hover:text-foreground"
						aria-label="Cerrar sesión"
						title="Cerrar sesión"
					>
						<LogOut className="h-4 w-4" />
					</button>
				</div>
			</aside>

			{/* Contenido */}
			<main className="p-5 sm:p-8">
				<div className="mx-auto max-w-5xl">
					{vista === "inicio" && <Inicio rol={rol} />}
					{vista === "clientes" && <ClientesView />}
					{vista === "pedidos" && <PedidosView />}
					{vista === "perfil" && <Perfil />}
				</div>
			</main>
		</div>
	);
}

// ------------------------------ Panel principal (KPIs) ------------------------------

function Inicio({ rol }: { rol: Rol }) {
	const { profile } = useAuth();
	const [loading, setLoading] = useState(true);
	const [kpis, setKpis] = useState({ total: 0, produccion: 0, entregados: 0, porCobrar: 0, clientes: 0 });

	useEffect(() => {
		(async () => {
			const [pedidos, clientes] = await Promise.all([listarPedidos(), listarClientes()]);
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
	const [bio, setBio] = useState("");
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		if (profile) {
			setDisplayName(profile.displayName ?? "");
			setBio(profile.bio ?? "");
		}
	}, [profile]);

	async function handleSave(e: React.FormEvent) {
		e.preventDefault();
		if (!user) return;
		setSaving(true);
		setSaved(false);
		await updateDoc(doc(getDb(), "users", user.uid), { displayName, bio, updatedAt: serverTimestamp() });
		await refreshProfile();
		setSaving(false);
		setSaved(true);
	}

	return (
		<div className="mx-auto flex max-w-md flex-col gap-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Mi cuenta</h1>
				<p className="text-sm text-muted">{user?.email} · {ROL_LABEL[profile?.rol ?? "vendedor"]}</p>
			</header>

			<Card>
				<form onSubmit={handleSave} className="flex flex-col gap-4">
					<Field label="Nombre">
						<Input value={displayName} onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }} />
					</Field>
					<Field label="Bio">
						<Textarea rows={3} value={bio} onChange={(e) => { setBio(e.target.value); setSaved(false); }} />
					</Field>
					<div className="flex items-center gap-3">
						<Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
						{saved && <span className="text-sm text-green-600">Guardado ✓</span>}
					</div>
				</form>
			</Card>
		</div>
	);
}
